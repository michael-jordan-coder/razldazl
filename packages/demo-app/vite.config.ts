import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@product/jsx-runtime',
    }),
    tailwind(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
