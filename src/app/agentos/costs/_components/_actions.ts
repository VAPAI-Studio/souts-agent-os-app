'use server';
/**
 * Phase 9 / Plan 09-02 — Server Actions for cost dashboard.
 *
 * getCostsForPeriod fetches all cost data bundles for a given period.
 * Called by CostPageClient when the user changes the time period.
 * Returns the { ok, data?, error? } action shape locked in CONTEXT/RESEARCH.
 */
import {
  fetchCostsForPeriod,
  fetchCostByAgentDaily,
  fetchCostByModel,
  fetchCostByProject,
  fetchCostsTable,
  type CostTotals,
  type DailyAgentCost,
  type ModelCost,
  type ProjectCost,
  type CostTableRow,
} from '../_data/costs';
import type { PeriodResolved } from '../_data/period';

export interface CostBundle {
  totals: CostTotals;
  byAgent: DailyAgentCost[];
  byModel: ModelCost[];
  byProject: ProjectCost[];
  tableRows: CostTableRow[];
}

export async function getCostsForPeriod(
  period: PeriodResolved,
): Promise<{ ok: true; data: CostBundle } | { ok: false; error: string }> {
  try {
    const [totals, byAgent, byModel, byProject, tableRows] = await Promise.all([
      fetchCostsForPeriod(period),
      fetchCostByAgentDaily(period),
      fetchCostByModel(period),
      fetchCostByProject(period),
      fetchCostsTable(period),
    ]);
    return { ok: true, data: { totals, byAgent, byModel, byProject, tableRows } };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
