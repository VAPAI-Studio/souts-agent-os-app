'use client';
/**
 * Phase 6 / Plan 06-05 — COO daily-report briefing card.
 *
 * Subscribes to `agent_runs` Realtime filtered by `agent_id=eq.{cooAgentId}`
 * (UI-SPEC §Surface 4). The component renders one of seven distinct states
 * driven by the run's status + output.slack_posted + draftsPendingCount:
 *
 *    1. no-run                    — null run                                → [Run now]
 *    2. running                   — status in (queued, dispatched, running) → spinner, no CTA
 *    3. awaiting_approval         — status='awaiting_approval'              → [Go to Approvals Inbox]
 *    4. completed-posted          — completed + output.slack_posted=true    → [Read report] + [View run]
 *    5. completed-not-posted      — completed + output.slack_posted!=true   → [Read report] + [View run]
 *    6. completed-drafts-pending  — completed + draftsPendingCount > 0      → adds [Review drafts] + Badge
 *    7. failed                    — status='failed'                         → [Re-run] + [View run]
 *
 * State 6 is a SUPERSET of state 4/5: when drafts are pending, the card adds
 * a `Badge` and the [Review drafts] button to whichever completed substate
 * applies; data-coo-card-status reports `completed-drafts-pending` so tests
 * have a stable single-status discriminant.
 *
 * Realtime pitfall (Phase 5 #10): `realtime.setAuth(accessToken)` MUST run
 * BEFORE `channel.subscribe()`. Otherwise the WS authorizer treats the
 * subscriber as `anon` and agentos.* events are filtered out. The pattern
 * here mirrors `useRunStatus` in `lib/supabase/realtime.ts`.
 *
 * Plan 03.1 lint guards: zero inline `style` attributes, all colors via
 * design tokens. Card border + background classes come from
 * `getCardClassName(state)` per UI-SPEC §Surface 4 table.
 *
 * a11y: `role="status"` on the Card root so screen readers announce state
 * transitions when Realtime payloads arrive (UI-SPEC line 497).
 */
import * as React from 'react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { triggerCooRun } from '../_actions';

export interface CooRun {
  id: string;
  agent_id: string;
  status: string;
  created_at: string;
  output: unknown;
  error_message: string | null;
}

export interface CooCardProps {
  cooAgentId: string | null;
  initialRun: CooRun | null;
  vaultUrl: string | null;
  draftsPendingCount: number;
  accessToken: string | null;
  todayIso: string;
}

type CardState =
  | 'no-run'
  | 'running'
  | 'awaiting_approval'
  | 'completed-posted'
  | 'completed-not-posted'
  | 'completed-drafts-pending'
  | 'failed';

function _hasSlackPosted(run: CooRun): boolean {
  if (!run.output || typeof run.output !== 'object') return false;
  const out = run.output as Record<string, unknown>;
  return out.slack_posted === true;
}

function deriveState(
  run: CooRun | null,
  draftsPendingCount: number,
): CardState {
  if (!run) return 'no-run';
  if (run.status === 'queued' || run.status === 'dispatched' || run.status === 'running') {
    return 'running';
  }
  if (run.status === 'awaiting_approval') return 'awaiting_approval';
  if (run.status === 'failed') return 'failed';
  if (run.status === 'completed') {
    if (draftsPendingCount > 0) return 'completed-drafts-pending';
    if (_hasSlackPosted(run)) return 'completed-posted';
    return 'completed-not-posted';
  }
  // Fallback for unknown statuses — render the running visual without CTA.
  return 'running';
}

function getCardClassName(state: CardState): string {
  switch (state) {
    case 'no-run':
      return 'border-border bg-surface';
    case 'running':
    case 'awaiting_approval':
      return 'border-warning bg-warning-subtle';
    case 'completed-posted':
    case 'completed-not-posted':
    case 'completed-drafts-pending':
      return 'border-success bg-success-subtle';
    case 'failed':
      return 'border-destructive bg-destructive-subtle';
  }
}

/**
 * Inline spinner — Lucide-free fallback so the dashboard does not pull a new
 * runtime dependency. Pure CSS via Tailwind animate-spin on an SVG ring.
 */
function Spinner() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin text-warning"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function CooCard(props: CooCardProps) {
  const {
    cooAgentId,
    initialRun,
    vaultUrl,
    draftsPendingCount,
    accessToken,
  } = props;

  const [run, setRun] = useState<CooRun | null>(initialRun);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null);

  if (sbRef.current === null) {
    sbRef.current = createClient();
  }

  // Realtime subscription: postgres_changes on agent_runs filtered by agent_id.
  // setAuth MUST fire BEFORE subscribe (Phase 5 pitfall #10).
  useEffect(() => {
    if (!cooAgentId) return; // No COO agent seeded yet — nothing to subscribe to.
    const sb = sbRef.current!;
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;

    (async () => {
      // setAuth before subscribe — Phase 5 pitfall #10.
      if (accessToken) {
        sb.realtime.setAuth(accessToken);
      } else {
        // Best-effort fallback — pull token from session if not provided.
        const { data: { session } } = await sb.auth.getSession();
        if (cancelled) return;
        if (session?.access_token) sb.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = sb
        .channel(`coo-runs-${cooAgentId}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'agentos',
            table: 'agent_runs',
            filter: `agent_id=eq.${cooAgentId}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const next = payload.new as CooRun | undefined;
            if (!next) return;
            // Only update when the row corresponds to today's run.
            if (!next.created_at?.startsWith(props.todayIso)) return;
            setRun((prev) => {
              // Prefer the freshest row by id+status; merge to keep optional
              // fields the payload omits.
              if (!prev || prev.id === next.id) {
                return { ...(prev ?? {}), ...next } as CooRun;
              }
              // New run for today — replace.
              return next;
            });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
  }, [cooAgentId, accessToken, props.todayIso]);

  const state = deriveState(run, draftsPendingCount);
  const cardClassName = getCardClassName(state);

  function onTriggerClick() {
    setActionError(null);
    startTransition(async () => {
      const r = await triggerCooRun();
      if (!r.ok) {
        setActionError(r.error);
      }
    });
  }

  return (
    <Card
      data-testid="coo-card"
      data-coo-card-status={state}
      role="status"
      aria-live="polite"
      className={cn('border', cardClassName)}
    >
      <CardHeader className="flex items-center gap-sm">
        <span
          data-testid="coo-card-status"
          className="text-[12px] font-mono text-text-muted"
        >
          {state}
        </span>
        {state === 'completed-drafts-pending' && (
          <Badge tone="accent">{draftsPendingCount} drafts pending</Badge>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-md">
        {state === 'no-run' && (
          <>
            <h2 className="text-[16px] font-semibold text-text">
              No COO report yet today
            </h2>
            <p className="text-[13px] text-text-muted">
              The daily report runs automatically at 09:00 on weekdays. You can
              also trigger it manually.
            </p>
            <div className="flex gap-sm">
              <Button
                intent="secondary"
                size="md"
                type="button"
                data-testid="coo-card-trigger-btn"
                disabled={isPending || !cooAgentId}
                onClick={onTriggerClick}
              >
                {isPending ? '...' : 'Run now'}
              </Button>
            </div>
            {!cooAgentId && (
              <p className="text-[12px] text-text-muted">
                COO agent not seeded yet. Apply migration
                <span className="font-mono">
                  {' '}
                  20260506_120600_seed_coo_agent.sql{' '}
                </span>
                to enable the daily report.
              </p>
            )}
          </>
        )}

        {state === 'running' && (
          <>
            <div className="flex items-center gap-sm">
              <Spinner />
              <h2 className="text-[16px] font-semibold text-text">
                Generating daily report…
              </h2>
            </div>
            <p className="text-[13px] text-text-muted">
              The COO agent is assembling today&apos;s briefing.
            </p>
          </>
        )}

        {state === 'awaiting_approval' && run && (
          <>
            <h2 className="text-[16px] font-semibold text-text">
              Waiting for Slack approval
            </h2>
            <p className="text-[13px] text-text-muted">
              The report is ready. Approve the Slack post to complete the run.
            </p>
            <div className="flex gap-sm">
              <Link
                href="/agentos/approvals"
                data-testid="coo-card-approvals-link"
                className="no-underline"
              >
                <Button intent="primary" size="md" type="button">
                  Go to Approvals Inbox
                </Button>
              </Link>
            </div>
          </>
        )}

        {(state === 'completed-posted' ||
          state === 'completed-not-posted' ||
          state === 'completed-drafts-pending') &&
          run && (
            <>
              <h2 className="text-[16px] font-semibold text-text">
                Today&apos;s report is ready
              </h2>
              <p className="text-[13px] text-text-muted">
                {state === 'completed-not-posted'
                  ? 'Slack post was not sent (rejected or no approval given).'
                  : 'The daily briefing has been posted to Slack.'}
              </p>
              <div className="flex flex-wrap gap-sm">
                {vaultUrl && (
                  <a
                    href={vaultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="coo-card-report-link"
                    className="no-underline"
                  >
                    <Button intent="primary" size="md" type="button">
                      Read report
                    </Button>
                  </a>
                )}
                <Link
                  href={`/agentos/runs/${run.id}`}
                  data-testid="coo-card-run-link"
                  className="no-underline"
                >
                  <Button intent="ghost" size="md" type="button">
                    View run
                  </Button>
                </Link>
                {state === 'completed-drafts-pending' && (
                  <Link
                    href={`/agentos/runs/${run.id}/drafts`}
                    data-testid="coo-card-drafts-link"
                    className="no-underline"
                  >
                    <Button intent="secondary" size="md" type="button">
                      Review drafts
                    </Button>
                  </Link>
                )}
              </div>
            </>
          )}

        {state === 'failed' && run && (
          <>
            <h2 className="text-[16px] font-semibold text-text">
              Today&apos;s report failed
            </h2>
            <pre className="font-mono text-[13px] text-destructive whitespace-pre-wrap m-0">
              {run.error_message ?? 'unknown error'}
            </pre>
            <div className="flex gap-sm">
              <Button
                intent="primary"
                size="md"
                type="button"
                data-testid="coo-card-rerun-btn"
                disabled={isPending || !cooAgentId}
                onClick={onTriggerClick}
              >
                {isPending ? '...' : 'Re-run'}
              </Button>
              <Link
                href={`/agentos/runs/${run.id}`}
                data-testid="coo-card-run-link"
                className="no-underline"
              >
                <Button intent="ghost" size="md" type="button">
                  View run
                </Button>
              </Link>
            </div>
          </>
        )}

        {actionError && (
          <p className="text-[13px] text-destructive" data-testid="coo-card-error">
            {actionError}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
