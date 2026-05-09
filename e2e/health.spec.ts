/**
 * Phase 9 / Plan 09-01 — Wave 0 RED Playwright scaffold for /agentos/health.
 *
 * Tests the SYS-01 System Health page admin-only UI:
 *   - 8 service rows (modal, supabase, slack, slack_bot, gmail, drive, calendar, notion)
 *   - Refresh now button
 *   - Admin-only access control (viewer → /agentos/no-access redirect)
 *   - Global error banner when any service is 'down'
 *
 * These assertions will FAIL until Plan 09-05 builds the Health page UI.
 *
 * Env vars:
 *   PLAYWRIGHT_ADMIN_EMAIL
 *   PLAYWRIGHT_ADMIN_PASSWORD
 *   PLAYWRIGHT_VIEWER_EMAIL    (optional — for the viewer access control test)
 *   PLAYWRIGHT_VIEWER_PASSWORD (optional)
 *
 * All tests skip cleanly when env vars are unset.
 */
import { test, expect, type Page } from '@playwright/test';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    page.getByTestId('login-submit').click(),
  ]);
}

// data-testid values for the 8 health service rows:
// health-row-modal, health-row-supabase, health-row-slack, health-row-slack_bot,
// health-row-gmail, health-row-drive, health-row-calendar, health-row-notion
const HEALTH_SERVICES = [
  'modal', 'supabase', 'slack', 'slack_bot', 'gmail', 'drive', 'calendar', 'notion',
];

test.describe('Phase 9 System Health page (RED until 09-05)', () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
      'Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run health spec',
    );
  });

  test('health page renders PageHeader "System Health"', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/health');

    await expect(page.getByRole('heading', { name: 'System Health' })).toBeVisible();
    await ctx.close();
  });

  test('health page has 8 service rows', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/health');

    for (const service of HEALTH_SERVICES) {
      await expect(page.getByTestId(`health-row-${service}`)).toBeVisible();
    }
    await ctx.close();
  });

  test('health page has a Refresh Now button', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/health');

    await expect(page.getByTestId('health-refresh-button')).toBeVisible();
    await ctx.close();
  });

  test('non-admin (viewer) visiting /agentos/health is redirected to /agentos/no-access', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_VIEWER_EMAIL;
    const password = process.env.PLAYWRIGHT_VIEWER_PASSWORD;
    test.skip(
      !email || !password,
      'Set PLAYWRIGHT_VIEWER_EMAIL/PASSWORD to run viewer access control test',
    );

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email!, password!);
    await page.goto('/agentos/health');

    // Should redirect to no-access page
    await page.waitForURL((url) => url.pathname.includes('no-access'), { timeout: 5000 });
    expect(page.url()).toContain('no-access');
    await ctx.close();
  });

  test('global error banner is visible when at least one service is down', async ({ browser }) => {
    /**
     * This test can only verify the banner WHEN a service is actually down.
     * In a healthy environment, we skip rather than fail — the banner should
     * not show when everything is OK.
     *
     * To force-test: manually set a service to 'down' in system_health_state
     * via Supabase SQL editor, then run this spec.
     */
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/dashboard');  // any /agentos/* page should show the banner

    // Check if banner is present; if not, skip (environment is healthy)
    const banner = page.getByTestId('global-error-banner');
    const isBannerVisible = await banner.isVisible().catch(() => false);
    if (!isBannerVisible) {
      test.skip(true, 'No services currently down — global-error-banner not shown (expected in healthy environment)');
      return;
    }

    // If visible, verify it has the expected structure
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('link', { name: /health/i })).toBeVisible();
    await ctx.close();
  });
});
