import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ICON_SAFE_PADDING, pwaIconSvg } from './icons.ts';

const CUTE_CREAM = '#FFF4EE';

describe('pwaIconSvg', () => {
  test('draws the peach mark on the cute peach-cream, for both compositions', () => {
    for (const maskable of [false, true]) {
      const svg = pwaIconSvg({ maskable, background: CUTE_CREAM });
      // The full-bleed background fill.
      expect(svg).toContain(`fill="${CUTE_CREAM}"`);
      // The shared peach mark: its leaf green and the smile stroke identify it.
      expect(svg).toContain('#8FD3B6');
      expect(svg).toContain('M45 67c3 3 7 3 10 0');
    }
  });

  test('the maskable icon keeps the peach within the safe zone', () => {
    // At least 10 percent padding per side, so the mark sits inside the central
    // 80 percent an Android launcher will not crop.
    expect(ICON_SAFE_PADDING.maskable).toBeGreaterThanOrEqual(0.1);
  });

  test('the maskable icon pads more than the standard icon', () => {
    expect(ICON_SAFE_PADDING.maskable).toBeGreaterThan(
      ICON_SAFE_PADDING.standard,
    );
  });

  test('the maskable peach box is smaller than the standard one', () => {
    // The padding drives the scale, so more padding means a smaller peach box.
    const scaleOf = (svg: string) => Number(svg.match(/scale\(([\d.]+)\)/)![1]);
    const standard = scaleOf(
      pwaIconSvg({ maskable: false, background: '#fff' }),
    );
    const maskable = scaleOf(
      pwaIconSvg({ maskable: true, background: '#fff' }),
    );
    expect(maskable).toBeLessThan(standard);
  });
});

describe('the retired 8 tile', () => {
  test('its generator is gone from the icon pipeline source', () => {
    // squareSvg and centeredGlyphPath were the 8-tile machinery. If the symbols
    // are absent from the source, the 8 tile cannot be generated again.
    const src = readFileSync(
      resolve(process.cwd(), 'scripts/build-icons.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/squareSvg/);
    expect(src).not.toMatch(/centeredGlyphPath/);
  });
});
