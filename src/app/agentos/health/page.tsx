/**
 * Phase 9 / Plan 09-05 — System Health page.
 *
 * Admin-only Server Component. Reads 60s-cached health snapshot from the
 * orchestrator's GET /health/probes endpoint. Renders 8 service rows.
 *
 * HealthTable is a Server Component; HealthRefreshButton is the only client boundary.
 * Non-admins are redirected to /agentos/no-access by requireAdmin().
 */
import * as React from 'react';
import { requireAdmin } from '@/lib/supabase/agentos';
import { PageHeader } from '@/components/ui/PageHeader';
import { HealthTable } from './_components/HealthTable';
import { HealthRefreshButton } from './_components/HealthRefreshButton';
import { getHealthSnapshot } from './_data/snapshot';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  await requireAdmin('/agentos/health');
  const snapshot = await getHealthSnapshot();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="System Health"
        actions={<HealthRefreshButton />}
      />
      <div className="text-[12px] text-text-muted" data-testid="health-snapshot-ts">
        Snapshot:{' '}
        {new Date(snapshot.ts).toLocaleString()}{' '}
        {snapshot.cached ? '(cached, ≤60s)' : '(fresh)'}
      </div>
      <HealthTable initialServices={snapshot.services} />
    </div>
  );
}
