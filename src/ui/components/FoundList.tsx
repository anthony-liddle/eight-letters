import { useMemo, type ReactNode } from 'react';
import { classifyWord, scoreWord, type Puzzle } from '@/engine/index.ts';
import { LADDER_RUNGS, RUNG_NAMES, type LadderRung } from '../rarity.ts';

interface Props {
  puzzle: Puzzle;
  found: readonly string[];
  /**
   * The score meter's value, the single source of truth shared with the
   * completion bar's readout. The summary shows its composition (set points
   * versus off-page points), which by construction sums back to this.
   */
  totalScore: number;
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
  words: Word[];
}

function categorize(word: string, puzzle: Puzzle): Category {
  if (word === puzzle.sourceWord) return 'source';
  // The source word aside, the rung is the single source of truth: set, or one
  // of the three off-page rungs.
  return classifyWord(word, puzzle);
}

function buildGroups(puzzle: Puzzle, found: readonly string[]): Group[] {
  const setTotalByLen = new Map<number, number>();
  for (const w of puzzle.commonWords) {
    setTotalByLen.set(w.length, (setTotalByLen.get(w.length) ?? 0) + 1);
  }

  const foundByLen = new Map<number, Word[]>();
  for (const word of found) {
    const list = foundByLen.get(word.length) ?? [];
    list.push({
      word,
      category: categorize(word, puzzle),
      score: scoreWord(word),
    });
    foundByLen.set(word.length, list);
  }

  const lengths = new Set<number>([
    ...setTotalByLen.keys(),
    ...foundByLen.keys(),
  ]);

  // Longest first: the eight-letter word sits at the head of the glossary.
  return [...lengths]
    .sort((a, b) => b - a)
    .map((length) => {
      const words = (foundByLen.get(length) ?? []).sort((a, b) =>
        a.word.localeCompare(b.word),
      );
      return {
        length,
        setTotal: setTotalByLen.get(length) ?? 0,
        // The source word is a set word too, so it counts toward the set.
        setFound: words.filter(
          (w) => w.category === 'set' || w.category === 'source',
        ).length,
        words,
      };
    });
}

/** True for an off-page ladder word: points shown inline, mark by shape. */
function isLadder(category: Category): category is LadderRung {
  return category !== 'set' && category !== 'source';
}

/** "point" or "points", for prose like aria labels. */
function pointWord(n: number): string {
  return n === 1 ? 'point' : 'points';
}

export function FoundList({
  puzzle,
  found,
  totalScore,
  onWordTap,
  summaryExtra,
}: Props) {
  const groups = useMemo(() => buildGroups(puzzle, found), [puzzle, found]);

  const setTotal = puzzle.commonWords.size;
  const setFound = found.filter((w) => puzzle.commonWords.has(w)).length;

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

  // The score's composition: points from the set (the source word's points are
  // set points, since it is a set word) versus points from off-page finds. The
  // two partition every find, so they sum to totalScore by construction.
  const setPoints = useMemo(() => {
    let sum = 0;
    for (const w of found) {
      if (puzzle.commonWords.has(w)) sum += scoreWord(w);
    }
    return sum;
  }, [found, puzzle]);
  const offPagePoints = totalScore - setPoints;

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
                {setFound} of {setTotal} in the set
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

          <div className="summary__score">
            <p className="summary__scorehead">
              <span className="summary__scorelabel">Score</span>
              <span className="summary__scoretotal">{totalScore}</span>
            </p>
            {/* Subordinate to the completion bar: smaller, labelled, role=img not
              progressbar. The set segment is the status colour, the off-page
              segment the discovery colour, the same green-equals-set,
              blue-equals-off-page language as the marks. Segments are told apart
              by label and value too, so the split survives colour-blind play. */}
            <div
              className="compbar"
              role="img"
              aria-label={`Score breakdown: ${setPoints} set ${pointWord(setPoints)}, ${offPagePoints} off-page ${pointWord(offPagePoints)}`}
            >
              <span
                className="compbar__seg compbar__seg--set"
                style={{ flexGrow: setPoints }}
                aria-hidden="true"
              />
              <span
                className="compbar__seg compbar__seg--offpage"
                style={{ flexGrow: offPagePoints }}
                aria-hidden="true"
              />
            </div>
            <p className="compbar__key">
              <span className="compbar__keyitem compbar__keyitem--set">
                <span
                  className="compbar__swatch compbar__swatch--set"
                  aria-hidden="true"
                />
                Set {setPoints}
              </span>
              <span className="compbar__keyitem compbar__keyitem--offpage">
                <span
                  className="compbar__swatch compbar__swatch--offpage"
                  aria-hidden="true"
                />
                Off-page {offPagePoints}
              </span>
            </p>
          </div>

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
            <ul className="found__words">
              {g.words.map((w) => (
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
                    <span
                      className={`mark mark--${w.category}`}
                      aria-hidden="true"
                    />
                    <span className="found__wordtext">{w.word}</span>
                    {isLadder(w.category) && (
                      <>
                        <span className="found__points">+{w.score}</span>
                        <span className="found__rung-note">
                          {RUNG_NAMES[w.category].toLowerCase()}
                        </span>
                      </>
                    )}
                    <span className="found__disclosure" aria-hidden="true">
                      +
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
