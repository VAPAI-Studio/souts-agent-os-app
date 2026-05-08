/**
 * Step 5: Tools / Permissions — server route
 * Plan 08-02 / Phase 8
 */
import { redirect } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { WizardStepper } from '../_components/WizardStepper';
import { computeMaxCompletedStep } from '../_components/wizardProgress';
import { ToolsPermissionsStep } from './ToolsPermissionsStep';

export default async function ToolsPermissionsStepPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const params = await searchParams;
  const draftId = params.draft;

  await requireAgentosRole('/agentos/agents/new/tools-permissions');
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

  // Fetch current tool permissions for this draft agent
  const { data: perms } = await supabase
    .schema('agentos')
    .from('agent_tool_permissions')
    .select('tool_name, level')
    .eq('agent_id', draftId);

  const maxCompletedStep = computeMaxCompletedStep(draft as Record<string, unknown>);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Create new agent"
        meta={<span className="text-sm text-muted-foreground">Step 5 of 8 — Tools / Permissions</span>}
      />
      <WizardStepper currentStep={5} draftId={draftId} maxCompletedStep={maxCompletedStep} />
      <ToolsPermissionsStep
        draft={draft as Record<string, unknown>}
        initialPerms={(perms ?? []) as { tool_name: string; level: string }[]}
      />
    </section>
  );
}
