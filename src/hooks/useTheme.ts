import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

// Keep in sync with the inline script in rsbuild.config.ts that applies the
// theme before first paint.
const STORAGE_KEY = 'theme';

const readTheme = (): Theme => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable (private mode etc.): the theme just won't persist.
    }
  }, [theme]);

  return [theme, setTheme] as const;
};
