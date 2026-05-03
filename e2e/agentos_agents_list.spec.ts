import { test, expect, type Page } from '@playwright/test';

/**
 * AGENT-01 / AGENT-10: list page shows agents.
 *
 * Auth pattern: same loginAs helper used by agentos_team_grant_revoke.spec.ts
 * (#email + #password fields, login-submit testid).
 *
 * Required env vars (per Plan 01-03 follow-up):
 *   PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD
 *   PLAYWRIGHT_VIEWER_EMAIL / PLAYWRIGHT_VIEWER_PASSWORD (optional; viewer test skips if absent)
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('AGENT-01: agents list page', () => {
  test('admin sees agents list page with table and "New agent" link', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(
      page,
      process.env.PLAYWRIGHT_ADMIN_EMAIL!,
      process.env.PLAYWRIGHT_ADMIN_PASSWORD!,
    );
    await page.goto('/agentos/agents');
    await expect(page.getByTestId('agents-table')).toBeVisible();
    await expect(page.getByTestId('new-agent-link')).toBeVisible();
    await ctx.close();
  });

  test('viewer hits no-access on /agentos/agents/new', async ({ browser }) => {
    test.skip(
      !process.env.PLAYWRIGHT_VIEWER_EMAIL,
      'no viewer credentials configured',
    );
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(
      page,
      process.env.PLAYWRIGHT_VIEWER_EMAIL!,
      process.env.PLAYWRIGHT_VIEWER_PASSWORD!,
    );
    await page.goto('/agentos/agents/new');
    await expect(page).toHaveURL(/no-access/);
    await ctx.close();
  });
});
