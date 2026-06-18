import { classifyWord } from './classify.ts';
import { MIN_WORD_LENGTH } from './config.ts';
import { scoreWord } from './scoring.ts';
import type { GuessResult, Puzzle } from './types.ts';

/** Normalize raw input to the canonical form used everywhere: lowercase a-z. */
export function normalizeGuess(input: string): string {
  return input.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Validate a guess against a resolved puzzle and the set already found.
 *
 * A guess is valid when it is 3+ letters, formable from the rack, and in ENABLE.
 * The puzzle's validationWords set already encodes all three (it is the formable
 * ENABLE set), so membership there is the single source of truth.
 */
export function validateGuess(
  input: string,
  puzzle: Puzzle,
  found: ReadonlySet<string>,
): GuessResult {
  const word = normalizeGuess(input);

  if (word.length < MIN_WORD_LENGTH) return { kind: 'too-short' };
  if (!puzzle.validationWords.has(word)) return { kind: 'not-a-word' };
  if (found.has(word)) return { kind: 'already-found' };

  return {
    kind: 'valid',
    word,
    score: scoreWord(word),
    rung: classifyWord(word, puzzle),
    isSourceWord: word === puzzle.sourceWord,
  };
}
