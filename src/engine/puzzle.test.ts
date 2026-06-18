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
// The off-page words split across the ladder by SCOWL membership:
//   'sneer' is in size 70  -> uncommon (not beyond 70)
//   'eased' is in size 95  -> rare     (beyond 70, not beyond 95)
//   'sane'  is beyond 95    -> mythic   (beyond both)
const BEYOND_70 = ['eased', 'sane'];
const BEYOND_95 = ['sane'];

const dictionary = createListDictionary(ENABLE);
const commonPool = createListWordSource(COMMON);
const beyond70Pool = createListWordSource(BEYOND_70);
const beyond95Pool = createListWordSource(BEYOND_95);
const puzzle = createPuzzle(
  'serenade',
  dictionary,
  commonPool,
  beyond70Pool,
  beyond95Pool,
);

describe('createPuzzle', () => {
  it('derives the rack as the sorted source letters', () => {
    expect(puzzle.letters).toBe('adeeenrs');
  });

  it('collects the formable ENABLE words as the validation set', () => {
    expect(puzzle.validationWords).toEqual(
      new Set(['serenade', 'sneer', 'eased', 'sea', 'near', 'dean', 'sane']),
    );
  });

  it('collects the formable set words as the completion denominator', () => {
    expect(puzzle.commonWords).toEqual(new Set(COMMON));
  });

  it('partitions the off-page finds into the three rarity rungs', () => {
    expect(puzzle.uncommonWords).toEqual(new Set(['sneer']));
    expect(puzzle.rareWords).toEqual(new Set(['eased']));
    expect(puzzle.mythicWords).toEqual(new Set(['sane']));
  });

  it('keeps the four bands disjoint and covering the whole validation set', () => {
    const union = new Set([
      ...puzzle.commonWords,
      ...puzzle.uncommonWords,
      ...puzzle.rareWords,
      ...puzzle.mythicWords,
    ]);
    expect(union).toEqual(puzzle.validationWords);
    const sizes =
      puzzle.commonWords.size +
      puzzle.uncommonWords.size +
      puzzle.rareWords.size +
      puzzle.mythicWords.size;
    expect(sizes).toBe(puzzle.validationWords.size); // no overlap
  });
});

describe('validateGuess', () => {
  const empty = new Set<string>();

  it('accepts a set word with the set rung', () => {
    expect(validateGuess('sea', puzzle, empty)).toEqual({
      kind: 'valid',
      word: 'sea',
      score: 1,
      rung: 'set',
      isSourceWord: false,
    });
  });

  it('grades an uncommon off-page word', () => {
    expect(validateGuess('sneer', puzzle, empty)).toMatchObject({
      kind: 'valid',
      rung: 'uncommon',
    });
  });

  it('grades a rare off-page word', () => {
    expect(validateGuess('eased', puzzle, empty)).toMatchObject({
      kind: 'valid',
      rung: 'rare',
    });
  });

  it('grades a mythic off-page word', () => {
    expect(validateGuess('sane', puzzle, empty)).toMatchObject({
      kind: 'valid',
      rung: 'mythic',
    });
  });

  it('flags the source word, still a set word', () => {
    expect(validateGuess('serenade', puzzle, empty)).toMatchObject({
      kind: 'valid',
      isSourceWord: true,
      rung: 'set',
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
