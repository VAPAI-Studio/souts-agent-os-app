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
  | 'ceo'
  | 'coo'
  | 'marketing'
  | 'sales'
  | 'project'
  | 'creative'
  | 'production';

export interface CreateAgentInput {
  name: string;
  department: Department;
  system_prompt: string;
  autonomy_level: AutonomyLevel;
  model_tier: ModelTier;
  max_turns: number;
  budget_cap_usd: number;
  /** Plan 09-04: cumulative monthly spend cap. NULL = no cap. */
  monthly_budget_usd?: number | null;
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

// Phase 6 / Plan 06-02: list of MCP tool names seeded into agent_tool_permissions
// when a new agent is created. MUST stay in lockstep with
// souts-agent-os-app/src/app/agentos/tools/_data/registry.ts ALL_REGISTERED_TOOLS.
// (Server Actions cannot import from app code that pulls in non-action runtime
// shapes without webpack module-resolution issues at the action runtime, so the
// list is duplicated here. Polish-phase candidate to collapse.)
//
// Phase 6.1 / Plan 06.1-02: Slack tool names refreshed to match the live MCP
// fixture (souts-agent-os-modal/tests/fixtures/mcp_tool_names_slack.json,
// captured 2026-05-07). Old names (post_message, list_channels, etc.) gone —
// the live MCP server uses the redundant slack_-leaf-prefix convention.
const ALL_REGISTERED_TOOLS: string[] = [
  // Slack reads
  'mcp__slack__slack_search_channels',
  'mcp__slack__slack_search_public',
  'mcp__slack__slack_search_public_and_private',
  'mcp__slack__slack_search_users',
  'mcp__slack__slack_read_channel',
  'mcp__slack__slack_read_thread',
  'mcp__slack__slack_read_canvas',
  'mcp__slack__slack_read_user_profile',
  // Slack writes (approval-gated)
  'mcp__slack__slack_send_message',
  'mcp__slack__slack_schedule_message',
  'mcp__slack__slack_create_canvas',
  'mcp__slack__slack_update_canvas',
  // Slack draft (draft_only level)
  'mcp__slack__slack_send_message_draft',
  // Calendar
  'mcp__google_calendar__list_calendars',
  'mcp__google_calendar__list_events',
  'mcp__google_calendar__get_event',
];

function defaultLevelFromAutonomy(autonomy: AutonomyLevel): string {
  // Maps Phase 5 autonomy_level (now seed-only per CONTEXT §8) to a Phase 6
  // tool_permission_level for the seed rows. Operators can override per-tool
  // via the Agent Edit Tools section.
  if (autonomy === 'suggestive') return 'no_access';
  if (autonomy === 'autonomous_with_approvals') return 'execute_autonomously';
  // semi_autonomous + manual default to execute_with_approval — gate routes via
  // approval_requests for any write tool the agent attempts.
  return 'execute_with_approval';
}

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

  // Phase 6 / Plan 06-02: seed agent_tool_permissions rows from autonomy_level.
  // CONTEXT §8 demoted autonomy_level to seed-only — runtime gate now consults
  // agent_tool_permissions exclusively. Failures are logged but never block the
  // agent creation (the operator can manually set permissions via Edit Tools).
  try {
    const seedLevel = defaultLevelFromAutonomy(input.autonomy_level);
    const seedRows = ALL_REGISTERED_TOOLS.map((toolName) => ({
      agent_id: data!.id,
      tool_name: toolName,
      level: seedLevel,
      set_by: claims.sub,
    }));
    const { error: seedError } = await sb
      .schema('agentos')
      .from('agent_tool_permissions')
      .insert(seedRows);
    if (seedError) {
      console.warn('agent_tool_permissions seed failed:', seedError.message);
    }
  } catch (e) {
    console.warn('agent_tool_permissions seed exception:', e);
  }

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
  // Plan 09-04: monthly_budget_usd — nullable (NULL = no cap). Validate non-negative.
  if ('monthly_budget_usd' in patch) {
    const rawBudget = patch.monthly_budget_usd;
    const budgetVal: number | null =
      rawBudget === undefined || rawBudget === null
        ? null
        : Number(rawBudget);
    if (budgetVal !== null && (Number.isNaN(budgetVal) || budgetVal < 0)) {
      return { ok: false as const, error: 'Monthly budget must be a non-negative number' };
    }
    update.monthly_budget_usd = budgetVal;
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
// Plan 08-02 — Draft management Server Actions
// =============================================================================
//
// Five actions for the 8-step wizard draft lifecycle:
//   createDraft        — inserts is_draft=true agent row
//   patchDraft         — patches any subset of wizard fields
//   activateDraft      — validates + flips is_draft=false
//   discardDraft       — soft-deletes the draft row
//   createDraftFromTemplate — pre-fills from a seeded JSON template
//
// Audit log column name is `action` (NOT `action_type`) and `user_id` (NOT `actor_id`).
// Enum values `agent_draft_create`, `agent_draft_activate`, `agent_draft_discard`
// were added to agentos.audit_action_type in Plan 08-01 migration (pending apply).

import cooTemplate from './new/templates/coo-daily-report.json';
import contentDrafterTemplate from './new/templates/content-drafter.json';
import taskSummarizerTemplate from './new/templates/task-summarizer.json';

type TemplateSlug = 'coo-daily-report' | 'content-drafter' | 'task-summarizer';

interface DraftPatch {
  name?: string;
  department?: Department;
  system_prompt?: string;
  autonomy_level?: AutonomyLevel;
  model_tier?: ModelTier;
  max_turns?: number;
  budget_cap_usd?: number;
  /** Plan 09-04: cumulative monthly spend cap. NULL = no cap. */
  monthly_budget_usd?: number | null;
  sensitive_tools?: string[];
  denylist_globs?: string[];
  required_mcp_servers?: string[];
  schedule_cron?: string;
  schedule_timezone?: string;
  schedule_enabled?: boolean;
  config?: Record<string, unknown>;
}

export async function createDraft(input: {
  name: string;
  department: Department;
}): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  if (!input.name?.trim()) return { ok: false, error: 'name_required' };
  if (input.name.length > 100) return { ok: false, error: 'name_too_long' };
  if (!input.department) return { ok: false, error: 'department_required' };
  const claims = await requireAdmin('/agentos/agents/new');
  const sb = await createClient();
  const { data, error } = await sb
    .schema('agentos')
    .from('agents')
    .insert({
      owner_id: claims.sub,
      name: input.name.trim(),
      department: input.department,
      system_prompt: '',
      autonomy_level: 'semi_autonomous' as AutonomyLevel,
      model_tier: 'sonnet' as ModelTier,
      max_turns: 25,
      budget_cap_usd: 1.0,
      status: 'active',
      is_draft: true,
      config: {},
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_draft_create',
    target_table: 'agents',
    target_id: data!.id,
    before_value: null,
    after_value: { name: input.name, department: input.department, is_draft: true },
  });
  return { ok: true, data: { id: data!.id as string } };
}

export async function patchDraft(
  draftId: string,
  patch: Partial<DraftPatch>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof patch.max_turns === 'number' && (patch.max_turns < 1 || patch.max_turns > 100)) {
    return { ok: false, error: 'max_turns must be 1-100' };
  }
  if (typeof patch.budget_cap_usd === 'number' && patch.budget_cap_usd <= 0) {
    return { ok: false, error: 'budget_cap_usd must be > 0' };
  }
  const claims = await requireAdmin('/agentos/agents/new');
  const sb = await createClient();
  // Build a typed update object from the patch keys
  const update: Record<string, unknown> = {};
  const patchableFields = [
    'name', 'department', 'system_prompt', 'autonomy_level', 'model_tier',
    'max_turns', 'budget_cap_usd', 'monthly_budget_usd', 'sensitive_tools', 'denylist_globs',
    'required_mcp_servers', 'schedule_cron', 'schedule_timezone',
    'schedule_enabled', 'config',
  ] as const;
  for (const key of patchableFields) {
    if (key in patch && patch[key] !== undefined) {
      update[key] = patch[key];
    }
  }
  const { data: updated, error } = await sb
    .schema('agentos')
    .from('agents')
    .update(update)
    .eq('id', draftId)
    .eq('is_draft', true)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: 'draft_not_found' };
  void claims; // used for auth gate above
  return { ok: true };
}

export async function activateDraft(
  draftId: string,
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const claims = await requireAdmin('/agentos/agents/new');
  const sb = await createClient();
  const { data: draft } = await sb
    .schema('agentos')
    .from('agents')
    .select('*')
    .eq('id', draftId)
    .eq('is_draft', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (!draft) return { ok: false, error: 'draft_not_found' };
  const validationError = validateCreate({
    name: draft.name,
    department: draft.department,
    system_prompt: draft.system_prompt,
    autonomy_level: draft.autonomy_level,
    model_tier: draft.model_tier,
    max_turns: draft.max_turns,
    budget_cap_usd: draft.budget_cap_usd,
  });
  if (validationError) return { ok: false, error: validationError };
  const { error } = await sb
    .schema('agentos')
    .from('agents')
    .update({ is_draft: false, schedule_enabled: false })
    .eq('id', draftId);
  if (error) return { ok: false, error: error.message };
  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_draft_activate',
    target_table: 'agents',
    target_id: draftId,
    before_value: { is_draft: true },
    after_value: { is_draft: false, schedule_enabled: false },
  });
  revalidatePath('/agentos/agents');
  return { ok: true, data: { id: draftId } };
}

export async function discardDraft(
  draftId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const claims = await requireAdmin('/agentos/agents/new');
  const sb = await createClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .schema('agentos')
    .from('agents')
    .update({ deleted_at: now })
    .eq('id', draftId)
    .eq('is_draft', true)
    .is('deleted_at', null);
  if (error) return { ok: false, error: error.message };
  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_draft_discard',
    target_table: 'agents',
    target_id: draftId,
    before_value: { is_draft: true },
    after_value: { deleted_at: now },
  });
  revalidatePath('/agentos/agents');
  return { ok: true };
}

export async function createDraftFromTemplate(
  slug: TemplateSlug,
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const templateMap: Record<TemplateSlug, typeof cooTemplate> = {
    'coo-daily-report': cooTemplate,
    'content-drafter': contentDrafterTemplate as unknown as typeof cooTemplate,
    'task-summarizer': taskSummarizerTemplate as unknown as typeof cooTemplate,
  };
  const template = templateMap[slug];
  if (!template) return { ok: false, error: 'template_not_found' };
  const claims = await requireAdmin('/agentos/agents/new');
  const sb = await createClient();
  const f = template.fields as Record<string, unknown>;
  const { data, error } = await sb
    .schema('agentos')
    .from('agents')
    .insert({
      owner_id: claims.sub,
      name: (f.name as string) || template.name,
      department: (template.department as Department),
      system_prompt: (f.system_prompt as string) || '',
      autonomy_level: (f.autonomy_level as AutonomyLevel) || 'semi_autonomous',
      model_tier: (f.model_tier as ModelTier) || 'sonnet',
      max_turns: (f.max_turns as number) || 25,
      budget_cap_usd: (f.budget_cap_usd as number) || 1.0,
      sensitive_tools: (f.sensitive_tools as string[]) || [],
      denylist_globs: (f.denylist_globs as string[]) || [],
      required_mcp_servers: (f.required_mcp_servers as string[]) || [],
      schedule_cron: (f.schedule_cron as string) || null,
      schedule_timezone: (f.schedule_timezone as string) || 'America/Mexico_City',
      status: 'active',
      is_draft: true,
      config: {
        suggested_tool_permissions: f.suggested_tool_permissions || {},
        schedule_preset: f.schedule_preset || '',
      },
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  await sb.schema('agentos').from('audit_logs').insert({
    user_id: claims.sub,
    action: 'agent_draft_create',
    target_table: 'agents',
    target_id: data!.id,
    before_value: null,
    after_value: { template_slug: slug, is_draft: true },
  });
  return { ok: true, data: { id: data!.id as string } };
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
 *
 * Plan 08-05: extended with optional `options` argument to support:
 *   - trigger_type: 'manual' | 'chat' | 'test_run' (defaults to 'manual')
 *   - parent_thread_id: linked-list chat thread continuity (Pitfall 2 avoidance)
 *
 * All EXISTING callers of triggerRun(agentId, input) continue to work because
 * `options` is optional and defaults to manual trigger with no parent_thread_id.
 */
export async function triggerRun(
  agentId: string,
  input: Record<string, unknown> = {},
  options: {
    trigger_type?: 'manual' | 'chat' | 'test_run';
    parent_thread_id?: string | null;
  } = {},
) {
  const claims = await requireAgentosRole(`/agentos/agents/${agentId}`);
  const sb = await createClient();

  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { ok: false as const, error: 'no_session' };
  }

  const triggerType = options.trigger_type ?? 'manual';

  const dispatchBody: Record<string, unknown> = {
    agent_id: agentId,
    input,
    trigger_type: triggerType,
  };
  // Include parent_thread_id only when explicitly provided (undefined = omit, null = clear)
  if (options.parent_thread_id !== undefined) {
    dispatchBody.parent_thread_id = options.parent_thread_id;
  }

  const resp = await fetch(`${ORCHESTRATOR_URL}/runs/dispatch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dispatchBody),
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
      after_value: { agent_id: agentId, input, trigger_type: triggerType },
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
