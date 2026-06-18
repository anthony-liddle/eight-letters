import { describe, expect, it } from 'vitest';
import { formableUnion, formableWords } from './formable.ts';

describe('formableWords', () => {
  it('keeps words length 3+ formable from the rack, drops the rest', () => {
    const enable = ['ad', 'sea', 'sneer', 'zebra', 'serene'];
    // "ad" too short; "zebra" needs a z; the rest form from serenade.
    expect(formableWords('serenade', enable)).toEqual([
      'sea',
      'sneer',
      'serene',
    ]);
  });
});

describe('formableUnion', () => {
  it('is the deduped, sorted union of every rack, length 3+', () => {
    const enable = ['ace', 'cab', 'bead', 'deed', 'zoo'];
    // racks: "abcdef" forms ace, cab; "abdeed" forms bead, deed (and ace? no c).
    const union = formableUnion(['abcdef', 'abdeed'], enable);
    expect(union).toEqual(['ace', 'bead', 'cab', 'deed']);
  });
});
