'use server';
/**
 * Phase 6 / Plan 06-05 — Dashboard Server Actions.
 *
 * `triggerCooRun` is the [Run now] / [Re-run] handler on the COO briefing
 * card. It locates the COO supervisor agent, then proxies to the
 * orchestrator's POST /runs/dispatch (single source of truth for the Modal
 * dispatch + agent_runs insert). Mirrors the pattern in
 * `agentos/agents/_actions.ts triggerRun`.
 *
 * Action shape locked from Phase 3: `{ ok: true; data?: T } | { ok: false; error: string }`.
 *
 * audit_logs column name is `action` (recurring drift in earlier plans —
 * see Phase 4/5/06-02b SUMMARYs for the canonical column resolution). The
 * audit row's action value is the literal "manual_trigger" string per the
 * Plan 06-05 acceptance contract.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/agentos';

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL ||
  'https://elegant-benevolence-production.up.railway.app';

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Trigger a manual COO run.
 *
 * Discovers the COO agent by `kind='supervisor' AND config->>'coo'='true'`.
 * Returns `coo_agent_not_found` when the seed has not been applied yet —
 * the dashboard renders an onboarding-friendly error in that case.
 */
export async function triggerCooRun(): Promise<
  ActionResult<{ run_id: string; coo_agent_id: string }>
> {
  const claims = await requireAdmin('/agentos/dashboard');
  const sb = await createClient();

  // 1. Locate the COO supervisor agent. Mirrors fetchCooAgentId in _data/coo.ts.
  const { data: agent, error: agentErr } = await sb
    .schema('agentos')
    .from('agents')
    .select('id')
    .eq('kind', 'supervisor')
    .eq('config->>coo', 'true')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (agentErr) {
    return { ok: false, error: `coo_lookup_failed: ${agentErr.message}` };
  }
  if (!agent) {
    return { ok: false, error: 'coo_agent_not_found' };
  }
  const cooAgentId = (agent as { id: string }).id;

  // 2. Get the admin's session token to forward to the orchestrator.
  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { ok: false, error: 'no_session' };
  }

  // 3. Proxy to orchestrator /runs/dispatch — single source of truth for the
  //    agent_runs row + Arq enqueue. Trigger type 'manual'.
  const resp = await fetch(`${ORCHESTRATOR_URL}/runs/dispatch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: cooAgentId,
      input: {},
      trigger_type: 'manual',
    }),
    cache: 'no-store',
  });

  if (!resp.ok) {
    const detail = await resp.text();
    return {
      ok: false,
      error: `dispatch_failed: ${resp.status} ${detail}`,
    };
  }

  const data = (await resp.json()) as { run_id: string };
  const runId = data.run_id;

  // 4. Audit log — best-effort. Column name is `action` (recurring drift in
  //    earlier plans used the wrong identifier; do not change it here).
  try {
    await sb.schema('agentos').from('audit_logs').insert({
      user_id: claims.sub,
      action: 'manual_trigger',
      target_table: 'agent_runs',
      target_id: runId,
      before_value: null,
      after_value: {
        agent_id: cooAgentId,
        trigger_source: 'dashboard_coo_card',
      },
    });
  } catch {
    // swallow — audit failure should not break the trigger UX
  }

  revalidatePath('/agentos/dashboard');
  return { ok: true, data: { run_id: runId, coo_agent_id: cooAgentId } };
}
