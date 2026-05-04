import { NextResponse } from 'next/server';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /agentos/projects/api/agents-available
 *
 * Returns agents the caller can see (RLS-scoped) for the AssignAgentDialog.
 * Each row reports its current project_id so the dialog can disable
 * already-assigned options.
 */
export async function GET() {
  await requireAgentosRole('/agentos/projects/api/agents-available');
  const supabase = await createClient();
  const { data } = await supabase
    .schema('agentos')
    .from('agents')
    .select('id, name, project_id')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  return NextResponse.json({
    agents: (data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      current_project_id: a.project_id,
    })),
  });
}
