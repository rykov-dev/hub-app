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
    tags: [{ tag: 'script', children: themeScript, head: true, append: false }],
  },
});
