import { useMemo } from 'react';
import { classifyWord, scoreWord, type Puzzle } from '@/engine/index.ts';
import { LADDER_RUNGS, RUNG_NAMES, type LadderRung } from '../rarity.ts';

interface Props {
  puzzle: Puzzle;
  found: readonly string[];
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

export function FoundList({ puzzle, found }: Props) {
  const groups = useMemo(() => buildGroups(puzzle, found), [puzzle, found]);

  const setTotal = puzzle.commonWords.size;
  const setFound = found.filter((w) => puzzle.commonWords.has(w)).length;

  // Open-ended counts per rung: a tally, never a denominator.
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
  const anyLadder = LADDER_RUNGS.some((r) => rungCounts[r] > 0);

  return (
    <section className="found" aria-label="Words found">
      <div className="found__head">
        <h2 className="found__title">The glossary</h2>
        <span className="found__count">
          {setFound} of {setTotal} in the set
        </span>
      </div>

      {anyLadder && (
        <p className="found__tallies">
          {LADDER_RUNGS.filter((r) => rungCounts[r] > 0).map((r) => (
            <span key={r} className={`found__tally found__tally--${r}`}>
              <span className={`mark mark--${r}`} aria-hidden="true" />
              {rungCounts[r]} {RUNG_NAMES[r]}
            </span>
          ))}
        </p>
      )}

      {found.length === 0 ? (
        <p className="found__empty">No words set yet. The case is full.</p>
      ) : (
        groups.map((g) => (
          <div className="found__group" key={g.length}>
            <div className="found__grouphead">
              <span>{g.length} letters</span>
              {g.setTotal > 0 && (
                <span>
                  {g.setFound} of {g.setTotal}
                </span>
              )}
            </div>
            <ul className="found__words">
              {g.words.map((w) => (
                <li
                  key={w.word}
                  className={`found__word found__word--${w.category}`}
                >
                  <span
                    className={`mark mark--${w.category}`}
                    aria-hidden="true"
                  />
                  {w.word}
                  {isLadder(w.category) && (
                    <>
                      <span className="found__points">+{w.score}</span>
                      <span className="found__rung-note">
                        {RUNG_NAMES[w.category].toLowerCase()}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <div className="legend" aria-hidden="true">
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
