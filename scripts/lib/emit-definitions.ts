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
