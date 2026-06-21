import { seededPermutation } from './shuffle.ts';

/**
 * Fixed seed for the one-time establishment shuffle and for ordering appended
 * words. A constant so generation is fully deterministic across runs.
 */
export const CALENDAR_SEED = 0x5e1ec7ed;

/**
 * Build the daily calendar from the current eligible source words and the
 * existing committed calendar.
 *
 * APPEND-ONLY INVARIANT (load-bearing, do not break):
 *   The daily calendar is append-only. Never reorder it, never remove from it.
 *   New words go on the end. Removing or reordering an entry re-dates every day
 *   after it and breaks the promise that a given day is a fixed puzzle.
 *
 * First run (existing empty): every eligible word in a deterministic seeded
 * shuffle, so consecutive days do not march alphabetically. Every later run:
 * existing entries keep their position and order untouched, and any eligible
 * word not already present is appended to the end in a deterministic order.
 */
export function generateCalendar(
  eligible: readonly string[],
  existing: readonly string[],
  seed: number = CALENDAR_SEED,
): string[] {
  const present = new Set(existing);
  // Sort for a stable base so the seeded shuffle is independent of input order.
  const sorted = [...eligible].sort();
  const perm = seededPermutation(sorted.length, seed);
  const shuffled = perm.map((i) => sorted[i]!);
  const additions = shuffled.filter((w) => !present.has(w));
  return [...existing, ...additions];
}
