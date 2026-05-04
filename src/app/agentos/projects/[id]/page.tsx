import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { AssignAgentDialog } from './AssignAgentDialog';

type RunRow = {
  id: string;
  agent_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAgentosRole(`/agentos/projects/${id}`);
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .schema('agentos')
    .from('projects')
    .select('id, name, description, status, owner_id, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error || !project) notFound();

  // PROJ-03: project's agents
  const { data: agents } = await supabase
    .schema('agentos')
    .from('agents')
    .select('id, name, department, status, autonomy_level, model_tier, owner_id')
    .eq('project_id', id)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  // PROJ-03: recent runs (activity) — joined via agent.project_id.
  const agentIds = (agents ?? []).map((a) => a.id);
  let recent_runs: RunRow[] = [];
  if (agentIds.length > 0) {
    const { data } = await supabase
      .schema('agentos')
      .from('agent_runs')
      .select('id, agent_id, status, started_at, completed_at, updated_at')
      .in('agent_id', agentIds)
      .order('updated_at', { ascending: false })
      .limit(20);
    recent_runs = (data ?? []) as RunRow[];
  }

  // PROJ-03: tasks (decisions / risks placeholder).
  const { data: tasks } = await supabase
    .schema('agentos')
    .from('tasks')
    .select('id, title, status, due_at, assigned_to')
    .eq('project_id', id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(10);

  return (
    <div className="flex flex-col gap-lg" data-testid="project-detail-page">
      <PageHeader
        title={
          <span className="flex items-center gap-sm">
            <span data-testid="project-name">{project.name}</span>
            <Badge tone={project.status === 'active' ? 'success' : 'neutral'}>
              {project.status}
            </Badge>
          </span>
        }
        actions={
          <div className="flex gap-sm">
            <Button
              asChild
              intent="ghost"
              size="sm"
              data-testid="vault-link"
            >
              <Link
                href={`/agentos/vault?scope=project&project_id=${id}`}
              >
                Vault
              </Link>
            </Button>
            <Button
              asChild
              intent="secondary"
              size="sm"
              data-testid="edit-project-link"
            >
              <Link href={`/agentos/projects/${id}/edit`}>Edit</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>Description</CardHeader>
        <CardBody>
          <p className="text-[13px] whitespace-pre-wrap">
            {project.description ?? '—'}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <span className="flex items-center justify-between w-full">
            <span>Agents ({agents?.length ?? 0})</span>
            <AssignAgentDialog projectId={id} />
          </span>
        </CardHeader>
        <CardBody>
          {!agents || agents.length === 0 ? (
            <p className="text-[13px] text-text-muted">
              No agents assigned. Click &quot;Assign agent&quot; to add one.
            </p>
          ) : (
            <Table data-testid="project-agents-table">
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Department</Th>
                  <Th>Status</Th>
                  <Th>Autonomy</Th>
                  <Th>Tier</Th>
                </Tr>
              </THead>
              <TBody>
                {agents.map((a) => (
                  <Tr key={a.id} data-testid={`project-agent-${a.id}`}>
                    <Td>
                      <Link
                        href={`/agentos/agents/${a.id}`}
                        className="text-accent hover:underline"
                      >
                        {a.name}
                      </Link>
                    </Td>
                    <Td>{a.department}</Td>
                    <Td>
                      <Badge
                        tone={a.status === 'active' ? 'success' : 'warning'}
                      >
                        {a.status}
                      </Badge>
                    </Td>
                    <Td>{a.autonomy_level}</Td>
                    <Td>{a.model_tier}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Recent activity</CardHeader>
        <CardBody>
          {recent_runs.length === 0 ? (
            <p className="text-[13px] text-text-muted">No runs yet.</p>
          ) : (
            <Table data-testid="project-activity-table">
              <THead>
                <Tr>
                  <Th>Run</Th>
                  <Th>Agent</Th>
                  <Th>Status</Th>
                  <Th>Started</Th>
                </Tr>
              </THead>
              <TBody>
                {recent_runs.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <span className="font-mono text-[12px]">
                        {r.id.slice(0, 8)}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/agentos/agents/${r.agent_id}`}
                        className="text-accent hover:underline"
                      >
                        {r.agent_id.slice(0, 8)}
                      </Link>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          r.status === 'completed'
                            ? 'success'
                            : r.status === 'failed'
                              ? 'destructive'
                              : 'warning'
                        }
                      >
                        {r.status}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px]">
                        {r.started_at?.slice(0, 19) ?? '—'}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Decisions &amp; risks (tasks)</CardHeader>
        <CardBody>
          {!tasks || tasks.length === 0 ? (
            <p className="text-[13px] text-text-muted">No tasks yet.</p>
          ) : (
            <Table data-testid="project-tasks-table">
              <THead>
                <Tr>
                  <Th>Title</Th>
                  <Th>Status</Th>
                  <Th>Due</Th>
                </Tr>
              </THead>
              <TBody>
                {tasks.map((t) => (
                  <Tr key={t.id}>
                    <Td>{t.title}</Td>
                    <Td>
                      <Badge
                        tone={t.status === 'done' ? 'success' : 'warning'}
                      >
                        {t.status}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px]">
                        {t.due_at?.slice(0, 10) ?? '—'}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
