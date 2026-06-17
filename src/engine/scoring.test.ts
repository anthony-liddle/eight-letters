import { describe, expect, it } from 'vitest';
import { scoreWord, totalScore } from './scoring.ts';

describe('scoreWord', () => {
  it('follows the GDD curve: 3=1, 4=3, 5=5, 6=7, 7=11, 8=15', () => {
    expect(scoreWord('cat')).toBe(1);
    expect(scoreWord('cats')).toBe(3);
    expect(scoreWord('scale')).toBe(5);
    expect(scoreWord('scaled')).toBe(7);
    expect(scoreWord('scalene')).toBe(11);
    expect(scoreWord('serenade')).toBe(15);
  });

  it('scores below the minimum length as zero', () => {
    expect(scoreWord('at')).toBe(0);
    expect(scoreWord('')).toBe(0);
  });
});

describe('totalScore', () => {
  it('sums a set of words', () => {
    expect(totalScore(['cat', 'cats', 'serenade'])).toBe(1 + 3 + 15);
  });
});
