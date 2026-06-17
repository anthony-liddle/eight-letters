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
const COMMON = ['serenade', 'sea', 'near', 'sane', 'eased', 'dean', 'erase'];

const ENTRY: SourceEntry = {
  word: 'serenade',
  definition: 'noun. a love song sung to a sweetheart.',
  etymology: 'Borrowed from French serenade, from Italian serenata.',
};

function fakeData(): GameData {
  return {
    dictionary: createListDictionary(ENABLE),
    commonPool: createListWordSource(COMMON),
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
});
