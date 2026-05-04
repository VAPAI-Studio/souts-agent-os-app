import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { AgentActions } from './AgentActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const claims = await requireAgentosRole(`/agentos/agents/${id}`);
  const supabase = await createClient();

  const { data: agent, error } = await supabase
    .schema('agentos')
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !agent) return notFound();

  const { data: recentRuns } = await supabase
    .schema('agentos')
    .from('agent_runs')
    .select(
      'id, status, cost_usd, started_at, completed_at, trigger_type',
    )
    .eq('agent_id', id)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(20);

  const isAdmin = claims.app_role === 'admin';
  const isOwner = claims.sub === agent.owner_id;
  const canEdit = isAdmin || isOwner;
  const editHref = `/agentos/agents/${id}/edit`;

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title={<span data-testid="agent-name">{agent.name}</span>}
        meta={
          <>
            <Badge
              tone={statusToTone(agent.status)}
              data-testid="agent-status-badge"
            >
              {agent.status}
            </Badge>
            {agent.deleted_at && (
              <span className="text-destructive text-[12px]">(deleted)</span>
            )}
          </>
        }
        actions={
          <>
            {canEdit && (
              <Button asChild intent="secondary" size="sm">
                <Link href={editHref} data-testid="edit-link">
                  Edit
                </Link>
              </Button>
            )}
            {isAdmin && !agent.deleted_at && <AgentActions agent={agent} />}
          </>
        }
      />

      <h2 className="text-[14px] font-semibold mt-md">Configuration</h2>
      <dl
        data-testid="agent-config"
        className="grid grid-cols-[max-content_1fr] gap-x-md gap-y-sm text-[13px]"
      >
        <dt className="text-text-muted">Department</dt>
        <dd className="text-text">{agent.department}</dd>
        <dt className="text-text-muted">Autonomy level</dt>
        <dd className="text-text">{agent.autonomy_level}</dd>
        <dt className="text-text-muted">Model tier</dt>
        <dd className="text-text">{agent.model_tier}</dd>
        <dt className="text-text-muted">max_turns</dt>
        <dd className="text-text">{agent.max_turns}</dd>
        <dt className="text-text-muted">Budget cap (USD)</dt>
        <dd className="text-text">{agent.budget_cap_usd}</dd>
        <dt className="text-text-muted">Sensitive tools</dt>
        <dd className="text-text">
          {(agent.config?.sensitive_tools ?? []).join(', ') || '(none)'}
        </dd>
        <dt className="text-text-muted">Denylist globs</dt>
        <dd className="text-text">
          {(agent.config?.denylist_globs ?? []).join(', ') || '(none)'}
        </dd>
        <dt className="text-text-muted">System prompt</dt>
        <dd className="col-span-2">
          <pre className="font-mono text-[12px] bg-surface-raised border border-border rounded p-md whitespace-pre-wrap">
            {agent.system_prompt}
          </pre>
        </dd>
      </dl>

      <h2 className="text-[14px] font-semibold mt-md">Recent runs</h2>
      <Table data-testid="recent-runs-table">
        <THead>
          <Tr>
            <Th>Status</Th>
            <Th>Trigger</Th>
            <Th>Cost</Th>
            <Th>Started</Th>
            <Th>Ended</Th>
            <Th>Run</Th>
          </Tr>
        </THead>
        <TBody>
          {(recentRuns ?? []).map((r) => {
            const costString = '$' + Number(r.cost_usd ?? 0).toFixed(4);
            const runHref = `/agentos/runs/${r.id}`;
            return (
              <Tr key={r.id} data-testid={`run-row-${r.id}`}>
                <Td>
                  <Badge tone={statusToTone(r.status)}>{r.status}</Badge>
                </Td>
                <Td className="text-text-muted">{r.trigger_type}</Td>
                <Td className="font-mono">{costString}</Td>
                <Td className="font-mono text-text-muted">
                  {r.started_at
                    ? new Date(r.started_at).toLocaleString()
                    : '—'}
                </Td>
                <Td className="font-mono text-text-muted">
                  {r.completed_at
                    ? new Date(r.completed_at).toLocaleString()
                    : '—'}
                </Td>
                <Td>
                  <Link
                    href={runHref}
                    className="text-accent hover:underline"
                  >
                    open
                  </Link>
                </Td>
              </Tr>
            );
          })}
          {(recentRuns ?? []).length === 0 && (
            <Tr>
              <Td colSpan={6} className="text-center text-text-muted p-md">
                No runs yet. Trigger a run from above.
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>
    </section>
  );
}

type Tone = 'success' | 'warning' | 'destructive' | 'neutral';
function statusToTone(status: string): Tone {
  switch (status) {
    case 'active':
    case 'completed':
      return 'success';
    case 'paused':
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
