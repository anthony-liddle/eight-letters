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
  /**
   * Total points available on this rack: every findable word scored by length
   * plus its rarity bonus, source word included. The denominator the named
   * points ladder runs against, so each rack is judged against its own ceiling.
   * Derived deterministically with the puzzle, the same as the formable set.
   */
  readonly reachableScore: number;
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

/**
 * A computed standing on the named points ladder. The rank is score as a
 * fraction of the rack's reachable score, so every find (set or off-page) moves
 * it up and rarity pays more. Theme-neutral: the displayed rank name is skinned
 * over `index` in the UI. `setFound`/`setTotal` are carried only for the existing
 * Edition-complete celebration, not for the ladder.
 */
export interface TierStanding {
  /** Index into the named ladder (0 to 5). */
  readonly index: number;
  readonly id: string;
  /** Points earned so far: length scores plus rarity bonuses. */
  readonly score: number;
  /** Total points available on the rack (the denominator). */
  readonly reachable: number;
  /** score / reachable, 0 to 1. */
  readonly fraction: number;
  /** Points from set (on-page) finds, for the two-color bar. */
  readonly setPoints: number;
  /** Points from off-page finds, for the two-color bar. */
  readonly offPagePoints: number;
  /** Set words found, kept for the Edition-complete celebration (Stage 2 retargets). */
  readonly setFound: number;
  /** Total set words, kept for the Edition-complete celebration. */
  readonly setTotal: number;
  /** The next rank, or null at the top named rank. */
  readonly next: { index: number; threshold: number } | null;
  /** True once the top named rank is reached (below full completion). */
  readonly isTop: boolean;
}
