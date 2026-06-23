/**
 * Dictionary patch layer. A small, curated, additive layer applied on top of
 * whatever the base validation boundary is (ENABLE today), so it carries over
 * unchanged when the boundary widens in a later phase.
 *
 * Two parts:
 * - allowlist: words to accept that the base list misses, each carrying a band
 *   so the classifier grades it correctly rather than letting it fall through
 *   to a rarity rung.
 * - denylist: words to reject that the base list wrongly accepts. The mechanism
 *   ships now; the real scrub is seeded later.
 *
 * The band on an allow entry is authoritative: a common-banded word joins the
 * common list and classifies as a set word, never as uncommon or mythic, even
 * though it sits beyond every SCOWL band.
 */

/** The band an allowlisted word joins. Only the common band is used today. */
export type PatchBand = 'common';

/** One allowlisted word and the band it joins. */
export interface AllowEntry {
  readonly word: string;
  readonly band: PatchBand;
}

/** The parsed patch: words to add (banded) and words to remove. */
export interface DictionaryPatch {
  readonly allow: readonly AllowEntry[];
  readonly deny: readonly string[];
}

/** The raw word lists the patch merges into, before they back the engine. */
export interface PatchableLists {
  readonly enable: readonly string[];
  readonly common: readonly string[];
  readonly beyond70: readonly string[];
  readonly beyond95: readonly string[];
}

const VALID_BANDS: ReadonlySet<string> = new Set<PatchBand>(['common']);

function normalizeWord(raw: string): string {
  const word = raw.trim().toLowerCase();
  if (!/^[a-z]+$/.test(word)) {
    throw new Error(`Patch word is not a-z only: "${raw}"`);
  }
  return word;
}

/**
 * Parse the patch TSV. Columns: word, action (allow or deny), band (the band
 * for allow; blank for deny), note (optional). Blank lines, comment lines
 * starting with #, and a header row whose first column is "word" are skipped.
 * An unknown action throws so a typo cannot silently drop an entry.
 */
export function parsePatch(tsv: string): DictionaryPatch {
  const allow: AllowEntry[] = [];
  const deny: string[] = [];

  for (const line of tsv.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const [rawWord, rawAction, rawBand] = line.split('\t');
    if ((rawWord ?? '').trim().toLowerCase() === 'word') continue; // header

    const action = (rawAction ?? '').trim().toLowerCase();
    if (action === 'allow') {
      const band = (rawBand ?? '').trim().toLowerCase();
      if (!VALID_BANDS.has(band)) {
        throw new Error(
          `Allow entry "${rawWord}" needs a valid band, got "${rawBand ?? ''}"`,
        );
      }
      allow.push({
        word: normalizeWord(rawWord ?? ''),
        band: band as PatchBand,
      });
    } else if (action === 'deny') {
      deny.push(normalizeWord(rawWord ?? ''));
    } else {
      throw new Error(`Unknown action "${rawAction ?? ''}" for "${rawWord}"`);
    }
  }

  return { allow, deny };
}

/** Append words not already present, preserving order. */
function withWords(
  list: readonly string[],
  additions: readonly string[],
): string[] {
  const seen = new Set(list);
  const out = [...list];
  for (const word of additions) {
    if (!seen.has(word)) {
      seen.add(word);
      out.push(word);
    }
  }
  return out;
}

/**
 * Apply the patch on top of the base lists: validation and the banded pools
 * gain the allowlist, and every list loses the denylist. Downstream,
 * createPuzzle and classifyWord then grade the merged lists with no special
 * casing: an allowlisted common word is just another common word.
 */
export function applyPatch(
  lists: PatchableLists,
  patch: DictionaryPatch,
): PatchableLists {
  const deny = new Set(patch.deny);
  const remove = (list: readonly string[]) => list.filter((w) => !deny.has(w));

  const allowWords = patch.allow.map((a) => a.word);
  const commonAllow = patch.allow
    .filter((a) => a.band === 'common')
    .map((a) => a.word);

  return {
    enable: remove(withWords(lists.enable, allowWords)),
    common: remove(withWords(lists.common, commonAllow)),
    beyond70: remove(lists.beyond70),
    beyond95: remove(lists.beyond95),
  };
}
