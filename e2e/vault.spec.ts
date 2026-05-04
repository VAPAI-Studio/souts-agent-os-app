import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

test.describe('Vault browser', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'PLAYWRIGHT_ADMIN_* env not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', ADMIN_EMAIL!);
    await page.fill('input[type=password]', ADMIN_PASSWORD!);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/agentos/);
  });

  test('vault page renders with scope tabs', async ({ page }) => {
    await page.goto('/agentos/vault');
    await expect(page.getByTestId('vault-page')).toBeVisible();
    await expect(page.getByTestId('scope-tab-company')).toBeVisible();
    await expect(page.getByTestId('scope-tab-project')).toBeVisible();
    await expect(page.getByTestId('scope-tab-agent')).toBeVisible();
  });

  test('signed-out user is redirected from /agentos/vault to /login', async ({
    browser,
  }) => {
    const fresh = await browser.newContext();
    const page = await fresh.newPage();
    await page.goto('/agentos/vault');
    await expect(page).toHaveURL(/\/login/);
    await fresh.close();
  });

  test('new vault file form renders', async ({ page }) => {
    await page.goto('/agentos/vault/new');
    await expect(page.getByTestId('new-vault-page')).toBeVisible();
    await expect(page.getByTestId('path-input')).toBeVisible();
    await expect(page.getByTestId('content-textarea')).toBeVisible();
    await expect(page.getByTestId('submit-btn')).toBeVisible();
  });
});
