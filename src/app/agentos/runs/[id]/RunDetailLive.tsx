'use client';
// Client Component for the Run Detail page.
// Subscribes via useRunStatus + useRunLogs (Supabase Realtime) and renders:
//   - status badge (live)
//   - cost / timing block
//   - message log (live appends)
//   - tool calls table (initial seed only — INSERTs after page load are rare for tool_call_logs)
//   - Cancel button (if not terminal)
//   - Re-run button (if status='failed')
//
// Plan 03-04 / TASK-04 + TASK-05 + TASK-06.
// Plan 03-04 retrofit (post 03.1): replaced inline style={{ }} with Plan 02 primitives
// (Button, Badge, Table) + Tailwind v4 design tokens. Preserves every data-testid:
//   run-status-badge, cancel-btn, rerun-btn, action-error, cost-usd,
//   message-log, tool-calls-table, run-output.
import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  useRunStatus,
  useRunLogs,
  type AgentRunRow,
  type RunLogRow,
} from '@/lib/supabase/realtime';
import { cancelRun, rerunRun } from '@/app/agentos/agents/_actions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';

interface AgentSummary {
  id: string;
  name: string;
  department: string;
  model_tier: string;
}

interface ToolCallRow {
  id: string;
  tool_name: string;
  tool_input: unknown;
  tool_output: unknown;
  duration_ms: number | null;
  success: boolean | null;
  created_at: string;
}

type Tone = 'success' | 'warning' | 'destructive' | 'neutral';
function statusToTone(status: string): Tone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'queued':
    case 'dispatched':
    case 'running':
    case 'awaiting_approval':
      return 'warning';
    case 'failed':
    case 'cancelled':
      return 'destructive';
    default:
      return 'neutral';
  }
}

export function RunDetailLive(props: {
  runId: string;
  agent: AgentSummary | null;
  initialRun: AgentRunRow;
  initialLogs: RunLogRow[];
  initialToolCalls: ToolCallRow[];
}) {
  const run = useRunStatus(props.runId, props.initialRun);
  const logs = useRunLogs(props.runId, props.initialLogs);
  // tool_call_logs: only initial render; live INSERTs would require a third subscription
  // and are rare for short runs. Add later if needed.
  const toolCalls = props.initialToolCalls;

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(run.status);
  const canCancel = !isTerminal;
  const canRerun = run.status === 'failed';

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-md flex-wrap">
        <Badge
          tone={statusToTone(run.status)}
          data-testid="run-status-badge"
        >
          {run.status}
        </Badge>
        {props.agent && (
          <Link
            href={`/agentos/agents/${props.agent.id}`}
            className="text-accent underline text-[13px]"
          >
            ← {props.agent.name}
          </Link>
        )}
        <div className="ml-auto flex items-center gap-sm">
          {canCancel && (
            <Button
              data-testid="cancel-btn"
              intent="destructive"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const r = await cancelRun(props.runId);
                  if (!r.ok) setError(r.error ?? 'cancel failed');
                })
              }
            >
              {isPending ? '...' : 'Cancel'}
            </Button>
          )}
          {canRerun && (
            <Button
              data-testid="rerun-btn"
              intent="primary"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const r = await rerunRun(props.runId);
                  if (!r.ok) {
                    setError(r.error ?? 'rerun failed');
                    return;
                  }
                  // Re-run lands on a new run id; navigate.
                  if (r.data?.id) {
                    window.location.assign(`/agentos/runs/${r.data.id}`);
                  }
                })
              }
            >
              {isPending ? '...' : 'Re-run'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p
          className="text-destructive text-[13px]"
          data-testid="action-error"
        >
          {error}
        </p>
      )}

      <div>
        <h2 className="text-[14px] font-semibold mb-sm">Cost &amp; timing</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-md gap-y-sm text-[13px]">
          <dt className="text-text-muted">Cost (USD)</dt>
          <dd className="text-text font-mono" data-testid="cost-usd">
            ${Number(run.cost_usd ?? 0).toFixed(4)}
          </dd>
          <dt className="text-text-muted">Started</dt>
          <dd className="text-text font-mono">
            {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
          </dd>
          <dt className="text-text-muted">Ended</dt>
          <dd className="text-text font-mono">
            {run.completed_at
              ? new Date(run.completed_at).toLocaleString()
              : '—'}
          </dd>
          {run.error_message && (
            <>
              <dt className="text-text-muted">Error</dt>
              <dd className="text-destructive">{run.error_message}</dd>
            </>
          )}
          {run.modal_container_id && (
            <>
              <dt className="text-text-muted">Modal call id</dt>
              <dd className="font-mono text-[12px] text-text-muted break-all">
                {run.modal_container_id}
              </dd>
            </>
          )}
        </dl>
      </div>

      <div>
        <h2 className="text-[14px] font-semibold mb-sm">
          Message log ({logs.length})
        </h2>
        <ul
          data-testid="message-log"
          className="list-none p-0 m-0 rounded border border-border bg-surface-raised divide-y divide-border"
        >
          {logs.length === 0 && (
            <li className="p-md text-text-muted text-[13px]">
              No messages yet.
            </li>
          )}
          {logs.map((l) => (
            <li key={l.id} className="p-md">
              <div className="flex items-center gap-sm text-[12px]">
                <span className="font-semibold text-text">{l.message_type}</span>
                <span className="text-text-muted font-mono">
                  {new Date(l.created_at).toLocaleTimeString()}
                </span>
              </div>
              <pre className="whitespace-pre-wrap mt-xs text-[12px] font-mono text-text">
                {JSON.stringify(l.content, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-[14px] font-semibold mb-sm">
          Tool calls ({toolCalls.length})
        </h2>
        <Table data-testid="tool-calls-table">
          <THead>
            <Tr>
              <Th>Tool</Th>
              <Th>Input</Th>
              <Th>Output</Th>
              <Th>Duration</Th>
              <Th>Success</Th>
            </Tr>
          </THead>
          <TBody>
            {toolCalls.length === 0 && (
              <Tr>
                <Td
                  colSpan={5}
                  className="text-center text-text-muted p-md"
                >
                  No tool calls recorded.
                </Td>
              </Tr>
            )}
            {toolCalls.map((t) => (
              <Tr key={t.id}>
                <Td className="font-mono">{t.tool_name}</Td>
                <Td>
                  <pre className="whitespace-pre-wrap m-0 max-w-[20rem] overflow-hidden text-[12px] font-mono text-text-muted">
                    {JSON.stringify(t.tool_input)}
                  </pre>
                </Td>
                <Td>
                  <pre className="whitespace-pre-wrap m-0 max-w-[20rem] overflow-hidden text-[12px] font-mono text-text-muted">
                    {String(t.tool_output ?? '').slice(0, 200)}
                  </pre>
                </Td>
                <Td className="font-mono text-text-muted">
                  {t.duration_ms != null ? `${t.duration_ms}ms` : '—'}
                </Td>
                <Td>
                  {t.success ? (
                    <Badge tone="success">ok</Badge>
                  ) : (
                    <Badge tone="destructive">fail</Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      {run.output != null && (
        <div>
          <h2 className="text-[14px] font-semibold mb-sm">Output</h2>
          <pre
            data-testid="run-output"
            className="whitespace-pre-wrap bg-surface-raised border border-border rounded p-md text-[12px] font-mono text-text"
          >
            {typeof run.output === 'object'
              ? JSON.stringify(run.output, null, 2)
              : String(run.output)}
          </pre>
        </div>
      )}
    </section>
  );
}
