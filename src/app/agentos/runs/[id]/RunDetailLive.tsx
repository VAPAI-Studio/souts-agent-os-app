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
import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  useRunStatus,
  useRunLogs,
  type AgentRunRow,
  type RunLogRow,
} from '@/lib/supabase/realtime';
import { cancelRun, rerunRun } from '@/app/agentos/agents/_actions';

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
    <section>
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Run {props.runId.slice(0, 8)}…</h1>
        <span
          data-testid="run-status-badge"
          style={{
            padding: '0.25rem 0.5rem',
            background: badgeColor(run.status),
            borderRadius: '0.25rem',
            fontWeight: 'bold',
          }}
        >
          {run.status}
        </span>
        {props.agent && (
          <Link href={`/agentos/agents/${props.agent.id}`}>← {props.agent.name}</Link>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {canCancel && (
            <button
              data-testid="cancel-btn"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const r = await cancelRun(props.runId);
                  if (!r.ok) setError(r.error ?? 'cancel failed');
                })
              }
            >
              Cancel
            </button>
          )}
          {canRerun && (
            <button
              data-testid="rerun-btn"
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
              Re-run
            </button>
          )}
        </div>
      </header>

      {error && (
        <p style={{ color: 'red' }} data-testid="action-error">
          {error}
        </p>
      )}

      <h2>Cost &amp; timing</h2>
      <dl>
        <dt>Cost (USD)</dt>
        <dd data-testid="cost-usd">${Number(run.cost_usd ?? 0).toFixed(4)}</dd>
        <dt>Started</dt>
        <dd>{run.started_at ? new Date(run.started_at).toLocaleString() : '-'}</dd>
        <dt>Ended</dt>
        <dd>{run.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}</dd>
        {run.error_message && (
          <>
            <dt>Error</dt>
            <dd style={{ color: 'red' }}>{run.error_message}</dd>
          </>
        )}
        {run.modal_container_id && (
          <>
            <dt>Modal call id</dt>
            <dd style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
              {run.modal_container_id}
            </dd>
          </>
        )}
      </dl>

      <h2>Message log ({logs.length})</h2>
      <ul
        data-testid="message-log"
        style={{ listStyle: 'none', padding: 0, margin: 0 }}
      >
        {logs.map((l) => (
          <li
            key={l.id}
            style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}
          >
            <span style={{ fontWeight: 'bold' }}>{l.message_type}</span>
            <span style={{ marginLeft: '0.5rem', color: '#888' }}>
              {new Date(l.created_at).toLocaleTimeString()}
            </span>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                margin: '0.25rem 0 0',
                fontSize: '0.875rem',
              }}
            >
              {JSON.stringify(l.content, null, 2)}
            </pre>
          </li>
        ))}
      </ul>

      <h2>Tool calls ({toolCalls.length})</h2>
      <table
        data-testid="tool-calls-table"
        style={{ borderCollapse: 'collapse', width: '100%' }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: '0.5rem' }}>Tool</th>
            <th style={{ padding: '0.5rem' }}>Input</th>
            <th style={{ padding: '0.5rem' }}>Output</th>
            <th style={{ padding: '0.5rem' }}>Duration</th>
            <th style={{ padding: '0.5rem' }}>Success</th>
          </tr>
        </thead>
        <tbody>
          {toolCalls.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{t.tool_name}</td>
              <td style={{ padding: '0.5rem' }}>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                    maxWidth: '20rem',
                    overflow: 'hidden',
                    fontSize: '0.75rem',
                  }}
                >
                  {JSON.stringify(t.tool_input)}
                </pre>
              </td>
              <td style={{ padding: '0.5rem' }}>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                    maxWidth: '20rem',
                    overflow: 'hidden',
                    fontSize: '0.75rem',
                  }}
                >
                  {String(t.tool_output ?? '').slice(0, 200)}
                </pre>
              </td>
              <td style={{ padding: '0.5rem' }}>
                {t.duration_ms != null ? `${t.duration_ms}ms` : '-'}
              </td>
              <td style={{ padding: '0.5rem' }}>{t.success ? '✓' : '✗'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {run.output != null && (
        <>
          <h2>Output</h2>
          <pre
            data-testid="run-output"
            style={{
              whiteSpace: 'pre-wrap',
              background: '#f4f4f4',
              padding: '1rem',
              borderRadius: '0.25rem',
            }}
          >
            {typeof run.output === 'object'
              ? JSON.stringify(run.output, null, 2)
              : String(run.output)}
          </pre>
        </>
      )}
    </section>
  );
}

function badgeColor(s: string): string {
  if (s === 'completed') return '#9f9';
  if (s === 'failed') return '#f99';
  if (s === 'cancelled') return '#fc9';
  if (s === 'awaiting_approval') return '#fc9';
  return '#9cf';
}
