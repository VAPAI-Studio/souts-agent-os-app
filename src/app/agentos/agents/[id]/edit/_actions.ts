'use server';
/**
 * Phase 6 / Plan 06-02 — Server Actions for the Agent Edit Tools section.
 *
 * These actions live alongside the existing `agents/_actions.ts` file (which
 * holds createAgent / updateAgent / triggerRun / etc.). They are split into
 * this `[id]/edit/_actions.ts` location to match the import path used by the
 * ToolPermissionsSection client component in `_components/`.
 *
 * Both actions return either {ok: true} or {ok: false, error: string}.
 *
 * Audit log column drift note: agentos.audit_logs uses `action` as the column
 * name (typed agentos.audit_action_type). Do NOT use `action_type` — that is
 * the type name, not the column name. Recurring drift fixed in Plans 04-05
 * and 04-06; preserved here for pattern continuity.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdminOrOwner } from '@/lib/supabase/agentos';

type Result = { ok: true } | { ok: false; error: string };

interface PermissionRow {
  tool_name: string;
  level: string;
}

/**
 * Upsert all per-tool permissions for the given agent. Admin or owner can call.
 *
 * Each row in `rows` becomes one INSERT or UPDATE on agent_tool_permissions
 * keyed by composite PK (agent_id, tool_name). set_by is filled with the
 * caller's auth UID; set_at defaults to now() but we set it explicitly for
 * audit traceability.
 */
export async function saveToolPermissions(
  agentId: string,
  rows: PermissionRow[],
): Promise<Result> {
  const sb = await createClient();
  // Confirm agent ownership before granting write access. Admin or owner.
  const { data: agent } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, owner_id')
    .eq('id', agentId)
    .single();
  if (!agent) return { ok: false, error: 'agent_not_found' };

  const claims = await requireAdminOrOwner(
    `/agentos/agents/${agentId}/edit`,
    agent.owner_id,
  );

  const now = new Date().toISOString();
  const upsertRows = rows.map((r) => ({
    agent_id: agentId,
    tool_name: r.tool_name,
    level: r.level,
    set_by: claims.sub,
    set_at: now,
  }));

  const { error } = await sb
    .schema('agentos')
    .from('agent_tool_permissions')
    .upsert(upsertRows, { onConflict: 'agent_id,tool_name' });
  if (error) return { ok: false, error: error.message };

  // Audit log — column name is `action` (NOT action_type). Recurring drift.
  try {
    await sb.schema('agentos').from('audit_logs').insert({
      user_id: claims.sub,
      action: 'permission_change',
      target_table: 'agent_tool_permissions',
      target_id: agentId,
      before_value: null,
      after_value: { row_count: rows.length, agent_id: agentId },
    });
  } catch {
    // Audit failures must not block the save; swallow.
  }

  revalidatePath(`/agentos/agents/${agentId}/edit`);
  revalidatePath(`/agentos/agents/${agentId}`);
  return { ok: true };
}

/**
 * Bulk-set every tool in `toolNames` to the same level for one agent.
 *
 * Caller (UI) passes the integration's tool list from REGISTRY when the user
 * picks "Set all Slack tools to: read_only". This is sugar over saveToolPermissions
 * — it constructs the rows then delegates.
 */
export async function bulkSetIntegrationPermissions(
  agentId: string,
  toolNames: string[],
  level: string,
): Promise<Result> {
  const rows = toolNames.map((tool_name) => ({ tool_name, level }));
  return saveToolPermissions(agentId, rows);
}
