import { MIN_WORD_LENGTH } from './config.ts';

const A = 'a'.charCodeAt(0);

/** Count of each letter a-z in a word. Index 0 is 'a'. Non-letters ignored. */
export function letterCounts(word: string): Int8Array {
  const counts = new Int8Array(26);
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i) - A;
    if (c >= 0 && c < 26) counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

/** True if `word` can be spelled from `rack`, each tile used at most once. */
export function canForm(rackCounts: Int8Array, word: string): boolean {
  const need = letterCounts(word);
  for (let i = 0; i < 26; i++) {
    if ((need[i] as number) > (rackCounts[i] as number)) return false;
  }
  return true;
}

/**
 * Filter a word list to those formable from the rack, length >= minimum.
 * The rack's letter counts are computed once for the whole pass.
 */
export function formableFrom(rack: string, words: Iterable<string>): string[] {
  const rackCounts = letterCounts(rack);
  const out: string[] = [];
  for (const w of words) {
    if (w.length >= MIN_WORD_LENGTH && canForm(rackCounts, w)) out.push(w);
  }
  return out;
}
