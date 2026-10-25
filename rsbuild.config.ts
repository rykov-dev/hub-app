import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact()],
  // GitHub Pages serves the app from /<repo>/; set by the deploy workflow.
  server: { base: process.env.BASE_PATH ?? '/' },
});
