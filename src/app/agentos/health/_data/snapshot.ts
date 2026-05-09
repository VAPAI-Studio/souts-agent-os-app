/**
 * Phase 9 / Plan 09-05 — Health snapshot with 60s server-side module-level cache.
 *
 * Server-only module (imported by Server Components only).
 * Manages a module-level Map cache keyed at 'snapshot:v1'.
 * Cache TTL: 60 seconds.
 *
 * Exports:
 *   getHealthSnapshot()      — honors 60s cache
 *   forceRefreshSnapshot()   — bypasses cache (used by Server Action on Refresh)
 */
import 'server-only';

export type ServiceState = 'ok' | 'slow' | 'auth_pending' | 'down';

export interface ServiceProbe {
  service: 'modal' | 'supabase' | 'slack' | 'slack_bot' | 'gmail' | 'drive' | 'calendar' | 'notion';
  state: ServiceState;
  ms: number;
  error: string | null;
  last_changed_at?: string;
  last_alerted_at?: string | null;
}

export interface ProbeSnapshot {
  services: ServiceProbe[];
  ts: string;      // ISO UTC when snapshot was generated
  cached: boolean; // true if served from module cache, false if fresh probe
}

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

type CacheEntry = { snapshot: ProbeSnapshot; ts: number };
const cache: Map<'snapshot:v1', CacheEntry> = new Map();
const TTL_MS = 60_000;

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL!;
const CRON_SECRET = process.env.CRON_SECRET!;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getHealthSnapshot(): Promise<ProbeSnapshot> {
  const entry = cache.get('snapshot:v1');
  const now = Date.now();
  if (entry && now - entry.ts < TTL_MS) {
    return { ...entry.snapshot, cached: true };
  }
  return _probeAndCache();
}

export async function forceRefreshSnapshot(): Promise<ProbeSnapshot> {
  cache.delete('snapshot:v1');
  return _probeAndCache();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _probeAndCache(): Promise<ProbeSnapshot> {
  try {
    const r = await fetch(`${ORCHESTRATOR_URL}/health/probes`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      return _emptyFailureSnapshot(`upstream ${r.status}`);
    }
    const body = await r.json();
    const snapshot: ProbeSnapshot = {
      services: body.services,
      ts: body.ts ?? new Date().toISOString(),
      cached: false,
    };
    cache.set('snapshot:v1', { snapshot, ts: Date.now() });
    return snapshot;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'fetch_failed';
    return _emptyFailureSnapshot(msg);
  }
}

function _emptyFailureSnapshot(reason: string): ProbeSnapshot {
  const services: ServiceProbe[] = (
    ['modal', 'supabase', 'slack', 'slack_bot', 'gmail', 'drive', 'calendar', 'notion'] as const
  ).map((s) => ({ service: s, state: 'down' as ServiceState, ms: 0, error: reason }));
  return { services, ts: new Date().toISOString(), cached: false };
}
