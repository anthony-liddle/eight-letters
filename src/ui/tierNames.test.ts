import { describe, expect, it } from 'vitest';
import { TIER_NAMES, tierName } from './tierNames.ts';

describe('theme-skinned tier names', () => {
  it('shows the letterpress name on classic and the cute name on cute, same rung', () => {
    expect(tierName('letterpress', 0)).toBe('Blank Page');
    expect(tierName('cute', 0)).toBe('First Sprout');
    expect(tierName('letterpress', 5)).toBe('Fine Press');
    expect(tierName('cute', 5)).toBe('Perfectly Peachy');
  });

  it('has exactly six named ranks per theme, the ladder structure', () => {
    expect(TIER_NAMES.letterpress).toHaveLength(6);
    expect(TIER_NAMES.cute).toHaveLength(6);
  });
});
