import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

// Applies a saved theme before first paint so a dark theme doesn't flash light.
// Keep the storage key in sync with src/hooks/useTheme.ts.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact()],
  // GitHub Pages serves the app from /<repo>/; set by the deploy workflow.
  server: { base: process.env.BASE_PATH ?? '/' },
  html: {
    title: 'Монетки',
    tags: [
      { tag: 'script', children: themeScript, head: true, append: false },
      { tag: 'link', attrs: { rel: 'manifest', href: 'manifest.webmanifest' } },
      { tag: 'link', attrs: { rel: 'icon', href: 'icon.svg', type: 'image/svg+xml' } },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: 'icons/apple-touch-icon.png' } },
    ],
    meta: {
      description: 'Заходи каждый день и собирай монетки.',
      // Matches --bg of each theme in src/App.css.
      'theme-color-light': {
        name: 'theme-color',
        content: '#f4f5f4',
        media: '(prefers-color-scheme: light)',
      },
      'theme-color-dark': {
        name: 'theme-color',
        content: '#0e1110',
        media: '(prefers-color-scheme: dark)',
      },
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': 'Монетки',
      'apple-mobile-web-app-status-bar-style': 'default',
    },
  },
});
