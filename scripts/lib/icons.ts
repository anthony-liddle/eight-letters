/**
 * Pure icon-art generators, kept apart from the build-icons pipeline so they
 * carry no side effects (no rasterizer, no filesystem, no top-level build) and
 * can be unit-tested directly. build-icons.ts imports these and does the I/O.
 */

/**
 * The smiling peach mark, the same original art the app draws in the cute theme
 * (Decorations peach1), on its native 0-100 canvas. One shared constant so the
 * whole icon system (OG card, favicon, home-screen icons) is one peach.
 */
export const PEACH_MARK_PATHS = `<path d="M50 12c4-8 14-9 18-4-2 6-9 9-14 8z" fill="#8FD3B6"/>
    <path d="M50 16c20 0 34 16 34 36 0 22-16 38-34 38S16 74 16 52c0-20 14-36 34-36z" fill="#FFC27A"/>
    <path d="M50 16c-9 0-17 4-23 11 7 4 15 5 23 5s16-1 23-5c-6-7-14-11-23-11z" fill="#FFD79B" opacity=".7"/>
    <circle cx="40" cy="58" r="3.4" fill="#7A4A33"/>
    <circle cx="60" cy="58" r="3.4" fill="#7A4A33"/>
    <circle cx="34" cy="66" r="4.5" fill="#FF9DAE" opacity=".7"/>
    <circle cx="66" cy="66" r="4.5" fill="#FF9DAE" opacity=".7"/>
    <path d="M45 67c3 3 7 3 10 0" stroke="#7A4A33" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;

/** The home-screen icon canvas. 512 is the largest size and the source of all. */
export const ICON_SIZE = 512;

/**
 * Background-only padding on each side, as a fraction of the icon. The maskable
 * icon keeps the peach inside the center safe zone: Android launchers crop the
 * icon to a circle or squircle, cutting roughly 10 percent per side, so the
 * mark must sit within the central 80 percent. The standard icon can be fuller
 * since iOS only rounds the corners, it does not crop to a circle.
 */
export const ICON_SAFE_PADDING = { standard: 0.09, maskable: 0.16 } as const;

interface IconOpts {
  /** Compose for the maskable safe zone (more padding), or the fuller standard. */
  maskable: boolean;
  /** The full-bleed background fill (the cute peach-cream). */
  background: string;
}

/**
 * A home-screen icon: the peach mark centered on a full-bleed background. The
 * background bleeds to every edge so a maskable crop only ever cuts background,
 * never the peach. The mark is the same shared peach as the tab and the card.
 */
export function pwaIconSvg(opts: IconOpts): string {
  const pad = opts.maskable
    ? ICON_SAFE_PADDING.maskable
    : ICON_SAFE_PADDING.standard;
  const box = ICON_SIZE * (1 - 2 * pad);
  const offset = (ICON_SIZE - box) / 2;
  const scale = box / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${opts.background}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    ${PEACH_MARK_PATHS}
  </g>
</svg>`;
}
