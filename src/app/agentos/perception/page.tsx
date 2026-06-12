import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';

/**
 * Phase 29 / Plan 29-02 — Perception page (UI-01, UI-02).
 *
 * Route: /agentos/perception
 * Data: GET {ORCHESTRATOR_URL}/perception (admin-JWT-gated, read-only).
 * Auth: requireAdmin() — same guard as the marketing/drafts + daily-report pages.
 * The orchestrator endpoint requires the user's admin JWT (require_role("admin")),
 * so we forward the session access_token as Bearer — same pattern as
 * agents/_actions.ts dispatch/cancel.
 *
 * UI-02: HONEST coverage banner at the TOP — flags contributed=false sources as
 * "not observed"; partial coverage is never hidden. Two-gate anchor: read-only.
 * Both-agents anchor: the endpoint serves BOTH COO and CMO (dual-written upstream).
 */

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL ||
  'https://elegant-benevolence-production.up.railway.app';

interface CoverageSource {
  contributed: boolean;
  event_count: number;
  freshness_ts: string | null;
}

interface Diff {
  source: string;
  change_type: string;
  actor_login: string | null;
  actor_person: string | null;
  artifact_title: string | null;
  url: string | null;
  ts: string | null;
  evidence: unknown;
}

interface Actor {
  actor_login: string | null;
  actor_person: string | null;
  source: string | null;
  event_count: number | null;
  last_activity: string | null;
  last_change_type: string | null;
  last_url: string | null;
}

interface PerceptionData {
  diffs: Diff[];
  by_actor: Actor[];
  work_state: Record<string, unknown> | null;
  digest: Record<string, unknown> | null;
  coverage: {
    sources: Record<string, CoverageSource>;
    caveat: string;
  };
}

function formatTs(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

async function fetchPerception(): Promise<PerceptionData | null> {
  const sb = await createClient();
  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return null;

  try {
    const r = await fetch(`${ORCHESTRATOR_URL}/perception`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return null;
    return (await r.json()) as PerceptionData;
  } catch {
    return null;
  }
}

interface SnapshotRow {
  source: string;
  computed_at: string;
  max_staleness_minutes: number | null;
  cost_usd: number | null;
  summary: unknown;
}

// Read the latest 'current' snapshot per source directly from Supabase (RLS:
// source_snapshots_select_any_role allows any agentos role to SELECT). No
// orchestrator round-trip needed — this is raw capture metadata, not the
// synthesized perception view.
async function fetchSnapshots(): Promise<SnapshotRow[]> {
  const sb = await createClient();
  const { data } = await sb
    .schema('agentos')
    .from('source_snapshots')
    .select('source, computed_at, max_staleness_minutes, cost_usd, summary')
    .eq('key', 'current')
    .order('computed_at', { ascending: false });
  return (data ?? []) as SnapshotRow[];
}

function freshness(computedAt: string, maxStale: number | null): {
  label: string;
  fresh: boolean;
  minsAgo: number;
} {
  const minsAgo = Math.round((Date.now() - new Date(computedAt).getTime()) / 60000);
  const fresh = maxStale != null && minsAgo <= maxStale;
  return { label: fresh ? 'fresh' : 'stale', fresh, minsAgo };
}

export default async function PerceptionPage() {
  await requireAdmin('/agentos/perception');
  const [data, snapshots] = await Promise.all([fetchPerception(), fetchSnapshots()]);

  const coverageEntries = data ? Object.entries(data.coverage.sources) : [];

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Perception"
        meta={
          <span className="text-[13px] text-text-muted">
            Read-only view of what the agents perceived — diffs, work-state, and
            per-actor activity. Serves both COO and CMO.
          </span>
        }
      />

      {/* SOURCE SNAPSHOTS — raw per-source capture state (pre-cómputo). Shows
          which sources have a fresh snapshot the COO can read vs which fall back
          to a live read. Read directly from Supabase (source_snapshots). */}
      <section className="flex flex-col gap-sm">
        <h2 className="text-[13px] font-medium text-text-muted uppercase tracking-wider">
          Source Snapshots
        </h2>
        {snapshots.length === 0 ? (
          <p className="text-[14px] text-text-muted">
            No source snapshots yet. They populate as each source&apos;s cron runs.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sm">
            {snapshots.map((s) => {
              const f = freshness(s.computed_at, s.max_staleness_minutes);
              return (
                <Card key={s.source}>
                  <CardBody>
                    <div className="flex items-center justify-between gap-sm">
                      <span className="text-[15px] font-semibold capitalize text-text">
                        {s.source}
                      </span>
                      <Badge tone={f.fresh ? 'success' : 'warning'}>{f.label}</Badge>
                    </div>
                    <div className="mt-1 text-[12px] text-text-muted">
                      captured {formatTs(s.computed_at)} · {f.minsAgo}m ago
                    </div>
                    <div className="mt-1 text-[12px] text-text-muted">
                      max staleness {s.max_staleness_minutes ?? '—'}m
                      {s.cost_usd != null && ` · $${Number(s.cost_usd).toFixed(3)}`}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] text-accent hover:underline">
                        View captured data
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded bg-surface p-2 text-[11px] text-text-muted whitespace-pre-wrap break-words">
                        {JSON.stringify(s.summary, null, 2)}
                      </pre>
                    </details>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {!data && (
        <Card>
          <CardBody>
            <p className="text-[14px] text-text-muted">
              Could not load perception data. The orchestrator may be unreachable,
              or the perception layer has no events yet (work_events is empty until
              source snapshots with content run).
            </p>
          </CardBody>
        </Card>
      )}

      {data && (
        <>
          {/* HONEST-COVERAGE BANNER (UI-02 headline). */}
          <Card>
            <CardBody>
              <h2 className="text-[13px] font-medium text-text-muted uppercase tracking-wider mb-3">
                Coverage
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-sm">
                {coverageEntries.map(([source, info]) => (
                  <div
                    key={source}
                    className="rounded border border-border px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-sm">
                      <span className="text-[14px] font-medium capitalize text-text">
                        {source}
                      </span>
                      <Badge tone={info.contributed ? 'success' : 'warning'}>
                        {info.contributed ? 'observed' : 'not observed'}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[12px] text-text-muted">
                      {info.event_count} events · fresh {formatTs(info.freshness_ts)}
                    </div>
                  </div>
                ))}
              </div>
              {data.coverage.caveat && (
                <p className="mt-3 text-[12px] text-text-muted italic">
                  {data.coverage.caveat}
                </p>
              )}
            </CardBody>
          </Card>

          {/* Per-actor table. */}
          <section className="flex flex-col gap-sm">
            <h2 className="text-[13px] font-medium text-text-muted uppercase tracking-wider">
              By Actor
            </h2>
            {data.by_actor.length === 0 ? (
              <p className="text-[14px] text-text-muted">
                No actor activity in this window.
              </p>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Actor</Th>
                    <Th>Source</Th>
                    <Th>Events</Th>
                    <Th>Last activity</Th>
                  </Tr>
                </THead>
                <TBody>
                  {data.by_actor.map((actor, i) => (
                    <Tr key={`${actor.actor_login}-${actor.source}-${i}`}>
                      <Td>{actor.actor_person || actor.actor_login || '—'}</Td>
                      <Td className="capitalize">{actor.source || '—'}</Td>
                      <Td>{actor.event_count ?? 0}</Td>
                      <Td>{formatTs(actor.last_activity)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </section>

          {/* Diffs list — each work_events row IS the diff. */}
          <section className="flex flex-col gap-sm">
            <h2 className="text-[13px] font-medium text-text-muted uppercase tracking-wider">
              Diffs
            </h2>
            {data.diffs.length === 0 ? (
              <p className="text-[14px] text-text-muted">No diffs in this window.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {data.diffs.map((diff, i) => (
                  <li key={`${diff.source}-${diff.ts}-${i}`}>
                    <Card>
                      <CardBody>
                        <div className="flex items-center justify-between gap-sm">
                          <span className="text-[14px] font-medium text-text">
                            <span className="capitalize">{diff.source}</span>
                            {' · '}
                            <span className="text-text-muted">{diff.change_type}</span>
                          </span>
                          <span className="text-[12px] text-text-muted">
                            {formatTs(diff.ts)}
                          </span>
                        </div>
                        <div className="mt-1 text-[14px] text-text">
                          {diff.url ? (
                            <a
                              href={diff.url}
                              className="text-accent hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {diff.artifact_title || diff.url}
                            </a>
                          ) : (
                            diff.artifact_title || '—'
                          )}
                        </div>
                        <div className="mt-1 text-[12px] text-text-muted">
                          by {diff.actor_person || diff.actor_login || 'unknown'}
                        </div>
                      </CardBody>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
