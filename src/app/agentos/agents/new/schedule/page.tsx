/**
 * Step 7: Schedule — server route.
 * Reads the draft from DB, renders WizardStepper + ScheduleStep.
 * Plan 08-04 / Phase 8
 */
import { redirect } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { WizardStepper } from '../_components/WizardStepper';
import { computeMaxCompletedStep } from '../_components/wizardProgress';
import { ScheduleStep } from './ScheduleStep';

export default async function ScheduleStepPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const params = await searchParams;
  const draftId = params.draft;

  await requireAgentosRole('/agentos/agents/new/schedule');
  const supabase = await createClient();

  if (!draftId) redirect('/agentos/agents/new');

  const { data: draft } = await supabase
    .schema('agentos')
    .from('agents')
    .select(
      'id, schedule_cron, schedule_timezone, schedule_enabled, next_run_at, is_draft, deleted_at, config, name, department, system_prompt, autonomy_level, model_tier, max_turns, budget_cap_usd, sensitive_tools, denylist_globs, required_mcp_servers, owner_id',
    )
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
        meta={
          <span className="text-sm text-muted-foreground">
            Step 7 of 8 — Schedule
          </span>
        }
      />
      <WizardStepper currentStep={7} draftId={draftId} maxCompletedStep={maxCompletedStep} />
      <ScheduleStep draft={draft as Record<string, unknown>} />
    </section>
  );
}
