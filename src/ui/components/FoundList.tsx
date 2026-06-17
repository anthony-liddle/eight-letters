import { useMemo } from 'react';
import { scoreWord, type Puzzle } from '@/engine/index.ts';

interface Props {
  puzzle: Puzzle;
  found: readonly string[];
}

type Category = 'source' | 'set' | 'rare' | 'bonus';

interface Word {
  word: string;
  category: Category;
  score: number;
}

interface Group {
  length: number;
  /** Common-pool words of this length (the "of Y"). */
  setTotal: number;
  /** Common-pool words of this length that were found (the "X"). */
  setFound: number;
  words: Word[];
}

function categorize(word: string, puzzle: Puzzle): Category {
  if (word === puzzle.sourceWord) return 'source';
  if (puzzle.commonWords.has(word)) return 'set';
  if (puzzle.rareWords.has(word)) return 'rare';
  return 'bonus';
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
        // The source word is a common word too, so it counts toward the set.
        setFound: words.filter(
          (w) => w.category === 'set' || w.category === 'source',
        ).length,
        words,
      };
    });
}

const MARK: Record<Category, string> = {
  set: '',
  bonus: '†',
  rare: '◆',
  source: '',
};

export function FoundList({ puzzle, found }: Props) {
  const groups = useMemo(() => buildGroups(puzzle, found), [puzzle, found]);

  const setTotal = puzzle.commonWords.size;
  const setFound = found.filter((w) => puzzle.commonWords.has(w)).length;
  const bonusFound = found.filter(
    (w) => categorize(w, puzzle) === 'bonus',
  ).length;
  const rareFound = found.filter(
    (w) => categorize(w, puzzle) === 'rare',
  ).length;

  return (
    <section className="found" aria-label="Words found">
      <div className="found__head">
        <h2 className="found__title">The glossary</h2>
        <span className="found__count">
          {setFound} of {setTotal} in the set
        </span>
      </div>

      {(bonusFound > 0 || rareFound > 0) && (
        <p className="found__tallies">
          {bonusFound > 0 && (
            <span className="found__tally found__tally--bonus">
              {bonusFound} bonus found
            </span>
          )}
          {rareFound > 0 && (
            <span className="found__tally found__tally--rare">
              {rareFound} rare found
            </span>
          )}
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
                  <span className="found__mark" aria-hidden="true">
                    {MARK[w.category]}
                  </span>
                  {w.word}
                  {(w.category === 'bonus' || w.category === 'rare') && (
                    <span className="found__points">+{w.score}</span>
                  )}
                  {w.category === 'rare' && (
                    <span className="found__rare-note">rare find</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <div className="legend" aria-hidden="true">
        <span>
          <i className="legend-mark legend-mark--set" /> in the set
        </span>
        <span>
          <i className="legend-mark legend-mark--bonus">†</i> bonus
        </span>
        <span>
          <i className="legend-mark legend-mark--rare">◆</i> rare
        </span>
      </div>
    </section>
  );
}
