'use client';
/**
 * Phase 9 / Plan 09-05 — GlobalErrorBanner.
 *
 * Admin-only sticky banner rendered at the top of /agentos/layout.tsx
 * when at least one service is in "Down" state.
 *
 * Props:
 *   initialDownCount: number — server-rendered count of down services (admin only)
 *
 * Behavior:
 *   - downCount <= 0 → renders nothing
 *   - downCount >= 1, no localStorage entry → banner visible
 *   - Click Dismiss → sets localStorage health_banner_dismissed_until = Date.now() + 3600000
 *     (exactly 3600000 ms = 1 hour); banner disappears
 *   - Remount with dismissal in future → banner hidden
 *   - Remount with dismissal in past (expired) → banner visible
 *
 * SSR safety: banner starts hidden (useState(true)) to avoid hydration mismatch,
 * then useEffect runs on client to read localStorage and decide visibility.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

const STORAGE_KEY = 'health_banner_dismissed_until';
const DISMISS_DURATION_MS = 3600_000; // exactly 1 hour in milliseconds

export interface GlobalErrorBannerProps {
  initialDownCount: number; // server-rendered for admin only; client manages dismiss
}

export function GlobalErrorBanner({ initialDownCount }: GlobalErrorBannerProps) {
  // Start hidden to avoid SSR mismatch — useEffect reveals based on localStorage
  const [hidden, setHidden] = useState<boolean>(true);

  useEffect(() => {
    if (initialDownCount <= 0) {
      setHidden(true);
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    const until = raw ? Number(raw) : 0;
    // Hide if dismissal is still active (until > now)
    setHidden(until > Date.now());
  }, [initialDownCount]);

  if (hidden) return null;

  return (
    <div
      role="alert"
      data-testid="global-error-banner"
      className="sticky top-0 z-50 bg-destructive/10 border-b border-destructive flex items-center gap-4 px-6 py-2"
    >
      <span className="text-[13px] font-medium text-destructive">
        {initialDownCount} service{initialDownCount === 1 ? '' : 's'} unhealthy
      </span>
      <Link
        href="/agentos/health"
        className="text-[12px] underline text-destructive"
        data-testid="banner-open-health"
      >
        Open Health page
      </Link>
      <Button
        intent="ghost"
        size="sm"
        data-testid="banner-dismiss"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, String(Date.now() + DISMISS_DURATION_MS));
          setHidden(true);
        }}
        className="ml-auto text-destructive hover:text-destructive"
      >
        Dismiss for 1 hour
      </Button>
    </div>
  );
}
