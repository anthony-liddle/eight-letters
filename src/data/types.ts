/** One source word with its baked Wiktionary content for the reveal. */
export interface SourceEntry {
  readonly word: string;
  readonly definition: string | null;
  readonly etymology: string | null;
}
