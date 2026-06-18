import { describe, expect, it } from 'vitest';
import type { Puzzle } from './types.ts';
import { computeTier } from './tiers.ts';

// Completion is word-count based: set words found over total set words. Lengths
// no longer matter to the bar, so we use a flat set of distinct words. Thirteen
// set words make the headline case exact: 12 of 13 reads as 92 percent.
const SOURCE = 'serenade';
const FIVES = Array.from({ length: 12 }, (_, i) =>
  String.fromCharCode(97 + i).repeat(5),
);
const commonWords = new Set([SOURCE, ...FIVES]);

const emptyBands = {
  uncommonWords: new Set<string>(),
  rareWords: new Set<string>(),
  mythicWords: new Set<string>(),
};

const puzzle: Puzzle = {
  sourceWord: SOURCE,
  letters: 'adeeenrs',
  validationWords: commonWords,
  commonWords,
  ...emptyBands,
};

describe('computeTier', () => {
  it('has thirteen set words to count against', () => {
    expect(puzzle.commonWords.size).toBe(13);
  });

  it('starts at Blank Page with nothing found', () => {
    const t = computeTier(new Set(), puzzle);
    expect(t.id).toBe('blank-page');
    expect(t.fraction).toBe(0);
    expect(t.setFound).toBe(0);
    expect(t.setTotal).toBe(13);
    expect(t.next?.id).toBe('a-few-words');
    expect(t.isTop).toBe(false);
  });

  it('measures the fraction by word count, not points', () => {
    // The source word alone would be 15 of 22 points (0.68) under the old
    // points-weighted bar; by word count it is just 1 of 13 (~0.077).
    const t = computeTier(new Set([SOURCE]), puzzle);
    expect(t.setFound).toBe(1);
    expect(t.fraction).toBeCloseTo(1 / 13);
  });

  it('leaves the fraction unchanged when an off-page word is found', () => {
    const setOnly = computeTier(new Set([FIVES[0]!]), puzzle);
    const withOffPage = computeTier(
      new Set([FIVES[0]!, 'zzzzzz']), // a word outside the set
      puzzle,
    );
    expect(withOffPage.setFound).toBe(setOnly.setFound);
    expect(withOffPage.fraction).toBe(setOnly.fraction);
  });

  it('climbs the ladder by the count of set words found', () => {
    // 6 of 13 set words is ~0.46, past the 0.40 In the Flow threshold.
    const t = computeTier(new Set([SOURCE, ...FIVES.slice(0, 5)]), puzzle);
    expect(t.setFound).toBe(6);
    expect(t.fraction).toBeCloseTo(6 / 13);
    expect(t.id).toBe('in-the-flow');
  });

  it('caps below Found the Word when the source word is missing', () => {
    // All 12 non-source words: 12 of 13 (~0.92), but no source word.
    const t = computeTier(new Set(FIVES), puzzle);
    expect(t.setFound).toBe(12);
    expect(Math.round(t.fraction * 100)).toBe(92);
    expect(t.id).toBe('word-hoard'); // NOT found-the-word: the gate is unmet
    expect(t.isTop).toBe(false);
  });

  it('reaches Found the Word at 12 of 13, which reads as 92 percent', () => {
    const t = computeTier(new Set([SOURCE, ...FIVES.slice(0, 11)]), puzzle);
    expect(t.setFound).toBe(12);
    expect(Math.round(t.fraction * 100)).toBe(92);
    expect(t.id).toBe('found-the-word');
    expect(t.isTop).toBe(false); // Edition Complete sits above it
    expect(t.next?.id).toBe('edition-complete');
  });

  it('crowns Edition Complete when every set word is found', () => {
    const t = computeTier(new Set(commonWords), puzzle);
    expect(t.setFound).toBe(13);
    expect(t.fraction).toBe(1);
    expect(t.id).toBe('edition-complete');
    expect(t.isTop).toBe(true);
    expect(t.next).toBeNull();
  });

  it('crowns Edition Complete regardless of how many off-page words were found', () => {
    const complete = new Set([...commonWords, 'zzzzzz', 'qqqqqq']);
    const t = computeTier(complete, puzzle);
    expect(t.id).toBe('edition-complete');
    expect(t.fraction).toBe(1);
  });
});
