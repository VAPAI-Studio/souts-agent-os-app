import { test, expect, type Page } from '@playwright/test';

/**
 * AGENT-11: Step 8 test-run gates Activate button until run completes.
 *
 * RED spec — the wizard review page does not exist yet. These tests will fail because:
 *   - /agentos/agents/new/review does not exist
 *   - testids (activate-btn, run-test-btn, run-output-pane, etc.) are not implemented
 *
 * Turns GREEN in Plan 08-03 (Step 8 test-run integration).
 *
 * Blocker 2 acceptance: Activate button must be DISABLED before test run completes,
 * and ENABLED after run-status-badge shows 'completed'.
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('AGENT-11: Step 8 test-run gate', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(
      page,
      process.env.PLAYWRIGHT_ADMIN_EMAIL!,
      process.env.PLAYWRIGHT_ADMIN_PASSWORD!,
    );
  });

  test('step 8 test-run gates Activate until run completes', async ({ page }) => {
    // Navigate to the review step with a placeholder draft UUID.
    // In RED state: the page does not exist, so visibility assertions will fail.
    // In GREEN state (Plan 08-03): a real draft_id would be obtained via API or
    // by navigating the wizard; here we accept the RED failure as the scaffold.
    const PLACEHOLDER_DRAFT = '00000000-0000-0000-0000-000000000000';
    await page.goto(`/agentos/agents/new/review?draft=${PLACEHOLDER_DRAFT}`);

    // Step 8 review page must be visible
    await expect(page.getByTestId('wizard-stepper-8')).toBeVisible();

    // --- Gate check (Blocker 2 closure) ---
    // BEFORE test run: Activate button must be DISABLED
    // (requires lastTestRunCompleted = false for this draft)
    await expect(page.getByTestId('activate-btn')).toBeDisabled();

    // The hint explaining the gate must also be visible before run
    await expect(page.getByTestId('activate-needs-test-hint')).toBeVisible();

    // Fill sample input and trigger test run
    await page.getByTestId('field-sample-input').fill('What is 2+2?');
    await page.getByTestId('run-test-btn').click();

    // Wait for output pane to populate (any text content within 30s)
    await expect(page.getByTestId('run-output-pane')).not.toBeEmpty({ timeout: 30000 });

    // Wait for run status badge to show 'completed'
    await expect(page.getByTestId('run-status-badge')).toHaveText('completed', { timeout: 30000 });

    // AFTER test run completes: Activate button must be ENABLED
    await expect(page.getByTestId('activate-btn')).toBeEnabled();

    // Hint must no longer be visible after test run passes
    await expect(page.getByTestId('activate-needs-test-hint')).not.toBeVisible();
  });
});
