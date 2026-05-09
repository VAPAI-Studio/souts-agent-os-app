/**
 * Phase 9 / Plan 09-05 — Vitest + RTL tests for GlobalErrorBanner dismiss behavior.
 *
 * Covers:
 *   Test 1: downCount=0 → renders nothing
 *   Test 2: downCount=2, no localStorage entry → banner visible with "2 services unhealthy"
 *   Test 3: Click Dismiss → localStorage health_banner_dismissed_until = now + 3600000; banner disappears
 *   Test 4: downCount=2 AND localStorage dismissed_until in the future → banner hidden
 *   Test 5: downCount=2 AND localStorage dismissed_until in the past → banner renders
 *   Test 6: Click Dismiss writes EXACTLY 3600000 ms forward (not 3600 s, not 60 min)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

// Fake stable date for deterministic ms math
const FAKE_NOW = 1_700_000_000_000;

// Mock next/link so it doesn't break in jsdom
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FAKE_NOW);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GlobalErrorBanner — dismiss behavior', () => {
  it('Test 1: downCount=0 → renders nothing', async () => {
    const { GlobalErrorBanner } = await import(
      '../app/agentos/_components/GlobalErrorBanner'
    );

    const { container } = render(<GlobalErrorBanner initialDownCount={0} />);

    // Let useEffect run
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Banner should not be present
    expect(screen.queryByTestId('global-error-banner')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('Test 2: downCount=2, no localStorage → banner shows "2 services unhealthy" + Dismiss button', async () => {
    const { GlobalErrorBanner } = await import(
      '../app/agentos/_components/GlobalErrorBanner'
    );

    render(<GlobalErrorBanner initialDownCount={2} />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const banner = screen.getByTestId('global-error-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'alert');
    expect(screen.getByText(/2 services? unhealthy/i)).toBeInTheDocument();
    expect(screen.getByTestId('banner-dismiss')).toBeInTheDocument();
  });

  it('Test 3: Click Dismiss → localStorage entry = now + 3600000; banner disappears', async () => {
    const { GlobalErrorBanner } = await import(
      '../app/agentos/_components/GlobalErrorBanner'
    );

    render(<GlobalErrorBanner initialDownCount={2} />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Banner is visible
    expect(screen.getByTestId('global-error-banner')).toBeInTheDocument();

    // Click Dismiss
    await act(async () => {
      fireEvent.click(screen.getByTestId('banner-dismiss'));
    });

    // Banner should disappear
    expect(screen.queryByTestId('global-error-banner')).toBeNull();

    // localStorage should be set to FAKE_NOW + 3600000
    const stored = localStorage.getItem('health_banner_dismissed_until');
    expect(stored).toBe(String(FAKE_NOW + 3_600_000));
  });

  it('Test 4: downCount=2 AND localStorage dismissed_until in future → banner hidden', async () => {
    // Set a future dismissal time
    localStorage.setItem(
      'health_banner_dismissed_until',
      String(FAKE_NOW + 1_000_000), // 1 million ms in the future
    );

    const { GlobalErrorBanner } = await import(
      '../app/agentos/_components/GlobalErrorBanner'
    );

    render(<GlobalErrorBanner initialDownCount={2} />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Banner should NOT render (dismissed)
    expect(screen.queryByTestId('global-error-banner')).toBeNull();
  });

  it('Test 5: downCount=2 AND localStorage dismissed_until in past → banner renders', async () => {
    // Set an expired dismissal time
    localStorage.setItem(
      'health_banner_dismissed_until',
      String(FAKE_NOW - 1_000), // 1 second in the past
    );

    const { GlobalErrorBanner } = await import(
      '../app/agentos/_components/GlobalErrorBanner'
    );

    render(<GlobalErrorBanner initialDownCount={2} />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Dismissal expired — banner should render
    expect(screen.getByTestId('global-error-banner')).toBeInTheDocument();
  });

  it('Test 6: Click Dismiss writes EXACTLY 3600000 ms forward (not 3600s, not 60min)', async () => {
    const { GlobalErrorBanner } = await import(
      '../app/agentos/_components/GlobalErrorBanner'
    );

    render(<GlobalErrorBanner initialDownCount={1} />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('banner-dismiss'));
    });

    const stored = localStorage.getItem('health_banner_dismissed_until');
    const expectedMs = FAKE_NOW + 3_600_000;

    // Must be EXACTLY 3600000 ms (1 hour), not 3600 seconds (different unit!) or any other value
    expect(Number(stored)).toBe(expectedMs);
    // Extra guard: NOT 3600 (seconds), NOT 60 (minutes)
    expect(Number(stored)).not.toBe(FAKE_NOW + 3_600);
    expect(Number(stored)).not.toBe(FAKE_NOW + 60);
  });
});
