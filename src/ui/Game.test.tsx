import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Game } from './Game.tsx';
import {
  createListDictionary,
  createListWordSource,
} from '@/data/listSource.ts';
import type { GameData } from '@/data/gameData.ts';
import type { SourceEntry } from '@/data/types.ts';
import { NullAudioEngine } from '@/audio/AudioEngine.ts';
import { GameStorage, type KeyValueStore } from '@/persistence/storage.ts';

const ENABLE = [
  'serenade',
  'sea',
  'near',
  'sane',
  'sneer',
  'eased',
  'dean',
  'erase',
];
// set/in-the-set words; 'sane' is bonus (valid, not common, not rare);
// 'sneer' is the rare find (in the rare pool, not common).
const COMMON = ['serenade', 'sea', 'near', 'dean', 'eased', 'erase'];

const ENTRY: SourceEntry = {
  word: 'serenade',
  definition: 'noun. a love song sung to a sweetheart.',
  etymology: 'Borrowed from French serenade, from Italian serenata.',
};

function fakeData(): GameData {
  return {
    dictionary: createListDictionary(ENABLE),
    commonPool: createListWordSource(COMMON),
    rarePool: createListWordSource(['sneer']), // the rare find on this rack
    sourceWords: ['serenade'], // single-word pool: the daily is always serenade
    sourceEntry: (w) => (w === 'serenade' ? ENTRY : undefined),
  };
}

function fakeStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

function type(word: string) {
  for (const ch of word) fireEvent.keyDown(window, { key: ch });
}

function renderGame(store = fakeStore()) {
  return render(
    <Game
      data={fakeData()}
      audio={new NullAudioEngine()}
      storage={new GameStorage(store)}
    />,
  );
}

describe('Game', () => {
  beforeEach(() => {
    // jsdom has no Web Audio; NullAudioEngine sidesteps it entirely.
  });

  it('renders the rack of eight type sorts', () => {
    renderGame();
    const tiles = screen.getAllByRole('button', { name: /^Letter / });
    expect(tiles).toHaveLength(8);
  });

  it('accepts a typed word and prints it to the glossary', () => {
    renderGame();
    type('sea');
    fireEvent.keyDown(window, { key: 'Enter' });

    const glossary = screen.getByRole('region', { name: /words found/i });
    expect(within(glossary).getByText('sea')).toBeInTheDocument();
  });

  it('rejects a non-word with direction, not an apology', () => {
    renderGame();
    // 'rns' is formable but not in ENABLE.
    type('rns');
    fireEvent.keyDown(window, { key: 'Enter' });
    // The message shows in both the visible line and the live region.
    expect(screen.getAllByText(/not in the word list/i).length).toBeGreaterThan(
      0,
    );
  });

  function findWord(text: string): HTMLElement {
    const glossary = screen.getByRole('region', { name: /words found/i });
    return within(glossary).getByText(text).closest('li') as HTMLElement;
  }

  it('renders a bonus word filled with a dagger and inline points', () => {
    renderGame();
    type('sane'); // valid, not common, not rare
    fireEvent.keyDown(window, { key: 'Enter' });

    const li = findWord('sane');
    expect(li).toHaveClass('found__word--bonus');
    expect(li.querySelector('.mark--bonus')).toBeTruthy(); // dagger mark, filled
    expect(li.textContent).toMatch(/\+\d/); // inline points
    expect(li.textContent).not.toMatch(/rare/i);
    expect(screen.getByText(/1 bonus found/i)).toBeInTheDocument();
  });

  it('renders a rare word with a diamond and a rare-find note', () => {
    renderGame();
    type('sneer'); // in the rare pool
    fireEvent.keyDown(window, { key: 'Enter' });

    const li = findWord('sneer');
    expect(li).toHaveClass('found__word--rare');
    expect(li.querySelector('.mark--rare')).toBeTruthy(); // diamond mark
    expect(li.textContent).toMatch(/\+\d/);
    expect(li.textContent).toMatch(/rare find/i);
    expect(screen.getByText(/1 rare found/i)).toBeInTheDocument();
  });

  it('tallies bonus and rare without ever showing a denominator', () => {
    renderGame();
    type('sane'); // bonus
    fireEvent.keyDown(window, { key: 'Enter' });
    type('sneer'); // rare
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByText(/1 bonus found/i)).toBeInTheDocument();
    expect(screen.getByText(/1 rare found/i)).toBeInTheDocument();
    // The set keeps "X of Y"; bonus and rare never do.
    expect(screen.queryByText(/bonus.*of/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rare.*of/i)).not.toBeInTheDocument();
  });

  it('updates the tier as common words are found', () => {
    renderGame();
    expect(screen.getByText('Blank Page')).toBeInTheDocument();
    type('serenade'); // 15 of the common total in one word
    fireEvent.keyDown(window, { key: 'Enter' });
    // Tier should have climbed off Blank Page.
    expect(screen.queryByText('Blank Page')).not.toBeInTheDocument();
  });

  it('reveals the source word with definition and etymology', () => {
    renderGame();
    type('serenade');
    fireEvent.keyDown(window, { key: 'Enter' });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('serenade')).toBeInTheDocument();
    expect(within(dialog).getByText(/a love song/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Borrowed from French/i),
    ).toBeInTheDocument();
  });

  it('announces found words for screen readers', () => {
    renderGame();
    type('sea');
    fireEvent.keyDown(window, { key: 'Enter' });
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/sea/i);
  });

  it('persists progress across a remount', () => {
    const store = fakeStore();
    const first = renderGame(store);
    type('sea');
    fireEvent.keyDown(window, { key: 'Enter' });
    first.unmount();

    // A fresh mount with the same store restores the found word.
    renderGame(store);
    const glossary = screen.getByRole('region', { name: /words found/i });
    expect(within(glossary).getByText('sea')).toBeInTheDocument();
  });

  it('toggles mute', () => {
    renderGame();
    const mute = screen.getByRole('button', { name: /mute sound/i });
    fireEvent.click(mute);
    expect(
      screen.getByRole('button', { name: /unmute sound/i }),
    ).toBeInTheDocument();
  });

  it('switches and persists the theme', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Cute' }));
    expect(document.documentElement.dataset.theme).toBe('cute');
    expect(localStorage.getItem('e8-theme')).toBe('cute');

    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(document.documentElement.dataset.theme).toBe('letterpress');
  });

  it('lists the source word in the glossary legend', () => {
    renderGame();
    const glossary = screen.getByRole('region', { name: /words found/i });
    expect(within(glossary).getByText('source word')).toBeInTheDocument();
  });
});

describe('Game mode state retention', () => {
  const glossary = () => screen.getByRole('region', { name: /words found/i });
  const toDaily = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));
  const toEndless = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Endless' }));
  const findWord = (w: string) => {
    type(w);
    fireEvent.keyDown(window, { key: 'Enter' });
  };

  it('retains the endless game and progress across a mode switch', () => {
    renderGame();
    toEndless();
    findWord('sea'); // found in endless

    toDaily();
    expect(within(glossary()).queryByText('sea')).not.toBeInTheDocument();

    toEndless();
    expect(within(glossary()).getByText('sea')).toBeInTheDocument();
  });

  it('keeps daily and endless progress separate', () => {
    renderGame();
    findWord('near'); // found in daily (default mode)
    toEndless();
    expect(within(glossary()).queryByText('near')).not.toBeInTheDocument();

    findWord('sea'); // found in endless
    toDaily();
    expect(within(glossary()).getByText('near')).toBeInTheDocument();
    expect(within(glossary()).queryByText('sea')).not.toBeInTheDocument();
  });

  it('only New Puzzle changes the endless game', () => {
    renderGame();
    toEndless();
    findWord('sea');
    expect(within(glossary()).getByText('sea')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /new puzzle/i }));
    expect(within(glossary()).queryByText('sea')).not.toBeInTheDocument();
  });

  it('preserves the endless game across a reload (remount)', () => {
    const store = fakeStore();
    const first = renderGame(store);
    toEndless();
    findWord('sea');
    first.unmount();

    // Fresh mount, same store: endless rehydrates with its progress.
    renderGame(store);
    toEndless();
    expect(within(glossary()).getByText('sea')).toBeInTheDocument();
  });
});

describe('Game edition complete', () => {
  const enter = () => fireEvent.keyDown(window, { key: 'Enter' });
  const findWord = (w: string) => {
    type(w);
    enter();
  };
  const editionCard = () =>
    screen.queryByRole('region', { name: /edition complete/i });
  // Every common word on this rack: finding all of them is 100% of the set.
  const SET = ['sea', 'near', 'dean', 'eased', 'erase'];

  function completeTheSet() {
    findWord('serenade'); // the source word; dismiss its amber reveal first
    fireEvent.click(screen.getByRole('button', { name: /back to the case/i }));
    SET.slice(0, -1).forEach(findWord);
    findWord(SET[SET.length - 1]!); // the last set word completes the edition
  }

  it('does not celebrate before the set is finished', () => {
    renderGame();
    findWord('serenade');
    fireEvent.click(screen.getByRole('button', { name: /back to the case/i }));
    findWord('sea');
    expect(editionCard()).not.toBeInTheDocument();
  });

  it('fires the celebration once and does not end the game', () => {
    renderGame();
    completeTheSet();

    // The card appears and the tier label holds Edition Complete.
    expect(editionCard()).toBeInTheDocument();
    const tier = screen.getByRole('region', { name: /completion/i });
    expect(within(tier).getByText('Edition Complete')).toBeInTheDocument();

    // Play continues: a bonus word can still be set.
    findWord('sane');
    const glossary = screen.getByRole('region', { name: /words found/i });
    expect(within(glossary).getByText('sane')).toBeInTheDocument();

    // Dismiss, and it does not return (fires once).
    fireEvent.click(screen.getByRole('button', { name: /keep going/i }));
    expect(editionCard()).not.toBeInTheDocument();
    findWord('sneer'); // another non-set find
    expect(editionCard()).not.toBeInTheDocument();
    // The label still holds the top rung.
    const tierAfter = screen.getByRole('region', { name: /completion/i });
    expect(within(tierAfter).getByText('Edition Complete')).toBeInTheDocument();
  });

  it('announces the completion for screen readers', () => {
    renderGame();
    completeTheSet();
    expect(screen.getByRole('status').textContent).toMatch(
      /edition complete\. every word in the set found/i,
    );
  });
});
