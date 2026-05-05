import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEED_AGENT_ID = process.env.PLAYWRIGHT_SEED_AGENT_ID; // existing agent in Phase 3 fixtures
const SEED_RUN_ID = process.env.PLAYWRIGHT_SEED_RUN_ID;     // existing run in Phase 3 fixtures

test.describe('approvals inbox (signed-out)', () => {
  test('redirects to /login from /agentos/approvals', async ({ page }) => {
    await page.goto('/agentos/approvals');
    await expect(page).toHaveURL(/\/login|\/agentos\/no-access/);
  });
});

test.describe('approvals inbox (admin)', () => {
  // Skip cleanly when env vars missing — same Plan 04-05 pattern as vault.spec.ts
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD || !SUPABASE_URL || !SERVICE_ROLE_KEY || !SEED_AGENT_ID || !SEED_RUN_ID,
    'requires PLAYWRIGHT_ADMIN_EMAIL, PLAYWRIGHT_ADMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLAYWRIGHT_SEED_AGENT_ID, PLAYWRIGHT_SEED_RUN_ID',
  );

  let approvalId: string;

  test.beforeEach(async ({ page }) => {
    // Seed a pending approval row via service-role
    const sb = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    const { data: ins, error: insErr } = await sb
      .schema('agentos')
      .from('approval_requests')
      .insert({
        run_id: SEED_RUN_ID,
        agent_id: SEED_AGENT_ID,
        tool_name: 'mcp__slack__post_message',
        tool_input: { channel: '#test-approvals', text: 'Hello from Playwright' },
        context_summary: 'Playwright e2e seed row',
        status: 'pending',
      })
      .select('id')
      .single();
    if (insErr || !ins) throw new Error(`failed to seed approval row: ${insErr?.message}`);
    approvalId = ins.id as string;

    // Sign in as admin
    await page.goto('/login');
    await page.fill('input[type=email]', ADMIN_EMAIL!);
    await page.fill('input[type=password]', ADMIN_PASSWORD!);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/agentos/);
  });

  test.afterEach(async () => {
    if (approvalId) {
      const sb = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
      await sb.schema('agentos').from('approval_requests').delete().eq('id', approvalId);
    }
  });

  test('list view shows seeded pending approval row', async ({ page }) => {
    await page.goto('/agentos/approvals');
    await expect(page.locator(`[data-testid="approval-row-${approvalId}"]`)).toBeVisible();
    await expect(page.locator('[data-testid="tool-input-slack"]').first()).toBeVisible();
  });

  test('badge shows non-zero pending count', async ({ page }) => {
    await page.goto('/agentos/approvals');
    await expect(page.locator('[data-testid="pending-approvals-badge"]').first()).toBeVisible();
  });

  test('approve button removes row and navigates to inbox', async ({ page }) => {
    await page.goto(`/agentos/approvals/${approvalId}`);
    await expect(page.locator('[data-testid="decision-panel"]')).toBeVisible();
    await page.click('[data-testid="approve-btn"]');
    await page.waitForURL('**/agentos/approvals');
    await expect(page.locator(`[data-testid="approval-row-${approvalId}"]`)).toHaveCount(0);
  });

  test('reject button records rejection and returns to inbox', async ({ page }) => {
    await page.goto(`/agentos/approvals/${approvalId}`);
    await page.fill('[data-testid="reject-reason-input"]', 'not appropriate');
    await page.click('[data-testid="reject-btn"]');
    await page.waitForURL('**/agentos/approvals');
    await expect(page.locator(`[data-testid="approval-row-${approvalId}"]`)).toHaveCount(0);
  });

  test('edit-and-approve flow surfaces editor for slack tool', async ({ page }) => {
    await page.goto(`/agentos/approvals/${approvalId}`);
    await page.click('[data-testid="open-edit-btn"]');
    await expect(page.locator('[data-testid="tool-editor-slack"]')).toBeVisible();
    await page.fill('[data-testid="edit-slack-text"]', 'Edited message body');
    await page.click('[data-testid="edit-approve-btn"]');
    await page.waitForURL('**/agentos/approvals');
    await expect(page.locator(`[data-testid="approval-row-${approvalId}"]`)).toHaveCount(0);
  });
});
