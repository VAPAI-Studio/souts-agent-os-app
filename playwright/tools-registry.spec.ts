/**
 * Phase 6 / Plan 06-02 — Playwright admin walkthrough for /agentos/tools.
 *
 * Mirrors the vault.spec.ts env-gating pattern. Skips cleanly without
 * PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD provisioned.
 *
 * Surface 1 contract (UI-SPEC §Surface 1 lines 132-182):
 *   - Admin can navigate to /agentos/tools
 *   - integration-card-slack visible with integration-status-slack badge
 *   - When Slack is connected (DB seed), badge reads "Connected"; else "Not connected"
 *   - 'Tools' button opens drill-in panel with tools-table-slack visible (when connected)
 *
 * NOTE: Project's playwright.config.ts may scan e2e/ rather than playwright/. A
 * mirrored copy at e2e/tools-registry.spec.ts ensures CI catches it. Plan 06-02
 * acceptance specifies this path; both locations co-exist intentionally.
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

test.describe('Tools registry', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'PLAYWRIGHT_ADMIN_* env not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', ADMIN_EMAIL!);
    await page.fill('input[type=password]', ADMIN_PASSWORD!);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/agentos/);
  });

  test('admin can navigate to /agentos/tools', async ({ page }) => {
    await page.goto('/agentos/tools');
    await expect(page.getByTestId('tools-page')).toBeVisible();
    await expect(page.getByTestId('integration-card-slack')).toBeVisible();
    await expect(page.getByTestId('integration-status-slack')).toBeVisible();
    await expect(page.getByTestId('integration-card-google_calendar')).toBeVisible();
  });

  test('Tools button opens drill-in panel for connected integration', async ({
    page,
  }) => {
    await page.goto('/agentos/tools');
    // Only attempt drill-in when Slack shows Connected badge — DB-seed dependent.
    const status = page.getByTestId('integration-status-slack');
    const text = (await status.textContent()) ?? '';
    if (!text.toLowerCase().includes('connected')) test.skip();
    await page.getByTestId('integration-card-slack').getByRole('button', { name: /tools/i }).click();
    await expect(page.getByTestId('tools-drill-in-slack')).toBeVisible();
    await expect(page.getByTestId('tools-table-slack')).toBeVisible();
  });
});
