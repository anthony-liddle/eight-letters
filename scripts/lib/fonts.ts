import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import opentype from 'opentype.js';
import { CACHE_DIR, ensureDir } from './util.ts';

/**
 * Fraunces is the app's display face. The rasterizer needs the real font files,
 * since resvg does not read system fonts. We pull static weights from the
 * Fontsource CDN (the same family the app loads from Google Fonts) and cache
 * them, so icon builds are reproducible and offline after the first run.
 */
const FONT_URLS: Record<number, string> = {
  400: 'https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-400-normal.ttf',
  600: 'https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-600-normal.ttf',
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureWeight(weight: number): Promise<string> {
  await ensureDir(CACHE_DIR);
  const path = join(CACHE_DIR, `fraunces-${weight}.ttf`);
  if (!(await fileExists(path))) {
    const url = FONT_URLS[weight];
    if (!url) throw new Error(`No font URL for weight ${weight}`);
    const res = await fetch(url);
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
  const path400 = await ensureWeight(400);
  const path600 = await ensureWeight(600);
  const buf = await readFile(path600);
  const display = opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  return { files: [path400, path600], display };
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
