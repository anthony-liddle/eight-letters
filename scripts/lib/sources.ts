import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  COMMON_POOL_SIZES,
  MIN_WORD_LENGTH,
  SCOWL_VARIANTS,
  SIZE_95_SIZES,
  SOURCE_POOL_SIZES,
  SOURCE_WORD_LENGTH,
} from './config.ts';
import { parseDefinitions } from './definitions.ts';
import { applyPatch, parsePatch } from '../../src/data/patch.ts';
import { ASSET_DIR, DATA_RAW_DIR } from './util.ts';

/** Lowercase, ASCII a-z only. Drops accents, apostrophes, proper-noun casing. */
function normalize(word: string): string | null {
  const w = word.trim().toLowerCase();
  return /^[a-z]+$/.test(w) ? w : null;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** ENABLE: the historical base list. Read from the vendored raw list. */
export async function loadEnable(): Promise<string[]> {
  const raw = await readFile(join(DATA_RAW_DIR, 'enable1.txt'), 'utf8');
  const words = new Set<string>();
  for (const line of raw.split('\n')) {
    const w = normalize(line);
    if (w && w.length >= MIN_WORD_LENGTH) words.add(w);
  }
  return [...words].sort();
}

/**
 * The full validation boundary: ENABLE union SCOWL 95 with the committed patch
 * layer applied (allowlist added, denylist removed). This is what the runtime
 * validates against, so definition acquisition and the per-puzzle bundles must
 * target it, not ENABLE alone. Mirrors loadGameData's merge from the same
 * committed inputs.
 */
export async function loadValidation(): Promise<string[]> {
  const enable = await loadEnable();
  const enableSet = new Set(enable);
  const scowl95 = await loadScowlWords(SIZE_95_SIZES);
  const additions = scowl95.filter((w) => !enableSet.has(w));
  const patchText = await readFile(
    join(ASSET_DIR, 'dictionary-patch.tsv'),
    'utf8',
  );
  const merged = applyPatch(
    {
      enable: [...enable, ...additions],
      common: [],
      beyond70: [],
      beyond95: [],
    },
    parsePatch(patchText),
  );
  return [...merged.enable];
}

async function readBand(variant: string, size: number): Promise<string[]> {
  const path = join(DATA_RAW_DIR, 'scowl', `${variant}-words.${size}`);
  if (!(await fileExists(path))) return [];
  const raw = await readFile(path, 'latin1'); // SCOWL final lists are latin1.
  const out: string[] = [];
  for (const line of raw.split('\n')) {
    const w = normalize(line);
    if (w) out.push(w);
  }
  return out;
}

/** Union of the given SCOWL bands across variants, deduped, length >= minimum. */
export async function loadScowlWords(
  sizes: readonly number[],
): Promise<string[]> {
  const words = new Set<string>();
  for (const variant of SCOWL_VARIANTS) {
    for (const size of sizes) {
      for (const w of await readBand(variant, size)) {
        if (w.length >= MIN_WORD_LENGTH) words.add(w);
      }
    }
  }
  return [...words].sort();
}

/** The common pool: the tier denominator source. */
export function loadCommonPool(): Promise<string[]> {
  return loadScowlWords(COMMON_POOL_SIZES);
}

/** The committed short definitions, or an empty map if not acquired yet. */
export async function loadDefinitions(): Promise<Map<string, string>> {
  try {
    const raw = await readFile(join(DATA_RAW_DIR, 'definitions.tsv'), 'utf8');
    return parseDefinitions(raw);
  } catch {
    return new Map();
  }
}

/** Source-word candidates: SCOWL words from the tighter bands, exactly 8 letters. */
export async function loadSourceCandidates(): Promise<string[]> {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const size of SOURCE_POOL_SIZES) {
    for (const variant of SCOWL_VARIANTS) {
      for (const w of await readBand(variant, size)) {
        if (w.length === SOURCE_WORD_LENGTH && !seen.has(w)) {
          seen.add(w);
          ordered.push(w);
        }
      }
    }
  }
  return ordered;
}
