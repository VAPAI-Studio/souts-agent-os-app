/**
 * Plan 09-04 — /agentos/settings page (Server Component, admin-only).
 *
 * Admin gate: requireAdmin redirects to /agentos/no-access for non-admin roles.
 * Reads current daily_aggregate_alert threshold from agentos.org_settings.
 * Hosts DailyThresholdForm and is designed for future settings extensibility.
 */
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { DailyThresholdForm } from './_components/DailyThresholdForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireAdmin('/agentos/settings');

  const supabase = await createClient();
  const { data } = await supabase
    .schema('agentos')
    .from('org_settings')
    .select('value')
    .eq('key', 'daily_aggregate_alert')
    .maybeSingle();

  const initialThreshold =
    (data?.value as Record<string, unknown> | null)?.threshold_usd as number | null ?? null;

  return (
    <div className="flex flex-col gap-md max-w-[640px]">
      <PageHeader title="Settings" />
      <DailyThresholdForm initialThreshold={initialThreshold} />
    </div>
  );
}
