'use client';
/**
 * Phase 9 / Plan 09-03 — Home dashboard activity feed.
 *
 * Renders the last N audit_logs rows for 3 event categories (run completions,
 * approval decisions, agent status changes), newest first.
 *
 * Key behaviors:
 *   - Subscribes to audit_logs INSERT events via Realtime channel 'home-activity'
 *   - 5-second debounce: multiple rapid INSERTs produce ONE re-fetch, not N
 *   - Unmount cleans up: clearTimeout + removeChannel
 *   - Empty state: "No activity yet today."
 *
 * Server/Client split:
 *   - `fetchActivityFeed` in _data/home.ts uses server-only createClient — cannot
 *     be called from this client component.
 *   - `clientFetchActivityFeed` (exported from this file) mirrors the same query
 *     using the browser Supabase client. It imports ACTIVITY_ACTIONS from _data/types
 *     (a server-and-client-safe module) so server and client share a single source
 *     of truth without dragging next/headers into the browser bundle.
 *
 * Design discipline (Phase 03.1):
 *   - No inline style attributes
 *   - No hex literals — Tailwind v4 tokens only
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ACTIVITY_ACTIONS } from '../_data/types';
import type { ActivityRow as ActivityRowType } from '../_data/types';
import { ActivityRow } from './ActivityRow';
import { Card, CardBody } from '@/components/ui/Card';

/** Debounce delay in ms — 5 seconds per PLAN spec. */
const DEBOUNCE_MS = 5000;

/**
 * Client-side re-fetch of activity feed rows.
 * Exported so tests can spy on it via the `_fetchFn` prop pattern.
 *
 * Mirrors fetchActivityFeed from _data/home.ts but uses the BROWSER supabase client.
 * Imports ACTIVITY_ACTIONS from _data/types — server and client agree by construction.
 */
export async function clientFetchActivityFeed(
  limit = 20,
): Promise<ActivityRowType[]> {
  try {
    const sb = createClient();
    const { data: rows, error } = await sb
      .schema('agentos')
      .from('audit_logs')
      .select('id, action, target_table, target_id, metadata, created_at')
      .in('action', [...ACTIVITY_ACTIONS])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !rows) return [];

    // Batch-resolve agent names (mirrors server-side enrichment in home.ts)
    const agentIds = new Set<string>();
    for (const row of rows as Array<{
      id: string;
      action: string;
      target_table: string;
      target_id: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>) {
      const meta = row.metadata ?? {};
      if (meta.agent_id && typeof meta.agent_id === 'string') {
        agentIds.add(meta.agent_id);
      }
      if (row.target_table === 'agents' && row.target_id) {
        agentIds.add(row.target_id);
      }
    }

    const nameMap = new Map<string, string>();
    if (agentIds.size > 0) {
      const { data: agents } = await sb
        .schema('agentos')
        .from('agents')
        .select('id, name')
        .in('id', [...agentIds]);
      for (const a of (agents ?? []) as { id: string; name: string }[]) {
        nameMap.set(a.id, a.name);
      }
    }

    return (
      rows as Array<{
        id: string;
        action: string;
        target_table: string;
        target_id: string;
        metadata: Record<string, unknown> | null;
        created_at: string;
      }>
    ).map((row) => {
      const meta = row.metadata ?? {};
      const action = row.action;
      let category: 'run' | 'approval' | 'agent' = 'agent';
      if (action === 'agent_run_completed' || action === 'agent_run_failed') {
        category = 'run';
      } else if (
        action === 'approval_approve' ||
        action === 'approval_reject' ||
        action === 'approval_edit'
      ) {
        category = 'approval';
      }

      const agentId =
        category === 'run'
          ? (meta.agent_id as string | null) ?? null
          : category === 'agent'
            ? row.target_id ?? null
            : (meta.agent_id as string | null) ?? null;

      const agent_name = agentId ? (nameMap.get(agentId) ?? null) : null;

      return {
        id: row.id,
        category,
        action: row.action,
        agent_id: agentId,
        agent_name,
        run_id: category === 'run' ? row.target_id ?? null : null,
        approval_id: category === 'approval' ? row.target_id ?? null : null,
        cost_usd:
          category === 'run' && meta.cost_usd != null
            ? Number(meta.cost_usd)
            : null,
        status:
          category === 'run'
            ? action === 'agent_run_completed'
              ? 'completed'
              : 'failed'
            : null,
        tool_name:
          category === 'approval'
            ? (meta.tool_name as string | null) ?? null
            : null,
        created_at: row.created_at,
      };
    });
  } catch {
    return [];
  }
}

interface ActivityFeedProps {
  initialRows: ActivityRowType[];
  /**
   * Injected fetch function — used in tests to spy on re-fetch calls without
   * relying on the actual Supabase client. Defaults to clientFetchActivityFeed.
   */
  _fetchFn?: (limit?: number) => Promise<ActivityRowType[]>;
}

export function ActivityFeed({
  initialRows,
  _fetchFn = clientFetchActivityFeed,
}: ActivityFeedProps) {
  const [rows, setRows] = useState<ActivityRowType[]>(initialRows);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = () => {
    void _fetchFn(20).then(setRows).catch(() => {});
  };

  const scheduleRefetch = () => {
    if (timerRef.current) return; // already pending — do NOT reset the timer
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      refetch();
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    const sb = createClient();
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        sb.realtime.setAuth(session.access_token);
      }
    })();

    const ch = sb
      .channel('home-activity')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'agentos',
        table: 'audit_logs',
      }, () => scheduleRefetch())
      .subscribe();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      sb.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-testid="activity-feed" role="list">
      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="px-md py-lg text-text-muted text-[13px]">
              No activity yet today.
            </div>
          ) : (
            rows.map((row) => <ActivityRow key={row.id} row={row} />)
          )}
        </CardBody>
      </Card>
    </div>
  );
}
