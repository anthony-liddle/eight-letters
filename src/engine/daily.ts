import { DAILY_EPOCH } from './config.ts';

interface EpochDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
}

/**
 * Whole calendar days from the epoch to the given local date.
 *
 * Built from the calendar Y/M/D components via UTC timestamps, never from
 * (now - epoch) / dayMs. Dividing milliseconds drifts across daylight-saving
 * boundaries and would make the daily differ on reload. This is rollover at
 * local midnight: a one-person audience, so simpler than a fixed time zone.
 */
export function dayIndex(date: Date, epoch: EpochDate = DAILY_EPOCH): number {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const start = Date.UTC(epoch.year, epoch.month - 1, epoch.day);
  return Math.floor((today - start) / 86_400_000);
}

/** Deterministic PRNG. Same seed, same stream. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A fresh seeded Fisher-Yates permutation of [0, n). Pure in n and seed. */
function seededPermutation(n: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/**
 * The source word for a given day.
 *
 * The day index splits into a cycle and a position. Each cycle is a fresh
 * deterministic shuffle of the whole pool, so the sequence never repeats a word
 * until the pool is exhausted, then reshuffles for the next pass.
 */
export function dailySourceWord(
  pool: readonly string[],
  date: Date,
  epoch: EpochDate = DAILY_EPOCH,
): string {
  if (pool.length === 0) throw new Error('Source pool is empty.');
  const index = dayIndex(date, epoch);
  // Guard against pre-epoch dates by flooring at cycle/position 0.
  const safeIndex = Math.max(0, index);
  const cycle = Math.floor(safeIndex / pool.length);
  const position = safeIndex % pool.length;
  const permutation = seededPermutation(pool.length, cycle + 1);
  return pool[permutation[position]!]!;
}
