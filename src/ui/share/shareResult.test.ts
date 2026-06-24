import { describe, expect, test } from 'vitest';
import type { Puzzle } from '@/engine/index.ts';
import { dailyShareResult } from './shareResult.ts';

/**
 * A small hand-built puzzle. Set words score by length (3=1, 4=3, 8=15); the
 * three off-page bands hold one word each so the rung counts are unambiguous.
 */
function testPuzzle(): Puzzle {
  const commonWords = new Set(['NOTECASE', 'NOTE', 'TONE', 'CAT']);
  const uncommonWords = new Set(['OCAS']);
  const rareWords = new Set(['NAE']);
  const mythicWords = new Set(['ETA']);
  const validationWords = new Set([
    ...commonWords,
    ...uncommonWords,
    ...rareWords,
    ...mythicWords,
  ]);
  return {
    sourceWord: 'NOTECASE',
    letters: 'ACENOST',
    validationWords,
    commonWords,
    uncommonWords,
    rareWords,
    mythicWords,
    reachableScore: 0,
  };
}

describe('dailyShareResult', () => {
  test('derives the counts and the point split from puzzle and finds', () => {
    const found = ['NOTECASE', 'NOTE', 'OCAS', 'NAE'];
    const result = dailyShareResult(
      testPuzzle(),
      found,
      new Date(2026, 5, 18),
      'Peach of a Word',
    );

    expect(result.title).toBe('Peach of a Word');
    expect(result.setFound).toBe(2);
    expect(result.setTotal).toBe(4);
    expect(result.uncommon).toBe(1);
    expect(result.rare).toBe(1);
    expect(result.mythic).toBe(0);
    // NOTECASE 15 + NOTE 3 = 18 set points; OCAS 3 + NAE 1 = 4 off-page.
    expect(result.setPoints).toBe(18);
    expect(result.offPagePoints).toBe(4);
    expect(result.totalPoints).toBe(22);
  });

  test('counts the source word toward the set, never off-page', () => {
    const result = dailyShareResult(
      testPuzzle(),
      ['NOTECASE'],
      new Date(2026, 5, 18),
      'Peach of a Word',
    );
    expect(result.setFound).toBe(1);
    expect(result.uncommon + result.rare + result.mythic).toBe(0);
    expect(result.setPoints).toBe(15);
    expect(result.offPagePoints).toBe(0);
  });

  test('carries the source word and found words for spoiler checks', () => {
    const found = ['NOTE', 'OCAS'];
    const result = dailyShareResult(
      testPuzzle(),
      found,
      new Date(2026, 5, 18),
      'Peach of a Word',
    );
    expect(result.sourceWord).toBe('NOTECASE');
    expect(result.foundWords).toEqual(found);
  });
});
