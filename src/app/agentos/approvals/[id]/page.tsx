import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ToolInputCard } from '../_components/ToolInputCard';
import { ApprovalDecisionPanel } from '../_components/ApprovalDecisionPanel';

interface DetailRow {
  id: string;
  run_id: string;
  agent_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  modified_input: Record<string, unknown> | null;
  context_summary: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  expires_at: string;
  created_at: string;
  agents: { name: string | null; department: string | null } | null;
}

function statusTone(status: string): 'warning' | 'success' | 'destructive' | 'neutral' {
  switch (status) {
    case 'pending': return 'warning';
    case 'approved': return 'success';
    case 'rejected':
    case 'expired': return 'destructive';
    default: return 'neutral';
  }
}

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin('/agentos/approvals');
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema('agentos')
    .from('approval_requests')
    .select('id, run_id, agent_id, tool_name, tool_input, modified_input, context_summary, status, decided_by, decided_at, decision_reason, expires_at, created_at, agents!inner(name, department)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <Card>
        <CardBody>
          <span data-testid="approval-load-error" className="text-destructive text-[13px]">
            Failed to load approval: {error.message}
          </span>
        </CardBody>
      </Card>
    );
  }

  if (!data) notFound();
  const row = data as unknown as DetailRow;
  const agent = row.agents;

  return (
    <div className="flex flex-col gap-lg" data-testid={`approval-detail-${id}`}>
      <PageHeader
        title="Review approval"
        meta={<span className="text-[12px] text-text-muted">{agent?.name ?? row.agent_id.slice(0, 8)} · {row.tool_name}</span>}
        actions={
          <Button asChild intent="ghost" size="sm">
            <Link href="/agentos/approvals">Back to inbox</Link>
          </Button>
        }
      />

      <Card>
        <CardBody>
          <div className="flex flex-col gap-sm">
            <div className="flex items-center gap-sm">
              <Badge tone={statusTone(row.status)}>{row.status}</Badge>
              <span className="font-mono text-[12px] text-text-muted">{row.tool_name}</span>
              <span className="text-[12px] text-text-muted ml-auto font-mono">
                expires {row.expires_at?.slice(0, 19)}
              </span>
            </div>
            {row.context_summary && (
              <p className="text-[13px] text-text-muted" data-testid="context-summary">{row.context_summary}</p>
            )}
            <div className="text-[12px] text-text-muted">
              Run{' '}
              <Link href={`/agentos/agents/${row.agent_id}`} className="font-mono text-accent hover:underline">
                {row.run_id.slice(0, 8)}
              </Link>
            </div>
          </div>
        </CardBody>
      </Card>

      <h2 className="text-[14px] font-semibold">Tool input</h2>
      <ToolInputCard tool_name={row.tool_name} input={row.tool_input} />

      {row.status === 'pending' ? (
        <ApprovalDecisionPanel
          approval_id={row.id}
          tool_name={row.tool_name}
          tool_input={row.tool_input}
        />
      ) : (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-xs">
              <h3 className="text-[14px] font-semibold">Decision</h3>
              <div className="text-[13px] text-text-muted">
                {row.status} {row.decided_at ? `at ${row.decided_at.slice(0, 19)}` : ''}{' '}
                {row.decided_by ? `by ${row.decided_by.slice(0, 8)}` : ''}
              </div>
              {row.decision_reason && (<div className="text-[13px]">Reason: {row.decision_reason}</div>)}
              {row.modified_input && (
                <>
                  <div className="text-[12px] text-text-muted mt-sm">Modified input applied:</div>
                  <pre className="font-mono text-[12px] bg-surface p-sm rounded border border-border whitespace-pre-wrap">
                    {JSON.stringify(row.modified_input, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
