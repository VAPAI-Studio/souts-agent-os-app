'use server';
/**
 * Plan 09-04 — Server Actions for the /agentos/settings page.
 *
 * saveDailyThresholdAction: persists daily_aggregate_alert threshold to
 * agentos.org_settings and writes an audit_log row.
 *
 * Writes directly to org_settings (no orchestrator round-trip) — the orchestrator
 * PUT /settings/daily-aggregate-threshold endpoint stays for programmatic use.
 *
 * Pitfall 6: audit_logs column is `action` (NOT action_type).
 */
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';

const ALERT_SETTINGS_KEY = 'daily_aggregate_alert';

export async function saveDailyThresholdAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const claims = await requireAdmin('/agentos/settings');

    const raw = formData.get('threshold_usd');
    const threshold: number | null =
      raw == null || String(raw).trim() === '' ? null : Number(raw);

    if (threshold !== null && (Number.isNaN(threshold) || threshold < 0)) {
      return { ok: false, error: 'Threshold must be a non-negative number' };
    }

    const supabase = await createClient();

    // Read existing value first to preserve last_alerted_for_date
    const { data: existing } = await supabase
      .schema('agentos')
      .from('org_settings')
      .select('value')
      .eq('key', ALERT_SETTINGS_KEY)
      .maybeSingle();

    const merged = {
      ...((existing?.value as Record<string, unknown>) ?? {}),
      threshold_usd: threshold,
    };

    const { error: upsertErr } = await supabase
      .schema('agentos')
      .from('org_settings')
      .upsert({ key: ALERT_SETTINGS_KEY, value: merged }, { onConflict: 'key' });

    if (upsertErr) return { ok: false, error: upsertErr.message };

    // Audit log — column is `action` (NOT action_type — Pitfall 6).
    // action 'org_settings_update' matches the audit_action_type enum added in Phase 9 migration.
    try {
      await supabase.schema('agentos').from('audit_logs').insert({
        user_id: claims.sub,
        action: 'org_settings_update',
        target_table: 'org_settings',
        target_id: null,
        metadata: { key: ALERT_SETTINGS_KEY, threshold_usd: threshold },
      });
    } catch {
      // Audit failures must never block the save (same posture as other actions).
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, error: msg };
  }
}
