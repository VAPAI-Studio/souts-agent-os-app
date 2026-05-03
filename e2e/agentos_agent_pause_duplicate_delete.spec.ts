import { test, expect, type Page } from '@playwright/test';

/**
 * AGENT-05/06/07: pause, duplicate, soft-delete flows.
 *
 * This test creates a fresh agent first (so it doesn't depend on seed data)
 * then exercises each action.
 *
 * Required env vars: PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('AGENT-05/06/07: pause + duplicate + soft-delete', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(
      page,
      process.env.PLAYWRIGHT_ADMIN_EMAIL!,
      process.env.PLAYWRIGHT_ADMIN_PASSWORD!,
    );
  });

  test('admin can pause + resume + duplicate + delete an agent', async ({
    page,
  }) => {
    // Create
    const baseName = `e2e-pdd-${Date.now()}`;
    await page.goto('/agentos/agents/new');
    await page.getByTestId('field-name').fill(baseName);
    await page.getByTestId('field-department').selectOption('Marketing');
    await page.getByTestId('field-system_prompt').fill('test');
    await page.getByTestId('field-max_turns').fill('5');
    await page.getByTestId('field-budget_cap_usd').fill('0.10');
    await page.getByTestId('submit-btn').click();
    await page.waitForURL(/\/agents\/[0-9a-f-]+$/);
    const agentUrl = page.url();

    // Pause
    await page.getByTestId('pause-btn').click();
    await expect(page.getByTestId('agent-status-badge')).toHaveText(
      'paused',
    );

    // Resume
    await page.getByTestId('resume-btn').click();
    await expect(page.getByTestId('agent-status-badge')).toHaveText(
      'active',
    );

    // Duplicate
    await page.getByTestId('duplicate-btn').click();
    // Land on the duplicate's detail page
    await page.waitForURL(/\/agents\/[0-9a-f-]+$/);
    await expect(page.getByTestId('agent-name')).toContainText('(copy)');

    // Go back to original and delete it
    await page.goto(agentUrl);
    // Accept the confirm() dialog
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('delete-btn').click();

    // Should land on the list and the original name should NOT appear
    await page.waitForURL(/\/agents$/);
    const tableText = await page.getByTestId('agents-table').textContent();
    expect(tableText).not.toContain(baseName);
    // But the duplicate (with "(copy)") should still be visible
    expect(tableText).toContain(`${baseName} (copy)`);
  });
});
