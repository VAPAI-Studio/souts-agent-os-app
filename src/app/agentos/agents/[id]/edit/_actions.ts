'use server';
/**
 * Phase 6 / Plan 06-02 + 06-03b — Server Actions for the Agent Edit page.
 *
 * These actions live alongside the existing `agents/_actions.ts` file (which
 * holds createAgent / updateAgent / triggerRun / etc.). They are split into
 * this `[id]/edit/_actions.ts` location to match the import path used by the
 * ToolPermissionsSection + ScheduleSection client components in `_components/`.
 *
 * Each action returns either {ok: true} or {ok: false, error: string}.
 *
 * Audit log column drift note: agentos.audit_logs uses `action` as the column
 * name (typed by the audit-action enum). Recurring drift fixed in Plans 04-05
 * and 04-06; preserved here for pattern continuity.
 */
import { revalidatePath } from 'next/cache';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { CronExpressionParser } from 'cron-parser';
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

  // Audit log — column name is `action` (NOT actionType). Recurring drift.
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

// =============================================================================
// Plan 06-03b — Schedule Server Action
// =============================================================================

interface SaveScheduleInput {
  schedule_cron: string;
  schedule_timezone: string;
  schedule_enabled: boolean;
}

function _serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Persist the schedule fields on an agent row.
 *
 * Defense-in-depth: re-parses the cron expression server-side with cron-parser
 * even though the client form gates the Save button on parse success. Avoids a
 * malicious / out-of-band caller writing an invalid cron that would crash the
 * Railway scheduler at compute_next() call time.
 *
 * When schedule_enabled is true, the FIRST next_run_at is computed here so the
 * scheduler picks the agent up on the very next 5-minute cron tick. When false,
 * next_run_at is set to NULL so the partial index (`schedule_due_idx`) excludes
 * the row.
 */
export async function saveSchedule(
  agentId: string,
  schedule: SaveScheduleInput,
): Promise<Result> {
  const sb = await createClient();
  const { data: agentRow } = await sb
    .schema('agentos')
    .from('agents')
    .select(
      'id, owner_id, schedule_cron, schedule_timezone, schedule_enabled, next_run_at',
    )
    .eq('id', agentId)
    .single();
  if (!agentRow) return { ok: false, error: 'agent_not_found' };

  const claims = await requireAdminOrOwner(
    `/agentos/agents/${agentId}/edit`,
    agentRow.owner_id,
  );

  // Server-side cron + tz validation (defense-in-depth).
  let nextRunAt: string | null = null;
  try {
    const interval = CronExpressionParser.parse(schedule.schedule_cron, {
      tz: schedule.schedule_timezone,
    });
    if (schedule.schedule_enabled) {
      nextRunAt = interval.next().toDate().toISOString();
    }
  } catch {
    return {
      ok: false,
      error: `Invalid cron expression or timezone: ${schedule.schedule_cron} / ${schedule.schedule_timezone}`,
    };
  }

  const before = {
    schedule_cron: agentRow.schedule_cron,
    schedule_timezone: agentRow.schedule_timezone,
    schedule_enabled: agentRow.schedule_enabled,
    next_run_at: agentRow.next_run_at,
  };

  const update = {
    schedule_cron: schedule.schedule_cron,
    schedule_timezone: schedule.schedule_timezone,
    schedule_enabled: schedule.schedule_enabled,
    next_run_at: nextRunAt,
  };

  // Service-role write — same pattern as Plan 04-05 / 04-06 (RBAC enforced
  // above; service role bypasses RLS for the per-agent fields update).
  const service = _serviceClient();
  const { error: updateErr } = await service
    .schema('agentos')
    .from('agents')
    .update(update)
    .eq('id', agentId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Audit — `action: 'schedule_change'` matches the agentos audit-action enum
  // value added in supabase/migrations/20260506_120400_agents_schedule_columns.sql.
  try {
    await service.schema('agentos').from('audit_logs').insert({
      user_id: claims.sub,
      action: 'schedule_change',
      target_table: 'agents',
      target_id: agentId,
      before_value: before,
      after_value: update,
    });
  } catch {
    // audit failures must never fail the save (same posture as other actions).
  }

  revalidatePath(`/agentos/agents/${agentId}`);
  revalidatePath(`/agentos/agents/${agentId}/edit`);
  return { ok: true };
}

// =============================================================================
// Plan 06-03 — Slack channel allowlist + Calendar ID Server Actions
// =============================================================================

/**
 * Persist agents.config.slack_channels for a given agent. Admin or owner only.
 *
 * The runner reads agents.config.slack_channels at run start and feeds it into
 * coo_preflight + slack_channels_allowlist hook. An empty list disables Slack
 * tools for the agent (preflight + hook short-circuit on empty allowlist).
 */
export async function saveSlackChannels(
  agentId: string,
  channelIds: string[],
): Promise<Result> {
  const sb = await createClient();
  const { data: agentRow } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, owner_id, config')
    .eq('id', agentId)
    .single();
  if (!agentRow) return { ok: false, error: 'agent_not_found' };

  const claims = await requireAdminOrOwner(
    `/agentos/agents/${agentId}/edit`,
    agentRow.owner_id,
  );

  const beforeConfig = (agentRow.config ?? {}) as Record<string, unknown>;
  const newConfig = { ...beforeConfig, slack_channels: channelIds };

  const service = _serviceClient();
  const { error: updateErr } = await service
    .schema('agentos')
    .from('agents')
    .update({ config: newConfig })
    .eq('id', agentId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Audit — column is `action` (NOT actionType).
  try {
    await service.schema('agentos').from('audit_logs').insert({
      user_id: claims.sub,
      action: 'agent_config_change',
      target_table: 'agents',
      target_id: agentId,
      before_value: beforeConfig,
      after_value: newConfig,
    });
  } catch {
    // audit failures must never block the save.
  }

  revalidatePath(`/agentos/agents/${agentId}`);
  revalidatePath(`/agentos/agents/${agentId}/edit`);
  return { ok: true };
}

/**
 * Persist agents.config.calendar_id for a given agent. Admin or owner only.
 *
 * Phase 6 legacy — singular calendar_id. Kept for backward compat with any callers
 * that haven't been updated to saveCalendarIds. Phase 7 UI uses saveCalendarIds instead.
 */
export async function saveCalendarId(
  agentId: string,
  calendarId: string,
): Promise<Result> {
  return saveCalendarIds(agentId, calendarId ? [calendarId] : []);
}

/**
 * Phase 7 / Plan 07-01 — Persist agents.config.calendar_ids for a given agent.
 *
 * Writes the full array to agents.config.calendar_ids (jsonb array). Also writes
 * the singular calendar_id field for backward-compat (first ID if present, else null),
 * so Phase 6 runner.py callers that read config.calendar_id still work until they
 * are updated to read config.calendar_ids.
 *
 * The runner reads agents.config.calendar_ids at run start and builds the
 * calendar_ids_allowlist for the calendar_allowlist PreToolUse hook.
 * Empty array disables calendar ID enforcement (all calendar tools requiring an ID
 * will be denied with missing_calendar_id).
 */
export async function saveCalendarIds(
  agentId: string,
  calendarIds: string[],
): Promise<Result> {
  const sb = await createClient();
  const { data: agentRow } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, owner_id, config')
    .eq('id', agentId)
    .single();
  if (!agentRow) return { ok: false, error: 'agent_not_found' };

  const claims = await requireAdminOrOwner(
    `/agentos/agents/${agentId}/edit`,
    agentRow.owner_id,
  );

  const beforeConfig = (agentRow.config ?? {}) as Record<string, unknown>;
  // Sanitize: trim and deduplicate IDs.
  const sanitized = [...new Set(calendarIds.map((id) => id.trim()).filter(Boolean))];
  const newConfig: Record<string, unknown> = {
    ...beforeConfig,
    // Phase 7: primary field — array of calendar IDs.
    calendar_ids: sanitized,
    // Phase 6 backward-compat: singular calendar_id = first entry (or null).
    calendar_id: sanitized.length > 0 ? sanitized[0] : null,
  };

  const service = _serviceClient();
  const { error: updateErr } = await service
    .schema('agentos')
    .from('agents')
    .update({ config: newConfig })
    .eq('id', agentId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Audit — column is `action` (NOT actionType).
  try {
    await service.schema('agentos').from('audit_logs').insert({
      user_id: claims.sub,
      action: 'agent_config_change',
      target_table: 'agents',
      target_id: agentId,
      before_value: beforeConfig,
      after_value: newConfig,
    });
  } catch {
    // audit failures must never block the save.
  }

  revalidatePath(`/agentos/agents/${agentId}`);
  revalidatePath(`/agentos/agents/${agentId}/edit`);
  return { ok: true };
}

// =============================================================================
// Phase 7 / Plan 07-03 — Drive shared-drive allowlist Server Action
// =============================================================================

/**
 * Persist agents.config.drive_shared_drive_ids for a given agent. Admin or owner only.
 *
 * The runner reads agents.config.drive_shared_drive_ids at run start and feeds it into
 * the drive_allowlist PreToolUse hook. Shared drive IDs are opaque strings found in the
 * URL when navigating to a shared drive (e.g., drive.google.com/drive/folders/0AABCD...).
 *
 * Empty array = no shared drives allowed (all Drive file operations will be denied by
 * the My Drive hard block + empty allowlist). Non-empty restricts to the listed shared drives.
 */
export async function saveDriveSharedDrives(
  agentId: string,
  driveIds: string[],
): Promise<Result> {
  const sb = await createClient();
  const { data: agentRow } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, owner_id, config')
    .eq('id', agentId)
    .single();
  if (!agentRow) return { ok: false, error: 'agent_not_found' };

  const claims = await requireAdminOrOwner(
    `/agentos/agents/${agentId}/edit`,
    agentRow.owner_id,
  );

  const beforeConfig = (agentRow.config ?? {}) as Record<string, unknown>;
  // Sanitize: trim and deduplicate drive IDs.
  const sanitizedDriveIds = [...new Set(driveIds.map((id) => id.trim()).filter(Boolean))];
  const newConfig = { ...beforeConfig, drive_shared_drive_ids: sanitizedDriveIds };

  const service = _serviceClient();
  const { error: updateErr } = await service
    .schema('agentos')
    .from('agents')
    .update({ config: newConfig })
    .eq('id', agentId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Audit — column is `action` (NOT actionType).
  try {
    await service.schema('agentos').from('audit_logs').insert({
      user_id: claims.sub,
      action: 'agent_config_change',
      target_table: 'agents',
      target_id: agentId,
      before_value: beforeConfig,
      after_value: newConfig,
    });
  } catch {
    // audit failures must never block the save.
  }

  revalidatePath(`/agentos/agents/${agentId}`);
  revalidatePath(`/agentos/agents/${agentId}/edit`);
  return { ok: true };
}

// =============================================================================
// Phase 7 / Plan 07-02 — Gmail label allowlist Server Action
// =============================================================================

/**
 * Persist agents.config.gmail_label_allowlist for a given agent. Admin or owner only.
 *
 * The runner reads agents.config.gmail_label_allowlist at run start and feeds it into
 * the gmail_label_allowlist PreToolUse hook. An empty array = inbox-implicit (agent
 * can read the entire inbox); non-empty restricts to threads with at least one matching label.
 */
export async function saveGmailLabels(
  agentId: string,
  labels: string[],
): Promise<Result> {
  const sb = await createClient();
  const { data: agentRow } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, owner_id, config')
    .eq('id', agentId)
    .single();
  if (!agentRow) return { ok: false, error: 'agent_not_found' };

  const claims = await requireAdminOrOwner(
    `/agentos/agents/${agentId}/edit`,
    agentRow.owner_id,
  );

  const beforeConfig = (agentRow.config ?? {}) as Record<string, unknown>;
  // Sanitize: trim and deduplicate labels.
  const sanitizedLabels = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];
  const newConfig = { ...beforeConfig, gmail_label_allowlist: sanitizedLabels };

  const service = _serviceClient();
  const { error: updateErr } = await service
    .schema('agentos')
    .from('agents')
    .update({ config: newConfig })
    .eq('id', agentId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Audit — column is `action` (NOT actionType).
  try {
    await service.schema('agentos').from('audit_logs').insert({
      user_id: claims.sub,
      action: 'agent_config_change',
      target_table: 'agents',
      target_id: agentId,
      before_value: beforeConfig,
      after_value: newConfig,
    });
  } catch {
    // audit failures must never block the save.
  }

  revalidatePath(`/agentos/agents/${agentId}`);
  revalidatePath(`/agentos/agents/${agentId}/edit`);
  return { ok: true };
}
