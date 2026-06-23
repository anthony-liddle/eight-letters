import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyWord, createPuzzle } from '@/engine/index.ts';
import { loadGameData } from './gameData.ts';

function mockAssets(files: Record<string, string>) {
  return vi.fn(async (url: string) => {
    const name = Object.keys(files).find((n) => url.endsWith(`data/${n}`));
    if (name === undefined) return { ok: false, status: 404 } as Response;
    return {
      ok: true,
      status: 200,
      text: async () => files[name],
    } as unknown as Response;
  });
}

const BASE_FILES: Record<string, string> = {
  'enable.txt': 'sap\nasp\n',
  'common-pool.txt': 'sap\n',
  'beyond-size-70.txt': '',
  'beyond-size-95.txt': '',
  'source-pool.json': '[]',
  'daily-calendar.json': JSON.stringify({
    epoch: { year: 2026, month: 1, day: 1 },
    words: ['apppwfii'],
  }),
  'dictionary-patch.tsv': 'app\tallow\tcommon\nwifi\tallow\tcommon\n',
};

afterEach(() => vi.unstubAllGlobals());

describe('loadGameData with the patch layer', () => {
  it('merges the allowlist into validation so a patched word is accepted', async () => {
    vi.stubGlobal('fetch', mockAssets(BASE_FILES));
    const data = await loadGameData();
    expect(data.dictionary.has('app')).toBe(true);
    expect(data.dictionary.has('wifi')).toBe(true);
  });

  it('bands the allowlisted word so it classifies as common, not mythic', async () => {
    vi.stubGlobal('fetch', mockAssets(BASE_FILES));
    const data = await loadGameData();
    const puzzle = createPuzzle(
      'apppwfii',
      data.dictionary,
      data.commonPool,
      data.beyond70Pool,
      data.beyond95Pool,
    );
    expect(classifyWord('app', puzzle)).toBe('set');
    expect(puzzle.mythicWords.has('app')).toBe(false);
  });
});
