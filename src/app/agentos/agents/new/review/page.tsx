/**
 * Step 8: Review / Test — server route.
 *
 * Reads the draft from DB, fetches the user's connected tool_connections to
 * compute the MCP gate state, then renders WizardStepper + ReviewStep.
 *
 * Plan 08-03 / Phase 8 / AGENT-11
 */
import { redirect } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { WizardStepper } from '../_components/WizardStepper';
import { ReviewStep } from './ReviewStep';

export default async function ReviewStepPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const params = await searchParams;
  const draftId = params.draft;

  const claims = await requireAgentosRole('/agentos/agents/new/review');
  const supabase = await createClient();

  if (!draftId) redirect('/agentos/agents/new');

  const { data: draft } = await supabase
    .schema('agentos')
    .from('agents')
    .select('*')
    .eq('id', draftId)
    .eq('is_draft', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (!draft) redirect('/agentos/agents/new');

  // Fetch user's connected tool_connections to compute MCP gate state.
  const { data: connections } = await supabase
    .schema('agentos')
    .from('tool_connections')
    .select('integration_type, status')
    .eq('user_id', claims.sub)
    .eq('status', 'connected');

  const connectedSet = new Set((connections ?? []).map((c) => c.integration_type as string));

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Create new agent"
        meta={<span className="text-sm text-muted-foreground">Step 8 of 8 — Review &amp; Test</span>}
      />
      <WizardStepper currentStep={8} draftId={draftId} maxCompletedStep={7} />
      <ReviewStep draft={draft as Record<string, unknown>} connectedServers={[...connectedSet]} />
    </section>
  );
}
