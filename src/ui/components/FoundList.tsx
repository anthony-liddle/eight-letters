import { useMemo, type ReactNode } from 'react';
import {
  classifyWord,
  findScore,
  type Puzzle,
  type TierStanding,
} from '@/engine/index.ts';
import { LADDER_RUNGS, RUNG_NAMES, type LadderRung } from '../rarity.ts';
import type { Theme } from '../useTheme.ts';
import { TierMeter } from './TierMeter.tsx';

interface Props {
  puzzle: Puzzle;
  found: readonly string[];
  /**
   * The standing on the points ladder, the single source the bar also reads, so
   * the totals and the bar can never diverge: the score, the set-versus-off-page
   * split, the completion count, and the named tier all come from here.
   */
  tier: TierStanding;
  theme: Theme;
  /** Called when the player taps a found word to see its definition. */
  onWordTap: (word: string, trigger: HTMLElement) => void;
  /**
   * An optional control for the summary footer, the daily share among them.
   * Lives here so it sits with the score it brags about; Endless passes none.
   */
  summaryExtra?: ReactNode;
}

type Category = 'source' | 'set' | LadderRung;

interface Word {
  word: string;
  category: Category;
  score: number;
}

interface Group {
  length: number;
  /** Set words of this length (the "of Y"). */
  setTotal: number;
  /** Set words of this length that were found (the "X"). */
  setFound: number;
  /** Set and source finds of this length: the population the count describes. */
  setWords: Word[];
  /** Off-page finds of this length: shown, but never inside the set count. */
  offPageWords: Word[];
}

function categorize(word: string, puzzle: Puzzle): Category {
  if (word === puzzle.sourceWord) return 'source';
  // The source word aside, the rung is the single source of truth: set, or one
  // of the three off-page rungs.
  return classifyWord(word, puzzle);
}

function buildGroups(puzzle: Puzzle, found: readonly string[]): Group[] {
  // Set words per length: the honest "of Y" denominator, the same set the
  // top-level completion count totals, just sliced by length.
  const setTotalByLen = new Map<number, number>();
  for (const w of puzzle.commonWords) {
    setTotalByLen.set(w.length, (setTotalByLen.get(w.length) ?? 0) + 1);
  }

  const foundByLen = new Map<number, Word[]>();
  for (const word of found) {
    const list = foundByLen.get(word.length) ?? [];
    // Score by the single rarity-aware path, so an off-page word's inline +N
    // shows the bonus Bea earned, matching the bar and the total.
    list.push({
      word,
      category: categorize(word, puzzle),
      score: findScore(word, classifyWord(word, puzzle)),
    });
    foundByLen.set(word.length, list);
  }

  // Every length with set words, plus any length she has off-page finds in: the
  // Spelling Bee style grid, so an uncracked set length still shows what is
  // missing. Longest first, the eight-letter word at the head of the glossary.
  const lengths = new Set<number>([
    ...setTotalByLen.keys(),
    ...foundByLen.keys(),
  ]);
  return [...lengths]
    .sort((a, b) => b - a)
    .map((length) => {
      const words = (foundByLen.get(length) ?? []).sort((a, b) =>
        a.word.localeCompare(b.word),
      );
      // The source word is a set word too, so it counts toward the set. Off-page
      // finds are split out so the "X of Y" set count never lists them.
      const setWords = words.filter((w) => !isLadder(w.category));
      const offPageWords = words.filter((w) => isLadder(w.category));
      return {
        length,
        setTotal: setTotalByLen.get(length) ?? 0,
        setFound: setWords.length,
        setWords,
        offPageWords,
      };
    });
}

/** True for an off-page ladder word: points shown inline, mark by shape. */
function isLadder(category: Category): category is LadderRung {
  return category !== 'set' && category !== 'source';
}

export function FoundList({
  puzzle,
  found,
  tier,
  theme,
  onWordTap,
  summaryExtra,
}: Props) {
  const groups = useMemo(() => buildGroups(puzzle, found), [puzzle, found]);

  // Completion is the set, the one place an X of Y belongs. The count comes from
  // the tier, the same source the bar reads, so the two can never diverge.
  const setFound = tier.setFound;
  const setTotal = tier.setTotal;

  // Open-ended counts per rung: a tally, never a denominator. All three rungs
  // always show in the summary, so it reads as a stable totals block.
  const rungCounts = useMemo(() => {
    const counts: Record<LadderRung, number> = {
      uncommon: 0,
      rare: 0,
      mythic: 0,
    };
    for (const w of found) {
      const c = categorize(w, puzzle);
      if (isLadder(c)) counts[c] += 1;
    }
    return counts;
  }, [found, puzzle]);

  const renderChip = (w: Word) => (
    <li key={w.word} className="found__word-item" role="listitem">
      <button
        type="button"
        className={`found__word found__word--${w.category}`}
        aria-label={`${w.word}, show definition`}
        onClick={(e) => {
          e.currentTarget.focus();
          onWordTap(w.word, e.currentTarget);
        }}
      >
        <span className={`mark mark--${w.category}`} aria-hidden="true" />
        <span className="found__wordtext">{w.word}</span>
        {isLadder(w.category) && (
          <>
            <span className="found__points">+{w.score}</span>
            {/* Hiding rung-note for now */}
            <span className="found__rung-note">
              {RUNG_NAMES[w.category].toLowerCase()}
            </span>
          </>
        )}
        {/* hiding for now */}
        <span className="found__disclosure" aria-hidden="true">
          +
        </span>
      </button>
    </li>
  );

  return (
    <section className="found" aria-label="Words found">
      <h2 className="found__title">The glossary</h2>

      {/* Nothing to summarise on an empty board; the summary appears with the
          first find, so the start stays an invitation, not a wall of zeros. */}
      {found.length > 0 && (
        <div className="summary">
          <ul className="summary__stats">
            <li className="summary__stat summary__stat--set">
              <span className="mark mark--set" aria-hidden="true" />
              <span className="summary__statline">
                {setFound} of {setTotal} words
              </span>
            </li>
            {LADDER_RUNGS.map((r) => (
              <li key={r} className={`summary__stat summary__stat--${r}`}>
                <span className={`mark mark--${r}`} aria-hidden="true" />
                <span className="summary__statline">
                  {rungCounts[r]} {RUNG_NAMES[r]}
                </span>
              </li>
            ))}
            <li className="summary__stat summary__stat--total">
              <span className="summary__statline">
                {found.length} {found.length === 1 ? 'word' : 'words'} found
              </span>
            </li>
          </ul>

          {/* The one progress bar, here in the glossary where the totals live.
              It carries the named tier, the bold points total, the two-color
              set-versus-off-page climb, and the explicit Set and Off-page numbers
              beneath it. There is no second bar under the input. */}
          <TierMeter tier={tier} theme={theme} />

          {summaryExtra}
        </div>
      )}

      {found.length === 0 ? (
        <p className="found__empty">No words set yet. The case is full.</p>
      ) : (
        groups.map((g) => (
          <section className="found__group" key={g.length}>
            <div className="found__grouphead">
              <h3 className="found__grouplen">{g.length} letters</h3>
              {g.setTotal > 0 && (
                <span className="found__groupcount">
                  {g.setFound} of {g.setTotal}
                </span>
              )}
            </div>
            {/* The count above describes the set list only. Off-page finds of
                the same length follow in their own list, never counted. */}
            {g.setWords.length > 0 && (
              <ul className="found__words found__words--set">
                {g.setWords.map(renderChip)}
              </ul>
            )}
            {/* Only when a row carries both: a quiet aside framing the off-page
                finds as extras, so the count above never reads as describing
                them. Set-only rows stay clean and label-free. */}
            {g.setWords.length > 0 && g.offPageWords.length > 0 && (
              <p className="found__alsofound">also found</p>
            )}
            {g.offPageWords.length > 0 && (
              <ul className="found__words found__words--offpage">
                {g.offPageWords.map(renderChip)}
              </ul>
            )}
          </section>
        ))
      )}

      <div className="legend" aria-hidden="true">
        <span className="legend__caption">Key</span>
        <span>
          <span className="mark mark--set" /> in the set
        </span>
        {LADDER_RUNGS.map((r) => (
          <span key={r}>
            <span className={`mark mark--${r}`} /> {RUNG_NAMES[r]}
          </span>
        ))}
        <span>
          <span className="mark mark--source" /> source word
        </span>
      </div>
    </section>
  );
}
