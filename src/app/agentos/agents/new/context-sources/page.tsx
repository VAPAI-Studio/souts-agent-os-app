/**
 * Step 4: Context Sources — server route
 * Plan 08-02 / Phase 8 — rewritten 2026-05-09 (project picker + context notes)
 */
import { redirect } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { WizardStepper } from '../_components/WizardStepper';
import { computeMaxCompletedStep } from '../_components/wizardProgress';
import { ContextSourcesStep } from './ContextSourcesStep';

export default async function ContextSourcesStepPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const params = await searchParams;
  const draftId = params.draft;

  await requireAgentosRole('/agentos/agents/new/context-sources');
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

  // Load projects the user has access to (RLS filters automatically).
  const { data: projectsData } = await supabase
    .schema('agentos')
    .from('projects')
    .select('id, name')
    .order('name', { ascending: true });

  const projects = (projectsData ?? []) as Array<{ id: string; name: string }>;

  const maxCompletedStep = computeMaxCompletedStep(draft as Record<string, unknown>);

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Create new agent"
        meta={<span className="text-[13px] text-text-muted">Step 4 of 8 — Context Sources</span>}
      />
      <WizardStepper currentStep={4} draftId={draftId} maxCompletedStep={maxCompletedStep} />
      <ContextSourcesStep
        draft={draft as Record<string, unknown>}
        projects={projects}
      />
    </section>
  );
}
