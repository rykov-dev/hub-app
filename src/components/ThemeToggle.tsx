import type { ReactNode } from 'react';
import { type Theme, useTheme } from '../hooks/useTheme';

const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

const svg = (children: ReactNode) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden
  >
    {children}
  </svg>
);

const labels: Record<Theme, { icon: ReactNode; title: string }> = {
  system: {
    title: 'Тема: как в системе',
    icon: svg(
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
      </>,
    ),
  },
  light: {
    title: 'Тема: светлая',
    icon: svg(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>,
    ),
  },
  dark: {
    title: 'Тема: тёмная',
    icon: svg(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />),
  },
};

/** Cycles system → light → dark. */
export const ThemeToggle = () => {
  const [theme, setTheme] = useTheme();
  const { icon, title } = labels[theme];

  return (
    <button
      type="button"
      className="theme-toggle"
      title={title}
      aria-label={title}
      onClick={() => setTheme(next[theme])}
    >
      {icon}
    </button>
  );
};
