'use client';
/**
 * Phase 9 / Plan 09-02 — CostStatCards component.
 *
 * Renders 3 StatCards for the selected period totals.
 * Testids from e2e/costs.spec.ts: stat-total-cost, stat-active-agents, stat-runs-count.
 */
import { StatCard } from '@/components/ui/StatCard';
import type { CostTotals } from '../_data/costs';

export function CostStatCards({ totals }: { totals: CostTotals }) {
  return (
    <div className="grid grid-cols-3 gap-md">
      <StatCard
        label="Total cost"
        value={`$${totals.total_cost.toFixed(2)}`}
        testId="stat-total-cost"
      />
      <StatCard
        label="Active agents"
        value={String(totals.active_agents)}
        testId="stat-active-agents"
      />
      <StatCard
        label="Runs"
        value={String(totals.runs_count)}
        testId="stat-runs-count"
      />
    </div>
  );
}
