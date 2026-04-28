import { test, expect, type Page } from '@playwright/test';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('agentos auth guard', () => {
  test('signed-out user hitting /agentos is redirected to /login with redirect param', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/agentos');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fagentos/);
  });

  test('signed-out user hitting /agentos/team is redirected to /login with redirect=/agentos/team', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/agentos/team');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fagentos%2Fteam/);
  });

  test('signed-in user with no agentos role sees /agentos/no-access', async ({ page, context }) => {
    await context.clearCookies();
    const email = process.env.PLAYWRIGHT_NO_ROLE_EMAIL;
    const password = process.env.PLAYWRIGHT_NO_ROLE_PASSWORD;
    test.skip(!email || !password, 'Set PLAYWRIGHT_NO_ROLE_EMAIL/PASSWORD to run');

    await loginAs(page, email!, password!);
    // Login redirects to /agentos -> middleware rewrites to /agentos/no-access
    await page.goto('/agentos');
    await expect(page.getByTestId('no-access')).toBeVisible();
  });

  test('admin sees Team nav link; viewer does not', async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const viewerCtx = await browser.newContext();

    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, process.env.PLAYWRIGHT_ADMIN_EMAIL!, process.env.PLAYWRIGHT_ADMIN_PASSWORD!);
    await adminPage.goto('/agentos');
    await expect(adminPage.getByTestId('nav-team')).toBeVisible();
    await expect(adminPage.getByTestId('role-badge')).toContainText('admin');

    const viewerPage = await viewerCtx.newPage();
    await loginAs(viewerPage, process.env.PLAYWRIGHT_VIEWER_EMAIL!, process.env.PLAYWRIGHT_VIEWER_PASSWORD!);
    await viewerPage.goto('/agentos');
    await expect(viewerPage.getByTestId('nav-team')).toHaveCount(0);
    await expect(viewerPage.getByTestId('role-badge')).toContainText('viewer');

    await adminCtx.close();
    await viewerCtx.close();
  });

  test('session survives page refresh', async ({ page, context }) => {
    await context.clearCookies();
    await loginAs(page, process.env.PLAYWRIGHT_ADMIN_EMAIL!, process.env.PLAYWRIGHT_ADMIN_PASSWORD!);
    await page.goto('/agentos');
    await expect(page.getByTestId('role-badge')).toContainText('admin');

    await page.reload();
    await expect(page).toHaveURL(/\/agentos$/);
    await expect(page.getByTestId('role-badge')).toContainText('admin');
  });

  test('logout clears session and subsequent /agentos access redirects to /login', async ({ page, context }) => {
    await context.clearCookies();
    await loginAs(page, process.env.PLAYWRIGHT_ADMIN_EMAIL!, process.env.PLAYWRIGHT_ADMIN_PASSWORD!);
    await page.goto('/agentos');
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/agentos');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fagentos/);
  });
});
