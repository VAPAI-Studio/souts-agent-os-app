import Link from 'next/link';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';

export default async function AgentsListPage() {
  const claims = await requireAgentosRole('/agentos/agents');
  const supabase = await createClient();

  // RLS in Plan 01-02 already filters by role: admin sees all, others see what
  // they're entitled to. We just filter out soft-deleted rows.
  const { data: agents, error } = await supabase
    .schema('agentos')
    .from('agents')
    .select(
      'id, name, department, status, autonomy_level, model_tier, owner_id, updated_at, created_at',
    )
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
      {error ? (
        <p data-testid="agents-load-error" className="text-destructive">
          Failed to load agents: {error.message}. Refresh the page or check your connection.
        </p>
      ) : (
        <Table data-testid="agents-table">
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th>Autonomy</Th>
              <Th>Model</Th>
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
                <Td colSpan={7} className="text-center text-text-muted p-md">
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
