import { describe, expect, it } from 'vitest';
import {
  createListDictionary,
  createListWordSource,
} from '@/data/listSource.ts';
import { createPuzzle } from './puzzle.ts';
import { validateGuess } from './validate.ts';

const ENABLE = [
  'serenade',
  'sneer',
  'eased',
  'sea',
  'near',
  'dean',
  'sane',
  'zebra', // not formable from serenade (needs z, b)
  'ad', // too short
];
const COMMON = ['sea', 'near', 'dean', 'serenade'];
// 'sane' is valid but below the SCOWL-70 threshold: a rare find. 'sneer' and
// 'eased' are valid-but-not-common and not rare: ordinary bonus.
const RARE = ['sane'];

const dictionary = createListDictionary(ENABLE);
const commonPool = createListWordSource(COMMON);
const rarePool = createListWordSource(RARE);
const puzzle = createPuzzle('serenade', dictionary, commonPool, rarePool);

describe('createPuzzle', () => {
  it('derives the rack as the sorted source letters', () => {
    expect(puzzle.letters).toBe('adeeenrs');
  });

  it('collects the formable ENABLE words as the validation set', () => {
    expect(puzzle.validationWords).toEqual(
      new Set(['serenade', 'sneer', 'eased', 'sea', 'near', 'dean', 'sane']),
    );
  });

  it('collects the formable common-pool words as the denominator set', () => {
    expect(puzzle.commonWords).toEqual(new Set(COMMON));
  });

  it('scores the common total including the source word', () => {
    // sea 1 + near 3 + dean 3 + serenade 15
    expect(puzzle.commonTotal).toBe(22);
  });

  it('collects formable rare words, disjoint from the common set', () => {
    expect(puzzle.rareWords).toEqual(new Set(['sane']));
    for (const w of puzzle.rareWords)
      expect(puzzle.commonWords.has(w)).toBe(false);
  });
});

describe('validateGuess', () => {
  const empty = new Set<string>();

  it('accepts a common word', () => {
    expect(validateGuess('sea', puzzle, empty)).toEqual({
      kind: 'valid',
      word: 'sea',
      score: 1,
      isCommon: true,
      isRare: false,
      isSourceWord: false,
    });
  });

  it('marks an ordinary bonus word: valid, not common, not rare', () => {
    expect(validateGuess('sneer', puzzle, empty)).toMatchObject({
      kind: 'valid',
      isCommon: false,
      isRare: false,
    });
  });

  it('marks a rare find: valid, not common, rare', () => {
    expect(validateGuess('sane', puzzle, empty)).toMatchObject({
      kind: 'valid',
      isCommon: false,
      isRare: true,
    });
  });

  it('flags the source word', () => {
    expect(validateGuess('serenade', puzzle, empty)).toMatchObject({
      kind: 'valid',
      isSourceWord: true,
      isCommon: true,
    });
  });

  it('rejects words below the minimum length', () => {
    expect(validateGuess('ad', puzzle, empty).kind).toBe('too-short');
  });

  it('rejects a non-word and an unformable word the same way', () => {
    expect(validateGuess('zebra', puzzle, empty).kind).toBe('not-a-word');
    expect(validateGuess('xyz', puzzle, empty).kind).toBe('not-a-word');
  });

  it('rejects a word already found', () => {
    expect(validateGuess('sea', puzzle, new Set(['sea'])).kind).toBe(
      'already-found',
    );
  });

  it('normalizes case and stray characters', () => {
    expect(validateGuess(' SeA! ', puzzle, empty).kind).toBe('valid');
  });
});
