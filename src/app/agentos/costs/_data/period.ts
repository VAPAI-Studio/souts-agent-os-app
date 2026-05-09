/**
 * Phase 9 / Plan 09-02 — Pure period helper for the costs dashboard.
 *
 * No Supabase, no I/O, no date-fns. All date math is native Date + ISO strings.
 *
 * PeriodResolved is the canonical period descriptor consumed by all cost
 * fetchers and the client-side period selector. CostPageClient reconstructs
 * the resolved period on every user selection by calling one of the four
 * exported factory functions.
 */

export type PeriodId = 'today' | 'week' | 'month' | 'custom';

export interface PeriodResolved {
  id: PeriodId;
  startUtc: string; // ISO 8601, UTC midnight
  endUtc: string;   // ISO 8601, current moment OR custom end (23:59:59.999Z)
  label: string;    // "Today" | "This week" | "This month" | "May 1 – May 8"
}

/** Returns the UTC midnight ISO string for a given date. */
function utcMidnight(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/**
 * "Today" — UTC midnight → now.
 *
 * @param now  Optional override for testability. Defaults to current time.
 */
export function todayUtc(now: Date = new Date()): PeriodResolved {
  return {
    id: 'today',
    startUtc: utcMidnight(now),
    endUtc: now.toISOString(),
    label: 'Today',
  };
}

/**
 * "This week" — Monday 00:00 UTC → now.
 *
 * Uses (getUTCDay() + 6) % 7 to map Sunday=0 to index 6, Monday=1 to index 0.
 * This ensures Monday is always considered the start of the week.
 *
 * @param now  Optional override for testability. Defaults to current time.
 */
export function thisWeekUtc(now: Date = new Date()): PeriodResolved {
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // Monday=0, Sunday=6
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek),
  );
  return {
    id: 'week',
    startUtc: monday.toISOString(),
    endUtc: now.toISOString(),
    label: 'This week',
  };
}

/**
 * "This month" — day-1 00:00 UTC → now.
 *
 * @param now  Optional override for testability. Defaults to current time.
 */
export function thisMonthUtc(now: Date = new Date()): PeriodResolved {
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    id: 'month',
    startUtc: firstOfMonth.toISOString(),
    endUtc: now.toISOString(),
    label: 'This month',
  };
}

/**
 * Format a YYYY-MM-DD string as a short "Month D" label (e.g., "May 1").
 * Does NOT import date-fns.
 */
function shortDate(yyyyMmDd: string): string {
  const [year, month, day] = yyyyMmDd.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * "Custom range" — YYYY-MM-DD start → YYYY-MM-DD end (inclusive).
 *
 * Produces startUtc = `{date}T00:00:00.000Z` and endUtc = `{date}T23:59:59.999Z`.
 * Does NOT validate the range — call `validateCustomRange` before calling this.
 */
export function customRange(start: string, end: string): PeriodResolved {
  return {
    id: 'custom',
    startUtc: `${start}T00:00:00.000Z`,
    endUtc: `${end}T23:59:59.999Z`,
    label: `${shortDate(start)} – ${shortDate(end)}`,
  };
}

/**
 * Validate a custom range.
 *
 * Rules:
 *  1. end must be >= start
 *  2. span must be <= 90 days (inclusive: endDate - startDate <= 89 days)
 *
 * Returns `{ ok: true }` or `{ ok: false; error: string }`.
 */
export function validateCustomRange(
  start: string,
  end: string,
): { ok: true } | { ok: false; error: string } {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime();

  if (endMs < startMs) {
    return { ok: false, error: 'End date must be on or after start date' };
  }

  // Inclusive span in days: diff / ms_per_day gives number of days between start and end.
  // A 90-day INCLUSIVE range means the end date is 89 days after the start.
  const diffDays = Math.floor((endMs - startMs) / 86_400_000);
  if (diffDays > 89) {
    return { ok: false, error: 'Custom range cannot exceed 90 days' };
  }

  return { ok: true };
}
