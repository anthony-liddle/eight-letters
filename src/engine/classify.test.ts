import { describe, expect, it } from 'vitest';
import type { Puzzle } from './types.ts';
import { classifyWord } from './classify.ts';

// Hand-placed bands so the precedence is exercised directly. The four sets are
// disjoint, as createPuzzle guarantees: a word lands in exactly one.
const puzzle: Puzzle = {
  sourceWord: 'national',
  letters: 'ailnnoat',
  validationWords: new Set(['national', 'nation', 'ulna', 'talon', 'anti']),
  commonWords: new Set(['national', 'nation']),
  uncommonWords: new Set(['ulna']), // in SCOWL 70, not the set
  rareWords: new Set(['talon']), // in SCOWL 95, not 70
  mythicWords: new Set(['anti']), // beyond SCOWL 95
};

describe('classifyWord', () => {
  it('classifies a set word as set', () => {
    expect(classifyWord('nation', puzzle)).toBe('set');
  });

  it('classifies the source word as set, like any other set word', () => {
    expect(classifyWord('national', puzzle)).toBe('set');
  });

  it('classifies a size-70-not-set word as uncommon (ulna)', () => {
    expect(classifyWord('ulna', puzzle)).toBe('uncommon');
  });

  it('classifies a size-95-not-70 word as rare', () => {
    expect(classifyWord('talon', puzzle)).toBe('rare');
  });

  it('classifies an ENABLE-beyond-95 word as mythic', () => {
    expect(classifyWord('anti', puzzle)).toBe('mythic');
  });
});
