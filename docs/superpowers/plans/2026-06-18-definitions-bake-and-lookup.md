# Definitions Bake And Lookup Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every formable, findable word a short tappable definition, via a manual Wiktionary acquisition, a committed TSV, an offline build that emits per-puzzle bundles plus a measurement report, and a lazy cached lookup API.

**Architecture:** Two halves. Acquisition is a standalone manual script that touches the network and writes a committed TSV. The build is offline: it reads committed raw lists plus the TSV and emits per-puzzle JSON bundles, printing a report. A runtime `createDefinitionLookup(sourceWord)` lazily fetches one bundle and caches it, returning `null` for misses. It is the single seam the future tap UI depends on.

**Tech Stack:** TypeScript, Node (tsx for scripts), Vitest, Vite. pnpm.

## Global Constraints

- No em dashes anywhere, in code, comments, or docs.
- pnpm only. Conventional Commits. No Co-Authored-By lines.
- Nothing in the build path or tests may fetch. Only the acquisition and the vendoring scripts touch the network, and only when run by hand.
- No test hits the network. Use small fixtures.
- Word lists stay `.txt`, one word per line. Source-word etymology stays JSON and untouched. The definitions file is flat TSV, sorted by word, appendable.
- Short gloss length cap: 140 characters (`DEFINITION_MAX_LENGTH`).
- Wiktionary is CC BY-SA: carry attribution in provenance and keep it in the colophon.
- Minimum word length is 3 (`MIN_WORD_LENGTH`, already in `scripts/lib/config.ts`).
- Per-puzzle bundles are compact JSON `{ word: definition }`, written under `public/data/defs/<sourceword>.json`, same origin, out of the main bundle.

## File Structure

Create:

- `scripts/lib/formable.ts` plus `scripts/lib/formable.test.ts` (pure formability, mirrors `src/engine/formability.ts`).
- `scripts/lib/definitions.ts` plus `scripts/lib/definitions.test.ts` (pure: gloss shaping + TSV parse/serialize/merge).
- `scripts/lib/emit-definitions.ts` plus `scripts/lib/emit-definitions.test.ts` (pure: bundle building, coverage, size stats, shard projection).
- `scripts/vendor-lists.ts` (manual `pnpm data:vendor`: downloads + writes vendored raw lists and `PROVENANCE.md`).
- `scripts/acquire-definitions.ts` (manual `pnpm defs:acquire`).
- `scripts/data-raw/` (committed): `enable1.txt`, `scowl/<variant>-words.<size>`, `definitions.tsv`, `PROVENANCE.md`.
- `src/data/definitions.ts` plus `src/data/definitions.test.ts` (runtime lazy cached lookup).
- `public/data/defs/<sourceword>.json` (build output, committed).

Modify:

- `scripts/lib/wiktionary.ts`: refactor to a `firstSense` helper, export `extractDefinition`, add cached `fetchDefinitionJson`.
- `scripts/lib/sources.ts`: read vendored files, remove all network fetch/extract.
- `scripts/lib/config.ts`: remove `ENABLE_URL` and `SCOWL_TARBALL_URL`; add `DEFINITION_MAX_LENGTH`.
- `scripts/lib/util.ts`: add `DATA_RAW_DIR`; make `writeAsset` create the parent dir.
- `scripts/build-data.ts`: add the emit step and the measurement report.
- `package.json`: add `data:vendor` and `defs:acquire` scripts.
- `ATTRIBUTION.md` / colophon: confirm Wiktionary CC BY-SA surfaced for definitions.

---

### Task 1: Formable union helper (pure)

**Files:**

- Create: `scripts/lib/formable.ts`
- Test: `scripts/lib/formable.test.ts`

**Interfaces:**

- Consumes: `MIN_WORD_LENGTH` from `scripts/lib/config.ts`.
- Produces:
  - `letterCounts(word: string): Int8Array`
  - `canForm(rackCounts: Int8Array, word: string): boolean`
  - `formableWords(rack: string, words: Iterable<string>): string[]`
  - `formableUnion(racks: Iterable<string>, words: Iterable<string>): string[]` (sorted, deduped, length >= `MIN_WORD_LENGTH`)

- [ ] **Step 1: Write the failing test**

```ts
// scripts/lib/formable.test.ts
import { describe, expect, it } from 'vitest';
import { formableUnion, formableWords } from './formable.ts';

describe('formableWords', () => {
  it('keeps words length 3+ formable from the rack, drops the rest', () => {
    const enable = ['ad', 'sea', 'sneer', 'zebra', 'serene'];
    // "ad" too short; "zebra" needs a z; the rest form from serenade.
    expect(formableWords('serenade', enable)).toEqual([
      'sea',
      'sneer',
      'serene',
    ]);
  });
});

describe('formableUnion', () => {
  it('is the deduped, sorted union of every rack, length 3+', () => {
    const enable = ['ace', 'cab', 'bead', 'deed', 'zoo'];
    // racks: "abcdef" forms ace, cab; "abdeed" forms bead, deed (and ace? no c).
    const union = formableUnion(['abcdef', 'abdeed'], enable);
    expect(union).toEqual(['ace', 'bead', 'cab', 'deed']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/lib/formable.test.ts`
Expected: FAIL, cannot resolve `./formable.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/lib/formable.ts
// Build-time formability. Mirrors src/engine/formability.ts; kept local so the
// scripts have no dependency on the app's module graph.
import { MIN_WORD_LENGTH } from './config.ts';

const A = 'a'.charCodeAt(0);

/** Count of each letter a-z in a word. Index 0 is 'a'. Non-letters ignored. */
export function letterCounts(word: string): Int8Array {
  const counts = new Int8Array(26);
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i) - A;
    if (c >= 0 && c < 26) counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

/** True if `word` can be spelled from the rack, each tile used at most once. */
export function canForm(rackCounts: Int8Array, word: string): boolean {
  const need = letterCounts(word);
  for (let i = 0; i < 26; i++) {
    if ((need[i] as number) > (rackCounts[i] as number)) return false;
  }
  return true;
}

/** Words formable from one rack, length >= minimum. Input order preserved. */
export function formableWords(rack: string, words: Iterable<string>): string[] {
  const rackCounts = letterCounts(rack);
  const out: string[] = [];
  for (const w of words) {
    if (w.length >= MIN_WORD_LENGTH && canForm(rackCounts, w)) out.push(w);
  }
  return out;
}

/** The deduped, sorted union of formable words across every rack. */
export function formableUnion(
  racks: Iterable<string>,
  words: Iterable<string>,
): string[] {
  const list = [...words];
  const seen = new Set<string>();
  for (const rack of racks) {
    for (const w of formableWords(rack, list)) seen.add(w);
  }
  return [...seen].sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/lib/formable.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/formable.ts scripts/lib/formable.test.ts
git commit -m "feat(scripts): add build-time formable union helper"
```

---

### Task 2: Definition shaping and TSV (pure)

**Files:**

- Modify: `scripts/lib/wiktionary.ts` (refactor to `firstSense`, export `extractDefinition`)
- Modify: `scripts/lib/config.ts` (add `DEFINITION_MAX_LENGTH`)
- Create: `scripts/lib/definitions.ts`
- Test: `scripts/lib/definitions.test.ts`

**Interfaces:**

- Consumes: `firstSense(definitionJson: string | null): { pos: string | null; text: string } | null` and `extractDefinition` from `scripts/lib/wiktionary.ts`; `DEFINITION_MAX_LENGTH` from config.
- Produces:
  - `shapeDefinition(definitionJson: string | null, maxLength: number): string | null`
  - `parseDefinitions(tsv: string): Map<string, string>`
  - `serializeDefinitions(defs: Map<string, string>): string` (sorted by word, lines `word\tdef`, trailing newline)
  - `mergeDefinitions(existing: Map<string, string>, incoming: Map<string, string>): Map<string, string>`

- [ ] **Step 1: Refactor wiktionary.ts to expose a first-sense helper (no behavior change)**

In `scripts/lib/wiktionary.ts`, replace the existing `extractDefinition` with a `firstSense` helper plus a thin `extractDefinition` that preserves the current `"pos. text"` output the source-pool build relies on:

```ts
export interface FirstSense {
  pos: string | null;
  text: string;
}

/** The first usable English sense, cleaned to plain text. pos is lowercased. */
export function firstSense(definitionJson: string | null): FirstSense | null {
  if (!definitionJson) return null;
  let json: Record<string, RestDefinition[]>;
  try {
    json = JSON.parse(definitionJson);
  } catch {
    return null;
  }
  const en = json.en;
  if (!en?.length) return null;
  for (const sense of en) {
    const first = sense.definitions?.find((d) => d.definition?.trim());
    if (!first?.definition) continue;
    const text = cleanText(first.definition);
    if (!text) continue;
    return { pos: sense.partOfSpeech?.toLowerCase() ?? null, text };
  }
  return null;
}

/** Source-pool definition string: "pos. text" or just text. Unchanged shape. */
export function extractDefinition(
  definitionJson: string | null,
): string | null {
  const sense = firstSense(definitionJson);
  if (!sense) return null;
  return sense.pos ? `${sense.pos}. ${sense.text}` : sense.text;
}
```

Keep `cleanText`, `decodeEntities`, `RestDefinition`, and the rest as is. `enrichWord` still calls `extractDefinition`, so source-pool output is byte-identical.

- [ ] **Step 2: Add the length-cap constant**

In `scripts/lib/config.ts` add:

```ts
/** Short gloss length cap for tappable definitions. Roughly one sentence. */
export const DEFINITION_MAX_LENGTH = 140;
```

- [ ] **Step 3: Write the failing test**

```ts
// scripts/lib/definitions.test.ts
import { describe, expect, it } from 'vitest';
import {
  mergeDefinitions,
  parseDefinitions,
  serializeDefinitions,
  shapeDefinition,
} from './definitions.ts';

const multiSense = JSON.stringify({
  en: [
    {
      partOfSpeech: 'Noun',
      definitions: [
        { definition: 'A <b>domesticated</b> carnivorous mammal.' },
        { definition: 'A second, unwanted sense.' },
      ],
    },
    { partOfSpeech: 'Verb', definitions: [{ definition: 'to prowl.' }] },
  ],
});

describe('shapeDefinition', () => {
  it('reduces a multi-sense entry to one short plain gloss, markup stripped', () => {
    expect(shapeDefinition(multiSense, 140)).toBe(
      'noun. A domesticated carnivorous mammal.',
    );
  });

  it('truncates a long gloss at a word boundary within the cap', () => {
    const long = JSON.stringify({
      en: [
        {
          partOfSpeech: 'Noun',
          definitions: [{ definition: 'word '.repeat(60) }],
        },
      ],
    });
    const out = shapeDefinition(long, 40);
    expect(out).not.toBeNull();
    expect((out as string).length).toBeLessThanOrEqual(40);
    expect(out as string).not.toMatch(/wor$/); // no half words
  });

  it('returns null when there is no usable sense', () => {
    expect(shapeDefinition(null, 140)).toBeNull();
    expect(shapeDefinition('{"en":[]}', 140)).toBeNull();
  });
});

describe('TSV round-trip', () => {
  it('writes sorted lines and reads back the same map', () => {
    const map = new Map([
      ['zebra', 'a striped equine'],
      ['ace', 'a single pip card'],
    ]);
    const tsv = serializeDefinitions(map);
    expect(tsv).toBe('ace\ta single pip card\nzebra\ta striped equine\n');
    expect(parseDefinitions(tsv)).toEqual(map);
  });

  it('merges new entries, dedupes, and stays sorted', () => {
    const existing = parseDefinitions('ace\tone\nbead\ttwo\n');
    const incoming = parseDefinitions('bead\tupdated\ncab\tthree\n');
    const merged = serializeDefinitions(mergeDefinitions(existing, incoming));
    expect(merged).toBe('ace\tone\nbead\tupdated\ncab\tthree\n');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run scripts/lib/definitions.test.ts`
Expected: FAIL, cannot resolve `./definitions.ts`.

- [ ] **Step 5: Write minimal implementation**

```ts
// scripts/lib/definitions.ts
// Pure shaping and storage for short tappable definitions. No I/O, no network.
import { firstSense } from './wiktionary.ts';

/** Cut text to one sentence, then to a word boundary within budget. */
function capGloss(text: string, budget: number): string {
  const sentence = text.match(/^(.*?[.!?])(\s|$)/);
  let s = sentence?.[1] ?? text;
  if (s.length > budget) {
    const cut = s.slice(0, budget);
    const sp = cut.lastIndexOf(' ');
    s = sp > 0 ? cut.slice(0, sp) : cut;
  }
  return s.trim();
}

/** One primary sense as a short plain gloss within maxLength, markup stripped. */
export function shapeDefinition(
  definitionJson: string | null,
  maxLength: number,
): string | null {
  const sense = firstSense(definitionJson);
  if (!sense) return null;
  const prefix = sense.pos ? `${sense.pos}. ` : '';
  const budget = Math.max(1, maxLength - prefix.length);
  const gloss = capGloss(sense.text, budget);
  if (!gloss) return null;
  return `${prefix}${gloss}`;
}

/** Parse flat TSV (`word\tdefinition` per line) into a map. */
export function parseDefinitions(tsv: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of tsv.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab <= 0) continue;
    out.set(line.slice(0, tab), line.slice(tab + 1));
  }
  return out;
}

/** Serialize to flat TSV, sorted by word, with a trailing newline. */
export function serializeDefinitions(defs: Map<string, string>): string {
  const lines = [...defs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([word, def]) => `${word}\t${def}`);
  return lines.length ? `${lines.join('\n')}\n` : '';
}

/** Merge incoming into existing. Incoming wins on conflict. */
export function mergeDefinitions(
  existing: Map<string, string>,
  incoming: Map<string, string>,
): Map<string, string> {
  const out = new Map(existing);
  for (const [word, def] of incoming) out.set(word, def);
  return out;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run scripts/lib/definitions.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify the source-pool build path is unchanged**

Run: `pnpm vitest run scripts/`
Expected: PASS (no regressions from the wiktionary refactor).

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/wiktionary.ts scripts/lib/config.ts scripts/lib/definitions.ts scripts/lib/definitions.test.ts
git commit -m "feat(scripts): add definition shaping and TSV storage"
```

---

### Task 3: Emit bundles and report computation (pure)

**Files:**

- Create: `scripts/lib/emit-definitions.ts`
- Test: `scripts/lib/emit-definitions.test.ts`

**Interfaces:**

- Consumes: `formableWords` from `scripts/lib/formable.ts`.
- Produces:
  - `buildBundles(sourceWords: string[], enableWords: string[], defs: Map<string, string>): Map<string, Record<string, string>>`
  - `coverage(union: string[], defs: Map<string, string>): { union: number; defined: number; percent: number }`
  - `bundleStats(bundles: Map<string, Record<string, string>>): { count: number; combined: number; average: number; max: number }`
  - `shardProjection(definedWords: Iterable<[string, string]>): { combined: number; perShard: Record<string, number> }`
- Note: sizes are byte lengths of the compact JSON for each bundle or shard.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/lib/emit-definitions.test.ts
import { describe, expect, it } from 'vitest';
import {
  bundleStats,
  buildBundles,
  coverage,
  shardProjection,
} from './emit-definitions.ts';

const enable = ['ace', 'cab', 'bead', 'deed'];
const defs = new Map([
  ['ace', 'a single pip'],
  ['cab', 'a taxi'],
  ['bead', 'a small ball'],
  // "deed" intentionally has no definition.
]);

describe('buildBundles', () => {
  it('puts each formable defined word in every rack that can form it', () => {
    const bundles = buildBundles(['abcdef', 'abdeed'], enable, defs);
    // rack "abcdef": ace, cab (deed not formable, bead needs two... b e a d -> ok? no second d)
    expect(bundles.get('abcdef')).toEqual({
      ace: 'a single pip',
      cab: 'a taxi',
    });
    // rack "abdeed": bead and ace (a,c? no c) -> bead only; deed has no def.
    expect(bundles.get('abdeed')).toEqual({ bead: 'a small ball' });
  });

  it('omits words that have no definition', () => {
    const bundles = buildBundles(['deed'], enable, defs);
    expect(bundles.get('deed')).toEqual({});
  });
});

describe('coverage', () => {
  it('counts union words that have a definition', () => {
    expect(coverage(['ace', 'cab', 'deed'], defs)).toEqual({
      union: 3,
      defined: 2,
      percent: 67,
    });
  });
});

describe('bundleStats and shardProjection', () => {
  it('reports combined, average, and max bundle byte sizes', () => {
    const bundles = new Map([
      ['x', { ace: 'a single pip' }],
      ['y', { cab: 'a taxi' }],
    ]);
    const stats = bundleStats(bundles);
    expect(stats.count).toBe(2);
    expect(stats.combined).toBeGreaterThan(0);
    expect(stats.max).toBeGreaterThanOrEqual(stats.average);
  });

  it('projects per-first-letter shard sizes', () => {
    const shards = shardProjection(defs);
    expect(Object.keys(shards.perShard).sort()).toEqual(['a', 'b', 'c']);
    expect(shards.combined).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/lib/emit-definitions.test.ts`
Expected: FAIL, cannot resolve `./emit-definitions.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/lib/emit-definitions.ts
// Pure bundle building and report math for the offline build. No I/O.
import { formableWords } from './formable.ts';

const byteLength = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');

/** For each rack, the defined words formable from it, as a compact map. */
export function buildBundles(
  sourceWords: string[],
  enableWords: string[],
  defs: Map<string, string>,
): Map<string, Record<string, string>> {
  const bundles = new Map<string, Record<string, string>>();
  for (const rack of sourceWords) {
    const record: Record<string, string> = {};
    for (const word of formableWords(rack, enableWords)) {
      const def = defs.get(word);
      if (def !== undefined) record[word] = def;
    }
    bundles.set(rack, record);
  }
  return bundles;
}

/** How many union words carry a definition. */
export function coverage(
  union: string[],
  defs: Map<string, string>,
): { union: number; defined: number; percent: number } {
  const defined = union.filter((w) => defs.has(w)).length;
  const percent = union.length ? Math.round((defined / union.length) * 100) : 0;
  return { union: union.length, defined, percent };
}

/** Combined, average, and max single-bundle byte sizes. */
export function bundleStats(bundles: Map<string, Record<string, string>>): {
  count: number;
  combined: number;
  average: number;
  max: number;
} {
  const sizes = [...bundles.values()].map(byteLength);
  const combined = sizes.reduce((a, b) => a + b, 0);
  const max = sizes.reduce((a, b) => Math.max(a, b), 0);
  const average = sizes.length ? Math.round(combined / sizes.length) : 0;
  return { count: sizes.length, combined, average, max };
}

/** First-letter shard projection: one map per leading letter. */
export function shardProjection(definedWords: Iterable<[string, string]>): {
  combined: number;
  perShard: Record<string, number>;
} {
  const shards = new Map<string, Record<string, string>>();
  for (const [word, def] of definedWords) {
    const letter = word[0] ?? '_';
    const shard = shards.get(letter) ?? {};
    shard[word] = def;
    shards.set(letter, shard);
  }
  const perShard: Record<string, number> = {};
  let combined = 0;
  for (const [letter, shard] of shards) {
    const size = byteLength(shard);
    perShard[letter] = size;
    combined += size;
  }
  return { combined, perShard };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/lib/emit-definitions.test.ts`
Expected: PASS. If the `buildBundles` formability comments in the test prove wrong against real letter math, fix the expected values to match `formableWords`, not the other way round.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/emit-definitions.ts scripts/lib/emit-definitions.test.ts
git commit -m "feat(scripts): add bundle emit and report computation"
```

---

### Task 4: Runtime lazy lookup API

**Files:**

- Create: `src/data/definitions.ts`
- Test: `src/data/definitions.test.ts`

**Interfaces:**

- Produces: `createDefinitionLookup(sourceWord: string): { getDefinition(word: string): Promise<string | null> }`.
- Behavior: fetches `${import.meta.env.BASE_URL}data/defs/<sourceWord>.json` at most once (lazy on first lookup, cached after), same origin. A 404 or parse failure resolves the bundle to `{}` so every word becomes `null`. Never loads another puzzle's bundle.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/definitions.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefinitionLookup } from './definitions.ts';

function mockFetch(bundles: Record<string, Record<string, string>>) {
  return vi.fn(async (url: string) => {
    const match = url.match(/data\/defs\/([a-z]+)\.json$/);
    const word = match?.[1] ?? '';
    const bundle = bundles[word];
    if (!bundle) return { ok: false, status: 404 } as Response;
    return {
      ok: true,
      status: 200,
      json: async () => bundle,
    } as unknown as Response;
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('createDefinitionLookup', () => {
  it('returns the definition for a present word and null for an absent one', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ audience: { sea: 'a body of salt water' } }),
    );
    const lookup = createDefinitionLookup('audience');
    expect(await lookup.getDefinition('sea')).toBe('a body of salt water');
    expect(await lookup.getDefinition('xyz')).toBeNull();
  });

  it('loads the bundle at most once across repeated lookups', async () => {
    const fetchSpy = mockFetch({ audience: { sea: 'a body of salt water' } });
    vi.stubGlobal('fetch', fetchSpy);
    const lookup = createDefinitionLookup('audience');
    await Promise.all([
      lookup.getDefinition('sea'),
      lookup.getDefinition('sea'),
    ]);
    await lookup.getDefinition('sea');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not load a bundle for an unrelated puzzle', async () => {
    const fetchSpy = mockFetch({ audience: {}, password: {} });
    vi.stubGlobal('fetch', fetchSpy);
    const lookup = createDefinitionLookup('audience');
    await lookup.getDefinition('sea');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0] as string).toContain('audience.json');
    expect(fetchSpy.mock.calls[0]?.[0] as string).not.toContain(
      'password.json',
    );
  });

  it('resolves every word to null when the bundle is missing', async () => {
    vi.stubGlobal('fetch', mockFetch({}));
    const lookup = createDefinitionLookup('missing');
    expect(await lookup.getDefinition('sea')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/data/definitions.test.ts`
Expected: FAIL, cannot resolve `./definitions.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/data/definitions.ts
// The single seam between stored definitions and the UI. Lazy, cached, same
// origin. The storage shape behind it (per-puzzle bundles today) can change
// without touching callers.

export interface DefinitionLookup {
  getDefinition(word: string): Promise<string | null>;
}

type Bundle = Record<string, string>;

function bundleUrl(sourceWord: string): string {
  return `${import.meta.env.BASE_URL}data/defs/${sourceWord}.json`;
}

async function fetchBundle(sourceWord: string): Promise<Bundle> {
  try {
    const res = await fetch(bundleUrl(sourceWord));
    if (!res.ok) return {};
    return (await res.json()) as Bundle;
  } catch {
    return {};
  }
}

/**
 * Lookup for one puzzle. The bundle loads on first lookup and is cached, so a
 * session loads exactly the definitions for its rack and nothing else. Missing
 * words resolve to null for a graceful no definition state.
 */
export function createDefinitionLookup(sourceWord: string): DefinitionLookup {
  let pending: Promise<Bundle> | null = null;
  const load = (): Promise<Bundle> => {
    if (!pending) pending = fetchBundle(sourceWord);
    return pending;
  };
  return {
    async getDefinition(word: string): Promise<string | null> {
      const bundle = await load();
      return bundle[word] ?? null;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/data/definitions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/definitions.ts src/data/definitions.test.ts
git commit -m "feat(data): add lazy cached definition lookup API"
```

---

### Task 5: Cached single-definition fetch (network helper, not run in build/tests)

**Files:**

- Modify: `scripts/lib/wiktionary.ts` (add `fetchDefinitionJson`)

**Interfaces:**

- Produces: `fetchDefinitionJson(word: string): Promise<string | null>` (cached raw REST definition JSON, or null on miss). Reuses `fetchText`, `HEADERS`, `sleep`, and the disk cache.
- Note: this is exercised only by the manual acquisition script. No unit test (it is network I/O); its output feeds `shapeDefinition`, which is already tested.

- [ ] **Step 1: Add the cached definition-only fetch**

In `scripts/lib/wiktionary.ts`, add (reusing the existing `readCacheJson`, `writeCacheJson`, `fetchText`, `sleep`, `HEADERS`, and `REQUEST_DELAY_MS`):

```ts
interface RawDefinition {
  definitionJson: string | null;
}

/**
 * Raw REST definition JSON for one word, cached on disk under a definitions-only
 * key so it does not collide with the source-pool etymology cache. A cached null
 * (a throttled miss) is re-fetched rather than trusted, so a busy run never
 * poisons the cache permanently. Network: acquisition only.
 */
export async function fetchDefinitionJson(
  word: string,
): Promise<string | null> {
  const cacheKey = `wiktionary-defs/${word}.json`;
  let cached = await readCacheJson<RawDefinition>(cacheKey);
  if (!cached || cached.definitionJson === null) {
    const enc = encodeURIComponent(word);
    let definitionJson: string | null;
    try {
      definitionJson = await fetchText(
        `https://en.wiktionary.org/api/rest_v1/page/definition/${enc}`,
        { headers: HEADERS },
      );
    } catch {
      definitionJson = null;
    }
    await sleep(REQUEST_DELAY_MS);
    cached = { definitionJson };
    if (definitionJson !== null) await writeCacheJson(cacheKey, cached);
  }
  return cached.definitionJson;
}
```

Ensure `readCacheJson`, `writeCacheJson` are imported in this file (the source-pool path already imports them).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/wiktionary.ts
git commit -m "feat(scripts): add cached single-definition Wiktionary fetch"
```

---

### Task 6: Vendor the raw lists and make the build offline

**Files:**

- Modify: `scripts/lib/util.ts` (add `DATA_RAW_DIR`; make `writeAsset` create the parent dir)
- Modify: `scripts/lib/config.ts` (remove `ENABLE_URL`, `SCOWL_TARBALL_URL`)
- Modify: `scripts/lib/sources.ts` (read vendored files, remove all network and tar usage)
- Create: `scripts/vendor-lists.ts`
- Modify: `package.json` (add `data:vendor`)
- Create (by running the script): `scripts/data-raw/enable1.txt`, `scripts/data-raw/scowl/*`, `scripts/data-raw/PROVENANCE.md`

**Interfaces:**

- Consumes: `SCOWL_VARIANTS`, `SIZE_95_SIZES`, `COMMON_POOL_SIZES`, `SOURCE_POOL_SIZES`, `MIN_WORD_LENGTH`, `SOURCE_WORD_LENGTH` from config (unchanged); `DATA_RAW_DIR` from util.
- Produces: `loadEnable()`, `loadScowlWords(sizes)`, `loadCommonPool()`, `loadSourceCandidates()` keep their existing signatures in `sources.ts` but now read `scripts/data-raw/` with zero network.

- [ ] **Step 1: Add `DATA_RAW_DIR` and fix `writeAsset` to create subdirs**

In `scripts/lib/util.ts`:

```ts
export const DATA_RAW_DIR = join(REPO_ROOT, 'scripts', 'data-raw');
```

and change `writeAsset` to ensure the parent directory (so `defs/<word>.json` works):

```ts
export async function writeAsset(
  name: string,
  contents: string,
): Promise<void> {
  const full = join(ASSET_DIR, name);
  await ensureDir(dirname(full));
  await writeFile(full, contents, 'utf8');
}
```

(`dirname` is already imported in util.ts.)

- [ ] **Step 2: Write the vendoring script**

```ts
// scripts/vendor-lists.ts
// Manual, network-touching, one-time. Downloads the raw ENABLE list and the
// SCOWL tarball, writes the lists the offline build reads into scripts/data-raw,
// and records provenance. Run by hand:  pnpm data:vendor
// Never called by the build, CI, or tests.
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { SCOWL_VARIANTS, SIZE_95_SIZES } from './lib/config.ts';
import { CACHE_DIR, DATA_RAW_DIR, ensureDir, fetchText } from './lib/util.ts';

const execFileAsync = promisify(execFile);

const ENABLE_URL =
  'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt';
const SCOWL_VERSION = '2020.12.07';
const SCOWL_TARBALL_URL = `https://downloads.sourceforge.net/project/wordlist/SCOWL/${SCOWL_VERSION}/scowl-${SCOWL_VERSION}.tar.gz`;

async function vendorEnable(): Promise<void> {
  const raw = await fetchText(ENABLE_URL);
  await writeFile(join(DATA_RAW_DIR, 'enable1.txt'), raw, 'utf8');
}

async function vendorScowl(): Promise<void> {
  await ensureDir(CACHE_DIR);
  const tarball = join(CACHE_DIR, 'scowl.tar.gz');
  const extractRoot = join(CACHE_DIR, 'scowl');
  const res = await fetch(SCOWL_TARBALL_URL);
  if (!res.ok) throw new Error(`SCOWL download failed: HTTP ${res.status}`);
  await writeFile(tarball, Buffer.from(await res.arrayBuffer()));
  await ensureDir(extractRoot);
  await execFileAsync('tar', [
    'xzf',
    tarball,
    '-C',
    extractRoot,
    '--strip-components=1',
  ]);
  const outDir = join(DATA_RAW_DIR, 'scowl');
  await ensureDir(outDir);
  for (const variant of SCOWL_VARIANTS) {
    for (const size of SIZE_95_SIZES) {
      const name = `${variant}-words.${size}`;
      try {
        const band = await readFile(join(extractRoot, 'final', name), 'latin1');
        await writeFile(join(outDir, name), band, 'latin1');
      } catch {
        // Some variant/size combinations do not exist. Skip quietly.
      }
    }
  }
}

async function writeProvenance(): Promise<void> {
  const note = [
    '# Vendored word list provenance',
    '',
    'These raw lists are committed so the build is fully offline and reproducible.',
    'ENABLE2K and SCOWL v1 are frozen, so reading these local files is safe forever.',
    'Refresh them only by re-running:  pnpm data:vendor',
    '',
    '## ENABLE',
    '',
    `- Source: ${ENABLE_URL}`,
    '- License: public domain.',
    `- Vendored: ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '## SCOWL',
    '',
    `- Source: ${SCOWL_TARBALL_URL}`,
    `- Version: ${SCOWL_VERSION}.`,
    '- License: permissive (Kevin Atkinson). See ATTRIBUTION.md.',
    `- Vendored bands: ${SCOWL_VARIANTS.join(', ')} at sizes ${SIZE_95_SIZES.join(', ')}.`,
    `- Vendored: ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '## Wiktionary (definitions and etymology)',
    '',
    '- Definitions in definitions.tsv and source-pool etymology come from Wiktionary.',
    '- License: CC BY-SA 4.0. Attribution carried here and surfaced in the colophon.',
    '',
  ].join('\n');
  await writeFile(join(DATA_RAW_DIR, 'PROVENANCE.md'), note, 'utf8');
}

async function main(): Promise<void> {
  await ensureDir(DATA_RAW_DIR);
  console.log('Vendoring ENABLE.');
  await vendorEnable();
  console.log('Vendoring SCOWL bands.');
  await vendorScowl();
  await writeProvenance();
  console.log('Done. Wrote scripts/data-raw/.');
}

main().catch((err) => {
  console.error('Vendoring failed:', err);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Point `sources.ts` at the vendored files and remove the network**

Rewrite `scripts/lib/sources.ts` so `loadEnable` reads `scripts/data-raw/enable1.txt` and `readBand` reads `scripts/data-raw/scowl/<variant>-words.<size>`. Remove `scowlExtractDir`, the `execFile`/`promisify` imports, the `fetch`/`fetchText` import, and the `ENABLE_URL`/`SCOWL_TARBALL_URL` imports. Keep `normalize`, `fileExists`, and the public signatures.

```ts
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  COMMON_POOL_SIZES,
  MIN_WORD_LENGTH,
  SCOWL_VARIANTS,
  SOURCE_POOL_SIZES,
  SOURCE_WORD_LENGTH,
} from './config.ts';
import { DATA_RAW_DIR } from './util.ts';

/** Lowercase, ASCII a-z only. Drops accents, apostrophes, proper-noun casing. */
function normalize(word: string): string | null {
  const w = word.trim().toLowerCase();
  return /^[a-z]+$/.test(w) ? w : null;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** ENABLE: the full validation set. Read from the vendored raw list. */
export async function loadEnable(): Promise<string[]> {
  const raw = await readFile(join(DATA_RAW_DIR, 'enable1.txt'), 'utf8');
  const words = new Set<string>();
  for (const line of raw.split('\n')) {
    const w = normalize(line);
    if (w && w.length >= MIN_WORD_LENGTH) words.add(w);
  }
  return [...words].sort();
}

async function readBand(variant: string, size: number): Promise<string[]> {
  const path = join(DATA_RAW_DIR, 'scowl', `${variant}-words.${size}`);
  if (!(await fileExists(path))) return [];
  const raw = await readFile(path, 'latin1'); // SCOWL final lists are latin1.
  const out: string[] = [];
  for (const line of raw.split('\n')) {
    const w = normalize(line);
    if (w) out.push(w);
  }
  return out;
}

/** Union of the given SCOWL bands across variants, deduped, length >= minimum. */
export async function loadScowlWords(
  sizes: readonly number[],
): Promise<string[]> {
  const words = new Set<string>();
  for (const variant of SCOWL_VARIANTS) {
    for (const size of sizes) {
      for (const w of await readBand(variant, size)) {
        if (w.length >= MIN_WORD_LENGTH) words.add(w);
      }
    }
  }
  return [...words].sort();
}

/** The common pool: the tier denominator source. */
export function loadCommonPool(): Promise<string[]> {
  return loadScowlWords(COMMON_POOL_SIZES);
}

/** Source-word candidates: SCOWL words from the tighter bands, exactly 8 letters. */
export async function loadSourceCandidates(): Promise<string[]> {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const size of SOURCE_POOL_SIZES) {
    for (const variant of SCOWL_VARIANTS) {
      for (const w of await readBand(variant, size)) {
        if (w.length === SOURCE_WORD_LENGTH && !seen.has(w)) {
          seen.add(w);
          ordered.push(w);
        }
      }
    }
  }
  return ordered;
}
```

- [ ] **Step 4: Remove the dead URLs from config**

In `scripts/lib/config.ts`, delete the `SCOWL_TARBALL_URL` and `ENABLE_URL` exports (now local to `vendor-lists.ts`). Leave every other constant.

- [ ] **Step 5: Add the vendor script to package.json**

In `package.json` scripts, add:

```json
"data:vendor": "tsx scripts/vendor-lists.ts",
```

- [ ] **Step 6: Run the vendor script (network, one time) and confirm the build is offline**

Run:

```bash
pnpm data:vendor
ls scripts/data-raw scripts/data-raw/scowl
pnpm typecheck
```

Expected: `scripts/data-raw/enable1.txt`, `scripts/data-raw/PROVENANCE.md`, and `scripts/data-raw/scowl/<variant>-words.<size>` exist; typecheck passes.

- [ ] **Step 7: Prove the build no longer touches the network**

Confirm there are no remaining fetch calls in the build path:

```bash
grep -rn "fetch\|http" scripts/lib/sources.ts scripts/build-data.ts
```

Expected: no matches in `sources.ts`; any matches in `build-data.ts` are unrelated to list loading (there should be none after Task 7). The only files mentioning network are `vendor-lists.ts`, `acquire-definitions.ts`, and `wiktionary.ts`.

- [ ] **Step 8: Commit (code and vendored data together)**

```bash
git add scripts/lib/util.ts scripts/lib/config.ts scripts/lib/sources.ts scripts/vendor-lists.ts package.json scripts/data-raw/
git commit -m "feat(scripts): vendor raw lists and make the build offline"
```

---

### Task 7: Wire the emit step and report into the build

**Files:**

- Modify: `scripts/build-data.ts`
- Modify: `scripts/lib/sources.ts` (add `loadDefinitions`)

**Interfaces:**

- Consumes: `buildBundles`, `coverage`, `bundleStats`, `shardProjection` from `emit-definitions.ts`; `formableUnion` from `formable.ts`; `parseDefinitions` from `definitions.ts`.
- Produces: `loadDefinitions(): Promise<Map<string, string>>` in `sources.ts` (reads `scripts/data-raw/definitions.tsv`, returns an empty map if the file is absent, so the build is green before acquisition has run).

- [ ] **Step 1: Add `loadDefinitions` to sources.ts**

Append to `scripts/lib/sources.ts`:

```ts
import { parseDefinitions } from './definitions.ts';

/** The committed short definitions, or an empty map if not acquired yet. */
export async function loadDefinitions(): Promise<Map<string, string>> {
  try {
    const raw = await readFile(join(DATA_RAW_DIR, 'definitions.tsv'), 'utf8');
    return parseDefinitions(raw);
  } catch {
    return new Map();
  }
}
```

- [ ] **Step 2: Add the emit step and report to build-data.ts**

After the `source-pool.json` is written (around the `meta` block), insert the emit step. Add imports at the top:

```ts
import { rm } from 'node:fs/promises';
import { join as joinPath } from 'node:path';
import { formableUnion } from './lib/formable.ts';
import {
  bundleStats,
  buildBundles,
  coverage,
  shardProjection,
} from './lib/emit-definitions.ts';
import { loadDefinitions } from './lib/sources.ts';
import { ASSET_DIR } from './lib/util.ts';
```

Then before the `meta` object is assembled, add:

```ts
console.log('Definitions: emitting per-puzzle bundles.');
const sourceWordsList = sourcePool.map((e) => e.word);
const defs = await loadDefinitions();
const union = formableUnion(sourceWordsList, enable);
const bundles = buildBundles(sourceWordsList, enable, defs);

const defsDir = joinPath(ASSET_DIR, 'defs');
await rm(defsDir, { recursive: true, force: true });
for (const [word, bundle] of bundles) {
  await writeAsset(`defs/${word}.json`, JSON.stringify(bundle));
}

const cov = coverage(union, defs);
const stats = bundleStats(bundles);
const definedEntries = union
  .filter((w) => defs.has(w))
  .map((w) => [w, defs.get(w) as string] as [string, string]);
const shards = shardProjection(definedEntries);
let tsvSize = 0;
try {
  const { stat } = await import('node:fs/promises');
  tsvSize = (await stat(joinPath(DATA_RAW_DIR, 'definitions.tsv'))).size;
} catch {
  tsvSize = 0;
}

console.log('\n=== Definitions measurement report ===');
console.log(
  `  Formable union: ${cov.union.toLocaleString()} words, ` +
    `${cov.defined.toLocaleString()} defined (${cov.percent}% coverage).`,
);
console.log(`  definitions.tsv size: ${tsvSize.toLocaleString()} bytes.`);
console.log(
  `  Per-puzzle bundles: ${stats.count} bundles, ` +
    `${stats.combined.toLocaleString()} bytes combined, ` +
    `avg ${stats.average.toLocaleString()}, max ${stats.max.toLocaleString()} ` +
    `(max is what one session loads).`,
);
console.log(
  `  First-letter shard projection: ${shards.combined.toLocaleString()} bytes ` +
    `combined across ${Object.keys(shards.perShard).length} shards.`,
);
const shardLine = Object.entries(shards.perShard)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([letter, size]) => `${letter}:${size}`)
  .join('  ');
console.log(`    ${shardLine}`);
console.log('======================================\n');
```

Add `DATA_RAW_DIR` to the existing `./lib/util.ts` import line. Ensure `enable` (the array) and `sourcePool` are in scope where this block runs (they are: `enable` from `loadEnable`, `sourcePool` built just above).

- [ ] **Step 3: Add the bundles to meta counts (optional but tidy)**

In the `meta.counts` object, add:

```ts
      definitionUnion: union.length,
      definitionsCovered: cov.defined,
```

- [ ] **Step 4: Run the offline build**

Run:

```bash
pnpm data:build
```

Expected: the build completes with no network errors, prints the measurement report (coverage will be 0% until acquisition has run, which is fine), and writes `public/data/defs/<word>.json` for every source word (bundles will be `{}` until acquisition runs).

- [ ] **Step 5: Typecheck and run the full offline test suite**

Run:

```bash
pnpm typecheck
pnpm test
```

Expected: PASS, no network.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-data.ts scripts/lib/sources.ts
git commit -m "feat(scripts): emit per-puzzle definition bundles and report"
```

---

### Task 8: Acquisition script (manual network run)

**Files:**

- Create: `scripts/acquire-definitions.ts`
- Modify: `package.json` (add `defs:acquire`)
- Create (by running, then committing): `scripts/data-raw/definitions.tsv`
- Update (by re-running the build): `public/data/defs/*.json`

**Interfaces:**

- Consumes: `loadEnable` from `sources.ts`; `formableUnion` from `formable.ts`; `fetchDefinitionJson` from `wiktionary.ts`; `shapeDefinition`, `parseDefinitions`, `serializeDefinitions`, `mergeDefinitions` from `definitions.ts`; `mapWithConcurrency`, `DATA_RAW_DIR` from `util.ts`; `DEFINITION_MAX_LENGTH` from `config.ts`.
- Produces: `scripts/data-raw/definitions.tsv` (sorted, merged, resumable). Source words are read from `public/data/source-pool.json`.

- [ ] **Step 1: Write the acquisition script**

```ts
// scripts/acquire-definitions.ts
// Manual, network-touching, occasional. Computes the union of every findable
// word across the shipped source words, fetches a short definition for each from
// Wiktionary (cached, rate limited), and writes the committed definitions.tsv.
// Idempotent and resumable: words already present are skipped, per-word REST
// responses are cached, and progress is flushed periodically.
//
//   pnpm defs:acquire
//
// Never called by the build, CI, or tests. Wiktionary is CC BY-SA; see
// scripts/data-raw/PROVENANCE.md and the colophon.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFINITION_MAX_LENGTH } from './lib/config.ts';
import {
  mergeDefinitions,
  parseDefinitions,
  serializeDefinitions,
  shapeDefinition,
} from './lib/definitions.ts';
import { formableUnion } from './lib/formable.ts';
import { loadEnable } from './lib/sources.ts';
import { ASSET_DIR, DATA_RAW_DIR, mapWithConcurrency } from './lib/util.ts';
import { fetchDefinitionJson } from './lib/wiktionary.ts';

const TSV_PATH = join(DATA_RAW_DIR, 'definitions.tsv');
const FLUSH_EVERY = 200;
const CONCURRENCY = 4;

async function loadExisting(): Promise<Map<string, string>> {
  try {
    return parseDefinitions(await readFile(TSV_PATH, 'utf8'));
  } catch {
    return new Map();
  }
}

async function loadSourceWords(): Promise<string[]> {
  const json = await readFile(join(ASSET_DIR, 'source-pool.json'), 'utf8');
  return (JSON.parse(json) as { word: string }[]).map((e) => e.word);
}

async function flush(defs: Map<string, string>): Promise<void> {
  await writeFile(TSV_PATH, serializeDefinitions(defs), 'utf8');
}

async function main(): Promise<void> {
  console.log('Acquiring definitions (manual, network).');
  const [enable, sourceWords, existing] = await Promise.all([
    loadEnable(),
    loadSourceWords(),
    loadExisting(),
  ]);
  const union = formableUnion(sourceWords, enable);
  const todo = union.filter((w) => !existing.has(w));
  console.log(
    `  Union ${union.length.toLocaleString()} words, ` +
      `${existing.size.toLocaleString()} already have definitions, ` +
      `${todo.length.toLocaleString()} to fetch.`,
  );

  const found = new Map<string, string>();
  let processed = 0;
  await mapWithConcurrency(
    todo,
    CONCURRENCY,
    async (word) => {
      const gloss = shapeDefinition(
        await fetchDefinitionJson(word),
        DEFINITION_MAX_LENGTH,
      );
      if (gloss) found.set(word, gloss);
    },
    async (done, total) => {
      processed = done;
      if (done % FLUSH_EVERY === 0 || done === total) {
        await flush(mergeDefinitions(existing, found));
        process.stdout.write(`  ${done}/${total} (${found.size} found)\r`);
      }
    },
  );
  process.stdout.write('\n');

  await flush(mergeDefinitions(existing, found));
  console.log(
    `Done. ${found.size.toLocaleString()} new definitions ` +
      `(${processed.toLocaleString()} words checked). Wrote ${TSV_PATH}.`,
  );
}

main().catch((err) => {
  console.error('\nAcquisition failed:', err);
  process.exitCode = 1;
});
```

Note: `mapWithConcurrency`'s `onProgress` is currently typed as synchronous `(done, total) => void`. Awaiting an async callback inside it works because the worker awaits `onProgress?.(...)` only if it returns a promise. Verify the signature: if `onProgress` is invoked without `await` in `util.ts`, change the flush to be fire-and-forget safe by making the callback synchronous and flushing with `void flush(...)`. Prefer making `onProgress` return `void` and wrap the flush as `void flush(mergeDefinitions(existing, found));` to avoid changing `util.ts`.

- [ ] **Step 2: Reconcile the progress callback with util.ts**

Open `scripts/lib/util.ts` and check the `mapWithConcurrency` `onProgress` call site. It calls `onProgress?.(done, items.length)` without awaiting. So make the acquisition callback synchronous:

```ts
    (done, total) => {
      processed = done;
      if (done % FLUSH_EVERY === 0 || done === total) {
        void flush(mergeDefinitions(existing, found));
        process.stdout.write(`  ${done}/${total} (${found.size} found)\r`);
      }
    },
```

(Remove the `async` and the `await` from the callback.)

- [ ] **Step 3: Add the acquire script to package.json**

```json
"defs:acquire": "tsx scripts/acquire-definitions.ts",
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Run acquisition (manual, network, long: tens of minutes)**

Run:

```bash
pnpm defs:acquire
```

This fetches a short definition for each union word. It is resumable: if interrupted, re-run and it picks up where it left off (cached per-word responses, skips words already in the TSV). Expect a coverage well below 100%; missing words are normal and simply absent.

- [ ] **Step 6: Re-run the build to bake real bundles and read the report**

Run:

```bash
pnpm data:build
```

Read the measurement report: union size, coverage percent, TSV size, per-puzzle combined/avg/max, and the first-letter shard projection. This report is the decision input for per-puzzle versus shards (a separate follow-up; do not switch here).

- [ ] **Step 7: Commit code, then data**

```bash
git add scripts/acquire-definitions.ts package.json
git commit -m "feat(scripts): add manual Wiktionary definition acquisition"
git add scripts/data-raw/definitions.tsv public/data/defs/
git commit -m "chore(data): bake short definitions and per-puzzle bundles"
```

---

### Task 9: Attribution, final offline verification, and PR

**Files:**

- Modify: `ATTRIBUTION.md` and/or the colophon component (confirm Wiktionary CC BY-SA is surfaced for definitions, not only etymology)

- [ ] **Step 1: Confirm Wiktionary attribution covers definitions**

Check `ATTRIBUTION.md` and the in-app colophon (search the UI for where Wiktionary is credited):

```bash
grep -rn "Wiktionary\|CC BY-SA\|colophon" ATTRIBUTION.md src
```

If the existing credit names only the source-word etymology, broaden the wording so it also covers the tappable definitions. Keep it CC BY-SA 4.0. No em dashes.

- [ ] **Step 2: Full offline verification sweep**

Run, in order:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all PASS, no network access during `test` or `build`. (`pnpm build` is the app build; `pnpm data:build` is the data build, already run in Task 8.)

- [ ] **Step 3: Confirm no em dashes anywhere in the new work**

```bash
grep -rn "—" scripts src/data docs/superpowers
```

Expected: no matches.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/definitions-bake-lookup
gh pr create --fill --base main
```

In the PR body, paste the measurement report from Task 8 so the per-puzzle versus first-letter-shard decision has its numbers on record.

---

## Self-Review

**Spec coverage:**

- Two halves (acquisition vs build): Tasks 6, 8 (manual network) vs Tasks 1-3, 7 (offline build). Covered.
- Vendoring raw lists + provenance: Task 6. Covered.
- Acquisition: union (Task 1), per-word cached fetch (Task 5), shaping (Task 2), TSV idempotent/resumable/sorted (Tasks 2, 8), graceful gaps (Task 8). Covered.
- Build emit + measurement report (union, coverage, TSV size, per-puzzle combined/avg/max, shard projection): Tasks 3, 7. Covered.
- Source-word etymology untouched: Task 2 keeps `extractDefinition` output identical; verified in Task 2 Step 7. Covered.
- Lookup API (lazy, cached, same origin, null on miss, single seam): Task 4. Covered.
- Tests (union, TSV round-trip + merge, shaping, missing -> null, emit coverage, lookup laziness/cache/null/no cross-puzzle, offline build): Tasks 1-4, 7, 9. Covered.
- Out of scope (tap UI, patch layer, switching to shards): not built; report informs the shard decision only. Covered.
- No em dashes; Conventional Commits; pnpm; attribution: Global Constraints + Task 9.

**Placeholder scan:** No TBD/TODO/"handle edge cases" left. Every code step shows code.

**Type consistency:** `formableUnion(racks, words)` and `formableWords(rack, words)` (no minLength arg; uses `MIN_WORD_LENGTH` internally) used consistently in Tasks 1, 3, 7, 8. `shapeDefinition(json, maxLength)`, `parseDefinitions`, `serializeDefinitions`, `mergeDefinitions` consistent across Tasks 2, 8. `firstSense`/`extractDefinition` consistent across Tasks 2, 5. `createDefinitionLookup(sourceWord)` consistent in Task 4. `buildBundles`/`coverage`/`bundleStats`/`shardProjection` consistent across Tasks 3, 7. `loadDefinitions` added in Task 7 and consumed there.
