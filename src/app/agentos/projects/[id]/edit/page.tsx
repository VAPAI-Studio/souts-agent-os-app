import { notFound } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { EditProjectForm } from './EditProjectForm';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAgentosRole(`/agentos/projects/${id}/edit`);
  const supabase = await createClient();
  const { data: project } = await supabase
    .schema('agentos')
    .from('projects')
    .select('id, name, description, status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!project) notFound();
  return <EditProjectForm project={project} />;
}
