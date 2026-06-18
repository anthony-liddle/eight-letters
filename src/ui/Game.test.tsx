import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Game } from './Game.tsx';
import { CONFETTI_DURATION_MS } from './components/confetti.ts';
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
  'denar',
];
// The set (common) words carry no rarity label. The off-page finds exercise all
// three rungs: 'sane' is uncommon (in size 70), 'sneer' is rare (beyond 70, in
// 95), 'denar' is mythic (beyond 95).
const COMMON = ['serenade', 'sea', 'near', 'dean', 'eased', 'erase'];
const BEYOND_70 = ['sneer', 'denar']; // beyond size 70
const BEYOND_95 = ['denar']; // beyond size 95

const ENTRY: SourceEntry = {
  word: 'serenade',
  definition: 'noun. a love song sung to a sweetheart.',
  etymology: 'Borrowed from French serenade, from Italian serenata.',
};

function fakeData(): GameData {
  return {
    dictionary: createListDictionary(ENABLE),
    commonPool: createListWordSource(COMMON),
    beyond70Pool: createListWordSource(BEYOND_70),
    beyond95Pool: createListWordSource(BEYOND_95),
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

function countingStore(): { store: KeyValueStore; writes: () => number } {
  const map = new Map<string, string>();
  let writes = 0;
  return {
    store: {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        writes += 1;
        map.set(k, v);
      },
    },
    writes: () => writes,
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

  it('renders an uncommon find with its mark and inline points', () => {
    renderGame();
    type('sane'); // off-page, in size 70: uncommon
    fireEvent.keyDown(window, { key: 'Enter' });

    const li = findWord('sane');
    expect(li).toHaveClass('found__word--uncommon');
    expect(li.querySelector('.mark--uncommon')).toBeTruthy();
    expect(li.textContent).toMatch(/\+\d/); // points are the reward, shown inline
    expect(screen.getByText(/1 uncommon/i)).toBeInTheDocument();
  });

  it('renders a rare find with its mark and inline points', () => {
    renderGame();
    type('sneer'); // off-page, beyond 70 but in 95: rare
    fireEvent.keyDown(window, { key: 'Enter' });

    const li = findWord('sneer');
    expect(li).toHaveClass('found__word--rare');
    expect(li.querySelector('.mark--rare')).toBeTruthy();
    expect(li.textContent).toMatch(/\+\d/);
    expect(screen.getByText(/1 rare/i)).toBeInTheDocument();
  });

  it('renders a mythic find with its mark and inline points', () => {
    renderGame();
    type('denar'); // off-page, beyond 95: mythic
    fireEvent.keyDown(window, { key: 'Enter' });

    const li = findWord('denar');
    expect(li).toHaveClass('found__word--mythic');
    expect(li.querySelector('.mark--mythic')).toBeTruthy();
    expect(li.textContent).toMatch(/\+\d/);
    expect(screen.getByText(/1 mythic/i)).toBeInTheDocument();
  });

  it('tallies each rarity rung without ever showing a denominator', () => {
    renderGame();
    ['sane', 'sneer', 'denar'].forEach((w) => {
      type(w);
      fireEvent.keyDown(window, { key: 'Enter' });
    });

    expect(screen.getByText(/1 uncommon/i)).toBeInTheDocument();
    expect(screen.getByText(/1 rare/i)).toBeInTheDocument();
    expect(screen.getByText(/1 mythic/i)).toBeInTheDocument();
    // The set keeps "X of Y"; the rarity ladder never does.
    expect(screen.queryByText(/uncommon.*of/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rare.*of/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mythic.*of/i)).not.toBeInTheDocument();
  });

  it('announces an off-page find with its rung for screen readers', () => {
    renderGame();
    type('sneer'); // rare
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toMatch(/rare find: sneer/i);
  });

  it('keeps the bar and the X-of-Y counter in agreement', () => {
    renderGame();
    // Two of the six set words found.
    type('sea');
    fireEvent.keyDown(window, { key: 'Enter' });
    type('near');
    fireEvent.keyDown(window, { key: 'Enter' });

    const counter = screen.getByText(/2 of 6 in the set/i);
    expect(counter).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    // 2 of 6 is 33 percent, the same fact the counter shows.
    expect(bar).toHaveAttribute('aria-valuenow', '33');
  });

  it('lets an off-page find feed the score but never the bar', () => {
    renderGame();
    const bar = screen.getByRole('progressbar');
    const meter = screen.getByRole('region', { name: /completion/i });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(within(meter).getByText('0 points')).toBeInTheDocument();

    type('denar'); // mythic, off-page, 5 letters -> 5 points
    fireEvent.keyDown(window, { key: 'Enter' });

    // The bar has not moved: the set is still empty.
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    // But the score meter has climbed by the word's points.
    expect(within(meter).getByText('5 points')).toBeInTheDocument();
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

  it('does not write to storage while composing, only on a valid submit', () => {
    const counting = countingStore();
    render(
      <Game
        data={fakeData()}
        audio={new NullAudioEngine()}
        storage={new GameStorage(counting.store)}
      />,
    );
    const afterMount = counting.writes();

    // Compose, delete, clear, and shuffle: none of these change found words.
    fireEvent.keyDown(window, { key: 's' });
    fireEvent.keyDown(window, { key: 'e' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Backspace' });
    fireEvent.keyDown(window, { key: 'Escape' }); // clear
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
    expect(counting.writes()).toBe(afterMount);

    // A valid submitted word is durable progress and must be written.
    type('sea');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(counting.writes()).toBeGreaterThan(afterMount);
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

  it('switches and persists the theme, and names the right fonts', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Cute' }));
    expect(document.documentElement.dataset.theme).toBe('cute');
    expect(localStorage.getItem('e8-theme')).toBe('cute');
    expect(screen.getByText(/Set in Fredoka and Nunito/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(document.documentElement.dataset.theme).toBe('letterpress');
    expect(
      screen.getByText(/Set in Fraunces and Spectral/i),
    ).toBeInTheDocument();
  });

  it('swaps the theme from the compact button and keeps name and label in sync', () => {
    document.documentElement.dataset.theme = 'letterpress';
    renderGame();

    // In classic it shows the current theme and offers to switch to cute.
    const fromClassic = screen.getByRole('button', {
      name: /theme: classic\. activate to switch to cute/i,
    });
    expect(fromClassic).toHaveTextContent(/classic/i);

    fireEvent.click(fromClassic);
    expect(document.documentElement.dataset.theme).toBe('cute');

    // Now it shows Cute and offers the way back to Classic.
    const fromCute = screen.getByRole('button', {
      name: /theme: cute\. activate to switch to classic/i,
    });
    expect(fromCute).toHaveTextContent(/cute/i);

    fireEvent.click(fromCute);
    expect(document.documentElement.dataset.theme).toBe('letterpress');
  });

  it('lists the source word in the glossary legend', () => {
    renderGame();
    const glossary = screen.getByRole('region', { name: /words found/i });
    expect(within(glossary).getByText('source word')).toBeInTheDocument();
  });

  it('shows no storage warning when persistence works', () => {
    renderGame();
    expect(screen.queryByText(/not saving progress/i)).not.toBeInTheDocument();
  });

  it('warns quietly when this browser will not save progress', () => {
    render(
      <Game
        data={fakeData()}
        audio={new NullAudioEngine()}
        storage={new GameStorage(fakeStore(), false)}
      />,
    );
    expect(screen.getByText(/not saving progress/i)).toBeInTheDocument();
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

describe('Game edition confetti', () => {
  const SET = ['sea', 'near', 'dean', 'eased', 'erase'];
  const enter = () => fireEvent.keyDown(window, { key: 'Enter' });
  const findWord = (w: string) => {
    type(w);
    enter();
  };
  const confetti = () => document.querySelector('canvas.confetti');
  function completeTheSet() {
    findWord('serenade');
    fireEvent.click(screen.getByRole('button', { name: /back to the case/i }));
    SET.forEach(findWord);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute('data-theme');
    delete (window as { matchMedia?: unknown }).matchMedia;
    localStorage.clear();
  });

  it('bursts confetti once when the set is completed in cute', () => {
    document.documentElement.dataset.theme = 'cute';
    renderGame();
    completeTheSet();
    expect(document.querySelectorAll('canvas.confetti')).toHaveLength(1);
  });

  it('bursts no confetti in classic, but still shows the card', () => {
    document.documentElement.dataset.theme = 'letterpress';
    renderGame();
    completeTheSet();
    expect(confetti()).toBeNull();
    expect(
      screen.getByRole('region', { name: /edition complete/i }),
    ).toBeInTheDocument();
  });

  it('bursts no confetti under reduced motion, but still shows the card', () => {
    (window as { matchMedia?: unknown }).matchMedia = vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    document.documentElement.dataset.theme = 'cute';
    renderGame();
    completeTheSet();
    expect(confetti()).toBeNull();
    expect(
      screen.getByRole('region', { name: /edition complete/i }),
    ).toBeInTheDocument();
  });

  it('the overlay never intercepts taps and is gone after the burst', () => {
    document.documentElement.dataset.theme = 'cute';
    renderGame();
    completeTheSet();

    const canvas = confetti() as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    expect(canvas.style.pointerEvents).toBe('none');

    act(() => {
      vi.advanceTimersByTime(CONFETTI_DURATION_MS);
    });
    expect(confetti()).toBeNull(); // fully torn down, no leftover node
  });

  it('does not re-fire on a mode switch', () => {
    document.documentElement.dataset.theme = 'cute';
    renderGame();
    completeTheSet();
    act(() => {
      vi.advanceTimersByTime(CONFETTI_DURATION_MS);
    });
    expect(confetti()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Endless' }));
    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));
    expect(confetti()).toBeNull();
  });

  it('does not re-fire when an already-complete puzzle is reloaded', () => {
    const store = fakeStore();
    document.documentElement.dataset.theme = 'cute';
    const first = renderGame(store);
    completeTheSet();
    act(() => {
      vi.advanceTimersByTime(CONFETTI_DURATION_MS);
    });
    first.unmount();

    // A fresh mount with the completed set restored fires no burst.
    renderGame(store);
    expect(confetti()).toBeNull();
  });
});

// The controls row, redesigned into two clusters: a quiet utility pair (Shuffle,
// Clear) set apart from the prominent primary pair (Delete, then Submit). These
// tests pin the structure, the accessible names, the wiring, and the rule that
// the two themes share one layout (skin differs, structure does not).
describe('Controls layout', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  const controls = () => document.querySelector('.controls') as HTMLElement;
  const stickText = () =>
    document.querySelector('.stick')?.textContent?.trim() ?? '';
  const controlNames = () =>
    within(controls())
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '');

  it('orders the controls Shuffle, Clear, Delete, Submit', () => {
    renderGame();
    const names = controlNames();
    expect(names).toEqual([
      'Shuffle',
      'Clear',
      'Delete last letter',
      'Set word',
    ]);
    // Delete sits before Submit: Bea's "delete before submit".
    expect(names.indexOf('Delete last letter')).toBeLessThan(
      names.indexOf('Set word'),
    );
  });

  it('groups the controls into a utility cluster and a primary cluster', () => {
    renderGame();
    const groups = controls().querySelectorAll<HTMLElement>('.controls__group');
    expect(groups).toHaveLength(2);

    const utility = groups[0]!;
    const primary = groups[1]!;
    expect(
      within(utility).getByRole('button', { name: 'Shuffle' }),
    ).toBeInTheDocument();
    expect(
      within(utility).getByRole('button', { name: 'Clear' }),
    ).toBeInTheDocument();
    expect(
      within(primary).getByRole('button', { name: 'Delete last letter' }),
    ).toBeInTheDocument();
    expect(
      within(primary).getByRole('button', { name: 'Set word' }),
    ).toBeInTheDocument();
  });

  it('gives every control its accessible name', () => {
    renderGame();
    expect(screen.getByRole('button', { name: 'Shuffle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete last letter' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Set word' }),
    ).toBeInTheDocument();
  });

  it('Delete removes the last composed letter', () => {
    renderGame();
    type('sea');
    expect(stickText()).toBe('sea');
    fireEvent.click(screen.getByRole('button', { name: 'Delete last letter' }));
    expect(stickText()).toBe('se');
  });

  it('Clear empties the composing word', () => {
    renderGame();
    type('sea');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(stickText()).toBe('Set letters to make a word');
  });

  it('Submit sets the composed word into the glossary', () => {
    renderGame();
    type('sea');
    fireEvent.click(screen.getByRole('button', { name: 'Set word' }));
    const glossary = screen.getByRole('region', { name: /words found/i });
    expect(within(glossary).getByText('sea')).toBeInTheDocument();
  });

  it('Shuffle rearranges the rack', () => {
    renderGame();
    const before = screen
      .getAllByRole('button', { name: /^Letter / })
      .map((b) => b.textContent);
    // Shuffle is randomised; retry a few times so the rare no-op shuffle does
    // not flake the test.
    let after = before;
    for (let i = 0; i < 20 && after.join('') === before.join(''); i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
      after = screen
        .getAllByRole('button', { name: /^Letter / })
        .map((b) => b.textContent);
    }
    expect(after.join('')).not.toBe(before.join(''));
    expect([...after].sort()).toEqual([...before].sort());
  });

  it('keeps keyboard parity: Backspace deletes and Enter submits', () => {
    renderGame();
    type('sea');
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(stickText()).toBe('se');

    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Enter' });
    const glossary = screen.getByRole('region', { name: /words found/i });
    expect(within(glossary).getByText('sea')).toBeInTheDocument();
  });

  it('renders one shared structure for both themes (skin differs, not layout)', () => {
    document.documentElement.dataset.theme = 'letterpress';
    renderGame();
    const classic = controls().innerHTML;

    fireEvent.click(screen.getByRole('button', { name: 'Cute' }));
    const cute = controls().innerHTML;

    expect(cute).toBe(classic);
  });
});
