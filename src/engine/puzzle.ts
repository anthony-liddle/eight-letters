import { totalScore } from './scoring.ts';
import type { Dictionary, Puzzle, WordSource } from './types.ts';

/** Sort a word's letters for a stable canonical rack form. */
function sortLetters(word: string): string {
  return [...word].sort().join('');
}

/**
 * Build a full puzzle from a source word.
 *
 * - validationWords: every ENABLE word formable from the rack.
 * - commonWords: every common-pool word formable from the rack, intersected with
 *   the validation set so the denominator is always achievable.
 * - commonTotal: the scored total of the common set, the tier denominator.
 */
export function createPuzzle(
  sourceWord: string,
  dictionary: Dictionary,
  commonPool: WordSource,
  rarePool: WordSource,
): Puzzle {
  const validationWords = new Set(dictionary.formableWords(sourceWord));
  // The source word is in ENABLE and formable from itself, so it is guaranteed
  // to be present; assert nothing, just rely on the formable set.
  const commonWords = new Set(
    commonPool.formableWords(sourceWord).filter((w) => validationWords.has(w)),
  );
  // Rare words are valid (in ENABLE) but below the SCOWL-70 threshold, so they
  // are a subset of the validation set and never overlap the common pool.
  const rareWords = new Set(
    rarePool
      .formableWords(sourceWord)
      .filter((w) => validationWords.has(w) && !commonWords.has(w)),
  );

  return {
    sourceWord,
    letters: sortLetters(sourceWord),
    validationWords,
    commonWords,
    commonTotal: totalScore(commonWords),
    rareWords,
  };
}
