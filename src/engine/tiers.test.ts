import { describe, expect, it } from 'vitest';
import type { Puzzle } from './types.ts';
import { totalScore } from './scoring.ts';
import { computeTier } from './tiers.ts';

// computeTier depends only on word lengths, the common set, and the source word,
// so we build a denominator of exactly 100 from length-controlled strings:
// the 8-letter source (15) plus seventeen distinct 5-letter words (5 each).
const FIVES = Array.from({ length: 17 }, (_, i) =>
  String.fromCharCode(97 + i).repeat(5),
);
const SOURCE = 'serenade';
const commonWords = new Set([SOURCE, ...FIVES]);

const puzzle: Puzzle = {
  sourceWord: SOURCE,
  letters: 'adeeenrs',
  validationWords: commonWords,
  commonWords,
  commonTotal: totalScore(commonWords),
  rareWords: new Set(),
};

describe('computeTier', () => {
  it('has a clean denominator of 100', () => {
    expect(puzzle.commonTotal).toBe(100);
  });

  it('starts at Blank Page with nothing found', () => {
    const t = computeTier(new Set(), puzzle);
    expect(t.id).toBe('blank-page');
    expect(t.fraction).toBe(0);
    expect(t.next?.id).toBe('a-few-words');
    expect(t.isTop).toBe(false);
  });

  it('counts only common-pool points in the numerator, rest as bonus', () => {
    const found = new Set([FIVES[0]!, 'zzzzzz']); // one common (5), one bonus (6 -> 7)
    const t = computeTier(found, puzzle);
    expect(t.commonPoints).toBe(5);
    expect(t.bonusPoints).toBe(7);
    expect(t.fraction).toBeCloseTo(0.05);
    expect(t.id).toBe('blank-page'); // 0.05 < 0.08
  });

  it('climbs the ladder by fraction', () => {
    const found = new Set([SOURCE, ...FIVES.slice(0, 5)]); // 15 + 25 = 40
    const t = computeTier(found, puzzle);
    expect(t.fraction).toBeCloseTo(0.4);
    expect(t.id).toBe('in-the-flow');
  });

  it('caps below the top rung when the source word is missing', () => {
    const found = new Set(FIVES); // 85 points, no source word
    const t = computeTier(found, puzzle);
    expect(t.fraction).toBeCloseTo(0.85);
    expect(t.id).toBe('word-hoard'); // NOT found-the-word
    expect(t.isTop).toBe(false);
  });

  it('reaches Found the Word with the high bar plus the source word', () => {
    // source (15) + 14 fives (70) = 85 of 100, with the source word.
    const found = new Set([SOURCE, ...FIVES.slice(0, 14)]);
    const t = computeTier(found, puzzle);
    expect(t.fraction).toBeCloseTo(0.85);
    expect(t.id).toBe('found-the-word');
    expect(t.isTop).toBe(false); // no longer the top: Edition Complete is above
    expect(t.next?.id).toBe('edition-complete');
  });

  it('crowns Edition Complete when every word in the set is found', () => {
    const found = new Set(commonWords); // 100/100, source word included
    const t = computeTier(found, puzzle);
    expect(t.fraction).toBe(1);
    expect(t.id).toBe('edition-complete');
    expect(t.isTop).toBe(true);
    expect(t.next).toBeNull();
  });
});
