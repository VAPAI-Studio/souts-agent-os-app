import Link from 'next/link';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { cn } from '@/lib/cn';

export default async function AgentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === 'drafts' ? 'drafts' : 'active';
  const isDraftFilter = tab === 'drafts';

  const claims = await requireAgentosRole('/agentos/agents');
  const supabase = await createClient();

  // RLS in Plan 01-02 already filters by role: admin sees all, others see what
  // they're entitled to. We just filter out soft-deleted rows.
  const { data: agents, error } = await supabase
    .schema('agentos')
    .from('agents')
    .select(
      'id, name, department, status, autonomy_level, model_tier, owner_id, updated_at, created_at, is_draft, next_run_at, schedule_enabled',
    )
    .eq('is_draft', isDraftFilter)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  // Resolve owner emails (auth.users not in PostgREST; service-role lookup like team/page.tsx)
  const ownerIds = (agents ?? []).map((a) => a.owner_id);
  const emailMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: usersData } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of usersData?.users ?? []) {
      if (ownerIds.includes(u.id)) emailMap.set(u.id, u.email ?? '(no email)');
    }
  }

  const tabLinkCls = (active: boolean) =>
    cn(
      'px-4 py-2 text-sm border-b-2 -mb-px',
      active
        ? 'border-accent text-accent'
        : 'border-transparent text-muted-foreground hover:text-foreground',
    );

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Agents"
        actions={
          claims.app_role === 'admin' && (
            <Button asChild intent="primary" size="sm">
              <Link href="/agentos/agents/new" data-testid="new-agent-link">
                New agent
              </Link>
            </Button>
          )
        }
      />

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border" data-testid="agents-tabs">
        <Link
          href="/agentos/agents"
          data-testid="active-tab"
          className={tabLinkCls(tab === 'active')}
        >
          Active
        </Link>
        <Link
          href="/agentos/agents?tab=drafts"
          data-testid="drafts-tab"
          className={tabLinkCls(tab === 'drafts')}
        >
          Drafts
        </Link>
      </div>

      {error ? (
        <p data-testid="agents-load-error" className="text-destructive">
          Failed to load agents: {error.message}. Refresh the page or check your connection.
        </p>
      ) : tab === 'active' ? (
        /* ---- Active agents table ---- */
        <Table data-testid="agents-table">
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th>Autonomy</Th>
              <Th>Model</Th>
              <Th>Next run</Th>
              <Th>Owner</Th>
              <Th>Updated</Th>
            </Tr>
          </THead>
          <TBody>
            {(agents ?? []).map((a) => (
              <Tr key={a.id} data-testid={`agent-row-${a.id}`}>
                <Td>
                  <Link
                    href={`/agentos/agents/${a.id}`}
                    className="text-accent hover:underline"
                  >
                    {a.name}
                  </Link>
                </Td>
                <Td>{a.department}</Td>
                <Td data-testid={`agent-status-${a.id}`}>
                  <Badge tone={statusToTone(a.status)}>{a.status}</Badge>
                </Td>
                <Td>{a.autonomy_level}</Td>
                <Td>{a.model_tier}</Td>
                <Td data-testid={`next-run-cell-${a.id}`}>
                  {a.schedule_enabled && a.next_run_at ? (
                    <span title={new Date(a.next_run_at).toISOString()}>
                      {formatRelativeTime(a.next_run_at)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </Td>
                <Td>{emailMap.get(a.owner_id) ?? a.owner_id}</Td>
                <Td>
                  <span className="font-mono text-text-muted">
                    {new Date(a.updated_at).toLocaleString()}
                  </span>
                </Td>
              </Tr>
            ))}
            {(agents ?? []).length === 0 && (
              <Tr>
                <Td colSpan={8} className="text-center text-text-muted p-md">
                  No agents yet.{' '}
                  <Link
                    href="/agentos/agents/new"
                    className="text-accent underline underline-offset-2"
                  >
                    Create your first agent
                  </Link>{' '}
                  to get started.
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      ) : (
        /* ---- Drafts table ---- */
        <>
          {(agents ?? []).length === 0 ? (
            <p data-testid="drafts-empty" className="text-muted-foreground text-sm">
              No drafts.{' '}
              <Link href="/agentos/agents/new" className="text-accent underline underline-offset-2">
                Click &ldquo;New agent&rdquo;
              </Link>{' '}
              to start.
            </p>
          ) : (
            <Table data-testid="drafts-table">
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Department</Th>
                  <Th>Created</Th>
                  <Th>Continue</Th>
                </Tr>
              </THead>
              <TBody>
                {(agents ?? []).map((a) => (
                  <Tr key={a.id} data-testid={`draft-row-${a.id}`}>
                    <Td>{a.name}</Td>
                    <Td>{a.department}</Td>
                    <Td>
                      <span className="font-mono text-text-muted text-xs">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </Td>
                    <Td>
                      <Button asChild size="sm" intent="secondary">
                        <Link href={`/agentos/agents/new/basic-info?draft=${a.id}`}>
                          Continue setup
                        </Link>
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </>
      )}
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

function formatRelativeTime(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const min = Math.floor(abs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const future = ms >= 0;
  if (day > 0) return future ? `in ${day}d` : `${day}d ago`;
  if (hr > 0) return future ? `in ${hr}h` : `${hr}h ago`;
  return future ? `in ${min}m` : `${min}m ago`;
}
