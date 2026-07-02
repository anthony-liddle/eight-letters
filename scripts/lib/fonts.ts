import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import opentype from 'opentype.js';
import { CACHE_DIR, ensureDir } from './util.ts';

/**
 * The rasterizer needs the real font files, since resvg does not read system
 * fonts. We pull static weights from the Fontsource CDN (the same families the
 * app loads from Google Fonts) and cache them, so icon builds are reproducible
 * and offline after the first run. Fraunces is the letterpress display face;
 * Fredoka and Nunito are the cute faces, used for the cute Open Graph card.
 */
const fontsourceUrl = (family: string, weight: number): string =>
  `https://cdn.jsdelivr.net/fontsource/fonts/${family}@latest/latin-${weight}-normal.ttf`;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cache a single Fontsource weight to disk and return its path. The cache file
 * name carries the family and weight so different faces never collide.
 */
async function ensureFont(family: string, weight: number): Promise<string> {
  await ensureDir(CACHE_DIR);
  const path = join(CACHE_DIR, `${family}-${weight}.ttf`);
  if (!(await fileExists(path))) {
    const res = await fetch(fontsourceUrl(family, weight));
    if (!res.ok) throw new Error(`Font download failed: HTTP ${res.status}`);
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

export interface Fraunces {
  /** Paths to the cached TTF files, for the rasterizer's font list. */
  files: string[];
  /** Parsed 600-weight font, for turning the favicon glyph into a vector path. */
  display: opentype.Font;
}

export async function loadFraunces(): Promise<Fraunces> {
  const path400 = await ensureFont('fraunces', 400);
  const path600 = await ensureFont('fraunces', 600);
  const buf = await readFile(path600);
  const display = opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  return { files: [path400, path600], display };
}

/**
 * The cute faces for the Open Graph card: Fredoka (the rounded display face used
 * for the wordmark and letter tiles) and Nunito (the body face used for the small
 * kicker). Returns the cached TTF paths for the rasterizer's font list. The
 * font-family names in the cute SVG must match these families exactly, or resvg
 * falls back silently.
 */
export interface CuteFonts {
  files: string[];
}

export async function loadCuteFonts(): Promise<CuteFonts> {
  const fredoka = await ensureFont('fredoka', 600);
  const nunito = await ensureFont('nunito', 700);
  return { files: [fredoka, nunito] };
}

/**
 * A glyph as an SVG path, centered on (cx, cy) by its bounding box. Returns the
 * `d` attribute only, so the caller controls fill and context.
 */
export function centeredGlyphPath(
  font: opentype.Font,
  text: string,
  cx: number,
  cy: number,
  fontSize: number,
): string {
  const probe = font.getPath(text, 0, 0, fontSize);
  const bb = probe.getBoundingBox();
  const dx = cx - (bb.x1 + bb.x2) / 2;
  const dy = cy - (bb.y1 + bb.y2) / 2;
  const path = font.getPath(text, dx, dy, fontSize);
  return path.toPathData(2);
}
