'use server';
/**
 * Phase 4 / Plan 04-06 — Projects Server Actions.
 *
 * PROJ-01..PROJ-04. Action shape locked from Phase 3:
 *   { ok: true, data: T } | { ok: false, error: string }.
 *
 * Phase 1 trigger 20260425_120550_agentos_project_owner_member_trigger automatically
 * inserts a project_members row for the creator on INSERT into projects — we do NOT
 * manually insert that row here.
 *
 * NOTE: audit_logs column is `action` (typed agentos.audit_action_type), NOT `action_type`.
 * Plan 04-05 fixed this for vault Server Actions; we follow the same convention here. The
 * enum values used (project_create / project_update / project_delete /
 * project_member_assign_agent) all come from Plan 04-01's audit_action_type extension.
 */
import { revalidatePath } from 'next/cache';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requireAgentosRole, requireAdmin } from '@/lib/supabase/agentos';

type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';
const VALID_STATUSES: readonly ProjectStatus[] = [
  'active',
  'on_hold',
  'completed',
  'archived',
];

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
}

function validateCreate(input: CreateProjectInput): string | null {
  if (!input.name || input.name.length < 1 || input.name.length > 200) {
    return 'Name must be 1-200 characters';
  }
  if (input.description && input.description.length > 5000) {
    return 'Description exceeds 5000 character limit';
  }
  if (input.status && !VALID_STATUSES.includes(input.status)) {
    return 'Invalid status';
  }
  return null;
}

function _serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function _audit(
  user_id: string,
  action: string,
  target_id: string,
  before: unknown,
  after: unknown,
) {
  try {
    const sb = _serviceClient();
    await sb.schema('agentos').from('audit_logs').insert({
      user_id,
      action,
      target_table: 'projects',
      target_id,
      before_value: before,
      after_value: after,
    });
  } catch {
    /* never fail action on audit failure */
  }
}

export async function createProject(
  input: CreateProjectInput,
): Promise<
  { ok: true; data: { id: string } } | { ok: false; error: string }
> {
  const claims = await requireAgentosRole('/agentos/projects');
  if (claims.app_role === 'viewer') {
    return { ok: false, error: 'Viewers cannot create projects' };
  }

  const err = validateCreate(input);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const insertPayload = {
    name: input.name,
    description: input.description ?? null,
    owner_id: claims.sub,
    status: input.status ?? 'active',
  };
  const { data, error } = await supabase
    .schema('agentos')
    .from('projects')
    .insert(insertPayload)
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Insert failed' };
  }

  await _audit(claims.sub, 'project_create', data.id, null, insertPayload);
  revalidatePath('/agentos/projects');
  return { ok: true, data: { id: data.id as string } };
}

export async function updateProject(
  id: string,
  patch: { name?: string; description?: string; status?: ProjectStatus },
): Promise<
  { ok: true; data: { id: string } } | { ok: false; error: string }
> {
  const claims = await requireAgentosRole(`/agentos/projects/${id}`);
  if (claims.app_role === 'viewer') {
    return { ok: false, error: 'Viewers cannot edit projects' };
  }

  if (patch.name && (patch.name.length < 1 || patch.name.length > 200)) {
    return { ok: false, error: 'Name must be 1-200 characters' };
  }
  if (patch.status && !VALID_STATUSES.includes(patch.status)) {
    return { ok: false, error: 'Invalid status' };
  }

  const supabase = await createClient();

  const { data: before } = await supabase
    .schema('agentos')
    .from('projects')
    .select('name, description, status')
    .eq('id', id)
    .single();

  const updatePayload: Record<string, unknown> = {};
  if (patch.name !== undefined) updatePayload.name = patch.name;
  if (patch.description !== undefined)
    updatePayload.description = patch.description;
  if (patch.status !== undefined) updatePayload.status = patch.status;

  const { error } = await supabase
    .schema('agentos')
    .from('projects')
    .update(updatePayload)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await _audit(claims.sub, 'project_update', id, before, patch);
  revalidatePath('/agentos/projects');
  revalidatePath(`/agentos/projects/${id}`);
  return { ok: true, data: { id } };
}

export async function softDeleteProject(
  id: string,
): Promise<
  { ok: true; data: { id: string } } | { ok: false; error: string }
> {
  const claims = await requireAdmin(`/agentos/projects/${id}`);
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .schema('agentos')
    .from('projects')
    .update({ deleted_at: now })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  await _audit(claims.sub, 'project_delete', id, null, { deleted_at: now });
  revalidatePath('/agentos/projects');
  return { ok: true, data: { id } };
}

export async function assignAgentToProject(
  agent_id: string,
  project_id: string | null,
): Promise<
  { ok: true; data: { agent_id: string } } | { ok: false; error: string }
> {
  // PROJ-02: requires admin OR agent_owner of the agent.
  const claims = await requireAgentosRole(
    `/agentos/projects/${project_id ?? 'null'}`,
  );
  if (claims.app_role === 'viewer') {
    return { ok: false, error: 'Viewers cannot assign agents' };
  }

  const supabase = await createClient();

  // Fetch before-state.
  const { data: before } = await supabase
    .schema('agentos')
    .from('agents')
    .select('id, project_id, owner_id')
    .eq('id', agent_id)
    .single();
  if (!before) return { ok: false, error: 'Agent not found' };

  if (claims.app_role !== 'admin' && before.owner_id !== claims.sub) {
    return {
      ok: false,
      error: 'Only admin or the agent owner can assign agents',
    };
  }

  const { error } = await supabase
    .schema('agentos')
    .from('agents')
    .update({ project_id })
    .eq('id', agent_id);
  if (error) return { ok: false, error: error.message };

  await _audit(
    claims.sub,
    'project_member_assign_agent',
    agent_id,
    { project_id: before.project_id },
    { project_id },
  );
  if (project_id) revalidatePath(`/agentos/projects/${project_id}`);
  if (before.project_id) revalidatePath(`/agentos/projects/${before.project_id}`);
  return { ok: true, data: { agent_id } };
}
