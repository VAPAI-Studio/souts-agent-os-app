/**
 * Phase 9 / Plan 09-02 — /agentos/costs Server Component shell.
 *
 * Gated by requireAgentosRole (all agentos roles can view cost dashboards).
 * Fetches initial data server-side via Promise.all (parallel, not waterfall).
 * Hands off to CostPageClient for tab + period interactivity.
 *
 * Pitfall 7 honored: data fetched here, passed as initialData props.
 * Pitfall 1 honored: Recharts chart components are client-only ('use client')
 *   — they are imported inside CostPageClient, not here.
 */
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { PageHeader } from '@/components/ui/PageHeader';
import { CostPageClient } from './_components/CostPageClient';
import {
  fetchCostsForPeriod,
  fetchCostByAgentDaily,
  fetchCostByModel,
  fetchCostByProject,
  fetchCostsTable,
} from './_data/costs';
import { thisMonthUtc } from './_data/period';

export const dynamic = 'force-dynamic';

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string; tab?: string }>;
}) {
  await requireAgentosRole('/agentos/costs');

  const sp = await searchParams;

  // Server render defaults to "This month"; client takes over for period switching.
  const period = thisMonthUtc();

  const [totals, byAgent, byModel, byProject, tableRows] = await Promise.all([
    fetchCostsForPeriod(period),
    fetchCostByAgentDaily(period),
    fetchCostByModel(period),
    fetchCostByProject(period),
    fetchCostsTable(period),
  ]);

  return (
    <div className="flex flex-col gap-md">
      <PageHeader title="Costs" />
      <CostPageClient
        initialPeriod={period}
        initialTab={(sp.tab as 'overview' | 'by-agent' | 'by-project') ?? 'overview'}
        initialData={{ totals, byAgent, byModel, byProject, tableRows }}
      />
    </div>
  );
}
