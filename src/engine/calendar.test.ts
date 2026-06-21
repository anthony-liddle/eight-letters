import { describe, expect, it } from 'vitest';
import { generateCalendar } from './calendar.ts';

const eligible = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];

describe('generateCalendar', () => {
  it('first run contains exactly the eligible words, none extra', () => {
    const calendar = generateCalendar(eligible, []);
    expect([...calendar].sort()).toEqual([...eligible].sort());
  });

  it('does not march alphabetically (the seeded shuffle)', () => {
    const calendar = generateCalendar(eligible, []);
    expect(calendar).not.toEqual([...eligible].sort());
  });

  it('is deterministic: same inputs yield an identical calendar', () => {
    expect(generateCalendar(eligible, [])).toEqual(
      generateCalendar(eligible, []),
    );
  });

  // The freeze. This is the load-bearing invariant: a new eligible word lands at
  // the end and every existing position is untouched. A failure here re-dates
  // every day after the change and breaks the promise that a day is fixed.
  it('appends new eligible words to the end and never moves an existing one', () => {
    const existing = generateCalendar(eligible, []);
    const grown = generateCalendar([...eligible, 'foxtrot', 'golf'], existing);

    // Every existing entry keeps its exact index.
    for (let i = 0; i < existing.length; i++) {
      expect(grown[i]).toBe(existing[i]);
    }
    // The new words are appended, in some order, after the frozen prefix.
    expect(grown.slice(existing.length).sort()).toEqual(['foxtrot', 'golf']);
    expect(grown.length).toBe(existing.length + 2);
  });

  it('never reorders or removes when nothing new is eligible', () => {
    const existing = generateCalendar(eligible, []);
    expect(generateCalendar(eligible, existing)).toEqual(existing);
  });
});
