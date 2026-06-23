import type { Dictionary, WordSource } from '@/engine/types.ts';
import { createListDictionary, createListWordSource } from './listSource.ts';
import { applyPatch, parsePatch } from './patch.ts';
import type { SourceEntry } from './types.ts';

/** The local calendar epoch baked into the daily calendar. */
export interface EpochDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** The frozen, append-only daily calendar: the ordered eligible source words. */
export interface DailyCalendar {
  readonly epoch: EpochDate;
  readonly words: readonly string[];
}

/** Everything the engine and UI need, loaded once from the baked assets. */
export interface GameData {
  /** Validation dictionary: ENABLE union SCOWL 95, with the patch layer applied. */
  readonly dictionary: Dictionary;
  /** SCOWL-small set pool, the completion denominator source. */
  readonly commonPool: WordSource;
  /** ENABLE words beyond SCOWL size 70: the uncommon cutoff for the rarity ladder. */
  readonly beyond70Pool: WordSource;
  /** ENABLE words beyond SCOWL size 95: the rare/mythic cutoff for the rarity ladder. */
  readonly beyond95Pool: WordSource;
  /**
   * The frozen daily calendar: only source words that clear MIN_SET_SIZE. Both
   * daily (by date) and endless (random) draw from this list, so a sub-floor
   * word never headlines either mode.
   */
  readonly dailyCalendar: DailyCalendar;
  /** Lookup from source word to its definition and etymology. */
  readonly sourceEntry: (word: string) => SourceEntry | undefined;
}

function assetUrl(name: string): string {
  return `${import.meta.env.BASE_URL}data/${name}`;
}

async function fetchText(name: string): Promise<string> {
  const res = await fetch(assetUrl(name));
  if (!res.ok) throw new Error(`Failed to load ${name}: HTTP ${res.status}`);
  return res.text();
}

function parseWordList(text: string): string[] {
  return text
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean);
}

/**
 * Load and wire up the baked assets behind the engine interfaces. The dictionary
 * lives behind the Dictionary interface so it can be swapped (a smaller list, a
 * remote service) without touching the engine or UI.
 */
export async function loadGameData(): Promise<GameData> {
  const [
    enableText,
    additionsText,
    commonText,
    beyond70Text,
    beyond95Text,
    sourceJson,
    calendarJson,
    patchText,
  ] = await Promise.all([
    fetchText('enable.txt'),
    fetchText('scowl95-additions.txt'),
    fetchText('common-pool.txt'),
    fetchText('beyond-size-70.txt'),
    fetchText('beyond-size-95.txt'),
    fetchText('source-pool.json'),
    fetchText('daily-calendar.json'),
    fetchText('dictionary-patch.tsv'),
  ]);

  // The validation boundary is ENABLE union SCOWL 95: ENABLE plus the within-95
  // SCOWL words it lacks (shipped as the additions complement so nothing is
  // listed twice). The bands stay derived from the same SCOWL v1 list, so the
  // newly valid words land in their true rung and the mythic tail is unchanged.
  const validation = [
    ...parseWordList(enableText),
    ...parseWordList(additionsText),
  ];

  // Apply the curated patch on top of the merged lists before they back the
  // engine. The allowlist joins validation and its band; the denylist is
  // removed. Everything downstream sees one merged set of lists.
  const lists = applyPatch(
    {
      enable: validation,
      common: parseWordList(commonText),
      beyond70: parseWordList(beyond70Text),
      beyond95: parseWordList(beyond95Text),
    },
    parsePatch(patchText),
  );

  const dictionary = createListDictionary(lists.enable);
  const commonPool = createListWordSource(lists.common);
  const beyond70Pool = createListWordSource(lists.beyond70);
  const beyond95Pool = createListWordSource(lists.beyond95);

  const entries = JSON.parse(sourceJson) as SourceEntry[];
  const byWord = new Map(entries.map((e) => [e.word, e]));
  const dailyCalendar = JSON.parse(calendarJson) as DailyCalendar;

  return {
    dictionary,
    commonPool,
    beyond70Pool,
    beyond95Pool,
    dailyCalendar,
    sourceEntry: (word) => byWord.get(word),
  };
}
