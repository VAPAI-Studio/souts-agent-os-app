import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 4 / Plan 04-06 — Projects UI smoke tests.
 *
 * Mirrors Plan 01-03 / Plan 04-05 env-gating: skips cleanly without
 * PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD; exercises the live
 * login + projects list + new-project form when both are set.
 */

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('#email', ADMIN_EMAIL!);
  await page.fill('#password', ADMIN_PASSWORD!);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/agentos/);
}

test.describe('Projects', () => {
  test('projects list page renders', async ({ browser }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'PLAYWRIGHT_ADMIN_* env not set',
    );
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAsAdmin(page);
    await page.goto('/agentos/projects');
    await expect(page.getByTestId('projects-page')).toBeVisible();
    await expect(page.getByTestId('new-project-link')).toBeVisible();
    await ctx.close();
  });

  test('signed-out redirect from /agentos/projects', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/agentos/projects');
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test('new project form renders', async ({ browser }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'PLAYWRIGHT_ADMIN_* env not set',
    );
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAsAdmin(page);
    await page.goto('/agentos/projects/new');
    await expect(page.getByTestId('new-project-page')).toBeVisible();
    await expect(page.getByTestId('name-input')).toBeVisible();
    await expect(page.getByTestId('submit-btn')).toBeVisible();
    await ctx.close();
  });
});
