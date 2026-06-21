import { MIN_SET_SIZE } from './config.ts';
import { createPuzzle } from './puzzle.ts';
import type { Dictionary, WordSource } from './types.ts';

/**
 * Set size for a source word, computed through the engine's own createPuzzle so
 * it matches the live game exactly. This is commonWords.size: the completion
 * denominator the "X of Y" counter shows, crown-inclusive (the source word is
 * itself a set word for any common crown). Reused by the calendar generator and
 * the eligibility floor; never reimplement the set rules elsewhere.
 */
export function sourceSetSize(
  word: string,
  dictionary: Dictionary,
  commonPool: WordSource,
  beyond70Pool: WordSource,
  beyond95Pool: WordSource,
): number {
  return createPuzzle(word, dictionary, commonPool, beyond70Pool, beyond95Pool)
    .commonWords.size;
}

/** True when a source word's set clears MIN_SET_SIZE (crown-inclusive). */
export function isEligibleSource(
  word: string,
  dictionary: Dictionary,
  commonPool: WordSource,
  beyond70Pool: WordSource,
  beyond95Pool: WordSource,
): boolean {
  return (
    sourceSetSize(word, dictionary, commonPool, beyond70Pool, beyond95Pool) >=
    MIN_SET_SIZE
  );
}

/** The candidates whose set clears the floor, input order preserved. */
export function eligibleSourceWords(
  candidates: Iterable<string>,
  dictionary: Dictionary,
  commonPool: WordSource,
  beyond70Pool: WordSource,
  beyond95Pool: WordSource,
): string[] {
  const out: string[] = [];
  for (const word of candidates) {
    if (
      isEligibleSource(word, dictionary, commonPool, beyond70Pool, beyond95Pool)
    ) {
      out.push(word);
    }
  }
  return out;
}
