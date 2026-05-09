/**
 * Phase 9 / Plan 09-03 — Server-side data helpers for the home dashboard stat
 * cards and activity feed.
 *
 * Uses createClient from @/lib/supabase/server (user-scoped, RLS enforced).
 * All fetchers wrap their logic in try/catch and return safe defaults on error
 * (count → 0, list → []) — mirror the posture of coo.ts.
 *
 * ENUM STRINGS — CRITICAL (verified against supabase/migrations/20260425_120100_agentos_enums.sql:54):
 *   - Approval decisions: approval_approve / approval_reject / approval_edit  (NO -d suffix)
 *   - Agent status:       agent_pause / agent_resume                           (NO -d suffix)
 *   - Run completions:    agent_run_completed / agent_run_failed
 *   - Budget auto-pause:  agent_auto_paused_budget
 *
 * ACTIVITY_ACTIONS is exported so ActivityFeed.tsx can import the same constant —
 * server and client share a single source of truth (no drift possible).
 */
import { createClient } from '@/lib/supabase/server';

// ── Shared constants + types ──────────────────────────────────────────────────
// Pure constants/types live in ./types so client components can import them
// without dragging next/headers (via @/lib/supabase/server) into the browser
// bundle. Re-export here for back-compat with server-side callers that import
// from this file.
import { ACTIVITY_ACTIONS, type ActivityRow } from './types';
export { ACTIVITY_ACTIONS };
export type { ActivityRow };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive 3-category 'category' from audit_logs action string. */
function deriveCategory(action: string): 'run' | 'approval' | 'agent' {
  if (action === 'agent_run_completed' || action === 'agent_run_failed') {
    return 'run';
  }
  if (
    action === 'approval_approve' ||
    action === 'approval_reject' ||
    action === 'approval_edit'
  ) {
    return 'approval';
  }
  // agent_pause / agent_resume / agent_auto_paused_budget
  return 'agent';
}

/** UTC midnight ISO for today (coarse filter — matches coo.ts pattern). */
function todayMidnightIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

/**
 * Count of approval_requests where status = 'pending'.
 * Reuses the same query predicate as PendingBadge in the sidebar.
 */
export async function fetchPendingApprovalsCount(): Promise<number> {
  try {
    const sb = await createClient();
    const { count, error } = await sb
      .schema('agentos')
      .from('approval_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Count agents in error (distinct agent_ids with a failed run in the last 24h).
 * Helper consumed by fetchActiveAgentsCount.
 */
export async function fetchAgentsInErrorCount(): Promise<number> {
  try {
    const sb = await createClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .schema('agentos')
      .from('agent_runs')
      .select('agent_id')
      .eq('status', 'failed')
      .gte('created_at', since);
    if (error || !data) return 0;
    // Deduplicate agent_ids client-side (avoids a DB function)
    const unique = new Set((data as { agent_id: string }[]).map((r) => r.agent_id));
    return unique.size;
  } catch {
    return 0;
  }
}

/**
 * Count of active agents + count of agents in error in the last 24h.
 * Returned as { active, errors } for the stat card sub-stat.
 */
export async function fetchActiveAgentsCount(): Promise<{
  active: number;
  errors: number;
}> {
  try {
    const sb = await createClient();
    const { count, error } = await sb
      .schema('agentos')
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deleted_at', null);
    if (error) return { active: 0, errors: 0 };
    const errors = await fetchAgentsInErrorCount();
    return { active: count ?? 0, errors };
  } catch {
    return { active: 0, errors: 0 };
  }
}

/**
 * SUM of agent_runs.cost_usd since UTC midnight today.
 */
export async function fetchTodaysCostUsd(): Promise<number> {
  try {
    const sb = await createClient();
    const since = todayMidnightIso();
    const { data, error } = await sb
      .schema('agentos')
      .from('agent_runs')
      .select('cost_usd')
      .gte('created_at', since);
    if (error || !data) return 0;
    const total = (data as { cost_usd: number | null }[]).reduce(
      (sum, r) => sum + (r.cost_usd ?? 0),
      0,
    );
    return total;
  } catch {
    return 0;
  }
}

/**
 * Agent with the smallest next_run_at where schedule_enabled=true AND deleted_at IS NULL.
 * Returns null when no scheduled agent exists.
 */
export async function fetchNextScheduledAgent(): Promise<{
  agent_id: string;
  agent_name: string;
  next_run_at: string;
} | null> {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .schema('agentos')
      .from('agents')
      .select('id, name, next_run_at')
      .eq('schedule_enabled', true)
      .is('deleted_at', null)
      .order('next_run_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { id: string; name: string; next_run_at: string | null };
    if (!row.next_run_at) return null;
    return {
      agent_id: row.id,
      agent_name: row.name,
      next_run_at: row.next_run_at,
    };
  } catch {
    return null;
  }
}

/**
 * Last N audit_logs rows for the 3 activity categories (run completions,
 * approval decisions, agent status changes), ordered newest first.
 *
 * Enum strings are sourced from ACTIVITY_ACTIONS constant above — any
 * downstream client component that re-fetches must import that constant
 * so server and client paths cannot drift.
 *
 * Returns [] on error (safe default — never bubbles).
 */
export async function fetchActivityFeed(limit = 20): Promise<ActivityRow[]> {
  try {
    const sb = await createClient();
    const { data: rows, error } = await sb
      .schema('agentos')
      .from('audit_logs')
      .select('id, action, target_table, target_id, metadata, created_at')
      .in('action', [...ACTIVITY_ACTIONS])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !rows) return [];

    // --- Batch-resolve agent_names ---
    // Collect unique agent IDs from metadata.agent_id (run rows)
    // and from target_id (when target_table='agents')
    const agentIds = new Set<string>();
    for (const row of rows as Array<{
      id: string;
      action: string;
      target_table: string;
      target_id: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>) {
      const meta = row.metadata ?? {};
      if (meta.agent_id && typeof meta.agent_id === 'string') {
        agentIds.add(meta.agent_id);
      }
      if (row.target_table === 'agents' && row.target_id) {
        agentIds.add(row.target_id);
      }
    }

    // One batch query for agent names
    const nameMap = new Map<string, string>();
    if (agentIds.size > 0) {
      const { data: agents } = await sb
        .schema('agentos')
        .from('agents')
        .select('id, name')
        .in('id', [...agentIds]);
      for (const a of (agents ?? []) as { id: string; name: string }[]) {
        nameMap.set(a.id, a.name);
      }
    }

    // Map to ActivityRow
    return (
      rows as Array<{
        id: string;
        action: string;
        target_table: string;
        target_id: string;
        metadata: Record<string, unknown> | null;
        created_at: string;
      }>
    ).map((row) => {
      const meta = row.metadata ?? {};
      const category = deriveCategory(row.action);

      // Resolve agent_id: run rows store it in metadata; agent rows use target_id
      const agentId =
        category === 'run'
          ? (meta.agent_id as string | null) ?? null
          : category === 'agent'
            ? row.target_id ?? null
            : (meta.agent_id as string | null) ?? null;

      const agent_name = agentId ? (nameMap.get(agentId) ?? null) : null;

      return {
        id: row.id,
        category,
        action: row.action,
        agent_id: agentId,
        agent_name,
        run_id: category === 'run' ? row.target_id ?? null : null,
        approval_id: category === 'approval' ? row.target_id ?? null : null,
        cost_usd:
          category === 'run' && meta.cost_usd != null
            ? Number(meta.cost_usd)
            : null,
        status:
          category === 'run'
            ? row.action === 'agent_run_completed'
              ? 'completed'
              : 'failed'
            : null,
        tool_name:
          category === 'approval'
            ? (meta.tool_name as string | null) ?? null
            : null,
        created_at: row.created_at,
      };
    });
  } catch {
    return [];
  }
}
