import { execFile } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  COMMON_POOL_SIZES,
  ENABLE_URL,
  MIN_WORD_LENGTH,
  SCOWL_TARBALL_URL,
  SCOWL_VARIANTS,
  SOURCE_POOL_SIZES,
  SOURCE_WORD_LENGTH,
} from './config.ts';
import { CACHE_DIR, ensureDir, fetchText } from './util.ts';

const execFileAsync = promisify(execFile);

/** Lowercase, ASCII a-z only. Drops accents, apostrophes, proper-noun casing. */
function normalize(word: string): string | null {
  const w = word.trim().toLowerCase();
  return /^[a-z]+$/.test(w) ? w : null;
}

/** ENABLE: the full validation set. Lowercased, a-z, length >= minimum. */
export async function loadEnable(): Promise<string[]> {
  const raw = await fetchText(ENABLE_URL);
  const words = new Set<string>();
  for (const line of raw.split('\n')) {
    const w = normalize(line);
    if (w && w.length >= MIN_WORD_LENGTH) words.add(w);
  }
  return [...words].sort();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download the SCOWL tarball once (cached) and return a reader for its
 * size-banded word lists. Each band is named like `english-words.40`.
 */
async function scowlExtractDir(): Promise<string> {
  await ensureDir(CACHE_DIR);
  const tarball = join(CACHE_DIR, 'scowl.tar.gz');
  const extractRoot = join(CACHE_DIR, 'scowl');

  if (!(await fileExists(tarball))) {
    const res = await fetch(SCOWL_TARBALL_URL);
    if (!res.ok) throw new Error(`SCOWL download failed: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(tarball, buf);
  }

  if (!(await fileExists(join(extractRoot, 'final')))) {
    await ensureDir(extractRoot);
    // Strip the top-level versioned dir so band files land in `final/`.
    await execFileAsync('tar', [
      'xzf',
      tarball,
      '-C',
      extractRoot,
      '--strip-components=1',
    ]);
  }
  return extractRoot;
}

async function readBand(
  dir: string,
  variant: string,
  size: number,
): Promise<string[]> {
  const path = join(dir, 'final', `${variant}-words.${size}`);
  if (!(await fileExists(path))) return [];
  // SCOWL final lists are latin1.
  const raw = await readFile(path, 'latin1');
  const out: string[] = [];
  for (const line of raw.split('\n')) {
    const w = normalize(line);
    if (w) out.push(w);
  }
  return out;
}

/**
 * The common pool: the tier denominator source. Union of the chosen SCOWL bands
 * across the chosen spelling variants, deduped, length >= minimum.
 */
export async function loadCommonPool(): Promise<string[]> {
  const dir = await scowlExtractDir();
  const words = new Set<string>();
  for (const variant of SCOWL_VARIANTS) {
    for (const size of COMMON_POOL_SIZES) {
      for (const w of await readBand(dir, variant, size)) {
        if (w.length >= MIN_WORD_LENGTH) words.add(w);
      }
    }
  }
  return [...words].sort();
}

/**
 * Source-word candidates: SCOWL words from the tighter bands, exactly 8 letters.
 * Returned most-common-first (lower band = more common) so the enrichment cap
 * keeps the most recognizable answers.
 */
export async function loadSourceCandidates(): Promise<string[]> {
  const dir = await scowlExtractDir();
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const size of SOURCE_POOL_SIZES) {
    for (const variant of SCOWL_VARIANTS) {
      for (const w of await readBand(dir, variant, size)) {
        if (w.length === SOURCE_WORD_LENGTH && !seen.has(w)) {
          seen.add(w);
          ordered.push(w);
        }
      }
    }
  }
  return ordered;
}
