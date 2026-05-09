'use client';
/**
 * Phase 9 / Plan 09-03 — Home dashboard stat cards row.
 *
 * Renders 4 stat cards in a row below the CooCard:
 *   1. Approvals (pending count) — links to /agentos/approvals
 *   2. Active agents (+ errors substat) — links to /agentos/agents
 *   3. Cost today — links to /agentos/costs?period=today
 *   4. Next scheduled run (agent name + relative time) — links to /agentos/agents/<id>
 *
 * Realtime: subscribes to two channels on mount:
 *   - home-approvals: approval_requests INSERT/UPDATE → refetch approvals count
 *   - home-runs: agent_runs INSERT/UPDATE → refetch active/errors AND cost today
 *
 * Pitfall (Phase 5 #10): setAuth BEFORE subscribe. Pattern from PendingBadge.tsx.
 *
 * Design discipline (Phase 03.1):
 *   - No inline style attributes
 *   - No hex literals — Tailwind v4 tokens only
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StatCard } from '@/components/ui/StatCard';
import { formatRelativeTime } from '@/lib/utils/format';

interface HomeStatCardsProps {
  initialApprovals: number;
  initialActiveAgents: { active: number; errors: number };
  initialCostToday: number;
  initialNextScheduled: {
    agent_id: string;
    agent_name: string;
    next_run_at: string;
  } | null;
}

export function HomeStatCards({
  initialApprovals,
  initialActiveAgents,
  initialCostToday,
  initialNextScheduled,
}: HomeStatCardsProps) {
  const [approvals, setApprovals] = useState<number>(initialApprovals);
  const [activeAgents, setActiveAgents] = useState<{
    active: number;
    errors: number;
  }>(initialActiveAgents);
  const [costToday, setCostToday] = useState<number>(initialCostToday);
  // nextScheduled doesn't subscribe via Realtime (low-churn, acceptable to keep SSR value)
  const nextScheduled = initialNextScheduled;
  const sbRef = useRef(createClient());

  useEffect(() => {
    const sb = sbRef.current;
    let chApprovals: ReturnType<typeof sb.channel> | null = null;
    let chRuns: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;

    // --- Refetch helpers (client-side counts; JWT carries RLS scoping) ---

    async function refetchApprovals() {
      if (cancelled) return;
      const { count } = await sb
        .schema('agentos')
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (!cancelled && typeof count === 'number') setApprovals(count);
    }

    async function refetchActiveAgents() {
      if (cancelled) return;
      // Active agents count
      const { count: activeCount } = await sb
        .schema('agentos')
        .from('agents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('deleted_at', null);

      // Agents in error: distinct agent_ids with failed run in last 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: failedRuns } = await sb
        .schema('agentos')
        .from('agent_runs')
        .select('agent_id')
        .eq('status', 'failed')
        .gte('created_at', since);
      const errorCount = new Set(
        (failedRuns ?? []).map((r: { agent_id: string }) => r.agent_id),
      ).size;

      if (!cancelled) {
        setActiveAgents({
          active: typeof activeCount === 'number' ? activeCount : 0,
          errors: errorCount,
        });
      }
    }

    async function refetchCostToday() {
      if (cancelled) return;
      const todayMidnight = new Date();
      todayMidnight.setUTCHours(0, 0, 0, 0);
      const { data } = await sb
        .schema('agentos')
        .from('agent_runs')
        .select('cost_usd')
        .gte('created_at', todayMidnight.toISOString());
      if (!cancelled) {
        const total = (data ?? []).reduce(
          (sum: number, r: { cost_usd: number | null }) => sum + (r.cost_usd ?? 0),
          0,
        );
        setCostToday(total);
      }
    }

    (async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        // CRITICAL: setAuth BEFORE subscribe (Phase 5 pitfall #10)
        sb.realtime.setAuth(session.access_token);
      }

      chApprovals = sb
        .channel('home-approvals')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on('postgres_changes' as any, {
          event: '*',
          schema: 'agentos',
          table: 'approval_requests',
        }, () => void refetchApprovals())
        .subscribe();

      chRuns = sb
        .channel('home-runs')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on('postgres_changes' as any, {
          event: '*',
          schema: 'agentos',
          table: 'agent_runs',
        }, () => {
          void refetchActiveAgents();
          void refetchCostToday();
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (chApprovals) sb.removeChannel(chApprovals);
      if (chRuns) sb.removeChannel(chRuns);
    };
  }, []);

  return (
    <div className="grid grid-cols-4 gap-md">
      <StatCard
        label="Approvals"
        value={String(approvals)}
        href="/agentos/approvals"
        testId="stat-approvals"
      />
      <StatCard
        label="Active agents"
        value={String(activeAgents.active)}
        subStat={
          activeAgents.errors > 0
            ? { label: `${activeAgents.errors} in error`, tone: 'destructive' }
            : undefined
        }
        href="/agentos/agents"
        testId="stat-active-agents"
      />
      <StatCard
        label="Cost today"
        value={`$${costToday.toFixed(2)}`}
        href="/agentos/costs?period=today"
        testId="stat-cost-today"
      />
      <StatCard
        label="Next scheduled"
        value={
          nextScheduled ? formatRelativeTime(nextScheduled.next_run_at) : '—'
        }
        subStat={
          nextScheduled
            ? { label: nextScheduled.agent_name, tone: 'neutral' }
            : undefined
        }
        href={
          nextScheduled
            ? `/agentos/agents/${nextScheduled.agent_id}`
            : '/agentos/agents'
        }
        testId="stat-next-scheduled"
      />
    </div>
  );
}
