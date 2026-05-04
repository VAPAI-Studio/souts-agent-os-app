import Link from 'next/link';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { LogsFilterBar } from './LogsFilterBar';
import { RetentionNotice } from './RetentionNotice';

const PAGE_SIZE = 50;
const RUN_STATUSES = [
  'queued',
  'dispatched',
  'running',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const;

type SearchParams = {
  agent_id?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
  tool_name?: string;
  page?: string;
};

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

function buildQs(params: Record<string, string | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) out.set(k, v);
  }
  return out.toString();
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAgentosRole('/agentos/logs');
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, Number(sp.page || 1));
  const offset = (page - 1) * PAGE_SIZE;

  // Default last 7 days
  const defaultFrom = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const fromIso = sp.from_date
    ? new Date(sp.from_date).toISOString()
    : defaultFrom;
  const toIso = sp.to_date
    ? new Date(sp.to_date).toISOString()
    : new Date().toISOString();

  // Agents for the filter dropdown
  const { data: agentsForFilter } = await supabase
    .schema('agentos')
    .from('agents')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  // Build the runs query
  let q = supabase
    .schema('agentos')
    .from('agent_runs')
    .select(
      'id, agent_id, status, cost_usd, started_at, completed_at, trigger_type, error_message',
      { count: 'exact' },
    )
    .gte('started_at', fromIso)
    .lte('started_at', toIso)
    .order('started_at', { ascending: false, nullsFirst: false });

  if (sp.agent_id) q = q.eq('agent_id', sp.agent_id);
  if (sp.status && (RUN_STATUSES as readonly string[]).includes(sp.status)) {
    q = q.eq('status', sp.status);
  }

  // tool_name filter: subquery on tool_call_logs to find run_ids that have
  // a matching tool_call_log row, then filter agent_runs.id IN those.
  if (sp.tool_name) {
    const { data: matchingRunIds } = await supabase
      .schema('agentos')
      .from('tool_call_logs')
      .select('run_id')
      .eq('tool_name', sp.tool_name);
    const ids = Array.from(
      new Set((matchingRunIds ?? []).map((r) => r.run_id)),
    );
    if (ids.length === 0) {
      return (
        <section className="flex flex-col gap-lg">
          <PageHeader title="Logs" />
          <RetentionNotice />
          <LogsFilterBar agents={agentsForFilter ?? []} initial={sp} />
          <p
            data-testid="no-results"
            className="text-text-muted text-[13px] font-sans"
          >
            No runs match the tool_name filter.
          </p>
        </section>
      );
    }
    q = q.in('id', ids);
  }

  const { data: runs, count, error } = await q.range(
    offset,
    offset + PAGE_SIZE - 1,
  );

  if (error) {
    return (
      <section className="flex flex-col gap-lg">
        <PageHeader title="Logs" />
        <RetentionNotice />
        <LogsFilterBar agents={agentsForFilter ?? []} initial={sp} />
        <p
          data-testid="logs-error"
          className="text-destructive text-[13px] font-sans"
        >
          Failed to load logs: {error.message}
        </p>
      </section>
    );
  }

  const agentNameMap = new Map(
    (agentsForFilter ?? []).map((a) => [a.id, a.name]),
  );

  const totalPages = count && count > 0 ? Math.ceil(count / PAGE_SIZE) : 1;
  const showingCount = (runs ?? []).length;

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader title="Logs" />
      <RetentionNotice />
      <LogsFilterBar agents={agentsForFilter ?? []} initial={sp} />

      <p
        data-testid="logs-summary"
        className="text-text-muted text-[12px] font-sans"
      >
        Showing {showingCount} of {count ?? 0} runs (page {page} of {totalPages})
      </p>

      <Table data-testid="logs-table">
        <THead>
          <Tr>
            <Th>Started</Th>
            <Th>Agent</Th>
            <Th>Status</Th>
            <Th>Trigger</Th>
            <Th>Cost</Th>
            <Th>Duration</Th>
            <Th>Run</Th>
          </Tr>
        </THead>
        <TBody>
          {(runs ?? []).map((r) => {
            const dur =
              r.started_at && r.completed_at
                ? Math.round(
                    (new Date(r.completed_at).getTime() -
                      new Date(r.started_at).getTime()) /
                      1000,
                  )
                : null;
            return (
              <Tr key={r.id} data-testid={`logs-row-${r.id}`}>
                <Td>
                  <span className="font-mono text-text-muted text-[12px]">
                    {r.started_at
                      ? new Date(r.started_at).toLocaleString()
                      : '-'}
                  </span>
                </Td>
                <Td>
                  <Link
                    href={`/agentos/agents/${r.agent_id}`}
                    className="text-accent underline underline-offset-2"
                  >
                    {agentNameMap.get(r.agent_id) ?? r.agent_id}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={statusToTone(r.status)}>{r.status}</Badge>
                </Td>
                <Td>{r.trigger_type}</Td>
                <Td>
                  <span className="font-mono">
                    ${Number(r.cost_usd ?? 0).toFixed(4)}
                  </span>
                </Td>
                <Td>
                  {dur !== null ? (
                    <span className="font-mono text-text-muted">{dur}s</span>
                  ) : (
                    <span className="text-text-muted">-</span>
                  )}
                </Td>
                <Td>
                  <Link
                    href={`/agentos/runs/${r.id}`}
                    className="text-accent underline underline-offset-2"
                  >
                    open
                  </Link>
                </Td>
              </Tr>
            );
          })}
          {showingCount === 0 && (
            <Tr>
              <Td
                colSpan={7}
                className="text-center text-text-muted p-md"
                data-testid="no-runs"
              >
                No runs in this window.
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>

      <nav
        aria-label="logs pagination"
        data-testid="pagination"
        className="flex items-center gap-md"
      >
        {page > 1 ? (
          <Button asChild intent="secondary" size="sm">
            <Link
              href={`/agentos/logs?${buildQs({ ...sp, page: String(page - 1) })}`}
              data-testid="pagination-prev"
            >
              Previous
            </Link>
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="text-text-muted text-[12px] font-sans">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Button asChild intent="secondary" size="sm">
            <Link
              href={`/agentos/logs?${buildQs({ ...sp, page: String(page + 1) })}`}
              data-testid="pagination-next"
            >
              Next
            </Link>
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}
      </nav>
    </section>
  );
}
