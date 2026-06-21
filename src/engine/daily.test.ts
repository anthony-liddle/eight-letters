import { describe, expect, it } from 'vitest';
import { dailySourceWord, dayIndex, endlessSourceWord } from './daily.ts';

const EPOCH = { year: 2026, month: 1, day: 1 };

describe('dayIndex', () => {
  it('is zero on the epoch date', () => {
    expect(dayIndex(new Date(2026, 0, 1, 9, 30), EPOCH)).toBe(0);
  });

  it('counts whole calendar days forward', () => {
    expect(dayIndex(new Date(2026, 0, 2), EPOCH)).toBe(1);
    expect(dayIndex(new Date(2026, 1, 1), EPOCH)).toBe(31);
  });

  it('ignores the time of day (local-midnight rollover)', () => {
    const early = dayIndex(new Date(2026, 0, 10, 0, 1), EPOCH);
    const late = dayIndex(new Date(2026, 0, 10, 23, 59), EPOCH);
    expect(early).toBe(late);
  });

  it('does not drift across a daylight-saving boundary', () => {
    // US DST begins 2026-03-08. The gap from the day before to the day after
    // must be exactly two calendar days despite the 23-hour day.
    const before = dayIndex(new Date(2026, 2, 7), EPOCH);
    const after = dayIndex(new Date(2026, 2, 9), EPOCH);
    expect(after - before).toBe(2);
  });
});

describe('dailySourceWord', () => {
  const calendar = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];

  it('is deterministic for a given date', () => {
    const a = dailySourceWord(calendar, new Date(2026, 5, 16), EPOCH);
    const b = dailySourceWord(calendar, new Date(2026, 5, 16), EPOCH);
    expect(a).toBe(b);
  });

  it('maps the first cycle to the frozen calendar order', () => {
    const seen = calendar.map((_, i) =>
      dailySourceWord(calendar, new Date(2026, 0, 1 + i), EPOCH),
    );
    expect(seen).toEqual(calendar);
  });

  it('yields a fixed first-cycle word, unaffected by appending words after it', () => {
    const date = new Date(2026, 0, 3); // day index 2, first cycle
    expect(dailySourceWord(calendar, date, EPOCH)).toBe('charlie');
    const appended = [...calendar, 'foxtrot', 'golf'];
    expect(dailySourceWord(appended, date, EPOCH)).toBe('charlie');
  });

  it('reshuffles into a new pass after exhaustion', () => {
    const firstPass = calendar.map((_, i) =>
      dailySourceWord(calendar, new Date(2026, 0, 1 + i), EPOCH),
    );
    const secondPass = calendar.map((_, i) =>
      dailySourceWord(
        calendar,
        new Date(2026, 0, 1 + calendar.length + i),
        EPOCH,
      ),
    );
    // Each later cycle is a fresh permutation: every word once, new order.
    expect([...secondPass].sort()).toEqual([...calendar].sort());
    expect(secondPass).not.toEqual(firstPass);
  });

  it('does not repeat a word across a cycle boundary', () => {
    const n = calendar.length;
    const wordOnDay = (day: number) =>
      dailySourceWord(calendar, new Date(2026, 0, 1 + day), EPOCH);
    // cycle 0 -> cycle 1, and cycle 1 -> cycle 2.
    expect(wordOnDay(n)).not.toBe(wordOnDay(n - 1));
    expect(wordOnDay(2 * n)).not.toBe(wordOnDay(2 * n - 1));
  });
});

describe('endlessSourceWord', () => {
  // The calendar holds only eligible words; a sub-floor word is never in it.
  const calendar = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];

  it('only ever draws a word from the calendar (never a sub-floor word)', () => {
    const set = new Set(calendar);
    // Sweep the whole [0, 1) range so every index is exercised deterministically.
    for (let r = 0; r < 1; r += 0.01) {
      const word = endlessSourceWord(calendar, () => r);
      expect(set.has(word)).toBe(true);
    }
  });

  it('reaches every word in the calendar', () => {
    const seen = new Set<string>();
    for (let r = 0; r < 1; r += 0.001) {
      seen.add(endlessSourceWord(calendar, () => r));
    }
    expect(seen).toEqual(new Set(calendar));
  });
});
