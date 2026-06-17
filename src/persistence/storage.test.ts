import { beforeEach, describe, expect, it } from 'vitest';
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
