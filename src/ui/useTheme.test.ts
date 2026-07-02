import { afterEach, describe, expect, test } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_THEME, resolveTheme, useTheme } from './useTheme.ts';

/**
 * The theme the app lands on when no preference is saved. This is the value the
 * runtime resolver falls back to, and it must agree with the pre-paint default
 * baked into index.html (asserted in indexHtml.test.ts) so a fresh visitor gets
 * one theme from first paint through hydration, with no flash.
 */
describe('DEFAULT_THEME', () => {
  test('is cute', () => {
    expect(DEFAULT_THEME).toBe('cute');
  });
});

describe('resolveTheme', () => {
  test('a saved cute preference resolves to cute', () => {
    expect(resolveTheme('cute')).toBe('cute');
  });

  test('a saved letterpress preference still wins', () => {
    expect(resolveTheme('letterpress')).toBe('letterpress');
  });

  test('no preference resolves to the default, cute', () => {
    expect(resolveTheme(undefined)).toBe('cute');
    expect(resolveTheme(null)).toBe('cute');
  });

  test('an unknown value resolves to the default, never a broken theme', () => {
    expect(resolveTheme('')).toBe('cute');
    expect(resolveTheme('sepia')).toBe('cute');
  });
});

describe('useTheme favicon wiring', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('link[rel="icon"]')
      .forEach((el) => el.remove());
    document.documentElement.removeAttribute('data-theme');
  });

  test('toggling the theme makes the tab icon follow', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current[1]('letterpress'));
    expect(
      document.head.querySelector('link[rel="icon"]')?.getAttribute('href'),
    ).toBe('/favicon-classic.svg');

    act(() => result.current[1]('cute'));
    expect(
      document.head.querySelector('link[rel="icon"]')?.getAttribute('href'),
    ).toBe('/favicon-cute.svg');
  });
});
