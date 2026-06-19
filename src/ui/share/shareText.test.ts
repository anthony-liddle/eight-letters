import { describe, expect, test } from 'vitest';
import { buildShareText, type DailyShareResult } from './shareText.ts';

/**
 * A representative result, the worked example from the spec. Jun 18 is month
 * index 5; the date is built from local components so the short form is stable.
 */
function exampleResult(
  overrides: Partial<DailyShareResult> = {},
): DailyShareResult {
  return {
    title: 'Peach of a Word',
    date: new Date(2026, 5, 18),
    setFound: 37,
    setTotal: 37,
    uncommon: 29,
    rare: 4,
    mythic: 2,
    setPoints: 113,
    offPagePoints: 113,
    totalPoints: 226,
    sourceWord: 'PEACHING',
    foundWords: ['PEACHING', 'PEACH', 'CHEAP', 'PINCH'],
    ...overrides,
  };
}

describe('buildShareText', () => {
  test('produces the exact block for the worked example', () => {
    const expected = [
      'Peach of a Word · Jun 18',
      'Set 37/37 ✓',
      '🟥🟥🟥🟥🟥🟪🟪🟪🟪🟪',
      '✦ 29 Uncommon · 4 Rare · 2 Mythic',
      '226 pts',
    ].join('\n');

    expect(buildShareText(exampleResult())).toBe(expected);
  });

  test('reads the title from the result, never a hardcoded name', () => {
    const out = buildShareText(exampleResult({ title: 'Renamed Game' }));
    expect(out.startsWith('Renamed Game · ')).toBe(true);
    expect(out).not.toContain('Peach of a Word');
  });

  describe('spoiler safety', () => {
    test('never leaks the source word or any found word', () => {
      const sourceWord = 'PEACHING';
      const foundWords = [
        'PEACHING',
        'PEACH',
        'CHEAP',
        'PINCH',
        'NICHE',
        'CHAIN',
      ];
      // A neutral title, so the assertion isolates the builder's word fields:
      // a real game title like "Peach of a Word" could share letters with a
      // found word ("PEACH") without that being a leak.
      const out = buildShareText(
        exampleResult({ title: 'Daily Game', sourceWord, foundWords }),
      ).toUpperCase();

      expect(out).not.toContain(sourceWord);
      for (const word of foundWords) {
        expect(out).not.toContain(word);
      }
    });
  });

  describe('the completion check', () => {
    test('appears only at 100 percent', () => {
      const complete = buildShareText(
        exampleResult({ setFound: 37, setTotal: 37 }),
      );
      expect(complete).toContain('Set 37/37 ✓');
    });

    test('is absent at 36 of 37', () => {
      const nearly = buildShareText(
        exampleResult({ setFound: 36, setTotal: 37 }),
      );
      expect(nearly).toContain('Set 36/37');
      expect(nearly).not.toContain('✓');
    });
  });

  describe('the score row', () => {
    function scoreRow(result: DailyShareResult): string {
      return buildShareText(result).split('\n')[2]!;
    }

    test('is always exactly 10 squares', () => {
      const row = scoreRow(
        exampleResult({ setPoints: 200, offPagePoints: 26 }),
      );
      expect([...row]).toHaveLength(10);
    });

    test('splits the squares by the point ratio', () => {
      // 70 set, 30 off-page rounds to 7 red and 3 purple.
      const row = scoreRow(
        exampleResult({ setPoints: 70, offPagePoints: 30, totalPoints: 100 }),
      );
      expect(row).toBe('🟥🟥🟥🟥🟥🟥🟥🟪🟪🟪');
    });

    test('a single off-page point still shows at least one purple square', () => {
      // 225 set, 1 off-page would round to zero purple; the haul must show.
      const row = scoreRow(
        exampleResult({ setPoints: 225, offPagePoints: 1, totalPoints: 226 }),
      );
      expect([...row]).toHaveLength(10);
      expect(row).toContain('🟪');
      expect((row.match(/🟪/gu) ?? []).length).toBe(1);
    });

    test('a single set point still shows at least one red square', () => {
      const row = scoreRow(
        exampleResult({ setPoints: 1, offPagePoints: 225, totalPoints: 226 }),
      );
      expect([...row]).toHaveLength(10);
      expect(row).toContain('🟥');
      expect((row.match(/🟥/gu) ?? []).length).toBe(1);
    });

    test('a puzzle with no off-page finds is all red', () => {
      const row = scoreRow(
        exampleResult({
          uncommon: 0,
          rare: 0,
          mythic: 0,
          setPoints: 80,
          offPagePoints: 0,
          totalPoints: 80,
        }),
      );
      expect(row).toBe('🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥');
    });
  });

  describe('the rarity line', () => {
    test('omits any rung that is zero', () => {
      const out = buildShareText(
        exampleResult({ uncommon: 5, rare: 0, mythic: 1 }),
      );
      expect(out).toContain('✦ 5 Uncommon · 1 Mythic');
      expect(out).not.toContain('Rare');
    });

    test('disappears entirely when there are no off-page finds', () => {
      const out = buildShareText(
        exampleResult({
          uncommon: 0,
          rare: 0,
          mythic: 0,
          setPoints: 80,
          offPagePoints: 0,
          totalPoints: 80,
        }),
      );
      expect(out).not.toContain('✦');
      expect(out).not.toContain('Uncommon');
      // Four lines, not five: title, set, score row, points.
      expect(out.split('\n')).toHaveLength(4);
    });
  });

  test('reports the total points', () => {
    expect(buildShareText(exampleResult({ totalPoints: 226 }))).toContain(
      '226 pts',
    );
  });
});
