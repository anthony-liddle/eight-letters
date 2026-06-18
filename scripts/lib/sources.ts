import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  COMMON_POOL_SIZES,
  MIN_WORD_LENGTH,
  SCOWL_VARIANTS,
  SOURCE_POOL_SIZES,
  SOURCE_WORD_LENGTH,
} from './config.ts';
import { DATA_RAW_DIR } from './util.ts';

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

/** ENABLE: the full validation set. Read from the vendored raw list. */
export async function loadEnable(): Promise<string[]> {
  const raw = await readFile(join(DATA_RAW_DIR, 'enable1.txt'), 'utf8');
  const words = new Set<string>();
  for (const line of raw.split('\n')) {
    const w = normalize(line);
    if (w && w.length >= MIN_WORD_LENGTH) words.add(w);
  }
  return [...words].sort();
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
