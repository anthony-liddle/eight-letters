import {
  classifyWord,
  computeTier,
  scoreWord,
  totalScore,
  type Puzzle,
} from '@/engine/index.ts';
import type { Theme } from '../useTheme.ts';
import { crownName, tierName } from '../tierNames.ts';
import type { DailyShareResult } from './shareText.ts';

/**
 * Derive the day's share result from the puzzle and the found words. Pure: the
 * same counts and point split the glossary summary shows, in the shape the
 * builder consumes. The source word is a set word, so its points and its place
 * in the count fall under the set, never off-page.
 *
 * The earned tier headline is computed the same way the app's TierMeter shows
 * it: the completion crown once every common word is found, otherwise the
 * current named rank, both theme-skinned from the tier-name source. So the share
 * headline matches what the player saw, in whichever theme they played.
 */
export function dailyShareResult(
  puzzle: Puzzle,
  found: readonly string[],
  date: Date,
  title: string,
  theme: Theme,
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

  // The headline, exactly as TierMeter labels it: crown on completion (every
  // common word found), otherwise the current named rank.
  const tier = computeTier(new Set(found), puzzle);
  const completed = tier.setTotal > 0 && tier.setFound >= tier.setTotal;
  const tierLabel = completed ? crownName(theme) : tierName(theme, tier.index);

  return {
    title,
    date,
    tierLabel,
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
