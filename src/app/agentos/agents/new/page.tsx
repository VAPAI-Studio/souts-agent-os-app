import { requireAdmin } from '@/lib/supabase/agentos';
import { NewAgentForm } from './NewAgentForm';

export default async function NewAgentPage() {
  await requireAdmin('/agentos/agents/new');
  return (
    <section>
      <h1>New agent</h1>
      <NewAgentForm />
    </section>
  );
}
