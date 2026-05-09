/**
 * Phase 9 / Plan 09-02 — Unit tests for cost fetchers (costs.ts).
 *
 * Mocks the Supabase client to avoid live DB dependency.
 * Asserts post-processing logic: top-5+Other collapse, project rollup,
 * cost_per_run math (including division-by-zero guard).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PeriodResolved } from '../app/agentos/costs/_data/period';

// ── Shared test period ─────────────────────────────────────────────────────
const period: PeriodResolved = {
  id: 'month',
  startUtc: '2026-05-01T00:00:00.000Z',
  endUtc: '2026-05-08T23:59:59.999Z',
  label: 'This month',
};

// ── Supabase mock factory ──────────────────────────────────────────────────

function makeSupabaseMock(tableData: Record<string, unknown[]>) {
  const builder = (data: unknown[], _error: null = null) => ({
    select: vi.fn().mockReturnThis(),
    schema: vi.fn().mockReturnThis(),
    from: vi.fn((table: string) => builder(tableData[table] ?? [])),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    // Resolve the builder: returns { data, error }
    then: vi.fn().mockImplementation((cb: (val: { data: unknown[]; error: null }) => void) => {
      return Promise.resolve(cb({ data, error: null }));
    }),
  });

  // The mock client — schema() returns the same client (fluent)
  const client: Record<string, unknown> = {};
  client.schema = vi.fn().mockImplementation((_schema: string) => ({
    from: (table: string) => {
      const rows = tableData[table] ?? [];
      return makeFluentBuilder(rows);
    },
  }));
  return client;
}

function makeFluentBuilder(rows: unknown[]) {
  const self: Record<string, unknown> = {};
  const respond = () => Promise.resolve({ data: rows, error: null });
  self.select = vi.fn().mockReturnThis();
  self.gte = vi.fn().mockReturnThis();
  self.lt = vi.fn().mockReturnThis();
  self.lte = vi.fn().mockReturnThis();
  self.in = vi.fn().mockReturnThis();
  self.eq = vi.fn().mockReturnThis();
  self.order = vi.fn().mockReturnThis();
  self.limit = vi.fn().mockReturnThis();
  self.maybeSingle = vi.fn().mockImplementation(respond);
  // Make it thenable (awaitable)
  self.then = vi.fn().mockImplementation((cb: (val: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve(cb({ data: rows, error: null }))
  );
  return self;
}

// ── Mock @/lib/supabase/server ─────────────────────────────────────────────

let mockTableData: Record<string, unknown[]> = {};

vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn(async () => makeSupabaseMock(mockTableData)),
}));

// ── Test 8: fetchCostsForPeriod aggregation ────────────────────────────────

describe('fetchCostsForPeriod', () => {
  beforeEach(() => {
    mockTableData = {
      agent_runs: [
        { id: 'r1', agent_id: 'a1', cost_usd: 0.05, model_used: 'claude-haiku-4-5' },
        { id: 'r2', agent_id: 'a2', cost_usd: 0.10, model_used: 'claude-sonnet-4-5' },
        { id: 'r3', agent_id: 'a1', cost_usd: 0.03, model_used: 'claude-haiku-4-5' },
      ],
      agents: [],
    };
    vi.clearAllMocks();
  });

  it('returns {total_cost, runs_count, active_agents} from stubbed Supabase (Test 8)', async () => {
    const { fetchCostsForPeriod } = await import('../app/agentos/costs/_data/costs');
    const result = await fetchCostsForPeriod(period);
    expect(result).toHaveProperty('total_cost');
    expect(result).toHaveProperty('runs_count');
    expect(result).toHaveProperty('active_agents');
    expect(typeof result.total_cost).toBe('number');
    expect(typeof result.runs_count).toBe('number');
    expect(typeof result.active_agents).toBe('number');
    // 3 runs, 2 unique agents
    expect(result.runs_count).toBe(3);
    expect(result.active_agents).toBe(2);
    expect(result.total_cost).toBeCloseTo(0.18, 5);
  });
});

// ── Test 9: fetchCostByAgentDaily top-5 + Other collapse ──────────────────

describe('fetchCostByAgentDaily', () => {
  beforeEach(() => {
    // 7 agents; top 5 by cost should keep their agent_id; remaining collapse to null
    mockTableData = {
      agent_runs: [
        { id: 'r1', agent_id: 'a1', cost_usd: 5.0, model_used: 'claude-haiku-4-5', created_at: '2026-05-01T10:00:00Z' },
        { id: 'r2', agent_id: 'a2', cost_usd: 4.0, model_used: 'claude-haiku-4-5', created_at: '2026-05-01T10:00:00Z' },
        { id: 'r3', agent_id: 'a3', cost_usd: 3.0, model_used: 'claude-haiku-4-5', created_at: '2026-05-01T10:00:00Z' },
        { id: 'r4', agent_id: 'a4', cost_usd: 2.0, model_used: 'claude-haiku-4-5', created_at: '2026-05-01T10:00:00Z' },
        { id: 'r5', agent_id: 'a5', cost_usd: 1.0, model_used: 'claude-haiku-4-5', created_at: '2026-05-01T10:00:00Z' },
        { id: 'r6', agent_id: 'a6', cost_usd: 0.5, model_used: 'claude-haiku-4-5', created_at: '2026-05-01T10:00:00Z' },
        { id: 'r7', agent_id: 'a7', cost_usd: 0.1, model_used: 'claude-haiku-4-5', created_at: '2026-05-01T10:00:00Z' },
      ],
      agents: [
        { id: 'a1', name: 'Agent One' },
        { id: 'a2', name: 'Agent Two' },
        { id: 'a3', name: 'Agent Three' },
        { id: 'a4', name: 'Agent Four' },
        { id: 'a5', name: 'Agent Five' },
        { id: 'a6', name: 'Agent Six' },
        { id: 'a7', name: 'Agent Seven' },
      ],
    };
    vi.clearAllMocks();
  });

  it('top-5 agents preserve their agent_id; rest collapse to agent_id=null (Test 9)', async () => {
    const { fetchCostByAgentDaily } = await import('../app/agentos/costs/_data/costs');
    const result = await fetchCostByAgentDaily(period);
    // Must return DailyAgentCost[]
    expect(Array.isArray(result)).toBe(true);
    // Top 5 agent IDs should appear
    const agentIds = result.map((r) => r.agent_id).filter(Boolean);
    expect(agentIds).toContain('a1');
    expect(agentIds).toContain('a5');
    // a6, a7 should appear as null (Other)
    const hasOther = result.some((r) => r.agent_id === null);
    expect(hasOther).toBe(true);
    // a6 and a7 should NOT have their own agent_id rows
    expect(agentIds).not.toContain('a6');
    expect(agentIds).not.toContain('a7');
  });
});

// ── Test 10: fetchCostByProject null-project aggregation ──────────────────

describe('fetchCostByProject', () => {
  beforeEach(() => {
    mockTableData = {
      agent_runs: [
        { id: 'r1', agent_id: 'a1', cost_usd: 2.0, model_used: 'haiku', created_at: '2026-05-01T10:00:00Z' },
        { id: 'r2', agent_id: 'a2', cost_usd: 3.0, model_used: 'haiku', created_at: '2026-05-01T10:00:00Z' },
        // a3 has no project — should end up under project_id=null
        { id: 'r3', agent_id: 'a3', cost_usd: 1.5, model_used: 'haiku', created_at: '2026-05-01T10:00:00Z' },
      ],
      agents: [
        { id: 'a1', name: 'A1', project_id: 'p1' },
        { id: 'a2', name: 'A2', project_id: 'p1' },
        { id: 'a3', name: 'A3', project_id: null },
      ],
    };
    vi.clearAllMocks();
  });

  it('runs whose agent has project_id=null aggregate under project_id=null (Test 10)', async () => {
    const { fetchCostByProject } = await import('../app/agentos/costs/_data/costs');
    const result = await fetchCostByProject(period);
    expect(Array.isArray(result)).toBe(true);
    const nullProjectRow = result.find((r) => r.project_id === null);
    expect(nullProjectRow).toBeDefined();
    expect(nullProjectRow?.cost).toBeGreaterThan(0);
  });
});

// ── Test 11: fetchCostsTable sort + cost_per_run math ─────────────────────

describe('fetchCostsTable', () => {
  beforeEach(() => {
    mockTableData = {
      agent_runs: [
        { id: 'r1', agent_id: 'a1', cost_usd: 10.0, model_used: 'haiku', created_at: '2026-05-01T10:00:00Z' },
        { id: 'r2', agent_id: 'a1', cost_usd: 5.0,  model_used: 'haiku', created_at: '2026-05-02T10:00:00Z' },
        { id: 'r3', agent_id: 'a2', cost_usd: 2.0,  model_used: 'sonnet', created_at: '2026-05-01T10:00:00Z' },
        // a3 has 0 cost — cost_per_run must be 0, not NaN
        { id: 'r4', agent_id: 'a3', cost_usd: 0.0,  model_used: 'haiku', created_at: '2026-05-01T10:00:00Z' },
      ],
      agents: [
        { id: 'a1', name: 'Alpha', dept: 'Eng', project_id: 'p1' },
        { id: 'a2', name: 'Beta',  dept: null,  project_id: null },
        { id: 'a3', name: 'Gamma', dept: 'Ops', project_id: null },
      ],
    };
    vi.clearAllMocks();
  });

  it('default sort is cost_usd DESC and cost_per_run = cost_usd / runs_count (Test 11)', async () => {
    const { fetchCostsTable } = await import('../app/agentos/costs/_data/costs');
    const result = await fetchCostsTable(period);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // First row should be highest cost (a1: 15.0 total)
    expect(result[0].agent_id).toBe('a1');
    expect(result[0].cost_usd).toBeCloseTo(15.0, 5);
    expect(result[0].runs_count).toBe(2);
    expect(result[0].cost_per_run).toBeCloseTo(7.5, 5);
    // a3 has 0 cost → cost_per_run must be 0, not NaN
    const a3row = result.find((r) => r.agent_id === 'a3');
    expect(a3row).toBeDefined();
    expect(a3row!.cost_per_run).toBe(0);
    expect(isNaN(a3row!.cost_per_run)).toBe(false);
  });
});
