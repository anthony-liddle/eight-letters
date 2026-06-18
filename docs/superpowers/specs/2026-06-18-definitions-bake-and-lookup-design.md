# Definitions Bake And Lookup Layer

Status: approved design, ready for implementation plan.
Date: 2026-06-18.

No em dashes anywhere, in code, comments, or docs.

## Goal

Give every word a player can find a short tappable definition, while keeping
the build fully offline and keeping our touch on Wiktionary to a single
deliberate, manual fetch. This builds the data layer and a lazy lookup API. It
does not build the tap-to-reveal UI, which is a follow-on that consumes the API.

A word a player can find is any ENABLE word, length three or more, formable from
a shipped source word's eight letters. The union of those across every shipped
source word is the target set.

## Decisions (locked)

- Acquisition source: reuse the existing per-word Wiktionary REST path
  (`scripts/lib/wiktionary.ts`), which is already cached, rate limited, and
  resumable. No bulk kaikki download. A definition-only extractor is added next
  to the existing definition-plus-etymology one.
- Vendoring: commit only the raw files the build reads (ENABLE plus the SCOWL
  band files actually consumed), not the whole SCOWL tarball.
- Per-puzzle bundle format: compact JSON object, `{ "word": "definition" }`.
  The format is internal to the lookup API, so it can change without touching
  callers.
- Short gloss length cap: roughly 140 characters, one sentence.

## The Two Halves

These stay separate. Only acquisition touches the network, and it is never part
of the build.

- Acquisition: a standalone manual script, run by hand, occasionally. Fetches
  definitions and writes a committed file. Not called by build, CI, or tests.
- Build: offline and reproducible. Reads committed files, emits runtime assets,
  prints a measurement report. Never fetches.

## Components

### 1. Vendoring the raw lists (offline-proofing the build)

- New committed directory `scripts/data-raw/` holding:
  - `enable1.txt`, the ENABLE validation list, one word per line.
  - The SCOWL band files the build reads: `english-words.N` and
    `american-words.N` for N in the configured size bands (10, 20, 35, 40, 50,
    55, 60, 70, 80, 95).
  - `PROVENANCE.md`: where each list came from, which version (SCOWL
    2020.12.07, ENABLE source URL), when fetched, and the Wiktionary CC BY-SA
    note. ENABLE2K and SCOWL v1 are frozen, so reading these local files is
    safe forever.
- `scripts/lib/sources.ts`: remove the `ENABLE_URL` and `SCOWL_TARBALL_URL`
  fetch-and-extract paths. Read the vendored files from `scripts/data-raw/`
  instead. After this change nothing in the build path fetches.
- Word lists stay `.txt`, one per line. Source-word etymology stays JSON and is
  untouched.

### 2. Acquisition script (network, manual, by hand)

`scripts/acquire-definitions.ts`, wired as `pnpm defs:acquire`. Documented as
manual. Not referenced by the build, CI, or tests.

- Target set: compute the formable union. For each shipped source word (the
  words in `public/data/source-pool.json`, which are exactly the racks a player
  can be given), take every ENABLE word of length three or more formable from
  its eight letters. Dedupe across all source words. Source words are included
  because they are themselves formable.
- New pure helper `formableUnion(sourceWords, enableWords)` in `scripts/lib/`,
  reusing the same letter-count formability logic the engine uses.
- New `fetchDefinition(word)` that reuses the cached, rate limited REST fetch
  and the existing `cleanText` cleanup from `wiktionary.ts`. It returns one
  primary sense as plain text, wikitext and markup stripped, trimmed to a single
  short gloss within the length cap. Part of speech as a short prefix only if
  the extract gives it cleanly. No long multi-sense entries.
- Output: committed `scripts/data-raw/definitions.tsv`, flat TSV, one line per
  word, `word<TAB>short definition`, sorted by word for stable diffs.
  - Idempotent and resumable: re-running merges into the existing file without
    duplicating and can resume after an interruption.
  - Graceful gaps: words with no usable entry are simply absent. A missing
    definition is normal and never fatal.

### 3. Build emit (offline, reads committed files)

Extends `scripts/build-data.ts`.

- Read `scripts/data-raw/definitions.tsv` into a `word -> definition` map.
- Emit per-puzzle bundles: for each shipped source word, write
  `public/data/defs/<sourceword>.json`, a compact `{ word: definition }` object
  holding just the definitions for the words formable from that rack that have a
  definition. These are standalone static assets, same origin, kept out of the
  main bundle, fetched lazily at runtime.
- Measurement report printed at the end of the build:
  - Formable union size, and how many of those words have a definition
    (coverage percentage).
  - Total `definitions.tsv` size.
  - Per-puzzle bundle totals: combined size of all bundles, plus average and
    maximum single-bundle size. The single-bundle size is what a session loads.
  - First-letter shard projection: total combined size and per-shard sizes, for
    comparison against the per-puzzle scheme.
- The report is the point. It tells us whether per-puzzle bundles stay light
  enough or whether to switch to first-letter shards. We emit per-puzzle bundles
  now, print both sets of numbers, and confirm or switch from real data later.
- The source-word etymology JSON and its reveal are left untouched. This is
  additive.

### 4. Lookup API (runtime, lazy, cached, same origin)

`src/data/definitions.ts`.

- `createDefinitionLookup(sourceWord)` returns `{ getDefinition(word) }`, where
  `getDefinition(word): Promise<string | null>`.
- Lazy: the bundle for the active puzzle loads on demand, on first lookup, not
  on page open, and never the whole map.
- Cached: once a bundle is loaded, repeat lookups are fast and do not refetch.
- Same origin static fetch only, no external calls at runtime. Works offline
  once the bundle is cached.
- Missing words resolve cleanly to `null` so the UI can show a graceful no
  definition state.
- This API is the single seam between stored data and the UI, so swapping
  per-puzzle bundles for first-letter shards later is an internal change.

## Data Flow

```
acquire (manual, network):
  source-pool.json + enable1.txt
    -> formableUnion
    -> fetchDefinition per word (cached REST)
    -> definitions.tsv (committed, sorted, merged)

build (offline):
  definitions.tsv + source-pool.json + enable1.txt (vendored)
    -> per-puzzle bundles public/data/defs/<word>.json
    -> measurement report (stdout)

runtime (lazy):
  createDefinitionLookup(sourceWord)
    -> getDefinition(word) -> fetch defs/<sourceWord>.json once, cache
    -> definition string or null
```

## Testing (TDD, all offline, fixtures only)

No test hits the network. Use small fixtures.

- Formable union: given a few source words and a tiny ENABLE fixture, the union
  is exactly the formable words of length three or more, deduped.
- TSV round-trip: writing then reading the TSV returns the same map. Lines are
  sorted by word. Merging new entries into an existing file dedupes and
  preserves order.
- Definition shaping: a raw multi-sense fixture entry reduces to a single short
  plain-text gloss within the length cap, markup stripped.
- Missing words: a word absent from the definitions file resolves to `null` end
  to end, and the build does not fail on it.
- Emit coverage: every formable word that has a definition appears in the
  emitted bundle for each puzzle whose rack can form it.
- Lookup API: returns the right definition for a present word, `null` for an
  absent one, loads a bundle at most once (cache proven by a single load across
  repeated lookups), and does not load bundles for unrelated puzzles (laziness
  proven).
- Offline build: the build and the full test run complete with no network
  access.

## Out Of Scope

- The tap-to-reveal UI. It consumes `getDefinition`.
- The dictionary patch layer (allowlist for words like udon). The TSV shares its
  format so the patch layer can append later, but building it is separate.
- Switching the loading scheme to first-letter shards. Only if the measurement
  says per-puzzle bundles are too heavy, as a follow up.

## Quality Bar And Done

- No em dashes anywhere.
- Acquisition is a separate, manual, network-touching script. Build and tests
  are fully offline. Nothing in the build path fetches.
- Raw lists committed and pinned with a provenance note. Word lists stay `.txt`.
  Source-word etymology stays JSON and untouched. The new definitions file is
  flat TSV, sorted, appendable.
- Wiktionary CC BY-SA attribution carried in provenance and still surfaced in
  the colophon.
- The build prints the measurement report with union size, coverage, and both
  candidate schemes' sizes.
- `getDefinition` is lazy, cached, same origin, returns `null` for misses, and
  is the only seam the UI depends on.
- Commits follow Conventional Commits. Open a PR when green.
