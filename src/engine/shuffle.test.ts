import { describe, expect, it } from 'vitest';
import { seededPermutation } from './shuffle.ts';

describe('seededPermutation', () => {
  it('is a true permutation of [0, n)', () => {
    const perm = seededPermutation(50, 123);
    expect([...perm].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, i) => i),
    );
  });

  it('is deterministic for a given n and seed', () => {
    expect(seededPermutation(20, 7)).toEqual(seededPermutation(20, 7));
  });

  it('differs across seeds', () => {
    expect(seededPermutation(20, 1)).not.toEqual(seededPermutation(20, 2));
  });
});
