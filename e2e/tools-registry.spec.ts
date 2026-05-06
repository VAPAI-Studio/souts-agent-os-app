/**
 * Phase 6 / Plan 06-02 — Playwright admin walkthrough for /agentos/tools.
 *
 * Mirrored copy of playwright/tools-registry.spec.ts to honor the project's
 * existing e2e/ scan path (playwright.config.ts default testDir). Plan 06-02
 * acceptance lists playwright/; both locations co-exist intentionally so either
 * CI scan path catches it.
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

test.describe('Tools registry (e2e/)', () => {
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
});
