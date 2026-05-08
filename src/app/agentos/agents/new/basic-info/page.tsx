/**
 * Step 1: Basic Info — server route
 * Reads the draft from DB, renders WizardStepper + BasicInfoStep.
 * Plan 08-02 / Phase 8
 */
import { redirect } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { WizardStepper } from '../_components/WizardStepper';
import { computeMaxCompletedStep } from '../_components/wizardProgress';
import { BasicInfoStep } from './BasicInfoStep';

export default async function BasicInfoStepPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const params = await searchParams;
  const draftId = params.draft;

  await requireAgentosRole('/agentos/agents/new/basic-info');
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
        meta={<span className="text-sm text-muted-foreground">Step 1 of 8 — Basic Info</span>}
      />
      <WizardStepper currentStep={1} draftId={draftId} maxCompletedStep={maxCompletedStep} />
      <BasicInfoStep draft={draft as Record<string, unknown>} />
    </section>
  );
}
