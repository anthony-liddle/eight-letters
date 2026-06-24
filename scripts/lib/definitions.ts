// Pure shaping and storage for short tappable definitions. No I/O, no network.
import { selectSense } from './wiktionary.ts';

/** Cut text to one sentence, then to a word boundary within budget. */
function capGloss(text: string, budget: number): string {
  // Lookahead ensures terminators inside abbreviations (e.g., U.S.) don't end the sentence.
  const sentence = text.match(/^(.*?[.!?])(?=\s+[A-Z]|$)/);
  let s = sentence?.[1] ?? text;
  if (s.length > budget) {
    const cut = s.slice(0, budget);
    const sp = cut.lastIndexOf(' ');
    s = sp > 0 ? cut.slice(0, sp) : cut;
  }
  return s.trim();
}

/** One primary sense as a short plain gloss within maxLength, markup stripped. */
export function shapeDefinition(
  definitionJson: string | null,
  maxLength: number,
): string | null {
  const sense = selectSense(definitionJson);
  if (!sense) return null;
  const prefix = sense.pos ? `${sense.pos}. ` : '';
  const budget = Math.max(1, maxLength - prefix.length);
  const gloss = capGloss(sense.text, budget);
  if (!gloss) return null;
  return `${prefix}${gloss}`;
}

/** Parse flat TSV (`word\tdefinition` per line) into a map. */
export function parseDefinitions(tsv: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of tsv.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab <= 0) continue;
    out.set(line.slice(0, tab), line.slice(tab + 1));
  }
  return out;
}

/** Serialize to flat TSV, sorted by word, with a trailing newline. */
export function serializeDefinitions(defs: Map<string, string>): string {
  const lines = [...defs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([word, def]) => `${word}\t${def}`);
  return lines.length ? `${lines.join('\n')}\n` : '';
}

export interface GlossChange {
  word: string;
  before: string;
  after: string;
}

export interface RederiveResult {
  /** The re-derived gloss map, one entry per existing word. */
  next: Map<string, string>;
  /** Words whose gloss changed, with the old and new text. */
  changed: GlossChange[];
  /** Words skipped because the cache held nothing for them. */
  cacheMisses: string[];
}

/**
 * Re-derive each existing gloss from cached Wiktionary JSON, picking a better
 * sense. The caller supplies the per-word JSON lookup (the disk cache), so this
 * stays pure and offline. A word is kept as-is when the cache is missing or
 * yields no usable sense, so no word is ever blanked.
 */
export function rederiveGlosses(
  existing: Map<string, string>,
  getJson: (word: string) => string | null,
  maxLength: number,
): RederiveResult {
  const next = new Map<string, string>();
  const changed: GlossChange[] = [];
  const cacheMisses: string[] = [];
  for (const [word, before] of existing) {
    const json = getJson(word);
    if (json === null) {
      cacheMisses.push(word);
      next.set(word, before);
      continue;
    }
    const after = shapeDefinition(json, maxLength);
    if (!after) {
      next.set(word, before);
      continue;
    }
    next.set(word, after);
    if (after !== before) changed.push({ word, before, after });
  }
  return { next, changed, cacheMisses };
}

/** Merge incoming into existing. Incoming wins on conflict. */
export function mergeDefinitions(
  existing: Map<string, string>,
  incoming: Map<string, string>,
): Map<string, string> {
  const out = new Map(existing);
  for (const [word, def] of incoming) out.set(word, def);
  return out;
}
