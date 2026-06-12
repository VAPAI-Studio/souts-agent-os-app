/**
 * Phase 9 / Plan 09-05 — HealthStatePill: pure render mapping service state to Badge tone.
 *
 * Server Component (no 'use client') — no browser APIs needed.
 */
import * as React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { ServiceState } from '../_data/snapshot';

interface HealthStatePillProps {
  state: ServiceState;
}

const STATE_LABELS: Record<ServiceState, string> = {
  ok: 'OK',
  slow: 'Slow',
  auth_pending: 'Auth pending',
  auth_refresh: 'Auto-refresh',
  down: 'Down',
};

type BadgeTone = 'success' | 'warning' | 'destructive' | 'neutral' | 'accent';

const STATE_TONES: Record<ServiceState, BadgeTone> = {
  ok: 'success',
  slow: 'warning',
  auth_pending: 'warning',
  // auth_refresh = token expired but the agent auto-refreshes at use-time;
  // not an outage, so warning (amber) not destructive (red).
  auth_refresh: 'warning',
  down: 'destructive',
};

export function HealthStatePill({ state }: HealthStatePillProps) {
  return (
    <Badge tone={STATE_TONES[state]}>
      {STATE_LABELS[state]}
    </Badge>
  );
}
