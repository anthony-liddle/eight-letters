/**
 * Build-time image pipeline. Generates the Open Graph share image and the full
 * favicon set from source SVGs, rasterized with the app's Fraunces face. Runs
 * offline after the first font fetch; every output is a byproduct, never a
 * hand-exported binary.
 *
 *   pnpm icons:build
 *
 * Outputs to public/:
 *   favicon.svg, favicon.ico, apple-touch-icon.png,
 *   icon-192.png, icon-512.png, icon-maskable-512.png,
 *   og.png (1200x630), site.webmanifest
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';
import { loadFraunces, centeredGlyphPath, type Fraunces } from './lib/fonts.ts';
import { REPO_ROOT, ensureDir } from './lib/util.ts';

const PUBLIC_DIR = join(REPO_ROOT, 'public');

/** The canonical letterpress palette. Mirrors the app's CSS tokens. */
const BRAND = {
  paper: '#F1EEE6',
  ink: '#211D17',
  inkSoft: '#5A5446',
  sage: '#4B6A52',
  crown: '#B5872F', // the source-word colour
  tileFace: '#F7F3E8',
  tileEdge: '#C9BD9C',
  foot: 'rgba(33, 29, 23, 0.15)',
};

const SITE_NAME = 'Peach of a Word';
const SHORT_NAME = 'Peach';
const DESCRIPTION =
  'Peach of a Word. Make words from eight scrambled letters, then find the source word they all came from. A quiet daily word game.';
const OG_ALT =
  'The wordmark Peach of a Word above a row of letterpress type sorts, one in amber.';

// --- Square icon (the type sort bearing an 8) ----------------------------

interface SquareOpts {
  /** Background fill, or null for transparent. */
  bg: string | null;
  /** Margin from the 512 edge to the tile. Larger = more safe-zone padding. */
  margin: number;
}

function squareSvg(font: Fraunces['display'], opts: SquareOpts): string {
  const size = 512;
  const m = opts.margin;
  const inner = size - 2 * m;
  const rx = Math.round(inner * 0.085);
  const stroke = Math.max(6, inner * 0.024);
  const footY = m + inner * 0.82;
  const footH = Math.max(4, inner * 0.022);
  const glyphSize = inner * 0.66;
  const d = centeredGlyphPath(font, '8', size / 2, m + inner * 0.45, glyphSize);

  const bg = opts.bg
    ? `<rect width="${size}" height="${size}" fill="${opts.bg}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <rect x="${m}" y="${m}" width="${inner}" height="${inner}" rx="${rx}" fill="${BRAND.tileFace}" stroke="${BRAND.ink}" stroke-width="${stroke}"/>
  <rect x="${m + inner * 0.16}" y="${footY}" width="${inner * 0.68}" height="${footH}" rx="3" fill="${BRAND.foot}"/>
  <path d="${d}" fill="${BRAND.ink}"/>
</svg>`;
}

// --- Open Graph image (1200x630) -----------------------------------------

function ogSvg(): string {
  const W = 1200;
  const H = 630;
  const cx = W / 2;
  const mx = 90;

  // A row of type sorts spelling a fitting eight-letter word, one in amber to
  // echo the source-word moment.
  const word = 'serenade';
  const accentIndex = 3;
  const sortW = 104;
  const sortH = 132;
  const gap = 16;
  const rowW = word.length * sortW + (word.length - 1) * gap;
  const rowX = (W - rowW) / 2;
  const rowY = 392;

  const sorts = [...word]
    .map((ch, i) => {
      const x = rowX + i * (sortW + gap);
      const isAccent = i === accentIndex;
      const strokeC = isAccent ? BRAND.crown : BRAND.tileEdge;
      const letterC = isAccent ? BRAND.crown : BRAND.ink;
      const baseline = rowY + sortH * 0.7;
      return `<rect x="${x}" y="${rowY}" width="${sortW}" height="${sortH}" rx="8" fill="${BRAND.tileFace}" stroke="${strokeC}" stroke-width="3"/>
    <rect x="${x + sortW * 0.18}" y="${rowY + sortH * 0.82}" width="${sortW * 0.64}" height="4" rx="2" fill="${BRAND.foot}"/>
    <text x="${x + sortW / 2}" y="${baseline}" font-family="Fraunces" font-weight="600" font-size="68" fill="${letterC}" text-anchor="middle">${ch}</text>`;
    })
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BRAND.paper}"/>
  <rect x="${mx}" y="64" width="${W - 2 * mx}" height="3" fill="${BRAND.ink}"/>
  <rect x="${mx}" y="72" width="${W - 2 * mx}" height="1.5" fill="${BRAND.ink}"/>
  <text x="${cx}" y="150" font-family="Fraunces" font-weight="600" font-size="27" letter-spacing="7" fill="${BRAND.sage}" text-anchor="middle">A QUIET DAILY WORD GAME</text>
  <text x="${cx}" y="316" font-family="Fraunces" font-weight="600" font-size="108" fill="${BRAND.ink}" text-anchor="middle">${SITE_NAME}</text>
  ${sorts}
</svg>`;
}

// --- Rasterizing ---------------------------------------------------------

function renderPng(svg: string, width: number, fonts?: string[]): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: fonts
      ? {
          fontFiles: fonts,
          loadSystemFonts: false,
          defaultFontFamily: 'Fraunces',
        }
      : { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

async function write(name: string, contents: string | Buffer): Promise<void> {
  await writeFile(join(PUBLIC_DIR, name), contents);
  console.log(`  ${name}`);
}

async function main(): Promise<void> {
  console.log('Building icons and the OG image.\n');
  await ensureDir(PUBLIC_DIR);
  const fraunces = await loadFraunces();

  // Square sources: a transparent tile for the favicon, a paper-backed tile for
  // Apple and PWA icons, and a padded tile for the maskable safe zone.
  const iconSvg = squareSvg(fraunces.display, { bg: null, margin: 40 });
  const filledSvg = squareSvg(fraunces.display, {
    bg: BRAND.paper,
    margin: 56,
  });
  const maskableSvg = squareSvg(fraunces.display, {
    bg: BRAND.paper,
    margin: 104,
  });

  console.log('Favicons:');
  await write('favicon.svg', iconSvg);
  const ico16 = renderPng(iconSvg, 16);
  const ico32 = renderPng(iconSvg, 32);
  const ico48 = renderPng(iconSvg, 48);
  await write('favicon.ico', await pngToIco([ico16, ico32, ico48]));
  await write('apple-touch-icon.png', renderPng(filledSvg, 180));
  await write('icon-192.png', renderPng(filledSvg, 192));
  await write('icon-512.png', renderPng(filledSvg, 512));
  await write('icon-maskable-512.png', renderPng(maskableSvg, 512));

  console.log('Open Graph:');
  await write('og.png', renderPng(ogSvg(), 1200, fraunces.files));

  console.log('Manifest:');
  const manifest = {
    name: SITE_NAME,
    short_name: SHORT_NAME,
    description: DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: BRAND.paper,
    theme_color: BRAND.paper,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
  await write('site.webmanifest', JSON.stringify(manifest, null, 2));

  // The OG alt text lives in index.html; surface it here for reference.
  console.log(`\nDone. og:image:alt is "${OG_ALT}"`);
}

main().catch((err) => {
  console.error('\nIcon build failed:', err);
  process.exitCode = 1;
});
