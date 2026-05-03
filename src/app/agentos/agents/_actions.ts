'use server';
/**
 * Server Actions for Agent CRUD.
 *
 * Per 03-RESEARCH.md Pattern 9: every action writes to agentos.audit_logs with
 * before_value + after_value snapshots so LOG-05 / SC#4 are satisfied at the action site.
 *
 * All actions return either {ok: true, data?} or {ok: false, error: string}.
 * Client forms render error.message inline if !ok.
 *
 * NOTE: This file is the conflict surface with parallel Plan 03-04 (Run Management).
 * 03-04 will append `triggerRun`, `cancelRun`, `rerunRun` Server Actions to this same file.
 * Keep this file's exports clean and named so 03-04 can append cleanly.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  requireAdmin,
  requireAdminOrOwner,
} from '@/lib/supabase/agentos';

// -------- Types --------

type AutonomyLevel =
  | 'manual'
  | 'suggestive'
  | 'semi_autonomous'
  | 'autonomous_with_approvals';
type ModelTier = 'haiku' | 'sonnet' | 'opus';
type Department =
  | 'CEO'
  | 'COO'
  | 'Marketing'
  | 'Sales'
  | 'Project'
  | 'Creative'
  | 'Production';

export interface CreateAgentInput {
  name: string;
  department: Department;
  system_prompt: string;
  autonomy_level: AutonomyLevel;
  model_tier: ModelTier;
  max_turns: number;
  budget_cap_usd: number;
  sensitive_tools?: string[]; // goes into config.sensitive_tools
  denylist_globs?: string[]; // goes into config.denylist_globs
}

// -------- Validation --------

function validateCreate(input: CreateAgentInput): string | null {
  if (!input.name || input.name.length < 3 || input.name.length > 50) {
    return 'Name must be 3-50 characters';
  }
  if (!input.department) return 'Department is required';
  if (!input.system_prompt || input.system_prompt.trim().length === 0) {
    return 'System prompt is required';
  }
  if (input.max_turns < 1 || input.max_turns > 200) {
    return 'max_turns must be between 1 and 200';
  }
  if (input.budget_cap_usd < 0) {
    return 'budget_cap_usd cannot be negative';
  }
  return null;
}

// -------- createAgent --------

export async function createAgent(input: CreateAgentInput) {
  const claims = await requireAdmin('/agentos/agents/new');
  const err = validateCreate(input);
  if (err) return { ok: false as const, error: err };

  const sb = await createClient();
  const config = {
    sensitive_tools: input.sensitive_tools || [],
    denylist_globs: input.denylist_globs || [],
  };
  const insertPayload = {
    owner_id: claims.sub,
    name: input.name,
    system_prompt: input.system_prompt,
    autonomy_level: input.autonomy_level,
    model_tier: input.model_tier,
    max_turns: input.max_turns,
    budget_cap_usd: input.budget_cap_usd,
    status: 'active' as const,
    department: input.department,
    config,
  };
  const { data, error } = await sb
    .schema('agentos')
    .from('agents')
    .insert(insertPayload)
    .select('id')
    .single();
  if (error) return { ok: false as const, error: error.message };

  // LOG-05 audit
  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_create',
    target_table: 'agents',
    target_id: data!.id,
    before_value: null,
    after_value: insertPayload,
  });

  revalidatePath('/agentos/agents');
  return { ok: true as const, data: { id: data!.id as string } };
}

// -------- updateAgent --------

export async function updateAgent(
  agentId: string,
  patch: Partial<CreateAgentInput>,
) {
  const sb = await createClient();
  const { data: before } = await sb
    .schema('agentos')
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();
  if (!before) return { ok: false as const, error: 'agent_not_found' };

  const claims = await requireAdminOrOwner(
    `/agentos/agents/${agentId}/edit`,
    before.owner_id,
  );

  // Whitelist patch fields; merge config carefully
  const update: Record<string, unknown> = {};
  const editable = [
    'name',
    'department',
    'system_prompt',
    'autonomy_level',
    'model_tier',
    'max_turns',
    'budget_cap_usd',
  ] as const;
  for (const k of editable) {
    if (k in patch && patch[k] !== undefined) update[k] = patch[k];
  }
  if (
    patch.sensitive_tools !== undefined ||
    patch.denylist_globs !== undefined
  ) {
    update.config = {
      ...(before.config || {}),
      sensitive_tools:
        patch.sensitive_tools ?? before.config?.sensitive_tools ?? [],
      denylist_globs:
        patch.denylist_globs ?? before.config?.denylist_globs ?? [],
    };
  }

  // Re-validate the merged shape (max_turns CHECK + name length CHECK)
  const merged = { ...before, ...update };
  if (
    typeof merged.name === 'string' &&
    (merged.name.length < 3 || merged.name.length > 50)
  ) {
    return { ok: false as const, error: 'Name must be 3-50 characters' };
  }
  if (
    typeof merged.max_turns === 'number' &&
    (merged.max_turns < 1 || merged.max_turns > 200)
  ) {
    return {
      ok: false as const,
      error: 'max_turns must be between 1 and 200',
    };
  }

  const { error } = await sb
    .schema('agentos')
    .from('agents')
    .update(update)
    .eq('id', agentId);
  if (error) return { ok: false as const, error: error.message };

  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_update',
    target_table: 'agents',
    target_id: agentId,
    before_value: before,
    after_value: merged,
  });

  revalidatePath('/agentos/agents');
  revalidatePath(`/agentos/agents/${agentId}`);
  return { ok: true as const };
}

// -------- pauseAgent --------

export async function pauseAgent(agentId: string) {
  const claims = await requireAdmin(`/agentos/agents/${agentId}`);
  const sb = await createClient();
  const { data: before } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, status')
    .eq('id', agentId)
    .single();
  if (!before) return { ok: false as const, error: 'agent_not_found' };

  const { error } = await sb
    .schema('agentos')
    .from('agents')
    .update({ status: 'paused' })
    .eq('id', agentId);
  if (error) return { ok: false as const, error: error.message };

  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_pause',
    target_table: 'agents',
    target_id: agentId,
    before_value: before,
    after_value: { ...before, status: 'paused' },
  });

  revalidatePath('/agentos/agents');
  revalidatePath(`/agentos/agents/${agentId}`);
  return { ok: true as const };
}

// -------- resumeAgent --------

export async function resumeAgent(agentId: string) {
  const claims = await requireAdmin(`/agentos/agents/${agentId}`);
  const sb = await createClient();
  const { data: before } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, status')
    .eq('id', agentId)
    .single();
  if (!before) return { ok: false as const, error: 'agent_not_found' };

  const { error } = await sb
    .schema('agentos')
    .from('agents')
    .update({ status: 'active' })
    .eq('id', agentId);
  if (error) return { ok: false as const, error: error.message };

  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_resume',
    target_table: 'agents',
    target_id: agentId,
    before_value: before,
    after_value: { ...before, status: 'active' },
  });

  revalidatePath('/agentos/agents');
  revalidatePath(`/agentos/agents/${agentId}`);
  return { ok: true as const };
}

// -------- duplicateAgent --------

export async function duplicateAgent(agentId: string) {
  const claims = await requireAdmin(`/agentos/agents/${agentId}`);
  const sb = await createClient();
  const { data: src } = await sb
    .schema('agentos')
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();
  if (!src) return { ok: false as const, error: 'agent_not_found' };

  // Strip server-managed fields; suffix the name.
  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    deleted_at: _da,
    ...rest
  } = src;
  void _id;
  void _ca;
  void _ua;
  void _da;
  const newPayload = { ...rest, name: `${src.name} (copy)` };
  const { data: created, error } = await sb
    .schema('agentos')
    .from('agents')
    .insert(newPayload)
    .select('id')
    .single();
  if (error) return { ok: false as const, error: error.message };

  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_duplicate',
    target_table: 'agents',
    target_id: created!.id,
    before_value: null,
    after_value: { ...newPayload, source_agent_id: agentId },
  });

  revalidatePath('/agentos/agents');
  return { ok: true as const, data: { id: created!.id as string } };
}

// -------- softDeleteAgent --------

export async function softDeleteAgent(agentId: string) {
  const claims = await requireAdmin(`/agentos/agents/${agentId}`);
  const sb = await createClient();
  const { data: before } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, name, deleted_at')
    .eq('id', agentId)
    .single();
  if (!before) return { ok: false as const, error: 'agent_not_found' };

  const now = new Date().toISOString();
  const { error } = await sb
    .schema('agentos')
    .from('agents')
    .update({ deleted_at: now })
    .eq('id', agentId);
  if (error) return { ok: false as const, error: error.message };

  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_delete',
    target_table: 'agents',
    target_id: agentId,
    before_value: before,
    after_value: { ...before, deleted_at: now },
  });

  revalidatePath('/agentos/agents');
  return { ok: true as const };
}

// =============================================================================
// Plan 03-04 — Run management Server Actions
// =============================================================================
//
// triggerRun / cancelRun / rerunRun forward the user's Supabase session JWT to
// the orchestrator (Bearer auth) and write audit_logs rows for LOG-03.
//
// Each returns either {ok: true, data?} or {ok: false, error: string} — same
// shape as the CRUD actions above.

import { requireAgentosRole } from '@/lib/supabase/agentos';

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL ||
  'https://elegant-benevolence-production.up.railway.app';

/**
 * TASK-01: trigger a run for an agent. POSTs to orchestrator's /runs/dispatch.
 * Returns the new run_id so the client can navigate to /agentos/runs/{run_id}.
 */
export async function triggerRun(
  agentId: string,
  input: Record<string, unknown> = {},
) {
  const claims = await requireAgentosRole(`/agentos/agents/${agentId}`);
  const sb = await createClient();

  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { ok: false as const, error: 'no_session' };
  }

  const resp = await fetch(`${ORCHESTRATOR_URL}/runs/dispatch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: agentId,
      input,
      trigger_type: 'manual',
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    return {
      ok: false as const,
      error: `dispatch_failed: ${resp.status} ${detail}`,
    };
  }

  const data = (await resp.json()) as { run_id: string; idempotent?: boolean };
  const runId = data.run_id;

  // LOG-03 audit — best-effort; don't block on failure.
  try {
    await sb.schema('agentos').from('audit_logs').insert({
      user_id: claims.sub,
      action: 'agent_trigger', // enum value added in Plan 03-01 migration
      target_table: 'agent_runs',
      target_id: runId,
      before_value: null,
      after_value: { agent_id: agentId, input, trigger_type: 'manual' },
    });
  } catch {
    // swallow — audit failure should not break the trigger UX
  }

  revalidatePath(`/agentos/agents/${agentId}`);
  return { ok: true as const, data: { id: runId } };
}

/**
 * TASK-06: cancel a running task. POSTs to orchestrator /runs/{run_id}/cancel.
 * Orchestrator flips agent_runs.status='cancelled' first, then attempts
 * modal.FunctionCall.cancel(terminate_containers=True) for the hammer.
 */
export async function cancelRun(runId: string) {
  await requireAgentosRole(`/agentos/runs/${runId}`);
  const sb = await createClient();

  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { ok: false as const, error: 'no_session' };
  }

  const resp = await fetch(`${ORCHESTRATOR_URL}/runs/${runId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const detail = await resp.text();
    return {
      ok: false as const,
      error: `cancel_failed: ${resp.status} ${detail}`,
    };
  }

  revalidatePath(`/agentos/runs/${runId}`);
  return { ok: true as const };
}

/**
 * TASK-05: re-run a failed task with the same inputs.
 * Reads the source run's agent_id + input, then calls triggerRun.
 */
export async function rerunRun(runId: string) {
  await requireAgentosRole(`/agentos/runs/${runId}`);
  const sb = await createClient();

  const { data: src, error } = await sb
    .schema('agentos')
    .from('agent_runs')
    .select('agent_id, input')
    .eq('id', runId)
    .single();

  if (error || !src) {
    return { ok: false as const, error: 'run_not_found' };
  }

  return triggerRun(
    src.agent_id as string,
    (src.input as Record<string, unknown>) ?? {},
  );
}
