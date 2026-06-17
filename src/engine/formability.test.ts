import { describe, expect, it } from 'vitest';
import { canForm, formableFrom, letterCounts } from './formability.ts';

describe('canForm', () => {
  const rack = letterCounts('serenade'); // s e r e n a d e -> three e's

  it('forms a word using available tiles', () => {
    expect(canForm(rack, 'sneer')).toBe(true);
    expect(canForm(rack, 'eased')).toBe(true);
  });

  it('respects tile multiplicity', () => {
    // "serenade" has three e's; a word needing four e's cannot form.
    expect(canForm(letterCounts('eeen'), 'eeee')).toBe(false);
    expect(canForm(rack, 'eee')).toBe(true);
  });

  it('rejects words needing a letter not in the rack', () => {
    expect(canForm(rack, 'zebra')).toBe(false);
  });
});

describe('formableFrom', () => {
  it('keeps formable words of length 3 and up, drops the rest', () => {
    const words = ['ad', 'sea', 'sneer', 'zebra', 'serene'];
    // "ad" is too short; "zebra" needs a z; "serene" needs three e's and two
    // r-or-n... serene = s e r e n e needs three e's: serenade has three. ok.
    const result = formableFrom('serenade', words);
    expect(result).toEqual(['sea', 'sneer', 'serene']);
  });
});
