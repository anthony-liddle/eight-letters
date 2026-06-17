import { scoreForLength } from './config.ts';

/** Points for a single word, by its length. */
export function scoreWord(word: string): number {
  return scoreForLength(word.length);
}

/** Summed score of a collection of words. */
export function totalScore(words: Iterable<string>): number {
  let total = 0;
  for (const w of words) total += scoreWord(w);
  return total;
}
