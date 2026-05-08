import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { AgentActions } from './AgentActions';
import { AgentTabs, type TabKey } from './AgentTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { ChatInterface } from './chat/ChatInterface';

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

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
      'id, status, cost_usd, started_at, completed_at, trigger_type, parent_thread_id',
    )
    .eq('agent_id', id)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(20);

  const isAdmin = claims.app_role === 'admin';
  const isOwner = claims.sub === agent.owner_id;
  const canEdit = isAdmin || isOwner;
  const isDraft = !!(agent as { is_draft?: boolean }).is_draft;

  // CONTEXT.md decision #9 (locked): Chat is the default landing tab for activated agents.
  // Drafts have no Chat tab, so drafts default to Overview. Explicit ?tab= always wins.
  const tab: TabKey =
    (sp.tab as TabKey) ?? (isDraft ? 'overview' : 'chat');

  // Fetch the most recent chat run for this user+agent (for chat thread continuity).
  // Only needed when rendering chat tab, but cheap enough to fetch unconditionally.
  const { data: latestChatRunRows } = await supabase
    .schema('agentos')
    .from('agent_runs')
    .select('id, parent_thread_id, status, created_at')
    .eq('agent_id', id)
    .eq('triggered_by', claims.sub)
    .eq('trigger_type', 'chat')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1);
  const latestChatRunId = latestChatRunRows?.[0]?.id ?? null;

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
              {isDraft ? ' (draft)' : ''}
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

      <AgentTabs
        agentId={id}
        currentTab={tab}
        isDraft={isDraft}
        canEdit={canEdit}
      />

      {tab === 'overview' && (
        <OverviewContent
          agent={agent}
          recentRuns={recentRuns ?? []}
          editHref={editHref}
        />
      )}

      {tab === 'chat' && !isDraft && (
        <ChatInterface
          agentId={id}
          userId={claims.sub}
          initialLatestRunId={latestChatRunId}
        />
      )}

      {tab === 'chat' && isDraft && (
        <div
          data-testid="chat-disabled-for-draft"
          className="rounded border border-border bg-surface-raised p-md text-text-muted text-[13px]"
        >
          Activate this agent before using chat.
        </div>
      )}

      {tab === 'runs' && <RunsContent recentRuns={recentRuns ?? []} />}

      {tab === 'logs' && <LogsContent agentId={id} />}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tab content components (server-rendered)
// ---------------------------------------------------------------------------

type RecentRun = {
  id: string;
  status: string;
  cost_usd: number | null;
  started_at: string | null;
  completed_at: string | null;
  trigger_type: string | null;
  parent_thread_id?: string | null;
};

function OverviewContent({
  agent,
  recentRuns,
  editHref,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: Record<string, any>;
  recentRuns: RecentRun[];
  editHref: string;
}) {
  return (
    <>
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

      <div className="flex items-center justify-between mt-md">
        <h2 className="text-[14px] font-semibold">Recent runs</h2>
        <Link
          href={editHref}
          data-testid="edit-link-overview"
          className="text-accent text-[13px] hover:underline"
        >
          Edit agent
        </Link>
      </div>

      <RunsTable runs={recentRuns} />
    </>
  );
}

function RunsContent({ recentRuns }: { recentRuns: RecentRun[] }) {
  return (
    <>
      <h2 className="text-[14px] font-semibold">All recent runs</h2>
      <RunsTable runs={recentRuns} />
    </>
  );
}

function RunsTable({ runs }: { runs: RecentRun[] }) {
  return (
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
        {runs.map((r) => {
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
        {runs.length === 0 && (
          <Tr>
            <Td colSpan={6} className="text-center text-text-muted p-md">
              No runs yet.
            </Td>
          </Tr>
        )}
      </TBody>
    </Table>
  );
}

function LogsContent({ agentId }: { agentId: string }) {
  return (
    <div className="flex flex-col gap-sm text-[13px]">
      <p className="text-text-muted">
        Streaming logs for this agent are available in the full logs viewer.
      </p>
      <Link
        href={`/agentos/logs?agent_id=${agentId}`}
        data-testid="logs-deep-link"
        className="text-accent hover:underline"
      >
        View full logs for this agent
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

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
