'use server';
/**
 * Phase 6 / Plan 06-02b — Drafts Server Actions.
 *
 * sendDraft proxies to the orchestrator (single source of truth for the
 * Modal dispatch + sidecar update). discardDraft writes the sidecar directly
 * via the service-role client (no orchestrator coordination needed — discard
 * is a UI-local soft-delete).
 *
 * Action shape (locked from Phase 3): { ok: true; data?: T } | { ok: false; error: string }.
 *
 * audit_logs.action is the column name (recurring drift fixed in Phase 4/5 SUMMARYs).
 * Enum value 'draft_discard' lives in
 * supabase/migrations/20260506_120300_drafts_audit_enum.sql.
 */
import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/agentos';

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? '';

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function _adminAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function _serviceRoleClient() {
  // Inline service-role factory — Phase 4 plans noted createServiceRoleClient is
  // not exported from lib/supabase/server.ts; compose directly with createServerClient
  // and the SERVICE_ROLE key. RLS is bypassed; route-level requireAdmin is the gate.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // service-role client never sets cookies
        },
      },
    },
  );
}

/**
 * Dispatch a single-tool Modal run from a persisted draft.
 *
 * Calls POST /runs/{runId}/drafts/{draftId}/send on the orchestrator with the
 * admin's access token. The orchestrator inserts the new agent_runs row and
 * updates the sidecar — this Server Action only proxies.
 */
export async function sendDraft(
  runId: string,
  draftId: string,
  modifiedInput?: Record<string, unknown>,
): Promise<ActionResult<{ new_run_id: string; draft_id: string }>> {
  await requireAdmin(`/agentos/runs/${runId}/drafts`);
  if (!ORCHESTRATOR_URL) {
    return { ok: false, error: 'ORCHESTRATOR_URL env var missing' };
  }
  const token = await _adminAccessToken();
  if (!token) {
    return { ok: false, error: 'No admin session token' };
  }

  try {
    const url = `${ORCHESTRATOR_URL.replace(/\/$/, '')}/runs/${encodeURIComponent(runId)}/drafts/${encodeURIComponent(draftId)}/send`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        modifiedInput ? { modified_input: modifiedInput } : {},
      ),
      cache: 'no-store',
    });

    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      /* non-JSON */
    }

    if (res.status !== 200) {
      const detail =
        (parsed as { detail?: string } | null)?.detail ??
        `orchestrator returned ${res.status}`;
      return { ok: false, error: detail };
    }
    revalidatePath(`/agentos/runs/${runId}/drafts`);
    revalidatePath(`/agentos/runs/${runId}`);
    return {
      ok: true,
      data: parsed as { new_run_id: string; draft_id: string },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

/**
 * Mark a draft as discarded in the sidecar _meta.json.
 *
 * Soft-delete — the draft file stays on Storage; only the sidecar entry's
 * discarded_at timestamp is set. The drafts viewer reads the sidecar and
 * renders Discarded status accordingly.
 */
export async function discardDraft(
  runId: string,
  draftId: string,
): Promise<ActionResult<{ draft_id: string }>> {
  const claims = await requireAdmin(`/agentos/runs/${runId}/drafts`);
  const supabase = _serviceRoleClient();

  // 1. Read sidecar.
  const { data: blob, error: dlError } = await supabase.storage
    .from('vault')
    .download(`drafts/${runId}/_meta.json`);
  if (dlError || !blob) {
    return { ok: false, error: 'No drafts metadata for this run' };
  }
  let meta: { drafts: Record<string, Record<string, unknown>> };
  try {
    meta = JSON.parse(await blob.text());
  } catch {
    return { ok: false, error: 'Drafts metadata is corrupted' };
  }
  if (!meta.drafts || !meta.drafts[draftId]) {
    return { ok: false, error: 'Draft not found' };
  }

  // 2. Set discarded_at.
  meta.drafts[draftId].discarded_at = new Date().toISOString();
  const newBody = new Blob([JSON.stringify(meta, null, 2)], {
    type: 'application/json',
  });
  const { error: upError } = await supabase.storage
    .from('vault')
    .update(`drafts/${runId}/_meta.json`, newBody, {
      upsert: true,
      contentType: 'application/json',
    });
  if (upError) {
    return { ok: false, error: upError.message };
  }

  // 3. Audit log — column is `action`. Enum value is 'draft_discard' (added in
  // supabase/migrations/20260506_120300_drafts_audit_enum.sql).
  await supabase
    .schema('agentos')
    .from('audit_logs')
    .insert({
      user_id: claims.sub,
      action: 'draft_discard',
      target_table: 'agent_runs',
      target_id: runId,
      after_value: { draft_id: draftId },
      metadata: { source_run_id: runId },
    });

  revalidatePath(`/agentos/runs/${runId}/drafts`);
  revalidatePath(`/agentos/runs/${runId}`);
  return { ok: true, data: { draft_id: draftId } };
}
