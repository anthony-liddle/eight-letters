import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGame } from './useGame.ts';
import { dayIndex, STORAGE_EPOCH } from '@/engine/index.ts';
import {
  createListDictionary,
  createListWordSource,
} from '@/data/listSource.ts';
import { NullAudioEngine } from '@/audio/AudioEngine.ts';
import { GameStorage, type KeyValueStore } from '@/persistence/storage.ts';
import type { GameData } from '@/data/gameData.ts';

function capturingStore(): { store: KeyValueStore; read: () => unknown } {
  const map = new Map<string, string>();
  return {
    store: {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
    },
    read: () => {
      const raw = map.get('eight-letters/v1');
      return raw ? JSON.parse(raw) : null;
    },
  };
}

// Calendar re-anchored to a recent date, the way Phase 2 leaves it.
function dataAnchoredAt(epoch: {
  year: number;
  month: number;
  day: number;
}): GameData {
  return {
    dictionary: createListDictionary(['serenade', 'sea', 'near']),
    commonPool: createListWordSource(['serenade', 'sea', 'near']),
    beyond70Pool: createListWordSource([]),
    beyond95Pool: createListWordSource([]),
    dailyCalendar: { epoch, words: ['serenade'] },
    sourceEntry: () => undefined,
  };
}

describe('useGame daily day-key', () => {
  it('persists day progress under the fixed STORAGE_EPOCH, not the calendar epoch', () => {
    // The calendar epoch is re-anchored to today, but the storage and streak
    // key must keep counting from the fixed origin so a streak survives the
    // re-anchor. The two indices differ, so this is discriminating.
    const calendarEpoch = { year: 2026, month: 6, day: 23 };
    const data = dataAnchoredAt(calendarEpoch);
    const cap = capturingStore();
    const { result } = renderHook(() =>
      useGame(data, new NullAudioEngine(), new GameStorage(cap.store)),
    );

    // Find the set word 'sea' from the rack serenade, which persists progress.
    act(() => {
      result.current.addLetter('s');
      result.current.addLetter('e');
      result.current.addLetter('a');
    });
    act(() => result.current.submit());

    const persisted = cap.read() as { days: Record<string, unknown> } | null;
    const keys = Object.keys(persisted?.days ?? {}).map(Number);
    const today = new Date();
    expect(keys).toContain(dayIndex(today, STORAGE_EPOCH));
    expect(keys).not.toContain(dayIndex(today, calendarEpoch));
  });
});
