import { notFound } from 'next/navigation';
import { requireAdminOrOwner } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { EditAgentForm } from './EditAgentForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { ToolPermissionsSection } from './_components/ToolPermissionsSection';

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase
    .schema('agentos')
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();
  if (!agent) return notFound();
  await requireAdminOrOwner(`/agentos/agents/${id}/edit`, agent.owner_id);

  // Phase 6 / Plan 06-02: load existing tool permissions for this agent.
  // Empty array on missing rows or pre-migration DB — section renders all-zero
  // and the user can save fresh defaults.
  const { data: permsData } = await supabase
    .schema('agentos')
    .from('agent_tool_permissions')
    .select('tool_name, level')
    .eq('agent_id', id);
  const initialPerms = (permsData ?? []) as { tool_name: string; level: string }[];

  const editingTitle = 'Edit: ' + agent.name;

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader title={editingTitle} />
      <EditAgentForm agent={agent} />
      <ToolPermissionsSection agentId={id} initialPerms={initialPerms} />
    </section>
  );
}
