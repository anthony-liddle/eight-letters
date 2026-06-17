import { TIERS } from './config.ts';
import { scoreWord } from './scoring.ts';
import type { Puzzle, TierStanding } from './types.ts';

/**
 * Compute the tier standing from the set of found words.
 *
 * The tier numerator is common-pool points only. ENABLE-only finds score as
 * bonus and change neither the numerator nor the denominator. The top rung
 * requires both the high fraction and the day's source word.
 */
export function computeTier(
  found: ReadonlySet<string>,
  puzzle: Puzzle,
): TierStanding {
  let commonPoints = 0;
  let bonusPoints = 0;
  for (const word of found) {
    const points = scoreWord(word);
    if (puzzle.commonWords.has(word)) commonPoints += points;
    else bonusPoints += points;
  }

  const fraction =
    puzzle.commonTotal > 0 ? commonPoints / puzzle.commonTotal : 0;
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
    commonPoints,
    bonusPoints,
    next,
    isTop: index === TIERS.length - 1,
  };
}
