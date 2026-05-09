/**
 * Phase 9 / Plan 09-03 — Single row in the home dashboard activity feed.
 *
 * Pure presentational component — renders one audit_logs event as a clickable
 * row. Can be a Server Component or a client component; since ActivityFeed.tsx
 * is the 'use client' boundary, this component inherits that boundary and
 * renders client-side. No 'use client' directive needed here.
 *
 * Design discipline (Phase 03.1):
 *   - No inline style attributes
 *   - No hex literals — Tailwind v4 tokens only
 */
import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/utils/format';
import type { ActivityRow as ActivityRowType } from '../_data/home';

const categoryTone = {
  run: 'neutral',
  approval: 'warning',
  agent: 'neutral',
} as const;

const categoryLabel = {
  run: 'Run',
  approval: 'Approval',
  agent: 'Agent',
} as const;

function buildDescription(row: ActivityRowType): string {
  const agentName = row.agent_name ?? 'Unknown agent';
  switch (row.action) {
    case 'agent_run_completed':
      return row.cost_usd != null
        ? `${agentName} run completed — $${row.cost_usd.toFixed(4)}`
        : `${agentName} run completed`;
    case 'agent_run_failed':
      return `${agentName} run failed`;
    case 'approval_approve':
      return row.tool_name
        ? `${row.tool_name} approved`
        : 'Approval approved';
    case 'approval_reject':
      return row.tool_name
        ? `${row.tool_name} rejected`
        : 'Approval rejected';
    case 'approval_edit':
      return row.tool_name
        ? `${row.tool_name} edited & approved`
        : 'Approval edited';
    case 'agent_pause':
      return `${agentName} paused`;
    case 'agent_resume':
      return `${agentName} resumed`;
    case 'agent_auto_paused_budget':
      return `${agentName} paused (budget cap)`;
    default:
      return row.action;
  }
}

function buildHref(row: ActivityRowType): string {
  switch (row.category) {
    case 'run':
      // Link to agent detail page; run detail (/agentos/runs/<id>) not confirmed in Phase 3
      return row.agent_id ? `/agentos/agents/${row.agent_id}` : '/agentos/agents';
    case 'approval':
      return '/agentos/approvals';
    case 'agent':
      return row.agent_id ? `/agentos/agents/${row.agent_id}` : '/agentos/agents';
    default:
      return '/agentos/dashboard';
  }
}

interface ActivityRowProps {
  row: ActivityRowType;
}

export function ActivityRow({ row }: ActivityRowProps) {
  const tone = categoryTone[row.category];
  const label = categoryLabel[row.category];
  const description = buildDescription(row);
  const href = buildHref(row);

  return (
    <Link
      href={href}
      data-testid={`activity-row-${row.id}`}
      className="flex items-center gap-md px-md py-sm hover:bg-surface-raised border-b border-border last:border-b-0 text-sm no-underline"
    >
      {/* Category badge */}
      <Badge tone={tone} className="shrink-0 w-20 justify-center text-center">
        {label}
      </Badge>

      {/* Description */}
      <span className="flex-1 truncate text-text-primary text-[13px]">
        {description}
      </span>

      {/* Relative time */}
      <span className="shrink-0 text-text-muted text-[12px] tabular-nums">
        {formatRelativeTime(row.created_at)}
      </span>
    </Link>
  );
}
