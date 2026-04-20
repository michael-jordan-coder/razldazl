import { defineConfig } from '@playwright/test';

// Start all three processes before tests run. Tests assume they can reach
// the editor at http://localhost:5174 and it will embed the demo-app iframe
// from http://localhost:5173.
export default defineConfig({
  testDir: './src',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5174',
  },
  webServer: [
    {
      command: 'pnpm --filter @product/demo-app dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @product/editor-ui dev',
      port: 5174,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
