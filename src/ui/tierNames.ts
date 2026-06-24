import type { Theme } from './useTheme.ts';

/**
 * The six named ranks of the points ladder, skinned per theme. Keyed by rank
 * index (0 to 5), the same six rungs the engine's TIERS define by threshold, so
 * the ladder structure is one thing and the names are a skin over it, exactly as
 * the rarity marks swap per theme. The completion crown names (The Complete
 * Works, Peachy Keen Supreme) are Stage 2 and sit above these six; the data
 * shape is ready for a seventh rank above the named ladder.
 */
export const TIER_NAMES: Record<Theme, readonly string[]> = {
  letterpress: [
    'Blank Page',
    'First Impression',
    'Galley Proof',
    'Press Run',
    'Bound Edition',
    'Fine Press',
  ],
  cute: [
    'First Sprout',
    'Little Bud',
    'Blossom',
    'Ripening',
    'Sweet',
    'Perfectly Peachy',
  ],
};

/**
 * The completion crown: the rank above the six named ranks, reached not by
 * points but by finding every common word (the Stage 2 peak). Same per-theme
 * structure as the ladder, so a theme switch re-skins the crown label live.
 */
export const CROWN_NAMES: Record<Theme, string> = {
  letterpress: 'The Complete Works',
  cute: 'Peachy Keen Supreme',
};

/** The crown's rank index, one above the top named rank (5). */
export const CROWN_RANK = TIER_NAMES.letterpress.length;

/** The themed completion-crown name for the active theme. */
export function crownName(theme: Theme): string {
  return CROWN_NAMES[theme];
}

/** The themed name for a rank index, clamped to the top name past the ladder. */
export function tierName(theme: Theme, index: number): string {
  const names = TIER_NAMES[theme];
  return names[index] ?? names[names.length - 1]!;
}
