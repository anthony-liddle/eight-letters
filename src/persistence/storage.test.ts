import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameStorage, type KeyValueStore } from './storage.ts';

function fakeStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe('GameStorage day progress', () => {
  let storage: GameStorage;
  beforeEach(() => {
    storage = new GameStorage(fakeStore());
  });

  it('round-trips found words for a day', () => {
    storage.saveDayProgress(10, 'serenade', ['sea', 'near']);
    expect(storage.loadDayProgress(10, 'serenade')).toEqual(['sea', 'near']);
  });

  it('ignores saved progress if the source word has changed', () => {
    storage.saveDayProgress(10, 'serenade', ['sea']);
    expect(storage.loadDayProgress(10, 'absolute')).toEqual([]);
  });
});

describe('GameStorage endless', () => {
  let storage: GameStorage;
  beforeEach(() => {
    storage = new GameStorage(fakeStore());
  });

  it('is null until an endless game is saved', () => {
    expect(storage.loadEndless()).toBeNull();
  });

  it('round-trips the endless puzzle identity and progress', () => {
    storage.saveEndless('absolute', ['lob', 'bolt']);
    expect(storage.loadEndless()).toEqual({
      sourceWord: 'absolute',
      found: ['lob', 'bolt'],
    });
  });

  it('overwrites on a new puzzle and is independent of daily progress', () => {
    storage.saveDayProgress(10, 'serenade', ['sea']);
    storage.saveEndless('absolute', ['lob']);
    storage.saveEndless('mountain', []); // New Puzzle: fresh word, empty list
    expect(storage.loadEndless()).toEqual({
      sourceWord: 'mountain',
      found: [],
    });
    expect(storage.loadDayProgress(10, 'serenade')).toEqual(['sea']);
  });
});

describe('GameStorage streak', () => {
  let storage: GameStorage;
  beforeEach(() => {
    storage = new GameStorage(fakeStore());
  });

  it('starts at zero', () => {
    expect(storage.currentStreak(5)).toBe(0);
  });

  it('extends across consecutive days', () => {
    storage.recordDailyCleared(5);
    storage.recordDailyCleared(6);
    storage.recordDailyCleared(7);
    expect(storage.currentStreak(7)).toBe(3);
  });

  it('is a no-op when the same day is recorded twice', () => {
    storage.recordDailyCleared(5);
    storage.recordDailyCleared(5);
    expect(storage.currentStreak(5)).toBe(1);
  });

  it('restarts after a gap', () => {
    storage.recordDailyCleared(5);
    storage.recordDailyCleared(8); // missed 6 and 7
    expect(storage.currentStreak(8)).toBe(1);
  });

  it('shows the streak as broken once a day is missed', () => {
    storage.recordDailyCleared(5);
    expect(storage.currentStreak(5)).toBe(1); // today, cleared
    expect(storage.currentStreak(6)).toBe(1); // tomorrow, still alive
    expect(storage.currentStreak(7)).toBe(0); // day after, missed -> broken
  });
});

describe('GameStorage migration: calendar reshuffle preserves play history', () => {
  let storage: GameStorage;
  beforeEach(() => {
    storage = new GameStorage(fakeStore());
  });

  // The frozen-calendar migration may re-date a day to a different word. The
  // streak must be keyed to the date, not the word, so a finished day is never
  // read as unfinished. This guards that invariant.
  it('keeps a cleared day cleared and the streak intact when the word changes', () => {
    // Before the reshuffle: day 5 cleared, found words saved under the old word.
    storage.saveDayProgress(5, 'oldcrown', ['cat', 'cot']);
    storage.recordDailyCleared(5);
    expect(storage.currentStreak(5)).toBe(1);

    // The reshuffle changes day 5's word. The streak is keyed to the date, so it
    // is unaffected, and the next day continues it.
    storage.recordDailyCleared(6);
    expect(storage.currentStreak(6)).toBe(2);

    // The only visible effect: progress was word-keyed, so the new word starts
    // fresh. The day offers its new word once.
    expect(storage.loadDayProgress(5, 'newcrown')).toEqual([]);
  });
});

describe('GameStorage resilience', () => {
  it('does not throw when the underlying store rejects a write', () => {
    const throwingStore: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const storage = new GameStorage(throwingStore);
    expect(() => storage.saveDayProgress(1, 'serenade', ['sea'])).not.toThrow();
    expect(() => storage.saveEndless('absolute', ['lob'])).not.toThrow();
  });
});

describe('GameStorage persistence detection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports persistent storage when localStorage is available', () => {
    expect(new GameStorage().persistent).toBe(true);
  });

  it('reports non-persistent storage when writes are denied', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage access denied');
    });
    expect(new GameStorage().persistent).toBe(false);
  });

  it('treats an explicitly injected store as persistent by default', () => {
    expect(new GameStorage(fakeStore()).persistent).toBe(true);
  });
});
