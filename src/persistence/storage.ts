/**
 * Local persistence for streak and per-day progress. No backend in v1.
 * Behind a minimal storage interface so it is testable and swappable.
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface DayProgress {
  sourceWord: string;
  found: string[];
}

interface StreakState {
  count: number;
  lastClearedDayIndex: number | null;
}

interface PersistedState {
  version: 1;
  days: Record<number, DayProgress>;
  streak: StreakState;
}

const STORAGE_KEY = 'eight-letters/v1';
const MAX_DAYS_KEPT = 14;

function emptyState(): PersistedState {
  return {
    version: 1,
    days: {},
    streak: { count: 0, lastClearedDayIndex: null },
  };
}

/** A no-op store for environments where localStorage is unavailable or denied. */
function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

export function defaultStore(): KeyValueStore {
  try {
    const ls = globalThis.localStorage;
    const probe = '__el_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStore();
  }
}

export class GameStorage {
  private readonly store: KeyValueStore;

  constructor(store: KeyValueStore = defaultStore()) {
    this.store = store;
  }

  private read(): PersistedState {
    const raw = this.store.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    try {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed?.version === 1) return parsed;
    } catch {
      // Corrupt or stale; start clean rather than crash play.
    }
    return emptyState();
  }

  private write(state: PersistedState): void {
    // Keep only the most recent days so storage never grows without bound.
    const dayKeys = Object.keys(state.days)
      .map(Number)
      .sort((a, b) => b - a);
    for (const key of dayKeys.slice(MAX_DAYS_KEPT)) delete state.days[key];
    this.store.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /** Found words saved for a given day, if the source word still matches. */
  loadDayProgress(dayIndex: number, sourceWord: string): string[] {
    const day = this.read().days[dayIndex];
    if (day && day.sourceWord === sourceWord) return day.found;
    return [];
  }

  saveDayProgress(
    dayIndex: number,
    sourceWord: string,
    found: readonly string[],
  ): void {
    const state = this.read();
    state.days[dayIndex] = { sourceWord, found: [...found] };
    this.write(state);
  }

  /**
   * Record that a daily was cleared to the streak tier. Consecutive days extend
   * the streak; a gap restarts it. Recording the same day twice is a no-op.
   */
  recordDailyCleared(dayIndex: number): void {
    const state = this.read();
    const { lastClearedDayIndex } = state.streak;
    if (lastClearedDayIndex === dayIndex) return;
    if (lastClearedDayIndex === dayIndex - 1) state.streak.count += 1;
    else state.streak.count = 1;
    state.streak.lastClearedDayIndex = dayIndex;
    this.write(state);
  }

  /** Current streak as of today. A missed day shows the streak as broken (0). */
  currentStreak(todayIndex: number): number {
    const { count, lastClearedDayIndex } = this.read().streak;
    if (lastClearedDayIndex === null) return 0;
    return lastClearedDayIndex >= todayIndex - 1 ? count : 0;
  }
}
