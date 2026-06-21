/**
 * READ-ONLY sizing analysis. Does not change game logic, data, or selection.
 * Reuses the engine's own createPuzzle (the exact function the live game uses to
 * build each rack's set), so every set-size number matches the game.
 *
 *   pnpm tsx scripts/analyze-set-floor.ts
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPuzzle } from '../src/engine/puzzle.ts';
import { formableFrom } from '../src/engine/formability.ts';
import type { Dictionary, WordSource } from '../src/engine/types.ts';
import { SOURCE_WORD_LENGTH } from '../src/engine/config.ts';

const DATA = join(import.meta.dirname, '..', 'public', 'data');

async function lines(file: string): Promise<string[]> {
  const raw = await readFile(join(DATA, file), 'utf8');
  return raw
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean);
}

// List-backed sources, identical to src/data/listSource.ts.
function dict(words: Iterable<string>): Dictionary {
  const set = new Set(words);
  return { has: (w) => set.has(w), formableWords: (r) => formableFrom(r, set) };
}
function source(words: Iterable<string>): WordSource {
  const list = [...words];
  return { formableWords: (r) => formableFrom(r, list) };
}

async function main(): Promise<void> {
  const enable = await lines('enable.txt');
  const common = await lines('common-pool.txt');
  const beyond70 = await lines('beyond-size-70.txt');
  const beyond95 = await lines('beyond-size-95.txt');
  const shipped: string[] = JSON.parse(
    await readFile(join(DATA, 'source-pool.json'), 'utf8'),
  ).map((e: { word: string }) => e.word);

  const dictionary = dict(enable);
  const commonPool = source(common);
  const beyond70Pool = source(beyond70);
  const beyond95Pool = source(beyond95);

  // The game's exact set size for a rack: commonWords.size from createPuzzle.
  // commonWords INCLUDES the source word (it is itself a set word). The number
  // reported is the completion denominator the player sets out to find.
  const setSize = (word: string): number =>
    createPuzzle(word, dictionary, commonPool, beyond70Pool, beyond95Pool)
      .commonWords.size;

  // Candidate universes (8-letter source words):
  const enableSet = new Set(enable);
  // Common universe: all SCOWL-small length-8 words (already INTERSECT ENABLE in
  // common-pool.txt). The full eligible common pool, not just the shipped 707.
  const commonUniverse = common.filter(
    (w) => w.length === SOURCE_WORD_LENGTH && enableSet.has(w),
  );
  // Common + uncommon universe: all SCOWL-70 length-8 words INTERSECT ENABLE.
  // SCOWL-70 INTERSECT ENABLE = ENABLE minus beyond-size-70.
  const beyond70Set = new Set(beyond70);
  const size70Universe = enable.filter(
    (w) => w.length === SOURCE_WORD_LENGTH && !beyond70Set.has(w),
  );

  // ---- Part 1: shipped pool distribution ----
  const shippedSizes = shipped.map(setSize).sort((a, b) => a - b);
  const n = shippedSizes.length;
  const min = shippedSizes[0]!;
  const max = shippedSizes[n - 1]!;
  const median =
    n % 2
      ? shippedSizes[(n - 1) / 2]!
      : (shippedSizes[n / 2 - 1]! + shippedSizes[n / 2]!) / 2;

  const buckets: Record<string, number> = {
    '<10': 0,
    '10-14': 0,
    '15-19': 0,
    '20-29': 0,
    '30-49': 0,
    '50-99': 0,
    '100+': 0,
  };
  for (const s of shippedSizes) {
    if (s < 10) buckets['<10']!++;
    else if (s < 15) buckets['10-14']!++;
    else if (s < 20) buckets['15-19']!++;
    else if (s < 30) buckets['20-29']!++;
    else if (s < 50) buckets['30-49']!++;
    else if (s < 100) buckets['50-99']!++;
    else buckets['100+']!++;
  }

  const atLeast = (sizes: number[], floor: number): number =>
    sizes.filter((s) => s >= floor).length;

  console.log('\n===== PART 1: SHIPPED POOL (source-pool.json) =====');
  console.log(`Source words: ${n}`);
  console.log(`Set size (commonWords.size, INCLUDES source word):`);
  console.log(`  min ${min}   median ${median}   max ${max}`);
  console.log('Distribution buckets:');
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`  ${k.padStart(6)}: ${v}`);
  }
  console.log('Floor survivors (shipped):');
  for (const f of [15, 10]) {
    const keep = atLeast(shippedSizes, f);
    console.log(`  >= ${f}: ${keep} survive   |   < ${f}: ${n - keep} drop`);
  }
  const below10 = shipped
    .map((w) => [w, setSize(w)] as const)
    .filter(([, s]) => s < 10)
    .sort((a, b) => a[1] - b[1]);
  console.log(`\nShipped words with set < 10 (${below10.length}):`);
  for (const [w, s] of below10) console.log(`  ${w}  ${s}`);

  // ---- Part 2 & 3: universes ----
  const commonUniverseSizes = commonUniverse.map(setSize);
  const size70UniverseSizes = size70Universe.map(setSize);

  console.log('\n===== PARTS 2 & 3: UNIVERSES =====');
  console.log(
    `Common universe (SCOWL-small len-8 in ENABLE): ${commonUniverse.length} words`,
  );
  console.log(
    `Common+uncommon universe (SCOWL-70 len-8 in ENABLE): ${size70Universe.length} words`,
  );

  const row = (label: string, sizes: number[], total: number) => {
    console.log(
      `  ${label.padEnd(34)} total=${String(total).padStart(5)}  ` +
        `>=15: ${String(atLeast(sizes, 15)).padStart(5)}   ` +
        `>=10: ${String(atLeast(sizes, 10)).padStart(5)}`,
    );
  };
  console.log('\nQualifying source-word counts by floor:');
  row('Shipped (707, hand-reviewed)', shippedSizes, n);
  row('Common universe', commonUniverseSizes, commonUniverse.length);
  row('Common + uncommon universe', size70UniverseSizes, size70Universe.length);

  // Marginal from adding uncommon (raw upper bound).
  for (const f of [15, 10]) {
    const c = atLeast(commonUniverseSizes, f);
    const cu = atLeast(size70UniverseSizes, f);
    console.log(
      `  marginal from uncommon @ >=${f}: +${cu - c} (raw upper bound)`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
