import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * Phase 03.1 / Plan 03.1-05 — Accessibility baseline smoke test.
 *
 * Runs axe-core against the agents list page (the most data-dense retrofitted
 * surface) on an authenticated admin session. UI-SPEC pinned this single
 * automated a11y gate; full audit is out of scope for 03.1.
 *
 * Why /agentos/agents (list) instead of /agentos/agents/[id] (detail):
 *   The agent detail page requires a known seeded agent UUID, which is not
 *   guaranteed across local / CI environments. The list page exercises the
 *   full retrofit (PageHeader, Table, Badge, Button, Link) on a route with
 *   no parameter, so the spec runs in any environment with an admin login.
 *
 * Env vars (matches Plan 01-03 / agentos_auth_guard.spec.ts pattern):
 *   PLAYWRIGHT_ADMIN_EMAIL
 *   PLAYWRIGHT_ADMIN_PASSWORD
 *
 * Spec skips cleanly when these are absent (existing carry-over from
 * Plan 01-03; not a regression).
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('Phase 03.1 a11y baseline', () => {
  test('agents list page has zero axe violations', async ({ browser }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
    test.skip(
      !email || !password,
      'Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run a11y spec',
    );

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email!, password!);
    await page.goto('/agentos/agents');
    // Wait for the page's primary table to render before scanning.
    await expect(page.getByTestId('agents-table')).toBeVisible();

    const results = await new AxeBuilder({ page })
      // WCAG 2.1 AA is the project's accessibility floor (UI-SPEC.md Accessibility Baseline)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // If there are violations, dump them so the failing CI log is actionable.
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        'axe violations:',
        JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);

    await ctx.close();
  });
});
