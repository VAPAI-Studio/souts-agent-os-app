import { notFound } from 'next/navigation';
import { requireAdminOrOwner } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { EditAgentForm } from './EditAgentForm';

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

  return (
    <section>
      <h1>Edit: {agent.name}</h1>
      <EditAgentForm agent={agent} />
    </section>
  );
}
