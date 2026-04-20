// Smoke E2E: the golden read-path.
//
// Verifies the whole click-to-source chain works end-to-end:
//   demo-app renders with @product/jsx-runtime → __propsToSource populated
//   preview-agent fiber walk finds the source on click
//   postMessage lands in editor-ui
//   editor-ui shows the source triple in the sidebar
//
// The write-path (chat → AI → AST edit → HMR → relock) requires an AI stub
// at the server. That's covered by @product/server's unit test; a full
// three-process E2E version is a follow-up.

import { test, expect } from '@playwright/test';

test('click in preview surfaces source triple in editor sidebar', async ({ page }) => {
  await page.goto('/');

  // Wait for the preview-agent to announce readiness. We detect this by
  // waiting for the sidebar status to flip to "preview ready".
  await expect(page.getByText(/preview ready/i)).toBeVisible({ timeout: 20_000 });

  // Click the first button inside the preview iframe.
  const preview = page.frameLocator('iframe[title="preview"]');
  await preview.getByRole('button', { name: /primary/i }).click();

  // Sidebar should now show a file + line + col.
  await expect(page.getByText(/line \d+, col \d+/i)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/App\.tsx/i)).toBeVisible();
});
