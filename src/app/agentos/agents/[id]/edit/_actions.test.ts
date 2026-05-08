/**
 * Plan 08-04 / Phase 8 — Vitest unit tests for saveToolPermissions auto-derive logic.
 *
 * Closes Blocker 3: verifies that the Phase 8 extension to saveToolPermissions correctly
 * auto-derives required_mcp_servers from per-tool grants.
 *
 * 4 required test cases:
 *   (a) Granting a Slack tool permission with level != no_access adds 'slack'
 *   (b) When all Slack tool permissions become no_access, slack is removed
 *   (c) Mixed: granting Gmail + revoking Slack → gmail in, slack out
 *   (d) slack_bot manual addition is preserved across auto-derive
 *
 * Note: saveToolPermissions also calls requireAdminOrOwner which fetches agent.owner_id
 * first, then checks auth. We mock the full chain so the auto-derive SELECT / UPDATE
 * calls are the observable side-effects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks MUST be hoisted before imports of the SUT.
vi.mock('@/lib/supabase/agentos', () => ({
  requireAdminOrOwner: vi.fn(async () => ({
    sub: 'test-user-id',
    app_role: 'admin',
  })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock next/cache so revalidatePath doesn't throw in test environment.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Also mock createServiceClient (used by _serviceClient helper inside _actions.ts).
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    schema: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) }),
  })),
}));

import { createClient } from '@/lib/supabase/server';
import { saveToolPermissions } from './_actions';

/**
 * Build a chainable Supabase mock.
 *
 * @param agentRow        - What the initial agents SELECT returns (id + owner_id)
 * @param permsAfterUpsert - What agent_tool_permissions SELECT returns after the upsert
 *                          (the auto-derive reads current perms from DB, not the input rows)
 * @param initialRequiredMcp - What agents.required_mcp_servers contains before the derive update
 */
function buildMockSb(
  agentRow: { id: string; owner_id: string },
  permsAfterUpsert: Array<{ tool_name: string; level: string }>,
  initialRequiredMcp: string[],
) {
  // Track all update() calls for assertions.
  const updateCalls: Array<Record<string, unknown>> = [];

  // We need to distinguish between multiple calls to from('agents') and from('agent_tool_permissions').
  // The sequence for saveToolPermissions is:
  //   1. from('agents').select('id, owner_id').eq().single()   → ownership check
  //   2. from('agent_tool_permissions').upsert(...)            → save perms
  //   3. from('audit_logs').insert(...)                        → audit
  //   4. from('agent_tool_permissions').select('tool_name, level').eq()  → auto-derive read
  //   5. from('agents').select('required_mcp_servers').eq().maybeSingle() → preserve slack_bot
  //   6. from('agents').update({ required_mcp_servers }).eq()  → auto-derive write

  let agentsSelectCallCount = 0;
  let permsSelectCallCount = 0;

  const sb = {
    schema: () => sb,
    from: (table: string) => {
      if (table === 'agents') {
        return {
          select: (cols: string) => {
            agentsSelectCallCount++;
            if (agentsSelectCallCount === 1) {
              // Call 1: ownership check — select('id, owner_id')
              return {
                eq: () => ({
                  single: () => Promise.resolve({ data: agentRow, error: null }),
                }),
              };
            }
            // Call 2: auto-derive — select('required_mcp_servers')
            return {
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { required_mcp_servers: initialRequiredMcp },
                    error: null,
                  }),
              }),
            };
          },
          update: (patch: Record<string, unknown>) => {
            updateCalls.push(patch);
            return {
              eq: () => Promise.resolve({ error: null }),
            };
          },
        };
      }

      if (table === 'agent_tool_permissions') {
        return {
          upsert: () => Promise.resolve({ error: null }),
          select: () => {
            permsSelectCallCount++;
            // Always return the post-upsert perms for the auto-derive read.
            return {
              eq: () =>
                Promise.resolve({
                  data: permsAfterUpsert,
                  error: null,
                }),
            };
          },
        };
      }

      // audit_logs and anything else — no-op
      return {
        insert: () => Promise.resolve({ error: null }),
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        upsert: () => Promise.resolve({ error: null }),
        update: (patch: Record<string, unknown>) => {
          updateCalls.push(patch);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
  };

  return { sb: sb as unknown as ReturnType<typeof createClient>, updateCalls };
}

describe('saveToolPermissions auto-derives required_mcp_servers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) granting a Slack tool permission with level != no_access adds slack to required_mcp_servers', async () => {
    const { sb, updateCalls } = buildMockSb(
      { id: 'agent-id-1', owner_id: 'test-user-id' },
      [{ tool_name: 'mcp__slack__slack_send_message', level: 'execute_with_approval' }],
      [],
    );
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(sb);

    const result = await saveToolPermissions('agent-id-1', []);

    expect(result.ok).toBe(true);
    // The auto-derive update should include 'slack'
    const reqMcpUpdate = updateCalls.find((u) => 'required_mcp_servers' in u);
    expect(reqMcpUpdate).toBeDefined();
    expect((reqMcpUpdate!.required_mcp_servers as string[])).toContain('slack');
  });

  it('(b) when all Slack tool permissions become no_access, slack is removed from required_mcp_servers', async () => {
    const { sb, updateCalls } = buildMockSb(
      { id: 'agent-id-1', owner_id: 'test-user-id' },
      [{ tool_name: 'mcp__slack__slack_send_message', level: 'no_access' }],
      ['slack'],
    );
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(sb);

    const result = await saveToolPermissions('agent-id-1', []);

    expect(result.ok).toBe(true);
    const reqMcpUpdate = updateCalls.find((u) => 'required_mcp_servers' in u);
    expect(reqMcpUpdate).toBeDefined();
    expect((reqMcpUpdate!.required_mcp_servers as string[])).not.toContain('slack');
  });

  it('(c) granting Gmail + revoking Slack: gmail in, slack out', async () => {
    const { sb, updateCalls } = buildMockSb(
      { id: 'agent-id-1', owner_id: 'test-user-id' },
      [
        { tool_name: 'mcp__gmail__gmail_send_message', level: 'execute_with_approval' },
        { tool_name: 'mcp__slack__slack_send_message', level: 'no_access' },
      ],
      ['slack'],
    );
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(sb);

    const result = await saveToolPermissions('agent-id-1', []);

    expect(result.ok).toBe(true);
    const reqMcpUpdate = updateCalls.find((u) => 'required_mcp_servers' in u);
    expect(reqMcpUpdate).toBeDefined();
    const derived = reqMcpUpdate!.required_mcp_servers as string[];
    expect(derived).toContain('gmail');
    expect(derived).not.toContain('slack');
  });

  it('(d) slack_bot manual addition is preserved across auto-derive', async () => {
    const { sb, updateCalls } = buildMockSb(
      { id: 'agent-id-1', owner_id: 'test-user-id' },
      [{ tool_name: 'mcp__slack__slack_send_message', level: 'execute_with_approval' }],
      ['slack_bot'], // pre-existing manual addition
    );
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(sb);

    const result = await saveToolPermissions('agent-id-1', []);

    expect(result.ok).toBe(true);
    const reqMcpUpdate = updateCalls.find((u) => 'required_mcp_servers' in u);
    expect(reqMcpUpdate).toBeDefined();
    const derived = reqMcpUpdate!.required_mcp_servers as string[];
    expect(derived).toContain('slack_bot');
    expect(derived).toContain('slack');
  });
});
