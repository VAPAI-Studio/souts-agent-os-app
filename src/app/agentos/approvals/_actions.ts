'use server';
/**
 * Phase 5 / Plan 05-04 — Approvals Server Actions.
 *
 * These actions DO NOT write Supabase directly. Plan 05-02 made the orchestrator
 * (Railway FastAPI) the single source of truth for approval mutations.
 *
 * Action shape (locked from Phase 3): { ok: true, data?: T } | { ok: false, error: string }.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/agentos';

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? '';

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function _adminAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function _postOrchestrator(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  if (!ORCHESTRATOR_URL) throw new Error('ORCHESTRATOR_URL env var missing');
  const token = await _adminAccessToken();
  if (!token) throw new Error('No admin session token');
  const url = `${ORCHESTRATOR_URL.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  let parsed: unknown = null;
  try { parsed = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: parsed };
}

export async function approveApproval(
  approval_id: string,
  modified_input: Record<string, unknown> | null = null,
): Promise<ActionResult<{ approval_id: string; resumed: boolean }>> {
  await requireAdmin('/agentos/approvals');
  try {
    const { status, body } = await _postOrchestrator(
      `/approvals/${encodeURIComponent(approval_id)}/approve`,
      { modified_input },
    );
    if (status !== 200) {
      const detail = (body as { detail?: string } | null)?.detail ?? `orchestrator returned ${status}`;
      return { ok: false, error: detail };
    }
    revalidatePath('/agentos/approvals');
    revalidatePath(`/agentos/approvals/${approval_id}`);
    return { ok: true, data: body as { approval_id: string; resumed: boolean } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

export async function rejectApproval(
  approval_id: string,
  reason: string | null = null,
): Promise<ActionResult<{ approval_id: string; resumed: boolean }>> {
  await requireAdmin('/agentos/approvals');
  try {
    const { status, body } = await _postOrchestrator(
      `/approvals/${encodeURIComponent(approval_id)}/reject`,
      { reason },
    );
    if (status !== 200) {
      const detail = (body as { detail?: string } | null)?.detail ?? `orchestrator returned ${status}`;
      return { ok: false, error: detail };
    }
    revalidatePath('/agentos/approvals');
    revalidatePath(`/agentos/approvals/${approval_id}`);
    return { ok: true, data: body as { approval_id: string; resumed: boolean } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

export async function editAndApproveApproval(
  approval_id: string,
  modified_input: Record<string, unknown>,
): Promise<ActionResult<{ approval_id: string; resumed: boolean }>> {
  await requireAdmin('/agentos/approvals');
  if (!modified_input || Object.keys(modified_input).length === 0) {
    return { ok: false, error: 'modified_input required for edit-and-approve' };
  }
  try {
    const { status, body } = await _postOrchestrator(
      `/approvals/${encodeURIComponent(approval_id)}/edit-approve`,
      { modified_input },
    );
    if (status !== 200) {
      const detail = (body as { detail?: string } | null)?.detail ?? `orchestrator returned ${status}`;
      return { ok: false, error: detail };
    }
    revalidatePath('/agentos/approvals');
    revalidatePath(`/agentos/approvals/${approval_id}`);
    return { ok: true, data: body as { approval_id: string; resumed: boolean } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}
