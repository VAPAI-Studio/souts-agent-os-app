'use server';
/**
 * Server Actions for the /agentos/tools (Tool Registry) page.
 *
 * disconnectIntegrationAction: flips every connected tool_connections row for
 * one integration to status='disconnected' + stamps disconnected_at. Writes
 * directly to Supabase (same posture as settings/_actions.ts — no orchestrator
 * round-trip). The orchestrator also exposes DELETE /connections/{integration}
 * for programmatic use; this action is the UI path.
 *
 * Admin-only via requireAdmin(). Deliberately single-integration only — there
 * is no "disconnect all" so the COO/CMO can't be blinded in one click.
 */
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';

// Integrations the operator may disconnect from the UI. Guards against a stray
// key being passed in. Mirrors the orchestrator's _DISCONNECTABLE_INTEGRATIONS.
const DISCONNECTABLE = new Set<string>([
  'google_calendar',
  'google_drive',
  'gmail',
  'granola',
  'notion',
  'slack',
  'slack_cmo',
]);

export async function disconnectIntegrationAction(
  integration: string,
): Promise<{ ok: true; disconnected: number } | { ok: false; error: string }> {
  try {
    const claims = await requireAdmin('/agentos/tools');

    if (!DISCONNECTABLE.has(integration)) {
      return { ok: false, error: `Unknown integration '${integration}'` };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .schema('agentos')
      .from('tool_connections')
      .update({
        status: 'disconnected',
        disconnected_at: new Date().toISOString(),
      })
      .eq('integration', integration)
      .eq('status', 'connected')
      .select('id');

    if (error) return { ok: false, error: error.message };

    const disconnected = (data ?? []).length;

    // Audit log — column is `action` (NOT action_type — same Pitfall 6 as settings).
    try {
      await supabase.schema('agentos').from('audit_logs').insert({
        user_id: claims.sub,
        action: 'tool_connection_disconnect',
        target_table: 'tool_connections',
        target_id: null,
        metadata: { integration, disconnected_count: disconnected },
      });
    } catch {
      // Audit failures must never block the disconnect (same posture as other actions).
    }

    return { ok: true, disconnected };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, error: msg };
  }
}
