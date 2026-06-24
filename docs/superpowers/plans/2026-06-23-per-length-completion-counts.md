# Per-Length Completion Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring back a per-length "X of Y" count on each glossary length row, denominated by the common set, so Bea can see how close she is to Peachy Keen Supreme broken down by word length.

**Architecture:** Restore the full-grid per-length logic that commit #40 (`12cdbe9`) removed, layered on top of #41's declutter. `FoundList.buildGroups` regains a `setTotalByLen` map built from `puzzle.commonWords` and renders a row for every length that has set words (union with found-word lengths). The per-length numerator is the count of found set/source words of that length (`setWords.length`); the denominator is the set words of that length. Both reconcile to `tier.setFound` / `tier.setTotal` because the source word is a member of `commonWords` and is already grouped into `setWords`.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, Vite. Single component (`FoundList.tsx`), its test file, and the group-head CSS.

## Global Constraints

- TDD: write the failing test first, watch it fail, implement, watch it pass.
- Conventional Commits. No em dashes anywhere, including commit messages and code comments.
- Plain and direct copy.
- Do NOT change: the top-level completion count, the totals split, the bar, the tier ladder, scoring, par, validation, or the calendar.
- Off-page finds (the rarity ladder) never get a denominator, per length or anywhere. Per-rung totals stay bare counts.
- Off-page finds of a length are shown as chips in that length's group but are never inside the "X of Y" set count.

---

### Task 1: Return per-length set counts as a full grid

**Files:**

- Modify: `src/ui/components/FoundList.tsx` (`Group` interface, `buildGroups`, group-head JSX)
- Modify: `src/index.css` (re-add `.found__groupcount`)
- Test: `src/ui/components/FoundList.test.tsx` (replace the "carry no count" block)

**Interfaces:**

- Consumes: `puzzle.commonWords: ReadonlySet<string>`, `tier.setFound`, `tier.setTotal` (already wired).
- Produces: `Group` gains `setTotal: number` (set words of this length) and `setFound: number` (found set/source words of this length). Group-head renders `{setFound} of {setTotal}` in a `.found__groupcount` span when `setTotal > 0`.

- [ ] **Step 1: Rewrite the per-length test block to assert the counts (failing)**

In `src/ui/components/FoundList.test.tsx`, replace the entire `describe('FoundList per-length groups carry no count', ...)` block with:

```tsx
describe('FoundList per-length set counts', () => {
  it('shows each length an "X of Y" denominated by the set words of that length', () => {
    // 4-letter set words: near, dean (2 in the set). near is found.
    renderList(['near', 'sane']);
    const head = screen.getByRole('heading', { name: '4 letters' });
    const group = head.closest('section') as HTMLElement;
    expect(within(group).getByText('1 of 2')).toBeInTheDocument();
  });

  it('counts only the set words of a length, never the off-page finds (come and cone)', () => {
    // near (set) and sane (off-page uncommon) are both four letters.
    renderList(['near', 'sane']);
    const head = screen.getByRole('heading', { name: '4 letters' });
    const group = head.closest('section') as HTMLElement;

    // The count is one of the two four-letter set words: sane is not counted.
    expect(within(group).getByText('1 of 2')).toBeInTheDocument();

    // The counted set row lists near, never the off-page sane.
    const setRow = group.querySelector('.found__words--set') as HTMLElement;
    expect(within(setRow).getByText('near')).toBeInTheDocument();
    expect(within(setRow).queryByText('sane')).toBeNull();

    // sane still shows in the length group, in the off-page row, outside the count.
    const offRow = group.querySelector('.found__words--offpage') as HTMLElement;
    expect(within(offRow).getByText('sane')).toBeInTheDocument();
  });

  it('makes the per-length set counts reconcile to the top-level completion count', () => {
    const found = ['near', 'sane', 'sea'];
    const { container } = renderList(found);
    const tier = computeTier(new Set(found), makePuzzle());

    const counts = [...container.querySelectorAll('.found__groupcount')].map(
      (el) => {
        const m = (el.textContent ?? '').match(/(\d+)\s+of\s+(\d+)/);
        return { x: Number(m![1]), y: Number(m![2]) };
      },
    );
    const sumX = counts.reduce((s, c) => s + c.x, 0);
    const sumY = counts.reduce((s, c) => s + c.y, 0);

    // Numerators sum to set words found; denominators sum to total set words.
    expect(sumX).toBe(tier.setFound); // near + sea = 2 (sane is off-page)
    expect(sumY).toBe(tier.setTotal); // 6
  });

  it('shows a row for a set length she has not cracked yet, reading 0 of Y', () => {
    // sea is three letters; the five-letter set words (eased, erase) are unfound.
    renderList(['sea']);
    const head = screen.getByRole('heading', { name: '5 letters' });
    const group = head.closest('section') as HTMLElement;
    expect(within(group).getByText('0 of 2')).toBeInTheDocument();
  });

  it('reads every row Y of Y once every common word is found', () => {
    const { container } = renderList([
      'serenade',
      'sea',
      'near',
      'dean',
      'eased',
      'erase',
    ]);
    expect(screen.getByText(/6 of 6 words/i)).toBeInTheDocument();
    for (const el of container.querySelectorAll('.found__groupcount')) {
      const m = (el.textContent ?? '').match(/(\d+)\s+of\s+(\d+)/);
      expect(m![1]).toBe(m![2]); // X equals Y on every length row
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/ui/components/FoundList.test.tsx`
Expected: FAIL (no `.found__groupcount` element, no "1 of 2" text).

- [ ] **Step 3: Restore the full-grid logic in `FoundList.tsx`**

Change the `Group` interface to:

```tsx
interface Group {
  length: number;
  /** Set words of this length (the "of Y"). */
  setTotal: number;
  /** Set words of this length that were found (the "X"). */
  setFound: number;
  /** Set and source finds of this length: the population the count describes. */
  setWords: Word[];
  /** Off-page finds of this length: shown, but never inside the set count. */
  offPageWords: Word[];
}
```

Change `buildGroups` to build the full grid:

```tsx
function buildGroups(puzzle: Puzzle, found: readonly string[]): Group[] {
  // Set words per length: the honest "of Y" denominator, the same set the
  // top-level completion count totals, just sliced by length.
  const setTotalByLen = new Map<number, number>();
  for (const w of puzzle.commonWords) {
    setTotalByLen.set(w.length, (setTotalByLen.get(w.length) ?? 0) + 1);
  }

  const foundByLen = new Map<number, Word[]>();
  for (const word of found) {
    const list = foundByLen.get(word.length) ?? [];
    // Score by the single rarity-aware path, so an off-page word's inline +N
    // shows the bonus Bea earned, matching the bar and the total.
    list.push({
      word,
      category: categorize(word, puzzle),
      score: findScore(word, classifyWord(word, puzzle)),
    });
    foundByLen.set(word.length, list);
  }

  // Every length with set words, plus any length she has off-page finds in:
  // the Spelling Bee style grid, so an uncracked set length still shows what is
  // missing. Longest first, the eight-letter word at the head of the glossary.
  const lengths = new Set<number>([
    ...setTotalByLen.keys(),
    ...foundByLen.keys(),
  ]);
  return [...lengths]
    .sort((a, b) => b - a)
    .map((length) => {
      const words = (foundByLen.get(length) ?? []).sort((a, b) =>
        a.word.localeCompare(b.word),
      );
      // The source word is a set word too, so it counts toward the set. Off-page
      // finds are split out so the "X of Y" set count never lists them.
      const setWords = words.filter((w) => !isLadder(w.category));
      const offPageWords = words.filter((w) => isLadder(w.category));
      return {
        length,
        setTotal: setTotalByLen.get(length) ?? 0,
        setFound: setWords.length,
        setWords,
        offPageWords,
      };
    });
}
```

In the group render, restore the count in the head (replace the no-count comment):

```tsx
<section className="found__group" key={g.length}>
  <div className="found__grouphead">
    <h3 className="found__grouplen">{g.length} letters</h3>
    {g.setTotal > 0 && (
      <span className="found__groupcount">
        {g.setFound} of {g.setTotal}
      </span>
    )}
  </div>
  {/* The count above describes the set list only. Off-page finds of
                the same length follow in their own list, never counted. */}
  {g.setWords.length > 0 && (
    <ul className="found__words found__words--set">
      {g.setWords.map(renderChip)}
    </ul>
  )}
  {g.offPageWords.length > 0 && (
    <ul className="found__words found__words--offpage">
      {g.offPageWords.map(renderChip)}
    </ul>
  )}
</section>
```

- [ ] **Step 4: Re-add the `.found__groupcount` style**

In `src/index.css`, immediately after the `.found__grouplen { ... }` rule, add:

```css
.found__groupcount {
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
```

- [ ] **Step 5: Run the FoundList tests to verify they pass**

Run: `pnpm vitest run src/ui/components/FoundList.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite, typecheck, and build**

Run: `pnpm run test` then `pnpm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/FoundList.tsx src/ui/components/FoundList.test.tsx src/index.css
git commit -m "feat(found-list): return per-length set completion counts"
```
