import type { Rung } from '@/engine/index.ts';

/** The off-page rarity rungs, in ascending order, for legends and tallies. */
export const LADDER_RUNGS = ['uncommon', 'rare', 'mythic'] as const;
export type LadderRung = (typeof LADDER_RUNGS)[number];

/**
 * Display names for the rarity rungs, kept in one themeable place. Cute leans
 * into the loot-ladder register (Uncommon, Rare, Mythic); the letterpress voice
 * may later want a quieter typographic skin for the same three rungs. That is an
 * open voice question, so the names live here, trivial to reskin, while the
 * classification logic in the engine stays untouched. The mark for each rung is
 * its key (mark--uncommon, mark--rare, mark--mythic), shaped per theme in CSS so
 * the rung reads by shape, not by colour.
 */
export const RUNG_NAMES: Record<LadderRung, string> = {
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
};

/** True for the off-page ladder rungs (everything but the plain, unbadged set). */
export function isLadderRung(rung: Rung): rung is LadderRung {
  return rung !== 'set';
}
