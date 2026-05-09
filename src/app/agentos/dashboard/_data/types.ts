/**
 * Phase 9 / Plan 09-03 — Pure types and constants for the home dashboard
 * activity feed.
 *
 * This module is server-and-client safe — it imports nothing from
 * @/lib/supabase/server (which transitively pulls next/headers and breaks
 * the Turbopack build when imported from a client component).
 *
 * Both home.ts (server fetchers) and ActivityFeed.tsx (client component) import
 * ACTIVITY_ACTIONS + ActivityRow from here so server and client share one
 * source of truth without dragging the supabase server client into the bundle.
 *
 * ENUM STRINGS — verified against
 * supabase/migrations/20260425_120100_agentos_enums.sql:54
 *   - Approval decisions: approval_approve / approval_reject / approval_edit (NO -d suffix)
 *   - Agent status:       agent_pause / agent_resume                          (NO -d suffix)
 *   - Run completions:    agent_run_completed / agent_run_failed
 *   - Budget auto-pause:  agent_auto_paused_budget
 */

export const ACTIVITY_ACTIONS = [
  'agent_run_completed',      // Phase 9 (added by 09-01 migration)
  'agent_run_failed',         // Phase 9 (added by 09-01 migration)
  'approval_approve',         // existing — NO -d suffix
  'approval_reject',          // existing — NO -d suffix
  'approval_edit',            // existing — NO -d suffix
  'agent_pause',              // existing — NO -d suffix
  'agent_resume',             // existing — NO -d suffix
  'agent_auto_paused_budget', // Phase 9 (added by 09-01 migration)
] as const;

export interface ActivityRow {
  id: string;
  category: 'run' | 'approval' | 'agent';
  action: string;
  agent_id: string | null;
  agent_name: string | null;
  run_id: string | null;
  approval_id: string | null;
  cost_usd: number | null;
  status: string | null;
  tool_name: string | null;
  created_at: string;
}
