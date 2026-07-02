import type { Theme } from './useTheme.ts';

/**
 * The tab icon follows the theme: the peach mark on cute (the same peach the OG
 * card and the share signature use), the source-word crown on classic. Keyed by
 * theme so the mapping is one thing. The pre-paint inline script in index.html
 * holds its own copy of this mapping (it runs before any module loads), and the
 * index.html default is asserted against DEFAULT_THEME so the two cannot drift.
 */
export const FAVICON_HREF: Record<Theme, string> = {
  cute: '/favicon-cute.svg',
  letterpress: '/favicon-classic.svg',
};

/** The tab-icon path for a theme. */
export function faviconHref(theme: Theme): string {
  return FAVICON_HREF[theme];
}

/**
 * Point the tab icon at the mark for the given theme. Removes any existing icon
 * link and appends a fresh node rather than mutating href: browsers do not
 * reliably repaint the tab when an existing rel="icon" href changes, but they do
 * when the link node is replaced. Called on every theme toggle so the tab
 * follows. The pre-paint script sets the initial icon before this ever runs.
 */
export function applyFavicon(theme: Theme): void {
  const head = document.head;
  if (!head) return;
  head.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove());
  const link = document.createElement('link');
  link.id = 'favicon';
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = faviconHref(theme);
  head.appendChild(link);
}
