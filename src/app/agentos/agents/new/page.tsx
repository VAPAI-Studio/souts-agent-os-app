import { requireAdmin } from '@/lib/supabase/agentos';
import { NewAgentForm } from './NewAgentForm';
import { PageHeader } from '@/components/ui/PageHeader';

export default async function NewAgentPage() {
  await requireAdmin('/agentos/agents/new');
  return (
    <section className="flex flex-col gap-lg">
      <PageHeader title="New agent" />
      <NewAgentForm />
    </section>
  );
}
