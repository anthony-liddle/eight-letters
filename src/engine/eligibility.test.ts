import { describe, expect, it } from 'vitest';
import {
  createListDictionary,
  createListWordSource,
} from '@/data/listSource.ts';
import {
  eligibleSourceWords,
  isEligibleSource,
  sourceSetSize,
} from './eligibility.ts';
import { MIN_SET_SIZE } from './config.ts';

/**
 * Distinct strings formable from `rack` (each rack letter used at most once),
 * length 3+, used to build synthetic pools with a known set size.
 */
function formableTriples(rack: string, count: number): string[] {
  const letters = [...rack];
  const out: string[] = [];
  for (let i = 0; i < letters.length; i++) {
    for (let j = i + 1; j < letters.length; j++) {
      for (let k = j + 1; k < letters.length; k++) {
        out.push(letters[i]! + letters[j]! + letters[k]!);
        if (out.length === count) return out;
      }
    }
  }
  throw new Error('rack too small for requested count');
}

const RACK = 'abcdefgh';
const empty = createListWordSource([]);

/** A puzzle whose set size is exactly `size` words (crown-inclusive). */
function poolsOfSetSize(size: number) {
  const words = formableTriples(RACK, size);
  return {
    dictionary: createListDictionary(words),
    commonPool: createListWordSource(words),
  };
}

describe('sourceSetSize', () => {
  it('counts the set the game would build (crown-inclusive)', () => {
    const { dictionary, commonPool } = poolsOfSetSize(MIN_SET_SIZE);
    expect(sourceSetSize(RACK, dictionary, commonPool, empty, empty)).toBe(
      MIN_SET_SIZE,
    );
  });
});

describe('isEligibleSource', () => {
  it('is eligible when the set size is exactly the floor', () => {
    const { dictionary, commonPool } = poolsOfSetSize(15);
    expect(isEligibleSource(RACK, dictionary, commonPool, empty, empty)).toBe(
      true,
    );
  });

  it('is ineligible when the set size is one below the floor', () => {
    const { dictionary, commonPool } = poolsOfSetSize(14);
    expect(isEligibleSource(RACK, dictionary, commonPool, empty, empty)).toBe(
      false,
    );
  });
});

describe('eligibleSourceWords', () => {
  it('keeps only candidates whose set clears the floor', () => {
    // Disjoint letter sets: 'abcdefgh' forms 15 set words, 'ijklmnop' forms 14.
    const rich = formableTriples('abcdefgh', 15);
    const thin = formableTriples('ijklmnop', 14);
    const dictionary = createListDictionary([...rich, ...thin]);
    const commonPool = createListWordSource([...rich, ...thin]);
    const kept = eligibleSourceWords(
      ['abcdefgh', 'ijklmnop'],
      dictionary,
      commonPool,
      empty,
      empty,
    );
    expect(kept).toEqual(['abcdefgh']);
  });
});
