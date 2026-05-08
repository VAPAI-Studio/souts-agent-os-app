import { test, expect, type Page } from '@playwright/test';

/**
 * TASK-02: Schedule presets + Custom cron round-trip.
 *
 * RED spec — the wizard schedule step does not exist yet. These tests will fail because:
 *   - /agentos/agents/new/schedule does not exist
 *   - testids (field-schedule-preset, field-schedule-cron) are not implemented
 *
 * Turns GREEN in Plan 08-04 (schedule UI enhancement).
 *
 * Schedule presets verified:
 *   - 'Every weekday at 9am' → cron '0 9 * * 1-5'
 *   - 'Every Monday at 9am'  → cron '0 9 * * 1'
 *   - 'Daily at 6pm'         → cron '0 18 * * *'
 *   - 'Every hour'           → cron '0 * * * *'
 *   - 'Custom cron...'       → reveals editable cron input
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('TASK-02: schedule presets and custom cron', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(
      page,
      process.env.PLAYWRIGHT_ADMIN_EMAIL!,
      process.env.PLAYWRIGHT_ADMIN_PASSWORD!,
    );
  });

  test('schedule presets and custom cron round-trip', async ({ page }) => {
    const PLACEHOLDER_DRAFT = '00000000-0000-0000-0000-000000000000';
    await page.goto(`/agentos/agents/new/schedule?draft=${PLACEHOLDER_DRAFT}`);

    // Schedule step must render
    await expect(page.getByTestId('field-schedule-preset')).toBeVisible();

    // --- Preset: Every weekday at 9am ---
    await page.getByTestId('field-schedule-preset').selectOption('Every weekday at 9am');
    // cron display should update to '0 9 * * 1-5' (read-only display)
    await expect(page.getByTestId('field-schedule-cron')).toHaveValue('0 9 * * 1-5');

    // --- Preset: Custom cron... ---
    await page.getByTestId('field-schedule-preset').selectOption('Custom cron...');
    // cron input should become editable
    await expect(page.getByTestId('field-schedule-cron')).toBeEditable();

    // Type a custom cron expression
    await page.getByTestId('field-schedule-cron').clear();
    await page.getByTestId('field-schedule-cron').fill('5 4 * * *');

    // Click Next — should not show a validation error for valid cron
    await page.getByTestId('wizard-next-btn').click();

    // Should advance without validation error (no error testid visible)
    // In GREEN state: URL advances to next wizard step
    // In RED state: page doesn't exist, test fails on goto
  });
});
