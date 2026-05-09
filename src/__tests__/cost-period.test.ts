/**
 * Phase 9 / Plan 09-02 — Unit tests for period helper functions (period.ts).
 *
 * All functions are pure (no Supabase / no I/O). Tests use constructed Date
 * values passed as `now` argument to keep results deterministic.
 */
import { describe, it, expect } from 'vitest';
import {
  todayUtc,
  thisWeekUtc,
  thisMonthUtc,
  customRange,
  validateCustomRange,
  type PeriodResolved,
} from '../app/agentos/costs/_data/period';

describe('period helpers', () => {
  // ── todayUtc ────────────────────────────────────────────────────────────────

  it('todayUtc returns startUtc = today UTC midnight ISO string', () => {
    const now = new Date('2026-05-08T15:30:00.000Z');
    const result: PeriodResolved = todayUtc(now);
    expect(result.id).toBe('today');
    expect(result.startUtc).toBe('2026-05-08T00:00:00.000Z');
    // endUtc must be >= now (the current moment)
    expect(new Date(result.endUtc).getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000);
    expect(result.label).toBe('Today');
  });

  // ── thisWeekUtc ─────────────────────────────────────────────────────────────

  it('thisWeekUtc returns Monday 00:00 UTC even when called on Sunday', () => {
    // 2026-05-10 is a Sunday
    const now = new Date('2026-05-10T12:00:00.000Z');
    const result: PeriodResolved = thisWeekUtc(now);
    expect(result.id).toBe('week');
    // Monday of that week is 2026-05-04
    expect(result.startUtc).toBe('2026-05-04T00:00:00.000Z');
    expect(result.label).toBe('This week');
  });

  it('thisWeekUtc returns Monday 00:00 UTC when called on Monday', () => {
    // 2026-05-11 is a Monday
    const now = new Date('2026-05-11T09:00:00.000Z');
    const result: PeriodResolved = thisWeekUtc(now);
    expect(result.startUtc).toBe('2026-05-11T00:00:00.000Z');
  });

  // ── thisMonthUtc ─────────────────────────────────────────────────────────────

  it('thisMonthUtc returns day-1 of current month 00:00 UTC', () => {
    const now = new Date('2026-05-08T15:30:00.000Z');
    const result: PeriodResolved = thisMonthUtc(now);
    expect(result.id).toBe('month');
    expect(result.startUtc).toBe('2026-05-01T00:00:00.000Z');
    expect(result.label).toBe('This month');
  });

  // ── customRange ──────────────────────────────────────────────────────────────

  it('customRange preserves input strings as ISO with 00:00 UTC start and 23:59:59.999 UTC end', () => {
    const result: PeriodResolved = customRange('2026-05-01', '2026-05-08');
    expect(result.id).toBe('custom');
    expect(result.startUtc).toBe('2026-05-01T00:00:00.000Z');
    expect(result.endUtc).toBe('2026-05-08T23:59:59.999Z');
    expect(result.label).toContain('May 1');
    expect(result.label).toContain('May 8');
  });

  // ── validateCustomRange ──────────────────────────────────────────────────────

  it('validateCustomRange rejects spans > 90 days with the exact error message', () => {
    const start = '2026-01-01';
    const end = '2026-04-15'; // 104 days
    const result = validateCustomRange(start, end);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Custom range cannot exceed 90 days');
    }
  });

  it('validateCustomRange rejects end < start', () => {
    const result = validateCustomRange('2026-05-08', '2026-05-01');
    expect(result.ok).toBe(false);
  });

  it('validateCustomRange accepts exactly 90 days (inclusive boundary)', () => {
    // 2026-05-01 to 2026-07-29 = 89 days span, but inclusive that's 90 days
    const start = '2026-05-01';
    const end = '2026-07-29'; // exactly 89 days diff = 90-day range inclusive
    const result = validateCustomRange(start, end);
    expect(result.ok).toBe(true);
  });
});
