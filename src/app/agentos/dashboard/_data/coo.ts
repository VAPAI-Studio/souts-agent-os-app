/**
 * Phase 6 / Plan 06-05 — Server-side data helpers for the dashboard COO briefing card.
 *
 * Discovers the COO supervisor agent, fetches today's run, generates a 1-hour
 * signed URL for the daily-report vault file, and counts pending drafts off
 * the sidecar _meta.json. Used exclusively from the dashboard page Server
 * Component — the helpers expect a service-role-capable Supabase client so
 * RLS can be bypassed for cross-user reads (admin-only routes already gate
 * the boundary at the page-level).
 *
 * COO discovery query: `agents.kind='supervisor' AND config->>'coo'='true'`
 * (matches the seed shape Plan 06-04 will land). Until the seed migration is
 * applied to live Supabase, the COO row does not exist and `fetchCooAgentId`
 * returns null — the dashboard page must handle this case gracefully.
 *
 * UI-SPEC §Surface 4 — Data dependencies + RESEARCH.md §10 signed URL strategy.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CooRunRow {
  id: string;
  agent_id: string;
  status: string;
  created_at: string;
  output: unknown;
  error_message: string | null;
}

/**
 * Discover the COO supervisor agent's id.
 *
 * Filters: `kind='supervisor' AND config.coo=true`. The double-key match is
 * defensive — Plan 06-04 sets both. Returns null when no row matches (seed
 * migration not yet applied or no live COO row in this project).
 */
export async function fetchCooAgentId(
  supabase: SupabaseClient,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .schema('agentos')
      .from('agents')
      .select('id')
      .eq('kind', 'supervisor')
      .eq('config->>coo', 'true')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

/**
 * Fetch the most recent agent_runs row for the COO agent created today.
 *
 * Returns null when no run has fired yet today. The dashboard page renders
 * the "no-run" state in that case.
 */
export async function fetchTodaysCooRun(
  supabase: SupabaseClient,
  cooAgentId: string,
): Promise<CooRunRow | null> {
  try {
    // Today's UTC midnight as ISO — agent_runs.created_at is timestamptz, this
    // is a coarse "since-midnight-UTC" filter sufficient for the dashboard.
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);
    const sinceIso = todayMidnight.toISOString();

    const { data, error } = await supabase
      .schema('agentos')
      .from('agent_runs')
      .select('id, agent_id, status, created_at, output, error_message')
      .eq('agent_id', cooAgentId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as CooRunRow;
  } catch {
    return null;
  }
}

/**
 * Generate a 1-hour signed URL for the daily-report vault file.
 *
 * Returns null when the file does not exist (Storage returns an error with
 * message ~ "Object not found"). The dashboard hides the [Read report]
 * button in that case.
 *
 * Plan 06-04 writes the file at `vault/company/daily-reports/{today_iso}.md`.
 */
export async function generateVaultSignedUrl(
  supabase: SupabaseClient,
  todayIso: string,
): Promise<string | null> {
  try {
    const path = `company/daily-reports/${todayIso}.md`;
    const { data, error } = await supabase.storage
      .from('vault')
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Count drafts that are pending (no discarded_at, no sent_at) for a run.
 *
 * Reads `vault/drafts/{runId}/_meta.json` via Storage download. Returns 0
 * when the sidecar does not exist (the run produced no drafts). Mirrors
 * the same shape used by /agentos/runs/[id]/page.tsx (Plan 06-02b).
 */
export async function fetchPendingDraftsCount(
  supabase: SupabaseClient,
  runId: string,
): Promise<number> {
  try {
    const { data: blob, error } = await supabase.storage
      .from('vault')
      .download(`drafts/${runId}/_meta.json`);
    if (error || !blob) return 0;
    const text = await blob.text();
    const meta = JSON.parse(text) as {
      drafts?: Record<
        string,
        { discarded_at: string | null; sent_at: string | null }
      >;
    };
    if (!meta.drafts) return 0;
    return Object.values(meta.drafts).filter(
      (d) => !d.discarded_at && !d.sent_at,
    ).length;
  } catch {
    return 0;
  }
}

/**
 * Helper — today's date as `YYYY-MM-DD` UTC string.
 *
 * Matches the COO agent's daily-report file naming. The COO runs at 09:00
 * America/Mexico_City; the report file's date suffix is computed in UTC at
 * write-time. Using UTC here keeps the dashboard and the writer aligned.
 */
export function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
