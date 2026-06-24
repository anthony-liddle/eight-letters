import { findScore } from './scoring.ts';
import type { Dictionary, Puzzle, Rung, WordSource } from './types.ts';

/** Sort a word's letters for a stable canonical rack form. */
function sortLetters(word: string): string {
  return [...word].sort().join('');
}

/** Summed find score for a band of words at a known rung. */
function bandScore(words: Iterable<string>, rung: Rung): number {
  let total = 0;
  for (const word of words) total += findScore(word, rung);
  return total;
}

/**
 * Build a full puzzle from a source word.
 *
 * - validationWords: every ENABLE word formable from the rack.
 * - commonWords: every set word formable from the rack, intersected with the
 *   validation set so the completion denominator is always achievable.
 * - the rarity ladder: every formable validation word outside the set is graded
 *   by SCOWL membership. The two rarity pools carry the words BEYOND a SCOWL
 *   size band (the compact complement: ENABLE minus the band), so:
 *     uncommon = in size 70 (not beyond 70), and not in the set
 *     rare     = beyond size 70 but in size 95 (not beyond 95)
 *     mythic   = beyond size 95
 *   The four bands are disjoint and together partition the validation set.
 */
export function createPuzzle(
  sourceWord: string,
  dictionary: Dictionary,
  commonPool: WordSource,
  beyond70Pool: WordSource,
  beyond95Pool: WordSource,
): Puzzle {
  const validationWords = new Set(dictionary.formableWords(sourceWord));
  // The source word is in ENABLE and formable from itself, so it is guaranteed
  // to be present; assert nothing, just rely on the formable set.
  const commonWords = new Set(
    commonPool.formableWords(sourceWord).filter((w) => validationWords.has(w)),
  );
  const beyond70 = new Set(
    beyond70Pool
      .formableWords(sourceWord)
      .filter((w) => validationWords.has(w)),
  );
  const beyond95 = new Set(
    beyond95Pool
      .formableWords(sourceWord)
      .filter((w) => validationWords.has(w)),
  );

  // In size 70 (not beyond it) and not a set word.
  const uncommonWords = new Set(
    [...validationWords].filter((w) => !beyond70.has(w) && !commonWords.has(w)),
  );
  // Beyond 70 but within 95. Set words live in size 70, so none leak in here.
  const rareWords = new Set([...beyond70].filter((w) => !beyond95.has(w)));
  // Beyond 95. Set words never reach this far.
  const mythicWords = new Set(beyond95);

  // Reachable score: the set points (every common word at length, source word
  // included). The named ladder runs against this. Off-page finds still earn
  // their points into the score, so they climb faster and overflow the bar past
  // the top named rank, but they are not part of the denominator. Using the
  // huge ENABLE-union-SCOWL-95 off-page tail as the ceiling would make the
  // ladder unclimbable; set points are the stable, per-rack-consistent scale.
  // The set defines what a full climb is worth, not what must be found, so no
  // unfound word gates the climb. Full word-count completion is the Stage 2 peak.
  const reachableScore = bandScore(commonWords, 'set');

  return {
    sourceWord,
    letters: sortLetters(sourceWord),
    validationWords,
    commonWords,
    uncommonWords,
    rareWords,
    mythicWords,
    reachableScore,
  };
}
