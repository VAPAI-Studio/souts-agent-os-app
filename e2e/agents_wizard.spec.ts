import { test, expect, type Page } from '@playwright/test';

/**
 * AGENT-03: 8-step wizard happy path
 *
 * RED spec — the wizard UI does not exist yet. These tests will fail because:
 *   - /agentos/agents/new does not render template-gallery testid
 *   - wizard step routes (/new/basic-info, etc.) do not exist
 *   - testids (wizard-next-btn, activate-btn, etc.) are not yet implemented
 *
 * Turns GREEN in Plan 08-02 (wizard core) + Plan 08-03 (Step 8 test-run).
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('AGENT-03: 8-step wizard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(
      page,
      process.env.PLAYWRIGHT_ADMIN_EMAIL!,
      process.env.PLAYWRIGHT_ADMIN_PASSWORD!,
    );
  });

  test('admin completes 8-step wizard and lands on detail page', async ({ page }) => {
    const uniqueName = `e2e-wizard-agent-${Date.now()}`;

    // Step 0: Template gallery
    await page.goto('/agentos/agents/new');
    await expect(page.getByTestId('template-gallery')).toBeVisible();
    await page.getByTestId('template-card-blank').click();

    // Step 1: Basic Info
    await expect(page.getByTestId('wizard-stepper-1')).toBeVisible();
    await page.getByTestId('field-name').fill(uniqueName);
    await page.getByTestId('field-department').selectOption('coo');
    await page.getByTestId('wizard-next-btn').click();

    // Step 2: Role/Goals
    await expect(page.getByTestId('wizard-stepper-2')).toBeVisible();
    await page.getByTestId('wizard-next-btn').click();

    // Step 3: Instructions (system_prompt)
    await expect(page.getByTestId('wizard-stepper-3')).toBeVisible();
    await page.getByTestId('field-system_prompt').fill('You are a test agent created by the wizard e2e spec.');
    await page.getByTestId('wizard-next-btn').click();

    // Step 4: Context Sources
    await expect(page.getByTestId('wizard-stepper-4')).toBeVisible();
    await page.getByTestId('wizard-next-btn').click();

    // Step 5: Tools/Permissions
    await expect(page.getByTestId('wizard-stepper-5')).toBeVisible();
    await page.getByTestId('wizard-next-btn').click();

    // Step 6: Autonomy Level
    await expect(page.getByTestId('wizard-stepper-6')).toBeVisible();
    await page.getByTestId('field-autonomy_level').selectOption('semi_autonomous');
    await page.getByTestId('wizard-next-btn').click();

    // Step 7: Schedule
    await expect(page.getByTestId('wizard-stepper-7')).toBeVisible();
    await page.getByTestId('wizard-next-btn').click();

    // Step 8: Review/Test — lands on review page with ?draft= param
    await expect(page.getByTestId('wizard-stepper-8')).toBeVisible();
    await expect(page.url()).toMatch(/\/agentos\/agents\/new\/review\?draft=/);

    // Run a test before activating (required by gate)
    await page.getByTestId('field-sample-input').fill('What is 2+2?');
    await page.getByTestId('run-test-btn').click();
    // Wait for test run to complete (up to 30s)
    await expect(page.getByTestId('run-status-badge')).toHaveText('completed', { timeout: 30000 });

    // Activate
    await expect(page.getByTestId('activate-btn')).toBeEnabled();
    await page.getByTestId('activate-btn').click();

    // Land on detail page
    await page.waitForURL(/\/agentos\/agents\/[0-9a-f-]+$/, { timeout: 10000 });
  });
});
