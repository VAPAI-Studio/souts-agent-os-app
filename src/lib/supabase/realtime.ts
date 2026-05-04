'use client';
/**
 * Supabase Realtime hooks for agent runs.
 *
 * Per 03-RESEARCH.md Pattern 8:
 *   - postgres_changes filter id=eq.<run_id> for agent_runs status updates
 *   - postgres_changes filter run_id=eq.<run_id> for run_logs INSERTs
 *   - Plan 03-01 already added these tables to supabase_realtime publication + GRANT SELECT
 *     (migration 20260503_130000_realtime_publication_and_audit_enum.sql)
 *
 * RLS implication: the Realtime authorizer evaluates SELECT policies per-subscriber per-event.
 * Plan 01-02's policies already allow any authenticated agentos role to SELECT agent_runs
 * and run_logs; row-level filtering still applies via RLS on top of the channel filter.
 *
 * Usage:
 *   const live = useRunStatus(runId, initialRun);
 *   const logs = useRunLogs(runId, initialLogs);
 */
import { useEffect, useRef, useState } from 'react';
import { createClient } from './client';

export interface AgentRunRow {
  id: string;
  status: string;
  cost_usd: number;
  output: unknown;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  modal_container_id?: string | null;
  agent_id?: string | null;
  input?: unknown;
  trigger_type?: string | null;
  [k: string]: unknown;
}

export interface RunLogRow {
  id: string;
  run_id: string;
  message_type: string;
  content: unknown;
  created_at: string;
}

/**
 * Subscribe to UPDATE events on agentos.agent_runs filtered by id.
 * Returns the latest merged row (initial seed + live UPDATEs).
 *
 * Realtime + custom schema + RLS: the Realtime authorizer evaluates SELECT
 * policies as the JWT subject. Without realtime.setAuth(), the WS evaluates
 * as anon and agentos.* events are filtered out. We pull the access token
 * from the active session and set it on the realtime client before
 * subscribing.
 */
export function useRunStatus(runId: string, initial: AgentRunRow): AgentRunRow {
  const [row, setRow] = useState<AgentRunRow>(initial);
  const sbRef = useRef(createClient());

  useEffect(() => {
    const sb = sbRef.current;
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        sb.realtime.setAuth(session.access_token);
      }
      channel = sb
        .channel(`run-${runId}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          {
            event: 'UPDATE',
            schema: 'agentos',
            table: 'agent_runs',
            filter: `id=eq.${runId}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            setRow((prev) => ({ ...prev, ...(payload.new as AgentRunRow) }));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
  }, [runId]);

  return row;
}

/**
 * Subscribe to INSERT events on agentos.run_logs filtered by run_id.
 * Returns rows in chronological order (initial seed + live appends).
 */
export function useRunLogs(runId: string, initial: RunLogRow[]): RunLogRow[] {
  const [rows, setRows] = useState<RunLogRow[]>(initial);
  const sbRef = useRef(createClient());

  useEffect(() => {
    const sb = sbRef.current;
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        sb.realtime.setAuth(session.access_token);
      }
      channel = sb
        .channel(`run-logs-${runId}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          {
            event: 'INSERT',
            schema: 'agentos',
            table: 'run_logs',
            filter: `run_id=eq.${runId}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            setRows((prev) => [...prev, payload.new as RunLogRow]);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
  }, [runId]);

  return rows;
}
