import { formableFrom } from '@/engine/formability.ts';
import type { Dictionary, WordSource } from '@/engine/types.ts';

/**
 * A WordSource backed by an in-memory word list. The engine talks only to the
 * WordSource / Dictionary interfaces, so this list-backed form (used for the
 * baked ENABLE and common-pool assets, and for tests) can be swapped for any
 * other implementation later.
 */
export function createListWordSource(words: Iterable<string>): WordSource {
  const list = [...words];
  return {
    formableWords: (rack) => formableFrom(rack, list),
  };
}

/** A Dictionary (WordSource plus membership) backed by an in-memory list. */
export function createListDictionary(words: Iterable<string>): Dictionary {
  const set = new Set(words);
  return {
    has: (word) => set.has(word),
    formableWords: (rack) => formableFrom(rack, set),
  };
}
