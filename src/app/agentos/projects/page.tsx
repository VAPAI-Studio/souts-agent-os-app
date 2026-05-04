import Link from 'next/link';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';

const STATUS_TONE: Record<
  string,
  'success' | 'warning' | 'neutral' | 'destructive' | 'accent'
> = {
  active: 'success',
  on_hold: 'warning',
  completed: 'neutral',
  archived: 'neutral',
};

export default async function ProjectsListPage() {
  await requireAgentosRole('/agentos/projects');
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .schema('agentos')
    .from('projects')
    .select('id, name, description, status, owner_id, updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  return (
    <div className="flex flex-col gap-lg" data-testid="projects-page">
      <PageHeader
        title="Projects"
        actions={
          <Button
            asChild
            intent="primary"
            size="sm"
            data-testid="new-project-link"
          >
            <Link href="/agentos/projects/new">New project</Link>
          </Button>
        }
      />

      {error && (
        <Card>
          <CardBody>
            <span
              data-testid="projects-load-error"
              className="text-destructive text-[13px]"
            >
              Failed to load projects: {error.message}. Refresh the page or
              check your connection.
            </span>
          </CardBody>
        </Card>
      )}

      {!error && (!projects || projects.length === 0) && (
        <Card>
          <CardBody>
            <h2 className="text-[16px] font-semibold mb-xs">No projects yet</h2>
            <p className="text-[13px] text-text-muted">
              Create your first project to organize agents and vault files.
            </p>
          </CardBody>
        </Card>
      )}

      {projects && projects.length > 0 && (
        <Card>
          <Table data-testid="projects-table">
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Description</Th>
                <Th>Updated</Th>
                <Th>Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {projects.map((p) => (
                <Tr key={p.id} data-testid={`project-row-${p.id}`}>
                  <Td>
                    <span className="font-medium">{p.name}</span>
                  </Td>
                  <Td>
                    <Badge
                      tone={STATUS_TONE[p.status] ?? 'neutral'}
                      data-testid={`project-status-${p.id}`}
                    >
                      {p.status}
                    </Badge>
                  </Td>
                  <Td className="max-w-md truncate text-text-muted">
                    {p.description ?? ''}
                  </Td>
                  <Td>
                    <span className="font-mono text-[12px]">
                      {p.updated_at?.slice(0, 19)}
                    </span>
                  </Td>
                  <Td>
                    <Button
                      asChild
                      intent="ghost"
                      size="sm"
                      data-testid={`open-project-${p.id}`}
                    >
                      <Link href={`/agentos/projects/${p.id}`}>Open</Link>
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
