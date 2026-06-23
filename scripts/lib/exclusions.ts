import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_RAW_DIR } from './util.ts';

/**
 * Parse the committed source-word exclusion list. Columns: word, reason
 * (pure-inflection, degree-form, or past-tense-dual). Comment lines starting
 * with # and the header row are skipped. The build subtracts these words from
 * the crown pool; they stay valid, scorable finds, they just cannot headline a
 * day. Hand-editable: strike a line to re-admit a word.
 */
export function parseExclusions(tsv: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of tsv.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const [rawWord, rawReason] = line.split('\t');
    const word = (rawWord ?? '').trim().toLowerCase();
    if (word === '' || word === 'word') continue; // header or blank
    out.set(word, (rawReason ?? '').trim());
  }
  return out;
}

/** Load the committed exclusion list from the vendored data directory. */
export async function loadExclusions(): Promise<Map<string, string>> {
  const raw = await readFile(
    join(DATA_RAW_DIR, 'source-exclusions.tsv'),
    'utf8',
  );
  return parseExclusions(raw);
}
