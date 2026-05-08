'use client';
/**
 * RunOutputPane — live run status, log stream, cost, duration.
 *
 * Subscribes to useRunStatus + useRunLogs via Supabase Realtime when runId is set.
 * Renders: status badge, cost USD, duration, chronological log stream.
 *
 * When runId is null, shows a placeholder prompt.
 *
 * Plan 08-03 / Phase 8 / AGENT-11
 */
import { useRunStatus, useRunLogs, type AgentRunRow, type RunLogRow } from '@/lib/supabase/realtime';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type Tone = 'success' | 'warning' | 'destructive' | 'neutral' | 'accent';

function statusToTone(status: string): Tone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'cancelled':
    case 'expired':
      return 'destructive';
    case 'awaiting_approval':
      return 'warning';
    default:
      return 'neutral';
  }
}

/**
 * Inner component that actually uses the hooks — only rendered when runId is non-null.
 * Keeps the hook calls unconditional (Rules of Hooks).
 */
function RunOutputLive({ runId }: { runId: string }) {
  const emptyRun: AgentRunRow = { id: runId, status: 'queued', cost_usd: 0, output: null };
  const status = useRunStatus(runId, emptyRun);
  const logs = useRunLogs(runId, []);

  const sortedLogs = [...logs].sort(
    (a: RunLogRow, b: RunLogRow) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge tone={statusToTone(status.status)} data-testid="run-status-badge">
          {status.status}
        </Badge>
        <span className="text-xs text-muted-foreground" data-testid="run-cost">
          ${(status.cost_usd ?? 0).toFixed(4)}
        </span>
        {status.started_at && status.completed_at && (
          <span className="text-xs text-muted-foreground" data-testid="run-duration">
            {(
              (new Date(status.completed_at).getTime() - new Date(status.started_at).getTime()) /
              1000
            ).toFixed(1)}
            s
          </span>
        )}
      </div>
      <ol className="flex flex-col gap-1 text-xs" data-testid="run-log-list">
        {sortedLogs.map((l: RunLogRow) => (
          <li key={l.id} data-testid={`run-log-${l.id}`} className="border-l-2 border-border pl-2">
            <span className="text-muted-foreground">[{l.message_type}]</span>{' '}
            <span className="break-words">
              {typeof l.content === 'string'
                ? l.content
                : JSON.stringify(l.content).slice(0, 200)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RunOutputPane({ runId }: { runId: string | null }) {
  return (
    <Card data-testid="run-output-pane">
      <CardBody>
        <h3 className="font-medium text-base">Run output</h3>
        {!runId && (
          <p className="text-xs text-muted-foreground mt-2">
            Click &ldquo;Run Test&rdquo; to dispatch a real run.
          </p>
        )}
        {runId && <RunOutputLive runId={runId} />}
      </CardBody>
    </Card>
  );
}
