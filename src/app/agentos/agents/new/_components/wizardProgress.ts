/**
 * Wizard progress helper — computes which is the highest step the user has
 * completed based on the current draft row. Used by all 6 step page.tsx files.
 *
 * Plan 08-02 / Phase 8
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeMaxCompletedStep(draft: Record<string, any>): number {
  // Step 1 complete when name and department are both non-empty
  if (!draft.name || !draft.department) return 0;

  // Step 2: role_summary in config (any non-empty string)
  const role = (draft.config as Record<string, unknown> | null)?.role_summary;
  if (!role) return 1;

  // Step 3: system_prompt non-empty
  if (!draft.system_prompt || (draft.system_prompt as string).trim().length === 0) return 2;

  // Step 4: context sources — arrays may be empty by design; step is considered
  // complete after step 3 is satisfied (user can skip context sources)
  // Step 5: tools/permissions — considered complete if required_mcp_servers
  // is populated OR the user explicitly set config.tools_skipped
  const toolsSkipped = (draft.config as Record<string, unknown> | null)?.tools_skipped;
  const hasMcpServers = Array.isArray(draft.required_mcp_servers) && draft.required_mcp_servers.length > 0;
  if (!hasMcpServers && !toolsSkipped) return 4;

  // Step 6: autonomy fields complete
  if (!draft.autonomy_level || !draft.model_tier || draft.max_turns < 1 || draft.budget_cap_usd <= 0) {
    return 5;
  }

  // Step 7: schedule configured OR explicitly skipped
  const scheduleSkipped = (draft.config as Record<string, unknown> | null)?.schedule_skipped;
  if (!draft.schedule_cron && !scheduleSkipped) return 6;

  return 7;
}
