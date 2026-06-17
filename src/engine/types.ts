/** Core engine types. Pure data, no framework, no IO. */

/** A source of words formable from a rack. Backed by a baked word list. */
export interface WordSource {
  /** All words in this source, length >= minimum, formable from the rack. */
  formableWords(rack: string): string[];
}

/** The validation dictionary (ENABLE). Adds single-word membership. */
export interface Dictionary extends WordSource {
  /** True if the word is in the dictionary (ignores formability). */
  has(word: string): boolean;
}

/** A fully resolved puzzle: a source word and everything derived from it. */
export interface Puzzle {
  /** The 8-letter answer. */
  readonly sourceWord: string;
  /** The 8 rack letters, sorted for a stable canonical form. */
  readonly letters: string;
  /** Every ENABLE word formable from the rack (the full validation set). */
  readonly validationWords: ReadonlySet<string>;
  /** Every common-pool word formable from the rack (the tier denominator set). */
  readonly commonWords: ReadonlySet<string>;
  /** Scored total of the common set. The denominator for tier percentage. */
  readonly commonTotal: number;
}

/** Why a guess was accepted or rejected. */
export type GuessResult =
  | {
      readonly kind: 'valid';
      readonly word: string;
      readonly score: number;
      /** In the common pool (counts toward the tier numerator). */
      readonly isCommon: boolean;
      /** Exactly the day's source word (triggers the reveal, gates the top tier). */
      readonly isSourceWord: boolean;
    }
  | { readonly kind: 'too-short' }
  | { readonly kind: 'not-a-word' }
  | { readonly kind: 'already-found' };

/** A computed tier standing. */
export interface TierStanding {
  /** Index into the tier ladder. */
  readonly index: number;
  readonly id: string;
  readonly label: string;
  /** Fraction of common-pool points earned, 0 to 1. */
  readonly fraction: number;
  /** Points from common-pool finds (the numerator). */
  readonly commonPoints: number;
  /** Bonus points from valid-but-not-common (ENABLE-only) finds. */
  readonly bonusPoints: number;
  /** The next rung, or null at the top. */
  readonly next: { id: string; label: string; threshold: number } | null;
  /** True once the top rung is reached. */
  readonly isTop: boolean;
}
