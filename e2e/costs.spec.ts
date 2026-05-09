/**
 * Phase 9 / Plan 09-01 — Wave 0 RED Playwright scaffold for /agentos/costs.
 *
 * These assertions will FAIL until Plan 09-02 builds the Cost Dashboard UI.
 * They exist to give Plan 09-02's executor a precise RED→GREEN target.
 *
 * Env vars (matches existing spec patterns):
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

test.describe('Phase 9 Costs Dashboard (RED until 09-02)', () => {
  test.beforeEach(({ page }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
    test.skip(
      !email || !password,
      'Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run costs spec',
    );
  });

  test('costs page renders with PageHeader "Costs"', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/costs');
    await expect(page.getByRole('heading', { name: 'Costs' })).toBeVisible();
    await ctx.close();
  });

  test('costs page has 3 tab buttons (overview, by-agent, by-project)', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/costs');

    await expect(page.getByTestId('tab-overview')).toBeVisible();
    await expect(page.getByTestId('tab-by-agent')).toBeVisible();
    await expect(page.getByTestId('tab-by-project')).toBeVisible();
    await ctx.close();
  });

  test('costs page has 4 time-period selector buttons', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/costs');

    await expect(page.getByTestId('period-today')).toBeVisible();
    await expect(page.getByTestId('period-week')).toBeVisible();
    await expect(page.getByTestId('period-month')).toBeVisible();
    await expect(page.getByTestId('period-custom')).toBeVisible();
    await ctx.close();
  });

  test('costs page has 3 stat cards (total-cost, active-agents, runs-count)', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/costs');

    await expect(page.getByTestId('stat-total-cost')).toBeVisible();
    await expect(page.getByTestId('stat-active-agents')).toBeVisible();
    await expect(page.getByTestId('stat-runs-count')).toBeVisible();
    await ctx.close();
  });

  test('costs page has Recharts containers for cost-by-agent and cost-by-model', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/costs');

    await expect(page.getByTestId('chart-cost-by-agent')).toBeVisible();
    await expect(page.getByTestId('chart-cost-by-model')).toBeVisible();
    await ctx.close();
  });

  test('costs page has a sortable costs table', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);
    await page.goto('/agentos/costs');

    await expect(page.getByTestId('costs-table')).toBeVisible();
    await expect(page.getByTestId('costs-table')).toHaveAttribute('role', 'table');
    await ctx.close();
  });
});
