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

/**
 * Where a found word sits relative to the set. The set is the goal and carries
 * no rarity label; everything off the page is graded on the three-rung ladder.
 * The source word is orthogonal: it is also a set word, flagged separately.
 */
export type Rung = 'set' | 'uncommon' | 'rare' | 'mythic';

/** A fully resolved puzzle: a source word and everything derived from it. */
export interface Puzzle {
  /** The 8-letter answer. */
  readonly sourceWord: string;
  /** The 8 rack letters, sorted for a stable canonical form. */
  readonly letters: string;
  /** Every ENABLE word formable from the rack (the full validation set). */
  readonly validationWords: ReadonlySet<string>;
  /** Every set word formable from the rack. The completion denominator (by count). */
  readonly commonWords: ReadonlySet<string>;
  /**
   * Off-page finds in SCOWL size 70 but not in the set. The first rung. Disjoint
   * from commonWords, rareWords, and mythicWords; together the four partition the
   * validation set.
   */
  readonly uncommonWords: ReadonlySet<string>;
  /** Off-page finds in SCOWL size 95 but not in size 70. The second rung. */
  readonly rareWords: ReadonlySet<string>;
  /** Off-page finds valid in ENABLE but beyond SCOWL size 95. The top rung. */
  readonly mythicWords: ReadonlySet<string>;
}

/** Why a guess was accepted or rejected. */
export type GuessResult =
  | {
      readonly kind: 'valid';
      readonly word: string;
      readonly score: number;
      /** Where the word sits: the set, or a rung on the rarity ladder. */
      readonly rung: Rung;
      /** Exactly the day's source word (triggers the reveal, gates the top tier). */
      readonly isSourceWord: boolean;
    }
  | { readonly kind: 'too-short' }
  | { readonly kind: 'not-a-word' }
  | { readonly kind: 'already-found' };

/** A computed tier standing, measured by the count of set words found. */
export interface TierStanding {
  /** Index into the tier ladder. */
  readonly index: number;
  readonly id: string;
  readonly label: string;
  /** Fraction of the set found, by word count (setFound / setTotal), 0 to 1. */
  readonly fraction: number;
  /** Set words found (the "X" of "X of Y"). */
  readonly setFound: number;
  /** Total set words (the "Y" of "X of Y"). */
  readonly setTotal: number;
  /** The next rung, or null at the top. */
  readonly next: { id: string; label: string; threshold: number } | null;
  /** True once the top rung is reached. */
  readonly isTop: boolean;
}
