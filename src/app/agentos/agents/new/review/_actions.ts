'use server';
/**
 * Step 8 server actions. Thin wrappers around triggerRun + recheckMcpConnections
 * that add Step-8-specific audit logging and validation.
 *
 * Per .planning/phases/08-agent-builder-ui-chat-schedule/08-RESEARCH.md
 * §"Step 8 Test-Run Dispatch": no new orchestrator endpoint needed.
 * The wizard's "Run Test" button calls triggerRun(draftId, input)
 * which routes through POST /runs/dispatch with trigger_type='manual'.
 * The scheduler skips drafts via the SQL filter from Plan 08-01.
 *
 * Plan 08-03 / Phase 8 / AGENT-11
 */
import { requireAdmin, requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { triggerRun } from '../../_actions';

export async function triggerTestRun(
  draftId: string,
  sampleInput: string,
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  if (!sampleInput?.trim()) return { ok: false, error: 'sample_input_required' };
  if (sampleInput.length > 5000) return { ok: false, error: 'sample_input_too_long' };

  const claims = await requireAgentosRole('/agentos/agents/new/review');
  const sb = await createClient();

  // Confirm draft exists and is in fact a draft.
  const { data: draft } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, is_draft, deleted_at, owner_id')
    .eq('id', draftId)
    .maybeSingle();
  if (!draft || draft.deleted_at) return { ok: false, error: 'draft_not_found' };
  if (!draft.is_draft) return { ok: false, error: 'agent_already_active' };
  if (draft.owner_id !== claims.sub && claims.app_role !== 'admin') {
    return { ok: false, error: 'forbidden' };
  }

  // Audit the test-run intent (separate audit row from the run itself).
  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_run_trigger',
    target_table: 'agents',
    target_id: draftId,
    before_value: null,
    after_value: { test_run: true, sample_input_preview: sampleInput.slice(0, 100) },
  });

  // Delegate to existing triggerRun (uses trigger_type='manual', dispatch to /runs/dispatch).
  return triggerRun(draftId, { prompt: sampleInput });
}

export async function recheckMcpConnections(
  draftId: string,
): Promise<{ ok: true; data: { connectedServers: string[] } } | { ok: false; error: string }> {
  void draftId; // used for ownership context — draftId is accepted for future ownership checks
  const claims = await requireAgentosRole('/agentos/agents/new/review');
  const sb = await createClient();
  const { data: connections } = await sb
    .schema('agentos')
    .from('tool_connections')
    .select('integration_type')
    .eq('user_id', claims.sub)
    .eq('status', 'connected');
  return { ok: true, data: { connectedServers: (connections ?? []).map((c) => c.integration_type) } };
}
