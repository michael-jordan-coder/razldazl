import { defineConfig } from 'vite';
import tailwind from '@tailwindcss/vite';

// We deliberately do NOT use @vitejs/plugin-react here: its Fast Refresh
// preamble is prepended to the module *before* Babel parses it, which shifts
// every JSX __source lineNumber by ~19 lines — breaking DOM→file mapping.
// esbuild's built-in JSX dev transform preserves original lines 1:1.
//
// Trade-off: no React Fast Refresh. Edits trigger a full reload. Fine for
// the first slice; a source-map-based remapping layer is the follow-up.
export default defineConfig({
  plugins: [tailwind()],
  esbuild: {
    jsx: 'automatic',
    jsxDev: true,
    jsxImportSource: '@product/jsx-runtime',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
