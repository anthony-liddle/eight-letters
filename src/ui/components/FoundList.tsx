import { useMemo } from 'react';
import type { Puzzle } from '@/engine/index.ts';

interface Props {
  puzzle: Puzzle;
  found: readonly string[];
}

interface Group {
  length: number;
  commonTotal: number;
  commonFound: number;
  words: { word: string; isCommon: boolean; isSource: boolean }[];
}

function buildGroups(puzzle: Puzzle, found: readonly string[]): Group[] {
  const commonTotalByLen = new Map<number, number>();
  for (const w of puzzle.commonWords) {
    commonTotalByLen.set(w.length, (commonTotalByLen.get(w.length) ?? 0) + 1);
  }

  const foundByLen = new Map<number, Group['words']>();
  for (const word of found) {
    const isCommon = puzzle.commonWords.has(word);
    const entry = {
      word,
      isCommon,
      isSource: word === puzzle.sourceWord,
    };
    const list = foundByLen.get(word.length) ?? [];
    list.push(entry);
    foundByLen.set(word.length, list);
  }

  const lengths = new Set<number>([
    ...commonTotalByLen.keys(),
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
        commonTotal: commonTotalByLen.get(length) ?? 0,
        commonFound: words.filter((w) => w.isCommon).length,
        words,
      };
    });
}

export function FoundList({ puzzle, found }: Props) {
  const groups = useMemo(() => buildGroups(puzzle, found), [puzzle, found]);
  const totalCommon = puzzle.commonWords.size;
  const foundCommon = found.filter((w) => puzzle.commonWords.has(w)).length;

  return (
    <section className="found" aria-label="Words found">
      <div className="found__head">
        <h2 className="found__title">The glossary</h2>
        <span className="found__count">
          {foundCommon} of {totalCommon} in the set
        </span>
      </div>

      {found.length === 0 ? (
        <p className="found__empty">No words set yet. The case is full.</p>
      ) : (
        groups.map((g) => (
          <div className="found__group" key={g.length}>
            <div className="found__grouphead">
              <span>{g.length} letters</span>
              {g.commonTotal > 0 && (
                <span>
                  {g.commonFound} of {g.commonTotal}
                </span>
              )}
            </div>
            <ul className="found__words">
              {g.words.map((w) => (
                <li
                  key={w.word}
                  className={
                    'found__word' +
                    (w.isSource
                      ? ' found__word--source'
                      : w.isCommon
                        ? ' found__word--common'
                        : '')
                  }
                >
                  {w.word}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <div className="legend" aria-hidden="true">
        <span>
          <i className="is-common" /> in the set
        </span>
        <span>
          <i className="is-bonus" /> bonus
        </span>
      </div>
    </section>
  );
}
