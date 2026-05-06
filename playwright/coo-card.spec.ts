/**
 * Phase 6 / Plan 06-05 — Playwright admin walkthrough for /agentos/dashboard.
 *
 * Mirrors the tools-registry.spec.ts env-gating pattern. Skips cleanly without
 * PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD provisioned.
 *
 * Surface 4 contract (UI-SPEC lines 328-360):
 *   - Admin can navigate to /agentos/dashboard
 *   - coo-card testid is visible
 *   - PageHeader title "Dashboard" is rendered
 *
 * NOTE: Mirrored copy lives at e2e/coo-card.spec.ts to match the project's
 * existing testDir convention (playwright.config.ts defaults to e2e/). Plan
 * 06-05 acceptance lists playwright/; both locations co-exist intentionally.
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

test.describe('COO dashboard card', () => {
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
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('nav-dashboard link is visible in sidebar', async ({ page }) => {
    await page.goto('/agentos');
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
  });
});
