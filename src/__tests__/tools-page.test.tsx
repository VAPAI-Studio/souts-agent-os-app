/**
 * Phase 6 / Plan 06-02 — Task 1 RED scaffold for /agentos/tools page.
 *
 * NOTE: Project does NOT currently have vitest installed (only Playwright e2e
 * via @playwright/test + @axe-core/playwright). This file is written in vitest
 * style per the plan contract; the equivalent live-browser assertions are run
 * via e2e/tools-registry.spec.ts (Playwright admin walkthrough). When vitest
 * is added in a future polish plan, this file will RED→GREEN automatically.
 *
 * Asserted behavior (mirrors UI-SPEC §Surface 1):
 *   - testid 'tools-page' exists
 *   - testid 'integration-card-slack' renders with 'integration-status-slack' badge
 *   - testid 'integration-card-google_calendar' renders
 *   - testid 'integration-card-gmail' renders disabled (placeholder)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToolsPage from '@/app/agentos/tools/page';

// Mock the supabase data fetch — the Server Component awaits requireAdmin + a
// supabase tool_connections SELECT. Plan 06-02 page returns a Set of integration
// keys that are 'connected'. This mock seeds 'slack' as connected for the test.
vi.mock('@/lib/supabase/agentos', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ sub: 'u1', app_role: 'admin' }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn().mockReturnValue({
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            then: (resolve: any) =>
              resolve({ data: [{ integration: 'slack', status: 'connected' }] }),
          }),
        }),
      }),
    }),
  }),
}));

describe('tools-page', () => {
  it('renders integration cards with status badges', async () => {
    const ui = await ToolsPage();
    render(ui);
    expect(screen.getByTestId('tools-page')).toBeInTheDocument();
    expect(screen.getByTestId('integration-card-slack')).toBeInTheDocument();
    expect(screen.getByTestId('integration-status-slack')).toBeInTheDocument();
    expect(screen.getByTestId('integration-card-google_calendar')).toBeInTheDocument();
    expect(screen.getByTestId('integration-card-gmail')).toBeInTheDocument();
  });
});
