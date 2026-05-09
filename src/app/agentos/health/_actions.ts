'use server';
/**
 * Phase 9 / Plan 09-05 — Server Actions for the Health page.
 *
 * refreshHealthAction: admin-gated; bypasses the 60s module-level cache
 * and returns a fresh ProbeSnapshot.
 */
import { requireAdmin } from '@/lib/supabase/agentos';
import { forceRefreshSnapshot, type ProbeSnapshot } from './_data/snapshot';

export async function refreshHealthAction(): Promise<{
  ok: true;
  data: ProbeSnapshot;
}> {
  await requireAdmin('/agentos/health');
  const snapshot = await forceRefreshSnapshot();
  return { ok: true, data: snapshot };
}
