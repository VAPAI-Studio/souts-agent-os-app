/**
 * Phase 9 / Plan 09-03 — Unit tests for home dashboard data fetchers (home.ts)
 * and the formatRelativeTime utility (format.ts).
 *
 * Mocks @/lib/supabase/server to avoid live DB dependency.
 * Covers:
 *   - Tests 1-4: formatRelativeTime helper (format.ts)
 *   - Tests 5-11: home.ts fetchers (fetchPendingApprovalsCount, fetchActiveAgentsCount,
 *     fetchTodaysCostUsd, fetchNextScheduledAgent, fetchActivityFeed)
 *
 * Test 10 is the regression lock for the silent enum-drift bug:
 *   it asserts the exact 8-string ACTIVITY_ACTIONS array used in .in('action', [...]).
 *   Any typo in the enum strings silently returns zero results — this test catches that.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── formatRelativeTime tests (Tests 1-4) ──────────────────────────────────────

describe('formatRelativeTime', () => {
  it('Test 1: returns "in 5m" for 5 minutes in the future', async () => {
    const { formatRelativeTime } = await import('../lib/utils/format');
    // Add 30s buffer so millisecond drift doesn't round down to 4m
    const future = new Date(Date.now() + 5 * 60 * 1000 + 30 * 1000).toISOString();
    expect(formatRelativeTime(future)).toBe('in 5m');
  });

  it('Test 2: returns "5m ago" for 5 minutes in the past', async () => {
    const { formatRelativeTime } = await import('../lib/utils/format');
    // Add 30s buffer so millisecond drift doesn't round up to 6m
    const past = new Date(Date.now() - 5 * 60 * 1000 - 30 * 1000).toISOString();
    expect(formatRelativeTime(past)).toBe('5m ago');
  });

  it('Test 3: returns "in 2d" for 2 days in the future', async () => {
    const { formatRelativeTime } = await import('../lib/utils/format');
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(future)).toBe('in 2d');
  });

  it('Test 4: returns "in 14h" for 14 hours in the future', async () => {
    const { formatRelativeTime } = await import('../lib/utils/format');
    const future = new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(future)).toBe('in 14h');
  });
});

// ── Supabase mock setup ────────────────────────────────────────────────────────

interface MockTableOptions {
  rows?: unknown[];
  count?: number;
  error?: boolean;
}

type TableDataMap = Record<string, MockTableOptions>;

let mockTableData: TableDataMap = {};

/**
 * Build a chainable Supabase-like query builder stub.
 * Captures `.in('action', [...])` calls for Test 10 assertion.
 */
function makeFluentBuilder(opts: MockTableOptions) {
  const { rows = [], count = null, error = false } = opts;
  const resolve = () =>
    Promise.resolve({ data: error ? null : rows, error: error ? { message: 'mock error' } : null, count });

  const self: Record<string, unknown> = {};
  // Capture .in() args for assertion in Test 10
  self._inArgs = null as unknown;
  self.select = vi.fn().mockReturnThis();
  self.eq = vi.fn().mockReturnThis();
  self.is = vi.fn().mockReturnThis();
  self.gte = vi.fn().mockReturnThis();
  self.lt = vi.fn().mockReturnThis();
  self.lte = vi.fn().mockReturnThis();
  self.in = vi.fn().mockImplementation((col: string, arr: unknown[]) => {
    (self as Record<string, unknown>)._inArgs = { col, arr };
    return self;
  });
  self.order = vi.fn().mockReturnThis();
  self.limit = vi.fn().mockReturnThis();
  // maybeSingle returns a single row (first element) or null, not an array
  self.maybeSingle = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: rows.length > 0 ? rows[0] : null, error: error ? { message: 'mock error' } : null })
  );
  self.then = vi.fn().mockImplementation(
    (cb: (val: { data: unknown; error: unknown; count: unknown }) => unknown) =>
      Promise.resolve(cb({ data: error ? null : rows, error: error ? { message: 'mock error' } : null, count }))
  );
  return self;
}

function makeSupabaseMock(tableData: TableDataMap) {
  const client: Record<string, unknown> = {};
  client.schema = vi.fn().mockImplementation(() => ({
    from: (table: string) => {
      const opts = tableData[table] ?? {};
      return makeFluentBuilder(opts);
    },
  }));
  return client;
}

vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn(async () => makeSupabaseMock(mockTableData)),
}));

// ── Test 5: fetchPendingApprovalsCount ─────────────────────────────────────────

describe('fetchPendingApprovalsCount', () => {
  beforeEach(() => {
    mockTableData = {
      approval_requests: { rows: [], count: 3 },
    };
    vi.clearAllMocks();
  });

  it('Test 5: returns count of approval_requests where status=pending', async () => {
    mockTableData = { approval_requests: { rows: [], count: 3 } };
    const { fetchPendingApprovalsCount } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchPendingApprovalsCount();
    expect(typeof result).toBe('number');
    expect(result).toBe(3);
  });

  it('Test 5b: returns 0 on error (safe default)', async () => {
    mockTableData = { approval_requests: { error: true } };
    const { fetchPendingApprovalsCount } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchPendingApprovalsCount();
    expect(result).toBe(0);
  });
});

// ── Test 6: fetchActiveAgentsCount ─────────────────────────────────────────────

describe('fetchActiveAgentsCount', () => {
  beforeEach(() => {
    mockTableData = {
      agents: { rows: [], count: 4 },
      agent_runs: { rows: [] },
    };
    vi.clearAllMocks();
  });

  it('Test 6: returns {active, errors} object with numeric fields', async () => {
    mockTableData = {
      agents: { rows: [], count: 4 },
      agent_runs: { rows: [
        { agent_id: 'a1' },
        { agent_id: 'a2' },
        { agent_id: 'a1' }, // duplicate — should count DISTINCT
      ] },
    };
    const { fetchActiveAgentsCount } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchActiveAgentsCount();
    expect(result).toHaveProperty('active');
    expect(result).toHaveProperty('errors');
    expect(typeof result.active).toBe('number');
    expect(typeof result.errors).toBe('number');
    expect(result.active).toBe(4);
    // 2 unique agents in error (a1, a2 — a1 deduplicated)
    expect(result.errors).toBe(2);
  });
});

// ── Test 7: fetchTodaysCostUsd ─────────────────────────────────────────────────

describe('fetchTodaysCostUsd', () => {
  beforeEach(() => {
    mockTableData = {
      agent_runs: { rows: [
        { cost_usd: 0.10 },
        { cost_usd: 0.05 },
        { cost_usd: 0.03 },
      ] },
    };
    vi.clearAllMocks();
  });

  it('Test 7: returns SUM cost_usd from agent_runs since UTC midnight', async () => {
    const { fetchTodaysCostUsd } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchTodaysCostUsd();
    expect(typeof result).toBe('number');
    expect(result).toBeCloseTo(0.18, 5);
  });

  it('Test 7b: returns 0 on error', async () => {
    mockTableData = { agent_runs: { error: true } };
    const { fetchTodaysCostUsd } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchTodaysCostUsd();
    expect(result).toBe(0);
  });
});

// ── Test 8: fetchNextScheduledAgent ───────────────────────────────────────────

describe('fetchNextScheduledAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 8: returns the agent with smallest next_run_at where schedule_enabled=true', async () => {
    mockTableData = {
      agents: { rows: [
        { id: 'a1', name: 'Morning Agent', next_run_at: '2026-05-10T09:00:00Z' },
      ] },
    };
    const { fetchNextScheduledAgent } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchNextScheduledAgent();
    expect(result).not.toBeNull();
    expect(result?.agent_id).toBe('a1');
    expect(result?.agent_name).toBe('Morning Agent');
    expect(result?.next_run_at).toBe('2026-05-10T09:00:00Z');
  });

  it('Test 8b: returns null when no scheduled agent', async () => {
    mockTableData = { agents: { rows: [] } };
    const { fetchNextScheduledAgent } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchNextScheduledAgent();
    expect(result).toBeNull();
  });
});

// ── Test 9: fetchActivityFeed returns rows ordered DESC ────────────────────────

describe('fetchActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 9: returns rows with derived category, agent_name, and returns [] on error', async () => {
    mockTableData = {
      audit_logs: { rows: [
        {
          id: 'log-1',
          action: 'agent_run_completed',
          target_table: 'agent_runs',
          target_id: 'run-1',
          metadata: { agent_id: 'a1', cost_usd: 0.034 },
          created_at: '2026-05-09T10:00:00Z',
        },
        {
          id: 'log-2',
          action: 'approval_approve',
          target_table: 'approval_requests',
          target_id: 'apr-1',
          metadata: { agent_id: 'a2', tool_name: 'slack_send_message' },
          created_at: '2026-05-09T09:00:00Z',
        },
      ] },
      agents: { rows: [
        { id: 'a1', name: 'Run Agent' },
        { id: 'a2', name: 'Approval Agent' },
      ] },
    };

    const { fetchActivityFeed } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchActivityFeed(20);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);

    const runRow = result.find((r) => r.id === 'log-1');
    expect(runRow).toBeDefined();
    expect(runRow?.category).toBe('run');
    expect(runRow?.cost_usd).toBeCloseTo(0.034, 5);

    const approvalRow = result.find((r) => r.id === 'log-2');
    expect(approvalRow).toBeDefined();
    expect(approvalRow?.category).toBe('approval');
    expect(approvalRow?.tool_name).toBe('slack_send_message');
  });

  it('Test 9b: returns empty array on error (safe default, never throws)', async () => {
    mockTableData = { audit_logs: { error: true }, agents: { rows: [] } };
    const { fetchActivityFeed } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchActivityFeed();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ── Test 10: ACTIVITY_ACTIONS enum-drift regression lock ─────────────────────
// CRITICAL: this test asserts the exact 8-string array used in the .in() filter.
// The wrong enum strings (approval_approved, agent_paused, etc.) silently return zero results.

describe('ACTIVITY_ACTIONS constant — enum-drift regression lock', () => {
  it('Test 10: ACTIVITY_ACTIONS equals the exact 8-string allowlist (no -d suffix, no wrong strings)', async () => {
    const { ACTIVITY_ACTIONS } = await import('../app/agentos/dashboard/_data/home');
    const expected = [
      'agent_run_completed',
      'agent_run_failed',
      'approval_approve',
      'approval_reject',
      'approval_edit',
      'agent_pause',
      'agent_resume',
      'agent_auto_paused_budget',
    ];
    // Exact match: same elements, same length (order may vary)
    expect(ACTIVITY_ACTIONS.length).toBe(8);
    for (const s of expected) {
      expect(ACTIVITY_ACTIONS).toContain(s);
    }
    // Ensure WRONG strings are NOT present
    const wrongStrings = [
      'approval_approved',
      'approval_rejected',
      'approval_edited',
      'agent_paused',
      'agent_resumed',
    ];
    for (const bad of wrongStrings) {
      expect(ACTIVITY_ACTIONS).not.toContain(bad);
    }
  });
});

// ── Test 11: fetchActivityFeed row enrichment ─────────────────────────────────

describe('fetchActivityFeed enrichment', () => {
  it('Test 11: enriches rows with category, agent_name from batch query, cost_usd from metadata', async () => {
    mockTableData = {
      audit_logs: { rows: [
        {
          id: 'log-run',
          action: 'agent_run_completed',
          target_table: 'agent_runs',
          target_id: 'run-99',
          metadata: { agent_id: 'agent-abc', cost_usd: 0.0512 },
          created_at: '2026-05-09T11:00:00Z',
        },
        {
          id: 'log-pause',
          action: 'agent_pause',
          target_table: 'agents',
          target_id: 'agent-def',
          metadata: {},
          created_at: '2026-05-09T10:30:00Z',
        },
      ] },
      agents: { rows: [
        { id: 'agent-abc', name: 'ABC Runner' },
        { id: 'agent-def', name: 'DEF Pauser' },
      ] },
    };

    const { fetchActivityFeed } = await import('../app/agentos/dashboard/_data/home');
    const result = await fetchActivityFeed();

    const runRow = result.find((r) => r.id === 'log-run');
    expect(runRow?.category).toBe('run');
    expect(runRow?.agent_id).toBe('agent-abc');
    expect(runRow?.agent_name).toBe('ABC Runner');
    expect(runRow?.cost_usd).toBeCloseTo(0.0512, 5);

    const agentRow = result.find((r) => r.id === 'log-pause');
    expect(agentRow?.category).toBe('agent');
    expect(agentRow?.agent_id).toBe('agent-def');
    expect(agentRow?.agent_name).toBe('DEF Pauser');
  });
});
