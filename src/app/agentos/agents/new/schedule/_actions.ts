'use server';
/**
 * Plan 08-04 / Phase 8 — Schedule step Server Action.
 *
 * Persists schedule_cron, schedule_timezone, and computes next_run_at for the
 * draft agent when cron is non-empty. schedule_enabled stays false per
 * CONTEXT.md decision #16 — the wizard captures the schedule preference but does
 * NOT enable auto-runs on activation; user enables from the Edit page after
 * confirming the agent works.
 *
 * After a successful save the wizard advances to Step 8 (Review/Test).
 */
import { CronExpressionParser } from 'cron-parser';
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';

export async function saveScheduleStep(
  draftId: string,
  input: {
    schedule_cron: string; // empty string => no schedule
    schedule_timezone: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const claims = await requireAdmin('/agentos/agents/new/schedule');
  const sb = await createClient();

  // Verify the draft exists and belongs to the caller.
  const { data: draft } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, owner_id, is_draft, deleted_at')
    .eq('id', draftId)
    .maybeSingle();

  if (!draft || draft.deleted_at || !draft.is_draft) {
    return { ok: false, error: 'draft_not_found' };
  }
  if (draft.owner_id !== claims.sub && claims.app_role !== 'admin') {
    return { ok: false, error: 'forbidden' };
  }

  const cron = (input.schedule_cron ?? '').trim();
  const tz =
    (input.schedule_timezone ?? '').trim() || 'America/Mexico_City';

  let next_run_at: string | null = null;
  if (cron) {
    try {
      const interval = CronExpressionParser.parse(cron, { tz });
      next_run_at = interval.next().toDate().toISOString();
    } catch {
      return {
        ok: false,
        error: `Invalid cron expression or timezone: ${cron} / ${tz}`,
      };
    }
  }

  // CRITICAL — schedule_enabled stays false. Per CONTEXT.md decision #16,
  // schedule does NOT auto-enable on activation; user toggles it on Edit page.
  const { error } = await sb
    .schema('agentos')
    .from('agents')
    .update({
      schedule_cron: cron || null,
      schedule_timezone: tz,
      schedule_enabled: false,
      next_run_at,
    })
    .eq('id', draftId)
    .eq('is_draft', true);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
