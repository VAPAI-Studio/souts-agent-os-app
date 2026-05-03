import { test, expect, type Page } from '@playwright/test';

/**
 * AGENT-01 / AGENT-04: create flow.
 *
 * Required env vars: PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('AGENT-01/AGENT-04: create flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(
      page,
      process.env.PLAYWRIGHT_ADMIN_EMAIL!,
      process.env.PLAYWRIGHT_ADMIN_PASSWORD!,
    );
  });

  test('admin creates an agent and lands on detail page', async ({ page }) => {
    const uniqueName = `e2e-agent-${Date.now()}`;
    await page.goto('/agentos/agents/new');
    await expect(page.getByTestId('new-agent-form')).toBeVisible();

    await page.getByTestId('field-name').fill(uniqueName);
    await page.getByTestId('field-department').selectOption('COO');
    await page.getByTestId('field-system_prompt').fill('You are a test agent.');
    await page.getByTestId('field-autonomy_level').selectOption('semi_autonomous');
    await page.getByTestId('field-model_tier').selectOption('haiku');
    await page.getByTestId('field-max_turns').fill('5');
    await page.getByTestId('field-budget_cap_usd').fill('0.50');
    await page.getByTestId('submit-btn').click();

    // Land on detail page
    await page.waitForURL(/\/agentos\/agents\/[0-9a-f-]+$/);
    await expect(page.getByTestId('agent-name')).toHaveText(uniqueName);
  });

  test('create form rejects too-short name', async ({ page }) => {
    await page.goto('/agentos/agents/new');
    await page.getByTestId('field-name').fill('ab'); // too short — DB CHECK is 3-50
    await page.getByTestId('field-department').selectOption('COO');
    await page.getByTestId('field-system_prompt').fill('x');
    await page.getByTestId('field-max_turns').fill('5');
    await page.getByTestId('field-budget_cap_usd').fill('0.10');
    await page.getByTestId('submit-btn').click();

    // Either HTML5 validation blocks (browser-native — minLength=3) OR our
    // Server Action returns the error. Either way, we should still be on /new.
    await expect(page).toHaveURL(/\/agents\/new/);
  });
});
