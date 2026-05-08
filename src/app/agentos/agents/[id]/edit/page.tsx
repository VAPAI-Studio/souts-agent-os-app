import { notFound } from 'next/navigation';
import { requireAdminOrOwner } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { EditAgentForm } from './EditAgentForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { ToolPermissionsSection } from './_components/ToolPermissionsSection';
import { ScheduleSection } from './_components/ScheduleSection';
import { SlackChannelsSection } from './_components/SlackChannelsSection';
import { CalendarSection } from './_components/CalendarSection';

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase
    .schema('agentos')
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();
  if (!agent) return notFound();
  await requireAdminOrOwner(`/agentos/agents/${id}/edit`, agent.owner_id);

  // Phase 6 / Plan 06-02: load existing tool permissions for this agent.
  // Empty array on missing rows or pre-migration DB — section renders all-zero
  // and the user can save fresh defaults.
  const { data: permsData } = await supabase
    .schema('agentos')
    .from('agent_tool_permissions')
    .select('tool_name, level')
    .eq('agent_id', id);
  const initialPerms = (permsData ?? []) as { tool_name: string; level: string }[];

  // Phase 6 / Plan 06-03: gate the Slack + Calendar sections on whether the
  // corresponding tool_connections row exists with status='connected'. This
  // avoids confusing admins with "select channels" when no Slack OAuth has
  // happened (or "set calendar ID" when no Google OAuth has happened).
  const { data: connections } = await supabase
    .schema('agentos')
    .from('tool_connections')
    .select('integration')
    .eq('status', 'connected');
  const connectedIntegrations = new Set(
    (connections ?? []).map((c) => c.integration),
  );

  const agentConfig = (agent.config ?? {}) as {
    slack_channels?: string[];
    calendar_ids?: string[];
    calendar_id?: string | null;
  };
  const initialChannelIds = agentConfig.slack_channels ?? [];
  // Phase 7 / Plan 07-01: backward-compat read — prefer calendar_ids array (Phase 7)
  // else fall back to singular calendar_id (Phase 6) wrapped in array.
  const initialCalendarIds: string[] =
    agentConfig.calendar_ids ??
    (agentConfig.calendar_id ? [agentConfig.calendar_id] : []);

  const editingTitle = 'Edit: ' + agent.name;

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader title={editingTitle} />
      <EditAgentForm agent={agent} />
      <ToolPermissionsSection agentId={id} initialPerms={initialPerms} />
      <ScheduleSection
        agentId={id}
        initial={{
          schedule_cron: agent.schedule_cron ?? null,
          schedule_timezone: agent.schedule_timezone ?? null,
          schedule_enabled: !!agent.schedule_enabled,
        }}
      />
      {connectedIntegrations.has('slack') && (
        <SlackChannelsSection
          agentId={id}
          initialChannelIds={initialChannelIds}
        />
      )}
      {connectedIntegrations.has('google_calendar') && (
        <CalendarSection
          agentId={id}
          initialCalendarIds={initialCalendarIds}
        />
      )}
    </section>
  );
}
