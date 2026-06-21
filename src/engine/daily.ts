import { DAILY_EPOCH } from './config.ts';
import { seededPermutation } from './shuffle.ts';

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

/** A well-distributed seed for a reshuffled cycle. Cycle 0 never reaches here. */
function seedForCycle(cycle: number): number {
  return (cycle * 0x9e3779b1) >>> 0;
}

/**
 * The index order for a cycle over a calendar of n words.
 *
 * Cycle 0 is the committed calendar order itself (identity), so the first pass
 * plays the frozen sequence exactly as generated. Every later cycle is a fresh
 * deterministic permutation, and its first word is forced to differ from the
 * previous cycle's last word so no word repeats across a cycle boundary.
 */
function cycleOrder(cycle: number, n: number): number[] {
  if (cycle === 0) return Array.from({ length: n }, (_, i) => i);
  const order = seededPermutation(n, seedForCycle(cycle));
  if (n < 2) return order;
  const prevLast = cycleOrder(cycle - 1, n)[n - 1]!;
  if (order[0] === prevLast) {
    [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order;
}

/**
 * The source word for a given day, read from the frozen daily calendar.
 *
 * The day index splits into a cycle and a position. The first cycle is the
 * calendar in its committed order; once exhausted, each later cycle is a fresh
 * deterministic shuffle, so the sequence never repeats a word within a pass and
 * never repeats across a pass boundary. Appending words to the calendar leaves
 * every first-cycle day fixed, which is the whole point of the freeze.
 */
export function dailySourceWord(
  calendar: readonly string[],
  date: Date,
  epoch: EpochDate = DAILY_EPOCH,
): string {
  if (calendar.length === 0) throw new Error('Daily calendar is empty.');
  const index = dayIndex(date, epoch);
  // Guard against pre-epoch dates by flooring at cycle/position 0.
  const safeIndex = Math.max(0, index);
  const n = calendar.length;
  const cycle = Math.floor(safeIndex / n);
  const position = safeIndex % n;
  return calendar[cycleOrder(cycle, n)[position]!]!;
}

/**
 * A random source word for endless play, drawn from the same eligible calendar
 * as the daily. Because the calendar holds only words that clear MIN_SET_SIZE, a
 * sub-floor word can never headline endless. The rng is injectable for testing.
 */
export function endlessSourceWord(
  calendar: readonly string[],
  rng: () => number = Math.random,
): string {
  if (calendar.length === 0) throw new Error('Daily calendar is empty.');
  return calendar[Math.floor(rng() * calendar.length)]!;
}
