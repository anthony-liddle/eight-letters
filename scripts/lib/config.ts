/**
 * Build-time pipeline tunables. These shape the baked assets, not runtime play.
 * The GDD lists SCOWL size bands and pool sizes under "tuning after playtest", so
 * they live here as named constants rather than scattered literals.
 */

/**
 * SCOWL "size" bands to include in the common pool (the tier denominator).
 * Smaller size = more common. Tightened to size 20 (bands 10, 20) after the
 * first playtest. Measured across the source pool: size 50 left racks reaching
 * 200 words in the set and size 35 still hit a median of 48 with a long tail
 * past 90, both well above the comfortable completion band the denominator split
 * exists to protect. Size 20 lands a median near 27 with the 90+ tail nearly
 * gone. Add band 35 back if puzzles feel too sparse.
 */
export const COMMON_POOL_SIZES = [10, 20] as const;

/**
 * SCOWL bands up to and including size 70: the first rarity cutoff. A found word
 * is at most "uncommon" when it sits in this union. The baked beyond-size-70 set
 * is ENABLE minus this union (the compact complement we ship for the ladder).
 */
export const SIZE_70_SIZES = [10, 20, 35, 40, 50, 55, 60, 70] as const;

/**
 * SCOWL bands up to and including size 95: the second rarity cutoff. A word
 * beyond size 70 but inside this union is "rare"; one beyond it is "mythic". The
 * baked beyond-size-95 set is ENABLE minus this union.
 */
export const SIZE_95_SIZES = [10, 20, 35, 40, 50, 55, 60, 70, 80, 95] as const;

/**
 * Tighter band for the source-word candidate pool. Source words are the answer
 * Bea should recognize, so we keep them to the two most common bands (about
 * 1,600 eight-letter words). This is the lever to pull if answers feel too
 * obscure (this is already tight) or too few (add band 35, much larger).
 */
export const SOURCE_POOL_SIZES = [10, 20] as const;

/** SCOWL spelling variants to include. American + the shared English core. */
export const SCOWL_VARIANTS = ['english', 'american'] as const;

/** Minimum playable word length, honoring the original game. */
export const MIN_WORD_LENGTH = 3;

/** The source word is always exactly 8 letters. */
export const SOURCE_WORD_LENGTH = 8;

/**
 * Cap on how many source candidates we enrich with Wiktionary data. Set above
 * the size of bands 10 and 20 so the whole common set is enriched, with no
 * alphabetical bias from slicing. Lower it only to bound a first trial run.
 */
export const MAX_SOURCE_WORDS = 2000;

/** Polite User-Agent. Wiktionary throttles clients that omit one. */
export const WIKTIONARY_USER_AGENT =
  '8LettersInSearchOfAWord/1.0 (gift project; anthonyliddle@gmail.com)';

/** Concurrency for Wiktionary fetches. Polite, not aggressive. */
export const WIKTIONARY_CONCURRENCY = 4;

/**
 * Require a source word to carry BOTH a definition and an etymology. The
 * etymology reveal is the emotional center of the gift, so a word that cannot
 * deliver it does not earn a place as an answer.
 */
export const REQUIRE_ETYMOLOGY = true;

/** Short gloss length cap for tappable definitions. Roughly one sentence. */
export const DEFINITION_MAX_LENGTH = 140;
