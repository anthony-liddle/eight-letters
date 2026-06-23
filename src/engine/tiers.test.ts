import { describe, expect, it } from 'vitest';
import type { Puzzle, Rung } from './types.ts';
import { computeTier } from './tiers.ts';
import { findScore } from './scoring.ts';

// Synthetic words chosen by length so the scores are easy to reason about.
// Lengths: 3=1, 4=3, 5=5, 6=7, 7=11, 8=15; off-page adds uncommon +1 / rare +2 /
// mythic +4. The named ladder runs against the SET points only; off-page finds
// still earn points into the score and overflow the bar past the top rank.
const SOURCE = 'srcsrcsr'; // 8 letters, a set word, 15 points
const SET = [SOURCE, 'aaaa', 'bbbb', 'ccccc', 'ddddd', 'eee']; // 15+3+3+5+5+1 = 32
const UNCOMMON = ['ffffff']; // 7 + 1 = 8
const RARE = ['ggggggg']; // 11 + 2 = 13
const MYTHIC = ['hhhhhhhh']; // 15 + 4 = 19

function score(words: string[], rung: Rung): number {
  return words.reduce((s, w) => s + findScore(w, rung), 0);
}
const SET_POINTS = score(SET, 'set'); // 32, the reachable denominator

const puzzle: Puzzle = {
  sourceWord: SOURCE,
  letters: 'srcsrcsr',
  validationWords: new Set([...SET, ...UNCOMMON, ...RARE, ...MYTHIC]),
  commonWords: new Set(SET),
  uncommonWords: new Set(UNCOMMON),
  rareWords: new Set(RARE),
  mythicWords: new Set(MYTHIC),
  reachableScore: SET_POINTS,
};

describe('computeTier (named points ladder, set-points denominator)', () => {
  it('runs against the set points, not the huge off-page tail', () => {
    expect(puzzle.reachableScore).toBe(32);
  });

  it('starts at the first rank with nothing found', () => {
    const t = computeTier(new Set(), puzzle);
    expect(t.index).toBe(0);
    expect(t.score).toBe(0);
    expect(t.fraction).toBe(0);
    expect(t.setFound).toBe(0);
    expect(t.setTotal).toBe(6);
    expect(t.next).toEqual({ index: 1, threshold: 0.08 });
  });

  it('lets an off-page find climb the ladder (rarity pays more)', () => {
    // The mythic word is 19 of 32 (~0.59): past the 0.40 rung, on points alone.
    const t = computeTier(new Set(MYTHIC), puzzle);
    expect(t.score).toBe(19);
    expect(t.fraction).toBeCloseTo(19 / 32);
    expect(t.index).toBe(3);
  });

  it('splits points into set and off-page for the two-color bar', () => {
    const t = computeTier(new Set(['ccccc', 'hhhhhhhh']), puzzle); // set 5, mythic 19
    expect(t.setPoints).toBe(5);
    expect(t.offPagePoints).toBe(19);
    expect(t.score).toBe(24);
  });

  it('counts set words for the completion celebration, separate from the rank', () => {
    const t = computeTier(new Set([SOURCE, 'aaaa', 'hhhhhhhh']), puzzle);
    expect(t.setFound).toBe(2); // SOURCE and aaaa are set words; hhhhhhhh is not
    expect(t.setTotal).toBe(6);
  });

  // The whole reason for this stage: the old set gate walled Bea at "21 of 23"
  // even with rare finds and the source word. Under points, off-page finds carry
  // her past unfound set words to the TOP named rank.
  it('reaches the top named rank with set words unfound (the 21 of 23 guard)', () => {
    // Everything except two ordinary set words (eee=1, aaaa=3), plus all off-page.
    const found = new Set([
      SOURCE,
      'bbbb',
      'ccccc',
      'ddddd',
      ...UNCOMMON,
      ...RARE,
      ...MYTHIC,
    ]);
    const t = computeTier(found, puzzle);
    expect(t.setFound).toBe(4); // 2 of 6 set words still unfound
    expect(t.index).toBe(5); // top named rank, not walled below it
    expect(t.isTop).toBe(true);
    expect(t.next).toBeNull();
  });

  it('keeps the top named rank below full completion, with points overflowing', () => {
    // Reaching 0.80 of set points alone tops the named ladder, before the set is
    // complete: 0.80 * 32 = 25.6. SOURCE + ddddd + ccccc + bbbb = 28 of 32.
    const nearTop = computeTier(
      new Set([SOURCE, 'ddddd', 'ccccc', 'bbbb']),
      puzzle,
    );
    expect(nearTop.setFound).toBeLessThan(nearTop.setTotal);
    expect(nearTop.index).toBe(5);

    // Off-page points overflow past 1.0 but unlock no higher named rank: the
    // completion peak is a word-count trigger above the ladder (Stage 2).
    const everything = computeTier(
      new Set(puzzle.validationWords as Set<string>),
      puzzle,
    );
    expect(everything.fraction).toBeGreaterThan(1);
    expect(everything.index).toBe(5);
    expect(everything.isTop).toBe(true);
  });
});
