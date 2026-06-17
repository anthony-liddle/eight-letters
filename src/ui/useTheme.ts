import { useCallback, useState } from 'react';

export type Theme = 'letterpress' | 'cute';

const STORAGE_KEY = 'e8-theme';

/** The theme the no-flash head script already applied to the document root. */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'cute'
    ? 'cute'
    : 'letterpress';
}

/**
 * The active theme and a setter that updates the document root and persists the
 * choice. The root attribute is the single source of truth: an inline head
 * script sets it before paint (no flash), and this keeps it in sync.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked; the choice simply will not persist this session.
    }
    setThemeState(next);
  }, []);

  return [theme, setTheme];
}
