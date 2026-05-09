'use client';
/**
 * Phase 9 / Plan 09-02 — CostPageClient placeholder.
 * Full implementation ships in Task 3. This file satisfies the import
 * from page.tsx during Task 2 tsc check.
 */
import type { PeriodResolved } from '../_data/period';
import type {
  CostTotals,
  DailyAgentCost,
  ModelCost,
  ProjectCost,
  CostTableRow,
} from '../_data/costs';

export interface CostPageClientProps {
  initialPeriod: PeriodResolved;
  initialTab: 'overview' | 'by-agent' | 'by-project';
  initialData: {
    totals: CostTotals;
    byAgent: DailyAgentCost[];
    byModel: ModelCost[];
    byProject: ProjectCost[];
    tableRows: CostTableRow[];
  };
}

export function CostPageClient(_props: CostPageClientProps) {
  // Placeholder — replaced in Task 3
  return <div data-testid="cost-page-client-placeholder" />;
}
