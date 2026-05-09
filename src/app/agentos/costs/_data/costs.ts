/**
 * Phase 9 / Plan 09-02 — Server-side cost fetchers for the costs dashboard.
 *
 * All functions are Server-side ONLY (no 'use client' directive). They call
 * createClient() from @/lib/supabase/server and use .schema('agentos') on
 * every query to scope requests correctly per project convention.
 *
 * Aggregation strategy:
 *  - For totals and model breakdown: single query + TypeScript reduce.
 *  - For stacked bar chart (top-5 agents + "Other"): fetch all runs in period,
 *    group by agent_id in TypeScript to avoid a stored function dependency.
 *    Acceptable at internal-team scale (low-thousands of runs/month).
 *  - For project rollup and table: fetch runs + join agents, reduce in TS.
 */

import { createClient } from '@/lib/supabase/server';
import type { PeriodResolved } from './period';

// ── Public types ─────────────────────────────────────────────────────────────

export interface CostTotals {
  total_cost: number;
  runs_count: number;
  active_agents: number;
}

export interface DailyAgentCost {
  date: string;          // YYYY-MM-DD
  agent_id: string | null; // null = "Other" bucket
  cost: number;
  agent_name?: string;
}

export interface ModelCost {
  model: string;
  cost: number;
}

export interface ProjectCost {
  project_id: string | null;
  project_name: string | null;
  cost: number;
  runs_count: number;
  agent_count: number;
}

export interface CostTableRow {
  agent_id: string;
  agent_name: string;
  agent_dept: string | null;
  project_id: string | null;
  project_name: string | null;
  model_used: string | null;
  runs_count: number;
  cost_usd: number;
  cost_per_run: number; // guarded: 0 when runs_count === 0
}

// ── Internal row types ────────────────────────────────────────────────────────

interface RunRow {
  id: string;
  agent_id: string;
  cost_usd: number;
  model_used: string | null;
  created_at: string;
}

interface AgentRow {
  id: string;
  name: string;
  dept?: string | null;
  project_id: string | null;
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Aggregate totals for the selected period.
 * Returns: total_cost, runs_count, active_agents (distinct agent_ids).
 */
export async function fetchCostsForPeriod(p: PeriodResolved): Promise<CostTotals> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .schema('agentos')
      .from('agent_runs')
      .select('id, agent_id, cost_usd')
      .gte('created_at', p.startUtc)
      .lt('created_at', p.endUtc);

    if (error || !data) {
      return { total_cost: 0, runs_count: 0, active_agents: 0 };
    }

    const rows = data as Array<{ agent_id: string; cost_usd: number }>;
    const total_cost = rows.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);
    const runs_count = rows.length;
    const active_agents = new Set(rows.map((r) => r.agent_id)).size;

    return { total_cost, runs_count, active_agents };
  } catch {
    return { total_cost: 0, runs_count: 0, active_agents: 0 };
  }
}

/**
 * Daily cost breakdown for top-5 agents + "Other" bucket.
 *
 * Process:
 *  1. Fetch all runs in period.
 *  2. Sum cost per agent_id → sort DESC → take top 5 agent_ids.
 *  3. Group by (YYYY-MM-DD, agent_id_in_top5_or_null).
 *  4. Resolve names from agents table.
 */
export async function fetchCostByAgentDaily(p: PeriodResolved): Promise<DailyAgentCost[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .schema('agentos')
      .from('agent_runs')
      .select('agent_id, cost_usd, created_at')
      .gte('created_at', p.startUtc)
      .lt('created_at', p.endUtc);

    if (error || !data) return [];

    const rows = data as Array<{ agent_id: string; cost_usd: number; created_at: string }>;

    // Step 1: per-agent total cost → top 5
    const agentTotals = new Map<string, number>();
    for (const row of rows) {
      agentTotals.set(row.agent_id, (agentTotals.get(row.agent_id) ?? 0) + (row.cost_usd ?? 0));
    }
    const top5Ids = new Set(
      [...agentTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id),
    );

    // Step 2: group by (date, agent_id_or_null)
    const grouped = new Map<string, number>();
    for (const row of rows) {
      const date = row.created_at.slice(0, 10); // YYYY-MM-DD
      const agentKey = top5Ids.has(row.agent_id) ? row.agent_id : 'other';
      const key = `${date}__${agentKey}`;
      grouped.set(key, (grouped.get(key) ?? 0) + (row.cost_usd ?? 0));
    }

    // Step 3: resolve agent names
    const topIdArray = [...top5Ids];
    let nameMap = new Map<string, string>();
    if (topIdArray.length > 0) {
      const { data: agentData } = await supabase
        .schema('agentos')
        .from('agents')
        .select('id, name')
        .in('id', topIdArray);
      if (agentData) {
        for (const a of agentData as Array<{ id: string; name: string }>) {
          nameMap.set(a.id, a.name);
        }
      }
    }

    // Step 4: build DailyAgentCost[]
    const result: DailyAgentCost[] = [];
    for (const [key, cost] of grouped.entries()) {
      const [date, agentKey] = key.split('__');
      if (agentKey === 'other') {
        result.push({ date, agent_id: null, cost });
      } else {
        result.push({ date, agent_id: agentKey, cost, agent_name: nameMap.get(agentKey) });
      }
    }

    return result.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (b.cost - a.cost);
    });
  } catch {
    return [];
  }
}

/**
 * Cost breakdown by model (horizontal bar chart data).
 */
export async function fetchCostByModel(p: PeriodResolved): Promise<ModelCost[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .schema('agentos')
      .from('agent_runs')
      .select('model_used, cost_usd')
      .gte('created_at', p.startUtc)
      .lt('created_at', p.endUtc);

    if (error || !data) return [];

    const rows = data as Array<{ model_used: string | null; cost_usd: number }>;
    const modelMap = new Map<string, number>();
    for (const row of rows) {
      if (!row.model_used) continue;
      modelMap.set(row.model_used, (modelMap.get(row.model_used) ?? 0) + (row.cost_usd ?? 0));
    }

    return [...modelMap.entries()]
      .map(([model, cost]) => ({ model, cost }))
      .sort((a, b) => b.cost - a.cost);
  } catch {
    return [];
  }
}

/**
 * Cost rollup by project.
 *
 * Fetches runs + agents join, groups by project_id in TypeScript.
 * Runs with agents whose project_id is null appear under project_id=null.
 */
export async function fetchCostByProject(p: PeriodResolved): Promise<ProjectCost[]> {
  try {
    const supabase = await createClient();

    // Fetch runs for the period
    const { data: runData, error: runError } = await supabase
      .schema('agentos')
      .from('agent_runs')
      .select('agent_id, cost_usd')
      .gte('created_at', p.startUtc)
      .lt('created_at', p.endUtc);

    if (runError || !runData) return [];

    const runs = runData as Array<{ agent_id: string; cost_usd: number }>;
    const agentIds = [...new Set(runs.map((r) => r.agent_id))];

    if (agentIds.length === 0) return [];

    // Fetch agents + projects join
    const { data: agentData } = await supabase
      .schema('agentos')
      .from('agents')
      .select('id, project_id, projects(id, name)')
      .in('id', agentIds);

    // Build agent → project map
    // Supabase join returns projects as an array (even for one-to-one relations via !inner)
    type AgentWithProject = {
      id: string;
      project_id: string | null;
      projects: Array<{ id: string; name: string }> | { id: string; name: string } | null;
    };

    const agentProjectMap = new Map<
      string,
      { project_id: string | null; project_name: string | null }
    >();

    if (agentData) {
      for (const a of (agentData as unknown as AgentWithProject[])) {
        const proj = Array.isArray(a.projects) ? a.projects[0] : a.projects;
        agentProjectMap.set(a.id, {
          project_id: a.project_id ?? null,
          project_name: proj?.name ?? null,
        });
      }
    }

    // Aggregate by project
    type ProjectAccum = {
      project_id: string | null;
      project_name: string | null;
      cost: number;
      runs_count: number;
      agent_ids: Set<string>;
    };

    const projectMap = new Map<string | null, ProjectAccum>();

    for (const run of runs) {
      const proj = agentProjectMap.get(run.agent_id) ?? {
        project_id: null,
        project_name: null,
      };
      const key = proj.project_id;
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          project_id: proj.project_id,
          project_name: proj.project_name,
          cost: 0,
          runs_count: 0,
          agent_ids: new Set(),
        });
      }
      const bucket = projectMap.get(key)!;
      bucket.cost += run.cost_usd ?? 0;
      bucket.runs_count += 1;
      bucket.agent_ids.add(run.agent_id);
    }

    return [...projectMap.values()]
      .map((b) => ({
        project_id: b.project_id,
        project_name: b.project_name,
        cost: b.cost,
        runs_count: b.runs_count,
        agent_count: b.agent_ids.size,
      }))
      .sort((a, b) => b.cost - a.cost);
  } catch {
    return [];
  }
}

/**
 * Dense sortable table data — grouped by (agent_id, model_used).
 *
 * Computes cost_per_run = cost_usd / runs_count, guarding against runs_count=0
 * (returns 0 instead of NaN).
 *
 * Default sort: cost_usd DESC.
 */
export async function fetchCostsTable(
  p: PeriodResolved,
  sortBy: keyof CostTableRow = 'cost_usd',
  dir: 'asc' | 'desc' = 'desc',
): Promise<CostTableRow[]> {
  try {
    const supabase = await createClient();

    const { data: runData, error: runError } = await supabase
      .schema('agentos')
      .from('agent_runs')
      .select('agent_id, cost_usd, model_used')
      .gte('created_at', p.startUtc)
      .lt('created_at', p.endUtc);

    if (runError || !runData) return [];

    const runs = runData as RunRow[];
    const agentIds = [...new Set(runs.map((r) => r.agent_id))];

    if (agentIds.length === 0) return [];

    // Fetch agent metadata
    const { data: agentData } = await supabase
      .schema('agentos')
      .from('agents')
      .select('id, name, dept, project_id, projects(id, name)')
      .in('id', agentIds);

    type AgentWithProject = {
      id: string;
      name: string;
      dept: string | null;
      project_id: string | null;
      projects: Array<{ id: string; name: string }> | { id: string; name: string } | null;
    };

    const agentMap = new Map<
      string,
      { name: string; dept: string | null; project_id: string | null; project_name: string | null }
    >();

    if (agentData) {
      for (const a of (agentData as unknown as AgentWithProject[])) {
        const proj = Array.isArray(a.projects) ? a.projects[0] : a.projects;
        agentMap.set(a.id, {
          name: a.name,
          dept: a.dept ?? null,
          project_id: a.project_id ?? null,
          project_name: proj?.name ?? null,
        });
      }
    }

    // Group by agent_id
    type Accum = {
      agent_id: string;
      model_used: string | null;
      cost_usd: number;
      runs_count: number;
    };

    const tableMap = new Map<string, Accum>();

    for (const run of runs) {
      const key = run.agent_id;
      if (!tableMap.has(key)) {
        tableMap.set(key, {
          agent_id: run.agent_id,
          model_used: run.model_used ?? null,
          cost_usd: 0,
          runs_count: 0,
        });
      }
      const row = tableMap.get(key)!;
      row.cost_usd += run.cost_usd ?? 0;
      row.runs_count += 1;
      // Use latest model_used (last write wins — good enough for dense table)
      if (run.model_used) row.model_used = run.model_used;
    }

    const rows: CostTableRow[] = [...tableMap.values()].map((row) => {
      const agent = agentMap.get(row.agent_id);
      return {
        agent_id: row.agent_id,
        agent_name: agent?.name ?? row.agent_id,
        agent_dept: agent?.dept ?? null,
        project_id: agent?.project_id ?? null,
        project_name: agent?.project_name ?? null,
        model_used: row.model_used,
        runs_count: row.runs_count,
        cost_usd: row.cost_usd,
        // Guard against division by zero
        cost_per_run: row.runs_count > 0 ? row.cost_usd / row.runs_count : 0,
      };
    });

    // Sort
    rows.sort((a, b) => {
      const av = a[sortBy] as number | string | null;
      const bv = b[sortBy] as number | string | null;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const diff = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === 'asc' ? diff : -diff;
    });

    return rows;
  } catch {
    return [];
  }
}
