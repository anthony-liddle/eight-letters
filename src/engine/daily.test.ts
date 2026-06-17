import { describe, expect, it } from 'vitest';
import { dailySourceWord, dayIndex } from './daily.ts';

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
  const pool = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];

  it('is deterministic for a given date', () => {
    const a = dailySourceWord(pool, new Date(2026, 5, 16), EPOCH);
    const b = dailySourceWord(pool, new Date(2026, 5, 16), EPOCH);
    expect(a).toBe(b);
  });

  it('never repeats until the pool is exhausted', () => {
    const seen = pool.map((_, i) =>
      dailySourceWord(pool, new Date(2026, 0, 1 + i), EPOCH),
    );
    // One full cycle is a permutation of the whole pool: all present, no dupes.
    expect(new Set(seen).size).toBe(pool.length);
    expect([...seen].sort()).toEqual([...pool].sort());
  });

  it('reshuffles into a new pass after exhaustion', () => {
    const firstPass = pool.map((_, i) =>
      dailySourceWord(pool, new Date(2026, 0, 1 + i), EPOCH),
    );
    const secondPass = pool.map((_, i) =>
      dailySourceWord(pool, new Date(2026, 0, 1 + pool.length + i), EPOCH),
    );
    expect(new Set(secondPass).size).toBe(pool.length); // still a permutation
    expect(secondPass).not.toEqual(firstPass); // but a different order
  });
});
