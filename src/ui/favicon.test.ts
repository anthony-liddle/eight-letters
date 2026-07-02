import { afterEach, describe, expect, test } from 'vitest';
import { applyFavicon, faviconHref } from './favicon.ts';

afterEach(() => {
  document.head
    .querySelectorAll('link[rel="icon"]')
    .forEach((el) => el.remove());
});

describe('faviconHref', () => {
  test('is the peach mark on cute', () => {
    expect(faviconHref('cute')).toBe('/favicon-cute.svg');
  });

  test('is the source-word crown on classic', () => {
    expect(faviconHref('letterpress')).toBe('/favicon-classic.svg');
  });
});

describe('applyFavicon', () => {
  test('points the tab icon at the theme mark', () => {
    applyFavicon('letterpress');
    const link = document.head.querySelector('link[rel="icon"]');
    expect(link?.getAttribute('href')).toBe('/favicon-classic.svg');
  });

  test('replaces the link node rather than mutating it, so the tab repaints', () => {
    const stale = document.createElement('link');
    stale.rel = 'icon';
    stale.id = 'favicon';
    stale.href = '/favicon-cute.svg';
    document.head.appendChild(stale);

    applyFavicon('letterpress');

    const links = document.head.querySelectorAll('link[rel="icon"]');
    // Exactly one icon link, and it is a fresh node, not the mutated original.
    expect(links).toHaveLength(1);
    expect(links[0]).not.toBe(stale);
    expect(links[0]!.getAttribute('href')).toBe('/favicon-classic.svg');
  });

  test('swaps back to the peach on a return to cute', () => {
    applyFavicon('letterpress');
    applyFavicon('cute');
    const links = document.head.querySelectorAll('link[rel="icon"]');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe('/favicon-cute.svg');
  });
});
