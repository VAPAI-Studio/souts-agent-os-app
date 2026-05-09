/**
 * Phase 9 / Plan 09-01 — Wave 0 RED Playwright scaffold for /agentos/dashboard.
 *
 * Tests the HOME-01..03 stat cards + activity feed additions to the existing
 * COO briefing dashboard. The COO card from Phase 6 Plan 06-05 is preserved;
 * these assertions verify the NEW elements added by Plan 09-03.
 *
 * These assertions will FAIL until Plan 09-03 extends the dashboard UI.
 *
 * Env vars:
 *   PLAYWRIGHT_ADMIN_EMAIL
 *   PLAYWRIGHT_ADMIN_PASSWORD
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

test.describe('Phase 9 Home Dashboard (RED until 09-03)', () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
      'Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run home_dashboard spec',
    );
  });

  test('dashboard page renders and preserves existing CooCard', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/dashboard');

    // Existing CooCard from Phase 6 Plan 06-05 must remain intact
    await expect(page.getByTestId('coo-card')).toBeVisible();
    await ctx.close();
  });

  test('dashboard has 4 new stat cards below COO card', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/dashboard');

    // New stat cards: approvals, active-agents, cost-today, next-scheduled
    await expect(page.getByTestId('stat-approvals')).toBeVisible();
    await expect(page.getByTestId('stat-active-agents')).toBeVisible();
    await expect(page.getByTestId('stat-cost-today')).toBeVisible();
    await expect(page.getByTestId('stat-next-scheduled')).toBeVisible();
    await ctx.close();
  });

  test('dashboard stat cards are all clickable links', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/dashboard');

    // Each stat card should be wrapped in an anchor (or have role=link)
    // At minimum there must be 4 links among the stat cards area
    const statCards = ['stat-approvals', 'stat-active-agents', 'stat-cost-today', 'stat-next-scheduled'];
    for (const testId of statCards) {
      const card = page.getByTestId(testId);
      await expect(card).toBeVisible();
      // The card itself or its ancestor should be a link
      const linkCount = await card.locator('a').or(page.locator(`[data-testid="${testId}"] a`)).count();
      const isLink = await card.evaluate((el) => {
        let node: Element | null = el;
        while (node) {
          if (node.tagName === 'A') return true;
          node = node.parentElement;
        }
        return false;
      });
      expect(isLink, `${testId} should be wrapped in an anchor tag`).toBe(true);
    }
    await ctx.close();
  });

  test('dashboard has activity feed below stat cards', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/dashboard');

    await expect(page.getByTestId('activity-feed')).toBeVisible();
    await expect(page.getByTestId('activity-feed')).toHaveAttribute('role', 'list');
    await ctx.close();
  });
});
