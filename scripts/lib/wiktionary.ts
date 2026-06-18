import { WIKTIONARY_USER_AGENT } from './config.ts';
import { fetchText, readCacheJson, sleep, writeCacheJson } from './util.ts';

export interface WordEntry {
  word: string;
  definition: string | null;
  etymology: string | null;
}

/** Raw, uncleaned API responses, cached so text cleanup stays re-runnable. */
interface RawResponses {
  word: string;
  /** Raw REST definition JSON, or null if the fetch did not yield one. */
  definitionJson: string | null;
  /** Raw rendered HTML of the Etymology section, or null. */
  etymologyHtml: string | null;
}

const HEADERS = {
  'User-Agent': WIKTIONARY_USER_AGENT,
  'Api-User-Agent': WIKTIONARY_USER_AGENT,
};

/** Be polite: a small pause between requests keeps us under the throttle line. */
const REQUEST_DELAY_MS = 120;

// --- Text cleanup (pure) -------------------------------------------------

function cleanText(input: string): string {
  let t = input;
  t = t.replace(/<style\b[\s\S]*?<\/style>/gi, ' '); // inline CSS (e.g. .defdate)
  t = t.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, ' '); // ref/footnote markers
  t = t.replace(/<[^>]+>/g, ' '); // remaining tags
  t = decodeEntities(t);
  t = t.replace(/[\u200B\u200E\u200F\u00AD]/g, ''); // zero-width + bidi marks
  t = t.replace(/\.mw-parser-output[^}]*}/g, ' '); // any stray CSS rule text
  t = t.replace(/\[\s*\d+\s*\]/g, ' '); // [1] style markers
  t = t.replace(/\s*\u2014\s*/g, ', '); // no em dashes anywhere, per the voice guide
  // Tighten spacing the rendered HTML leaves around punctuation and quotes.
  t = t.replace(/\s+([,.;:)\]”’])/g, '$1');
  t = t.replace(/([([“‘])\s+/g, '$1');
  t = t.replace(/\s+\+\s*\u200E?/g, ' + '); // surface-analysis joins
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8212;|&mdash;/g, ', ') // no em dashes, per the voice guide
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export interface RestDefinition {
  partOfSpeech?: string;
  definitions?: { definition?: string }[];
}

export interface FirstSense {
  pos: string | null;
  text: string;
}

/** The first usable English sense, cleaned to plain text. pos is lowercased. */
export function firstSense(definitionJson: string | null): FirstSense | null {
  if (!definitionJson) return null;
  let json: Record<string, RestDefinition[]>;
  try {
    json = JSON.parse(definitionJson);
  } catch {
    return null;
  }
  const en = json.en;
  if (!en?.length) return null;
  for (const sense of en) {
    const first = sense.definitions?.find((d) => d.definition?.trim());
    if (!first?.definition) continue;
    const text = cleanText(first.definition);
    if (!text) continue;
    return { pos: sense.partOfSpeech?.toLowerCase() ?? null, text };
  }
  return null;
}

/** Source-pool definition string: "pos. text" or just text. Unchanged shape. */
export function extractDefinition(
  definitionJson: string | null,
): string | null {
  const sense = firstSense(definitionJson);
  if (!sense) return null;
  return sense.pos ? `${sense.pos}. ${sense.text}` : sense.text;
}

function extractEtymology(etymologyHtml: string | null): string | null {
  if (!etymologyHtml) return null;
  let html = etymologyHtml;
  // Drop maintenance-error spans (ambiguous-etymon notices) entirely.
  html = html.replace(/<span class="error[^>]*>[\s\S]*?<\/span>/gi, ' ');
  // The prose lives in <p> elements; the etymology tree and references are
  // sibling <div>/<ol> blocks, so taking paragraphs alone drops the noise.
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(
    (m) => m[1] ?? '',
  );
  if (paragraphs.length === 0) return null;
  const text = cleanText(paragraphs.join(' '));
  return text || null;
}

// --- Fetch (cached) ------------------------------------------------------

async function fetchRaw(word: string): Promise<RawResponses> {
  const enc = encodeURIComponent(word);

  let definitionJson: string | null;
  try {
    definitionJson = await fetchText(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${enc}`,
      { headers: HEADERS },
    );
  } catch {
    definitionJson = null;
  }
  await sleep(REQUEST_DELAY_MS);

  let etymologyHtml: string | null = null;
  try {
    const base = 'https://en.wiktionary.org/w/api.php';
    const sections = JSON.parse(
      await fetchText(
        `${base}?action=parse&page=${enc}&prop=sections&format=json&formatversion=2`,
        { headers: HEADERS },
      ),
    ) as { parse?: { sections?: { index?: string; line?: string }[] } };
    const ety = sections.parse?.sections?.find((s) =>
      s.line?.startsWith('Etymology'),
    );
    if (ety?.index) {
      await sleep(REQUEST_DELAY_MS);
      const body = JSON.parse(
        await fetchText(
          `${base}?action=parse&page=${enc}&section=${ety.index}&prop=text&format=json&formatversion=2&disabletoc=1`,
          { headers: HEADERS },
        ),
      ) as { parse?: { text?: string } };
      etymologyHtml = body.parse?.text ?? null;
    }
  } catch {
    etymologyHtml = null;
  }

  return { word, definitionJson, etymologyHtml };
}

/**
 * Enrich one word. Raw responses are cached on disk; a cached entry whose
 * definition fetch failed (a throttled null) is re-fetched rather than trusted,
 * so a busy run never poisons the cache permanently.
 */
export async function enrichWord(word: string): Promise<WordEntry> {
  const cacheKey = `wiktionary-raw/${word}.json`;
  let raw = await readCacheJson<RawResponses>(cacheKey);
  if (!raw || raw.definitionJson === null) {
    raw = await fetchRaw(word);
    if (raw.definitionJson !== null) await writeCacheJson(cacheKey, raw);
  }
  return {
    word,
    definition: extractDefinition(raw.definitionJson),
    etymology: extractEtymology(raw.etymologyHtml),
  };
}
