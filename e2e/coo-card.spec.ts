/**
 * Phase 6 / Plan 06-05 — Playwright admin walkthrough for /agentos/dashboard.
 *
 * Mirrored copy of playwright/coo-card.spec.ts — placed here so the project's
 * existing playwright.config.ts (testDir: ./e2e) executes the spec in CI.
 * Plan 06-05 acceptance grep targets playwright/; both locations co-exist.
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

test.describe('COO dashboard card (e2e/)', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'PLAYWRIGHT_ADMIN_* env not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', ADMIN_EMAIL!);
    await page.fill('input[type=password]', ADMIN_PASSWORD!);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/agentos/);
  });

  test('admin can navigate to /agentos/dashboard and see the COO card', async ({
    page,
  }) => {
    await page.goto('/agentos/dashboard');
    await expect(page.getByTestId('coo-card')).toBeVisible();
  });
});
