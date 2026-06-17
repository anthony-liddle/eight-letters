import { useSyncExternalStore } from 'react';

export type Theme = 'letterpress' | 'cute';

const STORAGE_KEY = 'e8-theme';

/**
 * The document root is the single source of truth for the theme: an inline head
 * script sets it before paint (no flash). This is a tiny external store over it
 * so every consumer (toolbar, colophon, ...) stays in sync when it changes.
 */
const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'cute'
    ? 'cute'
    : 'letterpress';
}

function setTheme(next: Theme): void {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage blocked; the choice simply will not persist this session.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

const serverSnapshot = (): Theme => 'letterpress';

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, serverSnapshot);
  return [theme, setTheme];
}
