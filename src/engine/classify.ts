import type { Puzzle, Rung } from './types.ts';

/**
 * Classify a found word by precedence: in the set, else the first rarity rung it
 * falls in. The puzzle's four band sets are disjoint, so the order is belt and
 * braces rather than strictly required, but it states the model plainly:
 *
 *   set  >  uncommon (SCOWL 70)  >  rare (SCOWL 95)  >  mythic (beyond 95)
 *
 * Only ever called on a valid found word, which is in exactly one band.
 */
export function classifyWord(word: string, puzzle: Puzzle): Rung {
  if (puzzle.commonWords.has(word)) return 'set';
  if (puzzle.uncommonWords.has(word)) return 'uncommon';
  if (puzzle.rareWords.has(word)) return 'rare';
  return 'mythic';
}
