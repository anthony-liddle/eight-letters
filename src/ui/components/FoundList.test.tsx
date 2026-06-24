import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FoundList } from './FoundList.tsx';
import { scoreWord, totalScore, type Puzzle } from '@/engine/index.ts';

// A small hand-built puzzle: six set words across four lengths, plus one find on
// each off-page rung. Only the fields FoundList reads need to be real.
function makePuzzle(): Puzzle {
  const common = ['serenade', 'sea', 'near', 'dean', 'eased', 'erase'];
  const uncommon = ['sane'];
  const rare = ['sneer'];
  const mythic = ['denar'];
  return {
    sourceWord: 'serenade',
    letters: 'adeenrs',
    validationWords: new Set([...common, ...uncommon, ...rare, ...mythic]),
    commonWords: new Set(common),
    uncommonWords: new Set(uncommon),
    rareWords: new Set(rare),
    mythicWords: new Set(mythic),
    reachableScore: 0,
  };
}

function renderList(found: string[]) {
  const puzzle = makePuzzle();
  return render(
    <FoundList
      puzzle={puzzle}
      found={found}
      totalScore={totalScore(found)}
      onWordTap={() => {}}
    />,
  );
}

describe('FoundList totals summary', () => {
  it('shows set progress as "X of Y" and the three rung counts with no denominators', () => {
    renderList(['sea', 'near', 'sane', 'sneer', 'denar']);

    // The set is the goal and carries its denominator.
    expect(screen.getByText(/2 of 6 in the set/i)).toBeInTheDocument();

    // The rarity ladder is counts only: never "of N".
    expect(screen.getByText(/1 uncommon/i)).toBeInTheDocument();
    expect(screen.getByText(/1 rare/i)).toBeInTheDocument();
    expect(screen.getByText(/1 mythic/i)).toBeInTheDocument();
    expect(screen.queryByText(/uncommon.*of/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rare.*of/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mythic.*of/i)).not.toBeInTheDocument();
  });

  it('shows a total words-found figure', () => {
    renderList(['sea', 'near', 'sane', 'sneer', 'denar']);
    expect(screen.getByText(/5 words found/i)).toBeInTheDocument();
  });

  it('updates the rung counts and total as set and off-page words are found', () => {
    const { rerender } = renderList(['sane']);
    expect(screen.getByText(/1 uncommon/i)).toBeInTheDocument();
    expect(screen.getByText(/0 rare/i)).toBeInTheDocument();
    expect(screen.getByText(/0 mythic/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 6 in the set/i)).toBeInTheDocument();
    expect(screen.getByText(/1 word found/i)).toBeInTheDocument();

    const puzzle = makePuzzle();
    const found = ['sane', 'sneer', 'sea'];
    rerender(
      <FoundList
        puzzle={puzzle}
        found={found}
        totalScore={totalScore(found)}
        onWordTap={() => {}}
      />,
    );
    expect(screen.getByText(/1 uncommon/i)).toBeInTheDocument();
    expect(screen.getByText(/1 rare/i)).toBeInTheDocument();
    expect(screen.getByText(/0 mythic/i)).toBeInTheDocument();
    expect(screen.getByText(/1 of 6 in the set/i)).toBeInTheDocument();
    expect(screen.getByText(/3 words found/i)).toBeInTheDocument();
  });
});

describe('FoundList score composition', () => {
  it('splits the score into set points and off-page points that sum to the displayed score', () => {
    // serenade is a set word (its points are set points); sane is off-page.
    const found = ['serenade', 'sane'];
    renderList(found);

    const setPoints = scoreWord('serenade');
    const offPagePoints = scoreWord('sane');
    expect(setPoints + offPagePoints).toBe(totalScore(found));

    const breakdown = screen.getByRole('img', { name: /score breakdown/i });
    expect(breakdown).toHaveAccessibleName(new RegExp(`${setPoints} set`, 'i'));
    expect(breakdown).toHaveAccessibleName(
      new RegExp(`${offPagePoints} off-page`, 'i'),
    );

    // The labelled values are shown, distinguishing the segments by more than
    // colour.
    expect(
      screen.getByText(new RegExp(`set\\s+${setPoints}`, 'i')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`off-page\\s+${offPagePoints}`, 'i')),
    ).toBeInTheDocument();
  });
});

describe('FoundList structure', () => {
  it('renders each word-length group as a section with a level-3 heading', () => {
    renderList(['serenade', 'sea', 'near', 'sneer']);

    const headings = screen.getAllByRole('heading', { level: 3 });
    const names = headings.map((h) => h.textContent);
    expect(names).toContain('8 letters');
    expect(names).toContain('4 letters');
    expect(names).toContain('3 letters');
  });

  it('renders the legend as a distinct key, separated from the word list', () => {
    renderList(['sea']);

    const glossary = screen.getByRole('region', { name: /words found/i });
    const legend = glossary.querySelector('.legend');
    expect(legend).toBeTruthy();
    // A caption sets the key off as a key, not another row of found words.
    expect(
      within(legend as HTMLElement).getByText(/^key$/i),
    ).toBeInTheDocument();
    expect(
      within(legend as HTMLElement).getByText('source word'),
    ).toBeInTheDocument();
  });
});

describe('FoundList word tap', () => {
  it('renders each found word as a button that reports taps with its element', () => {
    const puzzle = makePuzzle();
    const onWordTap = vi.fn();
    render(
      <FoundList
        puzzle={puzzle}
        found={['sea']}
        totalScore={totalScore(['sea'])}
        onWordTap={onWordTap}
      />,
    );
    const btn = screen.getByRole('button', { name: /sea, show definition/i });
    fireEvent.click(btn);
    expect(onWordTap).toHaveBeenCalledWith('sea', btn);
    expect(document.activeElement).toBe(btn);
  });

  it('exposes a non-color affordance on each word', () => {
    const puzzle = makePuzzle();
    const { container } = render(
      <FoundList
        puzzle={puzzle}
        found={['sea']}
        totalScore={totalScore(['sea'])}
        onWordTap={() => {}}
      />,
    );
    expect(
      container.querySelector('.found__word .found__disclosure'),
    ).not.toBeNull();
  });
});
