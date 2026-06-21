import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createListDictionary,
  createListWordSource,
} from '@/data/listSource.ts';
import {
  eligibleSourceWords,
  generateCalendar,
  sourceSetSize,
  MIN_SET_SIZE,
} from '@/engine/index.ts';
import type { SourceEntry } from '@/data/types.ts';
import type { Dictionary, WordSource } from '@/engine/types.ts';

/**
 * Real-data checks against the baked assets. These prove eligibility is wired up
 * (the 582 anchor) and that the committed calendar is in sync with the data.
 */
const DATA = join(import.meta.dirname, '..', 'public', 'data');
const read = (f: string) =>
  readFileSync(join(DATA, f), 'utf8')
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean);

let dictionary: Dictionary;
let commonPool: WordSource;
let beyond70Pool: WordSource;
let beyond95Pool: WordSource;
let sourceWords: string[];
let eligible: string[];

beforeAll(() => {
  dictionary = createListDictionary(read('enable.txt'));
  commonPool = createListWordSource(read('common-pool.txt'));
  beyond70Pool = createListWordSource(read('beyond-size-70.txt'));
  beyond95Pool = createListWordSource(read('beyond-size-95.txt'));
  sourceWords = (
    JSON.parse(
      readFileSync(join(DATA, 'source-pool.json'), 'utf8'),
    ) as SourceEntry[]
  ).map((e) => e.word);
  eligible = eligibleSourceWords(
    sourceWords,
    dictionary,
    commonPool,
    beyond70Pool,
    beyond95Pool,
  );
}, 120_000);

const setSize = (w: string) =>
  sourceSetSize(w, dictionary, commonPool, beyond70Pool, beyond95Pool);

describe('eligibility against the real baked data', () => {
  it('keeps 582 of the 707 shipped source words (the rest are sub-floor)', () => {
    expect(sourceWords.length).toBe(707);
    expect(eligible.length).toBe(582);
  });

  it('treats known thin words as sub-floor (crown-inclusive)', () => {
    // aardvark: 3, remember: 5. Both under the floor.
    expect(setSize('aardvark')).toBeLessThan(MIN_SET_SIZE);
    expect(setSize('remember')).toBeLessThan(MIN_SET_SIZE);
    expect(eligible).not.toContain('aardvark');
    expect(eligible).not.toContain('remember');
  });

  it('treats a rich word as eligible', () => {
    expect(setSize('basement')).toBeGreaterThanOrEqual(MIN_SET_SIZE);
    expect(eligible).toContain('basement');
  });
});

describe('the generated calendar', () => {
  it('first run contains exactly the eligible words, no sub-floor', () => {
    const calendar = generateCalendar(eligible, []);
    expect([...calendar].sort()).toEqual([...eligible].sort());
    expect(calendar).not.toContain('aardvark');
    expect(calendar).not.toContain('remember');
  });

  it('matches the committed daily-calendar.json', () => {
    const committed = JSON.parse(
      readFileSync(join(DATA, 'daily-calendar.json'), 'utf8'),
    ) as { epoch: unknown; words: string[] };
    expect(committed.words.length).toBe(582);
    expect([...committed.words].sort()).toEqual([...eligible].sort());
  });
});
