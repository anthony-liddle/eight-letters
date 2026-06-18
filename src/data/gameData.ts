import type { Dictionary, WordSource } from '@/engine/types.ts';
import { createListDictionary, createListWordSource } from './listSource.ts';
import type { SourceEntry } from './types.ts';

/** Everything the engine and UI need, loaded once from the baked assets. */
export interface GameData {
  /** ENABLE validation dictionary. */
  readonly dictionary: Dictionary;
  /** SCOWL-small set pool, the completion denominator source. */
  readonly commonPool: WordSource;
  /** ENABLE words beyond SCOWL size 70: the uncommon cutoff for the rarity ladder. */
  readonly beyond70Pool: WordSource;
  /** ENABLE words beyond SCOWL size 95: the rare/mythic cutoff for the rarity ladder. */
  readonly beyond95Pool: WordSource;
  /** Ordered source-word pool (drives daily and endless selection). */
  readonly sourceWords: readonly string[];
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
  const [enableText, commonText, beyond70Text, beyond95Text, sourceJson] =
    await Promise.all([
      fetchText('enable.txt'),
      fetchText('common-pool.txt'),
      fetchText('beyond-size-70.txt'),
      fetchText('beyond-size-95.txt'),
      fetchText('source-pool.json'),
    ]);

  const dictionary = createListDictionary(parseWordList(enableText));
  const commonPool = createListWordSource(parseWordList(commonText));
  const beyond70Pool = createListWordSource(parseWordList(beyond70Text));
  const beyond95Pool = createListWordSource(parseWordList(beyond95Text));

  const entries = JSON.parse(sourceJson) as SourceEntry[];
  const byWord = new Map(entries.map((e) => [e.word, e]));
  const sourceWords = entries.map((e) => e.word);

  return {
    dictionary,
    commonPool,
    beyond70Pool,
    beyond95Pool,
    sourceWords,
    sourceEntry: (word) => byWord.get(word),
  };
}
