/**
 * Step 6: Autonomy — server route
 * Plan 08-02 / Phase 8
 */
import { redirect } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { WizardStepper } from '../_components/WizardStepper';
import { computeMaxCompletedStep } from '../_components/wizardProgress';
import { AutonomyStep } from './AutonomyStep';

export default async function AutonomyStepPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const params = await searchParams;
  const draftId = params.draft;

  await requireAgentosRole('/agentos/agents/new/autonomy');
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

  const maxCompletedStep = computeMaxCompletedStep(draft as Record<string, unknown>);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Create new agent"
        meta={<span className="text-sm text-muted-foreground">Step 6 of 8 — Autonomy</span>}
      />
      <WizardStepper currentStep={6} draftId={draftId} maxCompletedStep={maxCompletedStep} />
      <AutonomyStep draft={draft as Record<string, unknown>} />
    </section>
  );
}
