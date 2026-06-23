import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyWord, createPuzzle, validateGuess } from '@/engine/index.ts';
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
  'scowl95-additions.txt': '',
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

describe('loadGameData with the ENABLE union SCOWL 95 boundary', () => {
  // blog is a SCOWL-95 word ENABLE lacks. Within size 95 but beyond 70 here,
  // so it must validate and grade as rare, never mythic.
  const FILES: Record<string, string> = {
    ...BASE_FILES,
    'enable.txt': 'cat\n',
    'common-pool.txt': 'cat\n',
    'scowl95-additions.txt': 'blog\n',
    'beyond-size-70.txt': 'blog\n', // boundary minus SCOWL 70 (blog is beyond 70)
    'beyond-size-95.txt': '', // boundary minus SCOWL 95 (blog is within 95)
    'dictionary-patch.tsv': '',
    'daily-calendar.json': JSON.stringify({
      epoch: { year: 2026, month: 1, day: 1 },
      words: ['blogxxxx'],
    }),
  };

  it('unions the SCOWL 95 additions into the validation set', async () => {
    vi.stubGlobal('fetch', mockAssets(FILES));
    const data = await loadGameData();
    expect(data.dictionary.has('blog')).toBe(true);
    expect(data.dictionary.has('cat')).toBe(true);
  });

  it('grades a newly admitted SCOWL word as rare, not mythic', async () => {
    vi.stubGlobal('fetch', mockAssets(FILES));
    const data = await loadGameData();
    const puzzle = createPuzzle(
      'blogxxxx',
      data.dictionary,
      data.commonPool,
      data.beyond70Pool,
      data.beyond95Pool,
    );
    expect(validateGuess('blog', puzzle, new Set()).kind).toBe('valid');
    expect(classifyWord('blog', puzzle)).toBe('rare');
    expect(puzzle.mythicWords.has('blog')).toBe(false);
  });
});
