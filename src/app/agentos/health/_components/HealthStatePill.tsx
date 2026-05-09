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
  down: 'Down',
};

type BadgeTone = 'success' | 'warning' | 'destructive' | 'neutral' | 'accent';

const STATE_TONES: Record<ServiceState, BadgeTone> = {
  ok: 'success',
  slow: 'warning',
  auth_pending: 'warning',
  down: 'destructive',
};

export function HealthStatePill({ state }: HealthStatePillProps) {
  return (
    <Badge tone={STATE_TONES[state]}>
      {STATE_LABELS[state]}
    </Badge>
  );
}
