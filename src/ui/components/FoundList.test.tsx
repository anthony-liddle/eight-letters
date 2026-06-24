import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FoundList } from './FoundList.tsx';
import { computeTier, findScore, type Puzzle } from '@/engine/index.ts';
import type { Theme } from '../useTheme.ts';

// A small hand-built puzzle: six set words across four lengths, plus one find on
// each off-page rung. reachableScore is the set points (the ladder denominator).
function makePuzzle(): Puzzle {
  const common = ['serenade', 'sea', 'near', 'dean', 'eased', 'erase'];
  const uncommon = ['sane'];
  const rare = ['sneer'];
  const mythic = ['denar'];
  const setPoints = common.reduce((s, w) => s + findScore(w, 'set'), 0); // 32
  return {
    sourceWord: 'serenade',
    letters: 'adeenrs',
    validationWords: new Set([...common, ...uncommon, ...rare, ...mythic]),
    commonWords: new Set(common),
    uncommonWords: new Set(uncommon),
    rareWords: new Set(rare),
    mythicWords: new Set(mythic),
    reachableScore: setPoints,
  };
}

function renderList(found: string[], theme: Theme = 'letterpress') {
  const puzzle = makePuzzle();
  const tier = computeTier(new Set(found), puzzle);
  return render(
    <FoundList
      puzzle={puzzle}
      found={found}
      tier={tier}
      theme={theme}
      onWordTap={() => {}}
    />,
  );
}

describe('FoundList totals summary', () => {
  it('shows one honest completion count, no legacy "in the set" counter', () => {
    renderList(['sea', 'near', 'sane', 'sneer', 'denar']);

    // The single completion count: set words found over findable.
    expect(screen.getByText(/2 of 6 words/i)).toBeInTheDocument();
    // The retired goal counter ("N of M in the set") is gone as a number.
    expect(screen.queryByText(/of \d+ in the set/i)).not.toBeInTheDocument();
  });

  it('counts each rarity rung with no denominator, ever', () => {
    renderList(['sea', 'near', 'sane', 'sneer', 'denar']);
    expect(screen.getByText(/1 uncommon/i)).toBeInTheDocument();
    expect(screen.getByText(/1 rare/i)).toBeInTheDocument();
    expect(screen.getByText(/1 mythic/i)).toBeInTheDocument();
    expect(screen.queryByText(/uncommon.*of/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rare.*of/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mythic.*of/i)).not.toBeInTheDocument();
  });

  it('shows the total words found, the points total, and the named tier', () => {
    // serenade (15) puts the score at 15 of 32 set points (~0.47), Press Run.
    renderList(['serenade', 'sane']);
    expect(screen.getByText(/2 words found/i)).toBeInTheDocument();
    const totals = screen.getByRole('region', { name: /words found/i });
    expect(within(totals).getByText('Press Run')).toBeInTheDocument();
    // serenade 15 (set) + sane 4 (uncommon: 4-letter is 3, plus the +1 bonus).
    expect(within(totals).getByText(/19 points/i)).toBeInTheDocument();
  });

  it('shows the completion crown in the totals once every word is found', () => {
    renderList(['serenade', 'sea', 'near', 'dean', 'eased', 'erase'], 'cute');
    expect(screen.getByText(/6 of 6 words/i)).toBeInTheDocument();
    const totals = screen.getByRole('region', { name: /words found/i });
    expect(within(totals).getByText('Peachy Keen Supreme')).toBeInTheDocument();
  });
});

describe('FoundList score composition', () => {
  it('names the set-versus-off-page points split from the single tier source', () => {
    // serenade is a set word (set points); sane is off-page (uncommon).
    const found = ['serenade', 'sane'];
    const tier = computeTier(new Set(found), makePuzzle());
    renderList(found);

    // The totals read the same setPoints/offPagePoints the bar reads, so they
    // cannot disagree: 15 set, 4 off-page (sane: 4-letter is 3, plus +1 uncommon).
    expect(tier.setPoints).toBe(15);
    expect(tier.offPagePoints).toBe(4);

    const breakdown = screen.getByRole('img', { name: /score breakdown/i });
    expect(breakdown).toHaveAccessibleName(/15 set/i);
    expect(breakdown).toHaveAccessibleName(/4 off-page/i);
    expect(screen.getByText(/set\s+15/i)).toBeInTheDocument();
    expect(screen.getByText(/off-page\s+4/i)).toBeInTheDocument();
  });
});

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

  it('labels off-page finds "also found" when a row has both a set and an off-page find', () => {
    // near (set) and sane (off-page) are both four letters.
    renderList(['near', 'sane']);
    const head = screen.getByRole('heading', { name: '4 letters' });
    const group = head.closest('section') as HTMLElement;

    // The quiet label frames the off-page list as outside the count.
    const label = within(group).getByText(/also found/i);
    expect(label).toBeInTheDocument();
    // It is not inside the counted set row.
    const setRow = group.querySelector('.found__words--set') as HTMLElement;
    expect(within(setRow).queryByText(/also found/i)).toBeNull();
  });

  it('shows no "also found" label on a clean set-only row', () => {
    // near is a 4-letter set word with no off-page find of that length.
    renderList(['near']);
    expect(screen.queryByText(/also found/i)).toBeNull();
  });

  it('shows no "also found" label on an off-page-only row', () => {
    // sane is a 4-letter off-page find with no set word found of that length.
    renderList(['sane']);
    expect(screen.queryByText(/also found/i)).toBeNull();
  });
});

describe('FoundList structure', () => {
  it('renders each word-length group as a section with a level-3 heading', () => {
    renderList(['serenade', 'sea', 'near', 'sneer']);
    const names = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(names).toContain('8 letters');
    expect(names).toContain('4 letters');
    expect(names).toContain('3 letters');
  });

  it('keeps every glossary mark filled and positive, the source crown intact', () => {
    const { container } = renderList(['serenade', 'sea', 'sane']);
    // set word: unbadged set mark; off-page: rung mark with inline points; the
    // source word keeps its crown mark. None reads as an empty slot.
    expect(
      container.querySelector('.found__word--source .mark--source'),
    ).toBeTruthy();
    expect(
      container.querySelector('.found__word--set .mark--set'),
    ).toBeTruthy();
    const off = container.querySelector('.found__word--uncommon');
    expect(off?.querySelector('.mark--uncommon')).toBeTruthy();
    expect(off?.textContent).toMatch(/\+\d/);
  });

  it('renders the legend as a distinct key, separated from the word list', () => {
    renderList(['sea']);
    const glossary = screen.getByRole('region', { name: /words found/i });
    const legend = glossary.querySelector('.legend');
    expect(legend).toBeTruthy();
    expect(
      within(legend as HTMLElement).getByText(/^key$/i),
    ).toBeInTheDocument();
    expect(
      within(legend as HTMLElement).getByText('source word'),
    ).toBeInTheDocument();
  });
});

describe('FoundList word tap', () => {
  it('renders each found word as a button that reports taps with its element', () => {
    const puzzle = makePuzzle();
    const onWordTap = vi.fn();
    render(
      <FoundList
        puzzle={puzzle}
        found={['sea']}
        tier={computeTier(new Set(['sea']), puzzle)}
        theme="letterpress"
        onWordTap={onWordTap}
      />,
    );
    const btn = screen.getByRole('button', { name: /sea, show definition/i });
    fireEvent.click(btn);
    expect(onWordTap).toHaveBeenCalledWith('sea', btn);
    expect(document.activeElement).toBe(btn);
  });
});
