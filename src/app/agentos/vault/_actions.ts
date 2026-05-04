'use server';
/**
 * Phase 4 / Plan 04-05 — Vault Server Actions.
 *
 * Action shape (locked from Phase 3): { ok: true, data?: T } | { ok: false, error: string }.
 * Every action writes to agentos.audit_logs with values from the Plan 04-01 enum extension:
 *   vault_file_create, vault_file_update, vault_file_delete, vault_file_upload.
 *
 * NOTE: audit_logs schema uses column name `action` (not `action_type`) — matches
 * Phase 3 _actions.ts pattern in agents/_actions.ts. Plan-supplied draft used
 * `action_type` which is wrong; corrected at executor time (Rule 1 deviation).
 */
import { revalidatePath } from 'next/cache';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requireAgentosRole, requireAdmin } from '@/lib/supabase/agentos';

type Scope = 'company' | 'project' | 'agent';

export interface CreateVaultFileInput {
  path: string;            // '/reports/2026-05-04.md' — must start with /
  name: string;
  scope: Scope;
  project_id?: string | null;
  agent_id?: string | null;
  content: string;         // Markdown text
  is_sensitive?: boolean;
}

function validateCreate(input: CreateVaultFileInput): string | null {
  if (!input.path || !input.path.startsWith('/')) return 'Path must start with /';
  if (input.path.length > 500) return 'Path must be 500 chars or fewer';
  if (!input.name || input.name.length < 1 || input.name.length > 200) return 'Name must be 1-200 characters';
  if (!['company', 'project', 'agent'].includes(input.scope)) return 'Invalid scope';
  if (input.scope === 'project' && !input.project_id) return 'Project scope requires a project_id';
  if (input.scope === 'agent' && !input.agent_id) return 'Agent scope requires an agent_id';
  if (input.content.length > 1_000_000) return 'Content exceeds 1 MB limit';
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
      target_table: 'vault_files',
      target_id,
      before_value: before,
      after_value: after,
    });
  } catch {
    /* audit failures must never fail the action */
  }
}

export async function createVaultFile(
  input: CreateVaultFileInput,
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const claims = await requireAgentosRole('/agentos/vault');
  if (claims.app_role === 'viewer') return { ok: false, error: 'Viewers cannot create vault files' };

  const err = validateCreate(input);
  if (err) return { ok: false, error: err };

  const service = _serviceClient();

  // Compute content_sha256
  const enc = new TextEncoder().encode(input.content);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  const sha256 = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Storage key: scope-prefixed
  const storageKey =
    input.scope === 'agent'
      ? `agent/${input.agent_id}${input.path}`
      : input.scope === 'project'
        ? `project/${input.project_id}${input.path}`
        : `company${input.path}`;

  // Upload via service-role (bypasses RLS — orchestrator path mirrors Modal vault.persist)
  const { error: upErr } = await service.storage
    .from('vault')
    .upload(storageKey, enc, {
      contentType: 'text/markdown',
      upsert: true,
    });
  if (upErr) return { ok: false, error: `Storage upload failed: ${upErr.message}` };

  // W3 fix (checker iter-1): use service-role for vault_files insert so non-admin users can
  // create agent-scoped files without hitting Plan 04-01's vault_files_insert_member_or_admin
  // RLS (which permits agent-scope inserts only for admin). RBAC is already enforced above
  // via requireAgentosRole + viewer guard; service-role mirrors the Storage upload pattern.
  const { data, error } = await service
    .schema('agentos')
    .from('vault_files')
    .insert({
      path: input.path,
      name: input.name,
      scope: input.scope,
      project_id: input.scope === 'project' ? input.project_id : null,
      agent_id: input.scope === 'agent' ? input.agent_id : null,
      storage_object_id: storageKey,
      content_sha256: sha256,
      size_bytes: enc.byteLength,
      is_sensitive: !!input.is_sensitive,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };

  // vault_history entry via service-role (RLS only allows service-role writes)
  await service.schema('agentos').from('vault_history').insert({
    vault_file_id: data.id,
    storage_object_id: storageKey,
    size_bytes: enc.byteLength,
    content_sha256: sha256,
    edited_by: claims.sub,
  });

  await _audit(
    claims.sub,
    'vault_file_create',
    data.id,
    null,
    { path: input.path, scope: input.scope },
  );
  revalidatePath('/agentos/vault');
  return { ok: true, data: { id: data.id } };
}

export async function updateVaultFile(
  id: string,
  content: string,
  is_sensitive?: boolean,
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const claims = await requireAgentosRole(`/agentos/vault/${id}`);
  if (claims.app_role === 'viewer') return { ok: false, error: 'Viewers cannot edit vault files' };

  const supabase = await createClient();
  const service = _serviceClient();

  // Read current row (RLS-checked)
  const { data: current, error: rErr } = await supabase
    .schema('agentos')
    .from('vault_files')
    .select('id, storage_object_id, scope, project_id, agent_id, path, content_sha256, is_sensitive')
    .eq('id', id)
    .single();
  if (rErr || !current) return { ok: false, error: rErr?.message ?? 'File not found' };

  const enc = new TextEncoder().encode(content);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  const sha256 = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const storageKey = current.storage_object_id;
  if (!storageKey) return { ok: false, error: 'File has no storage object id' };

  const { error: upErr } = await service.storage
    .from('vault')
    .upload(storageKey, enc, { contentType: 'text/markdown', upsert: true });
  if (upErr) return { ok: false, error: `Storage upload failed: ${upErr.message}` };

  const updatePayload: Record<string, unknown> = {
    content_sha256: sha256,
    size_bytes: enc.byteLength,
  };
  if (is_sensitive !== undefined) updatePayload.is_sensitive = is_sensitive;

  const { error: updErr } = await service
    .schema('agentos')
    .from('vault_files')
    .update(updatePayload)
    .eq('id', id);
  if (updErr) return { ok: false, error: updErr.message };

  await service.schema('agentos').from('vault_history').insert({
    vault_file_id: id,
    storage_object_id: storageKey,
    size_bytes: enc.byteLength,
    content_sha256: sha256,
    edited_by: claims.sub,
  });

  await _audit(
    claims.sub,
    'vault_file_update',
    id,
    { content_sha256: current.content_sha256, is_sensitive: current.is_sensitive },
    { content_sha256: sha256, is_sensitive: is_sensitive ?? current.is_sensitive },
  );
  revalidatePath('/agentos/vault');
  revalidatePath(`/agentos/vault/${id}`);
  return { ok: true, data: { id } };
}

export async function softDeleteVaultFile(
  id: string,
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const claims = await requireAdmin(`/agentos/vault/${id}`);

  const service = _serviceClient();
  const now = new Date().toISOString();
  const { error } = await service
    .schema('agentos')
    .from('vault_files')
    .update({ deleted_at: now })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await _audit(
    claims.sub,
    'vault_file_delete',
    id,
    null,
    { deleted_at: now },
  );
  revalidatePath('/agentos/vault');
  return { ok: true, data: { id } };
}

export async function uploadVaultDocument(
  formData: FormData,
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const claims = await requireAgentosRole('/agentos/vault');
  if (claims.app_role === 'viewer') return { ok: false, error: 'Viewers cannot upload' };

  const file = formData.get('file') as File | null;
  const scope = (formData.get('scope') as Scope) ?? 'company';
  const project_id = formData.get('project_id') as string | null;
  const agent_id = formData.get('agent_id') as string | null;
  const is_sensitive = formData.get('is_sensitive') === 'on';

  if (!file) return { ok: false, error: 'No file provided' };
  if (file.size === 0) return { ok: false, error: 'File is empty' };
  if (file.size > 50 * 1024 * 1024) return { ok: false, error: 'File exceeds 50 MB limit' };

  const allowed = ['text/plain', 'text/markdown', 'application/pdf', 'text/x-markdown'];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type}. Allowed: PDF, MD, TXT.` };
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const path = `/uploads/${file.name}`;
  const storageKey =
    scope === 'agent'
      ? `agent/${agent_id}${path}`
      : scope === 'project'
        ? `project/${project_id}${path}`
        : `company${path}`;

  const service = _serviceClient();

  const { error: upErr } = await service.storage
    .from('vault')
    .upload(storageKey, bytes, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: `Storage upload failed: ${upErr.message}` };

  // W3 fix (checker iter-1): use service-role for vault_files insert so non-admin users can
  // upload agent-scoped docs without hitting Plan 04-01's vault_files_insert_member_or_admin
  // RLS (which permits agent-scope inserts only for admin). RBAC is already enforced above
  // via requireAgentosRole + viewer guard; service-role client mirrors the Storage upload pattern.
  const { data, error } = await service
    .schema('agentos')
    .from('vault_files')
    .insert({
      path,
      name: file.name,
      scope,
      project_id: scope === 'project' ? project_id : null,
      agent_id: scope === 'agent' ? agent_id : null,
      storage_object_id: storageKey,
      content_sha256: sha256,
      size_bytes: file.size,
      is_sensitive,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };

  await service.schema('agentos').from('vault_history').insert({
    vault_file_id: data.id,
    storage_object_id: storageKey,
    size_bytes: file.size,
    content_sha256: sha256,
    edited_by: claims.sub,
  });

  await _audit(
    claims.sub,
    'vault_file_upload',
    data.id,
    null,
    { path, type: file.type, size: file.size },
  );
  revalidatePath('/agentos/vault');
  return { ok: true, data: { id: data.id } };
}
