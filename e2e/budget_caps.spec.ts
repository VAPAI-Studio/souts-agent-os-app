/**
 * Phase 9 / Plan 09-01 — Wave 0 RED Playwright scaffold for budget cap UI.
 *
 * Tests the COST-05 monthly budget cap field on:
 *   - Agent Edit page (EditAgentForm.tsx) — Plan 09-02
 *   - Agent Wizard Step 6 Autonomy (AutonomyStep.tsx) — Plan 09-02 (AGENT-03 parity)
 *
 * These assertions will FAIL until Plan 09-02 adds the monthly budget UI.
 *
 * Env vars:
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

test.describe('Phase 9 Budget Cap UI (RED until 09-02)', () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
      'Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run budget_caps spec',
    );
  });

  test('agent edit page has monthly-budget-section', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);

    // Navigate to agents list to find the first agent
    await page.goto('/agentos/agents');
    const firstAgentLink = page.getByTestId('agents-table').getByRole('link').first();

    // Check if there are any agents
    const agentCount = await firstAgentLink.count();
    if (agentCount === 0) {
      test.skip(true, 'No agents found — seed at least one agent to run this spec');
      return;
    }

    // Navigate to the first agent's edit page
    const href = await firstAgentLink.getAttribute('href');
    if (!href) {
      test.skip(true, 'No agent link found');
      return;
    }
    const editUrl = href.endsWith('/edit') ? href : `${href}/edit`;
    await page.goto(editUrl);

    await expect(page.getByTestId('monthly-budget-section')).toBeVisible();
    await ctx.close();
  });

  test('agent edit page has monthly-budget-input number field', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);

    await page.goto('/agentos/agents');
    const firstAgentLink = page.getByTestId('agents-table').getByRole('link').first();
    const agentCount = await firstAgentLink.count();
    if (agentCount === 0) {
      test.skip(true, 'No agents found');
      return;
    }

    const href = await firstAgentLink.getAttribute('href');
    if (!href) {
      test.skip(true, 'No agent link found');
      return;
    }
    const editUrl = href.endsWith('/edit') ? href : `${href}/edit`;
    await page.goto(editUrl);

    const budgetInput = page.getByTestId('monthly-budget-input');
    await expect(budgetInput).toBeVisible();
    await expect(budgetInput).toHaveAttribute('type', 'number');
    await ctx.close();
  });

  test('new agent wizard autonomy step has monthly-budget-input', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, password);

    // Navigate to the wizard and try the autonomy step URL directly
    // (Phase 8 wizard may or may not support direct URL navigation to step 6)
    await page.goto('/agentos/agents/new/autonomy');

    // If redirected away (wizard requires steps to be completed in order),
    // skip this sub-test rather than fail
    const isOnAutonomy = page.url().includes('/autonomy');
    if (!isOnAutonomy) {
      test.skip(true, 'Wizard requires sequential step completion — cannot navigate directly to autonomy step');
      return;
    }

    await expect(page.getByTestId('monthly-budget-input')).toBeVisible();
    await ctx.close();
  });
});
