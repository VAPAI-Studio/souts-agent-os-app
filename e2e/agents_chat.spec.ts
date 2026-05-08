import { test, expect, type Page } from '@playwright/test';

/**
 * AGENT-12: Chat tab sends message and renders response.
 *
 * RED spec — the chat tab does not exist yet. These tests will fail because:
 *   - /agentos/agents/[id]?tab=chat (or /[id]/chat) does not render chat-tab testid
 *   - testids (chat-input, chat-send-btn, chat-message-0) are not implemented
 *
 * Turns GREEN in Plan 08-05 (chat interface).
 *
 * Uses a hardcoded placeholder agent UUID that is known not to exist in real DB.
 * The spec fails on the visibility check — still RED, still useful as scaffold.
 * In GREEN state (Plan 08-05), this UUID should be replaced with a real seeded
 * active agent ID from the environment (PLAYWRIGHT_CHAT_AGENT_ID).
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

test.describe('AGENT-12: per-agent chat', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(
      page,
      process.env.PLAYWRIGHT_ADMIN_EMAIL!,
      process.env.PLAYWRIGHT_ADMIN_PASSWORD!,
    );
  });

  test('chat tab sends message and renders response', async ({ page }) => {
    // Use env-provided agent ID if available, otherwise fall back to placeholder
    // (placeholder causes RED failure on visibility check — intended scaffold behavior)
    const agentId =
      process.env.PLAYWRIGHT_CHAT_AGENT_ID ||
      '00000000-0000-0000-0000-000000000001';

    // Navigate to agent detail page with chat tab active
    await page.goto(`/agentos/agents/${agentId}?tab=chat`);

    // Chat tab must be visible and active
    await expect(page.getByTestId('chat-tab')).toBeVisible();

    // Chat input must be visible (only for activated agents, not drafts)
    await expect(page.getByTestId('chat-input')).toBeVisible();

    // Send a message
    await page.getByTestId('chat-input').fill('What is 2+2?');
    await page.getByTestId('chat-send-btn').click();

    // Wait up to 30s for at least one chat message to render
    // The message testid pattern is chat-message-{n} (0-indexed)
    await expect(page.getByTestId('chat-message-0')).toBeVisible({ timeout: 30000 });

    // Verify the message has text content (non-empty response)
    const messageText = await page.getByTestId('chat-message-0').textContent();
    expect(messageText).toBeTruthy();
    expect(messageText!.trim().length).toBeGreaterThan(0);
  });
});
