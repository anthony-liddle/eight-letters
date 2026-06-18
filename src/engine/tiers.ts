import { TIERS } from './config.ts';
import type { Puzzle, TierStanding } from './types.ts';

/**
 * Compute the tier standing from the set of found words.
 *
 * Completion is word-count based: set words found over total set words. Off-page
 * finds feed the score, never the bar, so they change neither the numerator nor
 * the denominator here. The bar and the "X of Y" counter read the same two
 * numbers, so they can never disagree. The top rung requires both the high
 * fraction and the day's source word.
 */
export function computeTier(
  found: ReadonlySet<string>,
  puzzle: Puzzle,
): TierStanding {
  const setTotal = puzzle.commonWords.size;
  let setFound = 0;
  for (const word of found) {
    if (puzzle.commonWords.has(word)) setFound += 1;
  }

  const fraction = setTotal > 0 ? setFound / setTotal : 0;
  const sourceFound = found.has(puzzle.sourceWord);

  // Highest rung whose threshold is met and whose source-word gate is satisfied.
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i]!;
    const meetsThreshold = fraction >= tier.threshold;
    const meetsGate = !tier.requiresSourceWord || sourceFound;
    if (meetsThreshold && meetsGate) index = i;
  }

  const current = TIERS[index]!;
  const nextDef = TIERS[index + 1];
  const next = nextDef
    ? { id: nextDef.id, label: nextDef.label, threshold: nextDef.threshold }
    : null;

  return {
    index,
    id: current.id,
    label: current.label,
    fraction,
    setFound,
    setTotal,
    next,
    isTop: index === TIERS.length - 1,
  };
}
