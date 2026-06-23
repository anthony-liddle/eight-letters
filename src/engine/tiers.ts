import { TIERS } from './config.ts';
import { classifyWord } from './classify.ts';
import { findScore } from './scoring.ts';
import type { Puzzle, TierStanding } from './types.ts';

/**
 * Compute the standing on the named points ladder.
 *
 * The rank is score (length plus rarity bonuses) as a fraction of the rack's
 * reachable score, so every find moves it up and rarity pays more. There is no
 * set gate and no source-word gate: the old set-fraction goal that walled a
 * player at "X of Y" is gone. setFound and setTotal are still tallied, but only
 * for the existing Edition-complete celebration, never to grade the ladder.
 */
export function computeTier(
  found: ReadonlySet<string>,
  puzzle: Puzzle,
): TierStanding {
  let score = 0;
  let setPoints = 0;
  let offPagePoints = 0;
  let setFound = 0;
  for (const word of found) {
    const rung = classifyWord(word, puzzle);
    const points = findScore(word, rung);
    score += points;
    if (rung === 'set') {
      setPoints += points;
      setFound += 1;
    } else {
      offPagePoints += points;
    }
  }

  const reachable = puzzle.reachableScore;
  const fraction = reachable > 0 ? score / reachable : 0;

  // Highest rank whose threshold the fraction meets.
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (fraction >= TIERS[i]!.threshold) index = i;
  }

  const current = TIERS[index]!;
  const nextDef = TIERS[index + 1];
  const next = nextDef
    ? { index: index + 1, threshold: nextDef.threshold }
    : null;

  return {
    index,
    id: current.id,
    score,
    reachable,
    fraction,
    setPoints,
    offPagePoints,
    setFound,
    setTotal: puzzle.commonWords.size,
    next,
    isTop: index === TIERS.length - 1,
  };
}
