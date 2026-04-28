import { test, expect, type Page } from '@playwright/test';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('agentos team grant/change/revoke flow', () => {
  test('admin grants role; target gains access; admin revokes; target loses access', async ({ browser }) => {
    const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL!;
    const adminPw = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;
    const targetEmail = process.env.PLAYWRIGHT_TARGET_EMAIL!;
    const targetPw = process.env.PLAYWRIGHT_TARGET_PASSWORD!;

    // ===== Step 1: Admin grants viewer role to target =====
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, adminEmail, adminPw);
    await adminPage.goto('/agentos/team');
    await expect(adminPage.getByTestId('team-table')).toBeVisible();

    await adminPage.getByTestId('open-add-member').click();
    await adminPage.getByTestId('search-email').fill(targetEmail);
    await adminPage.getByTestId('search-submit').click();

    // Find the search result for the target user and click "Grant viewer"
    const targetResult = adminPage.locator('[data-testid^="search-result-"]', { hasText: targetEmail });
    await expect(targetResult).toBeVisible({ timeout: 10_000 });
    const targetUserId = (await targetResult.getAttribute('data-testid'))!.replace('search-result-', '');
    await adminPage.getByTestId(`grant-${targetUserId}-viewer`).click();

    // Wait for team table to update
    await expect(adminPage.getByTestId(`team-row-${targetUserId}`)).toBeVisible({ timeout: 10_000 });

    // ===== Step 2: Target signs in fresh and can access /agentos =====
    const targetCtx = await browser.newContext();
    const targetPage = await targetCtx.newPage();
    await loginAs(targetPage, targetEmail, targetPw);
    await targetPage.goto('/agentos');
    await expect(targetPage.getByTestId('role-badge')).toContainText('viewer');

    // ===== Step 3: Admin revokes the role =====
    await adminPage.reload();
    await expect(adminPage.getByTestId(`team-row-${targetUserId}`)).toBeVisible();
    await adminPage.getByTestId(`revoke-${targetUserId}`).click();
    await expect(adminPage.getByTestId(`team-row-${targetUserId}`)).toHaveCount(0, { timeout: 10_000 });

    // ===== Step 4: Target signs in fresh again -> no-access =====
    const targetCtx2 = await browser.newContext();
    const targetPage2 = await targetCtx2.newPage();
    await loginAs(targetPage2, targetEmail, targetPw);
    await targetPage2.goto('/agentos');
    await expect(targetPage2.getByTestId('no-access')).toBeVisible();

    await adminCtx.close();
    await targetCtx.close();
    await targetCtx2.close();
  });

  test('admin cannot revoke their own role (no Revoke button on own row)', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, process.env.PLAYWRIGHT_ADMIN_EMAIL!, process.env.PLAYWRIGHT_ADMIN_PASSWORD!);
    await page.goto('/agentos/team');

    const ownRow = page.locator('[data-testid^="team-row-"]', { hasText: process.env.PLAYWRIGHT_ADMIN_EMAIL! });
    await expect(ownRow).toBeVisible();
    await expect(ownRow.getByText('(you)')).toBeVisible();
    await expect(ownRow.locator('button', { hasText: 'Revoke' })).toHaveCount(0);

    await ctx.close();
  });
});
