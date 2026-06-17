/**
 * Game rules. Numbers the GDD flags as tunable after playtest live here as named
 * constants, not scattered literals: the scoring curve, the tier ladder, the
 * daily epoch. Change them in one place.
 */

/** Minimum playable word length, honoring the original game. */
export const MIN_WORD_LENGTH = 3;

/** The source word is always exactly 8 letters. */
export const SOURCE_WORD_LENGTH = 8;

/**
 * Points by word length. Index by length; lengths below the minimum score 0.
 * 3=1, 4=3, 5=5, 6=7, 7=11, 8=15.
 */
const SCORE_BY_LENGTH: Readonly<Record<number, number>> = {
  3: 1,
  4: 3,
  5: 5,
  6: 7,
  7: 11,
  8: 15,
};

/** Score for a word of the given length. 0 below the minimum length. */
export function scoreForLength(length: number): number {
  return SCORE_BY_LENGTH[length] ?? (length > SOURCE_WORD_LENGTH ? 15 : 0);
}

/** A rung on the completion ladder. */
export interface TierDef {
  readonly id: string;
  readonly label: string;
  /** Fraction of the common-pool total needed to reach this tier (0 to 1). */
  readonly threshold: number;
  /** The top rung also requires the day's source word to be found. */
  readonly requiresSourceWord: boolean;
}

/**
 * Tiers by fraction of the common-pool total, low to high. The top rung fuses
 * Bea's two signatures: the high bar plus the long word. Thresholds are tunable.
 */
export const TIERS: readonly TierDef[] = [
  {
    id: 'blank-page',
    label: 'Blank Page',
    threshold: 0,
    requiresSourceWord: false,
  },
  {
    id: 'a-few-words',
    label: 'A Few Words',
    threshold: 0.08,
    requiresSourceWord: false,
  },
  {
    id: 'warming-up',
    label: 'Warming Up',
    threshold: 0.22,
    requiresSourceWord: false,
  },
  {
    id: 'in-the-flow',
    label: 'In the Flow',
    threshold: 0.4,
    requiresSourceWord: false,
  },
  {
    id: 'word-hoard',
    label: 'Word Hoard',
    threshold: 0.6,
    requiresSourceWord: false,
  },
  {
    id: 'found-the-word',
    label: 'Found the Word',
    threshold: 0.85,
    requiresSourceWord: true,
  },
  {
    // The crown above the crown: every word in the set found. Reaching 1.00
    // means the source word is among them, so the gate is met automatically.
    id: 'edition-complete',
    label: 'Edition Complete',
    threshold: 1,
    requiresSourceWord: true,
  },
];

/**
 * Day one of the daily sequence (local calendar date). The day index is the
 * number of whole calendar days from this date. Tunable.
 */
export const DAILY_EPOCH = { year: 2026, month: 1, day: 1 } as const;

/** Tier a daily must reach to count toward the streak. "In the Flow" and up. */
export const STREAK_TIER_INDEX = 3;
