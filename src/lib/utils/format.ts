/**
 * Phase 9 / Plan 09-03 — Shared formatting utilities.
 *
 * Extracted from `src/app/agentos/agents/page.tsx:232` (previously inline).
 * This module is shared between agents/page.tsx and dashboard components.
 *
 * Design discipline (Phase 03.1):
 *   - No date-fns dependency (keep it simple; this project uses an inline helper)
 */

/**
 * Format an ISO timestamp as a human-readable relative time string.
 * Matches the inline helper previously at agents/page.tsx:232.
 *
 * Examples:
 *   "in 5m"   — 5 minutes in the future
 *   "5m ago"  — 5 minutes in the past
 *   "in 2d"   — 2 days in the future
 *   "in 14h"  — 14 hours in the future
 *
 * Note: sub-minute differences round to "in 0m" / "0m ago"; acceptable for
 * this dashboard's use case (next-scheduled times are hours away).
 */
export function formatRelativeTime(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const min = Math.floor(abs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const future = ms >= 0;
  if (day > 0) return future ? `in ${day}d` : `${day}d ago`;
  if (hr > 0) return future ? `in ${hr}h` : `${hr}h ago`;
  return future ? `in ${min}m` : `${min}m ago`;
}
