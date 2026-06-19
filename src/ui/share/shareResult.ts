import {
  classifyWord,
  scoreWord,
  totalScore,
  type Puzzle,
} from '@/engine/index.ts';
import type { DailyShareResult } from './shareText.ts';

/**
 * Derive the day's share result from the puzzle and the found words. Pure: the
 * same counts and point split the glossary summary shows, in the shape the
 * builder consumes. The source word is a set word, so its points and its place
 * in the count fall under the set, never off-page.
 */
export function dailyShareResult(
  puzzle: Puzzle,
  found: readonly string[],
  date: Date,
  title: string,
): DailyShareResult {
  let setFound = 0;
  let uncommon = 0;
  let rare = 0;
  let mythic = 0;
  let setPoints = 0;

  for (const word of found) {
    if (puzzle.commonWords.has(word)) {
      setFound += 1;
      setPoints += scoreWord(word);
      continue;
    }
    switch (classifyWord(word, puzzle)) {
      case 'uncommon':
        uncommon += 1;
        break;
      case 'rare':
        rare += 1;
        break;
      case 'mythic':
        mythic += 1;
        break;
    }
  }

  const totalPoints = totalScore(found);

  return {
    title,
    date,
    setFound,
    setTotal: puzzle.commonWords.size,
    uncommon,
    rare,
    mythic,
    setPoints,
    offPagePoints: totalPoints - setPoints,
    totalPoints,
    sourceWord: puzzle.sourceWord,
    foundWords: found,
  };
}
