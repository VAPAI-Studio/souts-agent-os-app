import Link from 'next/link';
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ToolInputCard } from './_components/ToolInputCard';
import { ApprovalRealtimeList } from './_components/ApprovalRealtimeList';

type Scope = 'pending' | 'decided';
interface AgentJoin { name: string | null; department: string | null }
interface ApprovalListRow {
  id: string;
  run_id: string;
  agent_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  context_summary: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expires_at: string;
  created_at: string;
  decided_at: string | null;
  agents: AgentJoin | AgentJoin[] | null;
}

function statusTone(status: string): 'warning' | 'success' | 'destructive' | 'neutral' {
  switch (status) {
    case 'pending': return 'warning';
    case 'approved': return 'success';
    case 'rejected': return 'destructive';
    case 'expired': return 'destructive';
    default: return 'neutral';
  }
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: Scope }>;
}) {
  await requireAdmin('/agentos/approvals');
  const params = await searchParams;
  const scope: Scope = (params?.scope as Scope) ?? 'pending';
  const supabase = await createClient();

  let query = supabase
    .schema('agentos')
    .from('approval_requests')
    .select('id, run_id, agent_id, tool_name, tool_input, context_summary, status, expires_at, created_at, decided_at, agents!inner(name, department)');

  if (scope === 'pending') {
    query = query.eq('status', 'pending').order('created_at', { ascending: false });
  } else {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    query = query.neq('status', 'pending').gte('decided_at', since).order('decided_at', { ascending: false });
  }

  const { data: rows, error } = await query;
  const initialRows: ApprovalListRow[] = (rows as unknown as ApprovalListRow[]) ?? [];

  return (
    <div className="flex flex-col gap-lg" data-testid="approvals-page">
      <PageHeader title="Approvals" meta={<span className="text-[12px] text-text-muted">{initialRows.length} {scope}</span>} />

      <nav aria-label="Approvals scope" className="flex gap-sm border-b border-border">
        {(['pending', 'decided'] as Scope[]).map((s) => (
          <Link
            key={s}
            href={`/agentos/approvals?scope=${s}`}
            data-testid={`scope-tab-${s}`}
            className={
              s === scope
                ? 'px-md py-sm border-b-2 border-accent text-accent text-[13px]'
                : 'px-md py-sm border-b-2 border-transparent text-text-muted hover:text-text text-[13px]'
            }
          >
            {s === 'pending' ? 'Pending' : 'Decided (24h)'}
          </Link>
        ))}
      </nav>

      {error && (
        <Card>
          <CardBody>
            <span data-testid="approvals-load-error" className="text-destructive text-[13px]">
              Failed to load approvals: {error.message}
            </span>
          </CardBody>
        </Card>
      )}

      {!error && initialRows.length === 0 && (
        <Card>
          <CardBody>
            <h2 className="text-[16px] font-semibold mb-xs">
              {scope === 'pending' ? 'No pending approvals' : 'No decisions in the last 24 hours'}
            </h2>
            <p className="text-[13px] text-text-muted">
              {scope === 'pending'
                ? 'When an agent attempts a sensitive action it will appear here.'
                : 'Approve / reject / edit history shows here for 24 hours after decision.'}
            </p>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-col gap-md">
        {initialRows.map((row) => {
          const agent = Array.isArray(row.agents) ? row.agents[0] : row.agents;
          return (
            <Card key={row.id} data-testid={`approval-row-${row.id}`}>
              <CardBody>
                <div className="flex flex-col gap-sm">
                  <div className="flex items-center gap-sm">
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    <span className="font-mono text-[12px] text-text-muted">{row.tool_name}</span>
                    <span className="text-[12px] text-text-muted">{agent?.name ?? row.agent_id.slice(0, 8)}</span>
                    <span className="text-[12px] text-text-muted ml-auto font-mono">{row.created_at?.slice(0, 19)}</span>
                  </div>
                  {row.context_summary && (<p className="text-[13px] text-text-muted">{row.context_summary}</p>)}
                  <ToolInputCard tool_name={row.tool_name} input={row.tool_input} />
                  {row.status === 'pending' && (
                    <div className="flex gap-sm">
                      <Button asChild intent="primary" size="sm" data-testid={`open-approval-${row.id}`}>
                        <Link href={`/agentos/approvals/${row.id}`}>Review</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {scope === 'pending' && (
        <ApprovalRealtimeList initialIds={initialRows.map((r) => r.id)} />
      )}
    </div>
  );
}
