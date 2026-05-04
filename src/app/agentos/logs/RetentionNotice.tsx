import * as React from 'react';

/**
 * Plan 03-05 / LOG-05: 90-day retention banner displayed at the top of /agentos/logs.
 *
 * Implementation of the cron job is deferred to Phase 6+ (Vercel Cron infra fully
 * exercised by then). Policy lives at .planning/notes/2026-05-04-90day-retention-policy.md.
 *
 * Uses Plan 03.1 design tokens — no inline styles, no hex literals.
 */
export function RetentionNotice() {
  return (
    <div
      data-testid="retention-notice"
      role="note"
      className="rounded border border-warning/20 bg-warning-subtle px-md py-sm text-[13px] font-sans text-text"
    >
      <strong className="font-semibold">Retention policy:</strong>{' '}
      Run logs and tool call logs are retained for 90 days. Older entries will
      be purged by a scheduled cleanup job (Phase 6+).
    </div>
  );
}
