'use client';
/**
 * Phase 9 / Plan 09-02 — CostPageClient.
 *
 * 'use client' tab + time-period state container. Receives initial data from
 * the Server Component page.tsx and re-fetches on period change via a Server
 * Action. No full page reload on tab or period switch.
 *
 * Time-period buttons: today / week / month (default) / custom
 * Tab buttons: overview / by-agent / by-project
 *
 * Testids consumed by e2e/costs.spec.ts:
 *   period-today, period-week, period-month, period-custom
 *   tab-overview, tab-by-agent, tab-by-project
 *   (stat/chart/table testids are on the child components)
 */
import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { ChartCard } from '@/components/ui/ChartCard';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import {
  todayUtc,
  thisWeekUtc,
  thisMonthUtc,
  customRange,
  validateCustomRange,
  type PeriodId,
  type PeriodResolved,
} from '../_data/period';
import type {
  CostTotals,
  DailyAgentCost,
  ModelCost,
  ProjectCost,
  CostTableRow,
} from '../_data/costs';
import { getCostsForPeriod } from './_actions';
import { CostStatCards } from './CostStatCards';
import { CostByAgentChart } from './CostByAgentChart';
import { CostByModelChart } from './CostByModelChart';
import { CostTable } from './CostTable';

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'by-agent' | 'by-project';

export interface CostPageClientProps {
  initialPeriod: PeriodResolved;
  initialTab: TabId;
  initialData: {
    totals: CostTotals;
    byAgent: DailyAgentCost[];
    byModel: ModelCost[];
    byProject: ProjectCost[];
    tableRows: CostTableRow[];
  };
}

// ── Period button config ─────────────────────────────────────────────────────

const PERIOD_BUTTONS: Array<{ id: PeriodId; label: string; testId: string }> = [
  { id: 'today', label: 'Today', testId: 'period-today' },
  { id: 'week', label: 'This week', testId: 'period-week' },
  { id: 'month', label: 'This month', testId: 'period-month' },
  { id: 'custom', label: 'Custom range', testId: 'period-custom' },
];

const TAB_BUTTONS: Array<{ id: TabId; label: string; testId: string }> = [
  { id: 'overview', label: 'Overview', testId: 'tab-overview' },
  { id: 'by-agent', label: 'By Agent', testId: 'tab-by-agent' },
  { id: 'by-project', label: 'By Project', testId: 'tab-by-project' },
];

// ── Component ────────────────────────────────────────────────────────────────

export function CostPageClient({
  initialPeriod,
  initialTab,
  initialData,
}: CostPageClientProps) {
  const [period, setPeriod] = React.useState<PeriodResolved>(initialPeriod);
  const [tab, setTab] = React.useState<TabId>(initialTab);
  const [data, setData] = React.useState(initialData);
  const [loading, setLoading] = React.useState(false);
  const [customError, setCustomError] = React.useState<string | null>(null);
  const [showCustom, setShowCustom] = React.useState(initialPeriod.id === 'custom');
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');

  async function applyPeriod(newPeriod: PeriodResolved) {
    setLoading(true);
    setPeriod(newPeriod);
    const result = await getCostsForPeriod(newPeriod);
    if (result.ok) {
      setData(result.data);
    }
    setLoading(false);
  }

  async function handlePeriodSelect(id: PeriodId) {
    setCustomError(null);
    if (id === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    let resolved: PeriodResolved;
    if (id === 'today') resolved = todayUtc();
    else if (id === 'week') resolved = thisWeekUtc();
    else resolved = thisMonthUtc();
    await applyPeriod(resolved);
  }

  async function handleCustomApply() {
    setCustomError(null);
    const validation = validateCustomRange(customStart, customEnd);
    if (!validation.ok) {
      setCustomError(validation.error);
      return;
    }
    const resolved = customRange(customStart, customEnd);
    await applyPeriod(resolved);
  }

  return (
    <div className="flex flex-col gap-lg">
      {/* ── Period selector row ──────────────────────────────────────────── */}
      <div className="flex items-center gap-sm flex-wrap">
        {PERIOD_BUTTONS.map((btn) => {
          const isActive =
            btn.id !== 'custom'
              ? period.id === btn.id
              : period.id === 'custom' || showCustom;
          return (
            <Button
              key={btn.id}
              intent={isActive ? 'primary' : 'ghost'}
              size="sm"
              data-testid={btn.testId}
              onClick={() => handlePeriodSelect(btn.id)}
              disabled={loading}
            >
              {btn.label}
            </Button>
          );
        })}
        {loading && (
          <span className="text-[12px] text-text-muted ml-sm">Loading…</span>
        )}
      </div>

      {/* ── Custom range inputs ──────────────────────────────────────────── */}
      {showCustom && (
        <div className="flex items-end gap-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-text-muted uppercase tracking-wider">
              Start
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 px-2 rounded border border-border bg-surface text-[13px] font-sans text-text focus:outline-accent"
              data-testid="period-custom-start"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-text-muted uppercase tracking-wider">
              End
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 px-2 rounded border border-border bg-surface text-[13px] font-sans text-text focus:outline-accent"
              data-testid="period-custom-end"
            />
          </div>
          <Button
            intent="secondary"
            size="sm"
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd || loading}
            data-testid="period-custom-apply"
          >
            Apply
          </Button>
          {customError && (
            <span className="text-[12px] text-destructive">{customError}</span>
          )}
        </div>
      )}

      {/* ── Tab row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-sm border-b border-border pb-sm">
        {TAB_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            data-testid={btn.testId}
            onClick={() => setTab(btn.id)}
            className={cn(
              'text-[13px] font-sans pb-2 border-b-2 -mb-[calc(var(--spacing-sm)+2px)] transition-colors',
              tab === btn.id
                ? 'border-accent text-text font-medium'
                : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── Tab body ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-lg">
          <CostStatCards totals={data.totals} />
          <ChartCard title="Cost by agent over time">
            <CostByAgentChart data={data.byAgent} />
          </ChartCard>
          <ChartCard title="Cost by model">
            <CostByModelChart data={data.byModel} />
          </ChartCard>
          <CostTable rows={data.tableRows} />
        </div>
      )}

      {tab === 'by-agent' && (
        <div className="flex flex-col gap-lg">
          <CostStatCards totals={data.totals} />
          <CostTable rows={data.tableRows} />
        </div>
      )}

      {tab === 'by-project' && (
        <div className="flex flex-col gap-lg">
          <ProjectTable rows={data.byProject} />
        </div>
      )}
    </div>
  );
}

// ── Per-project rollup table (inline — no separate file needed) ───────────

function ProjectTable({ rows }: { rows: ProjectCost[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-text-muted text-[13px]">No project runs in this period.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded border border-border">
      <table
        className="w-full border-collapse text-[13px] font-sans text-text"
        data-testid="costs-by-project-table"
        role="table"
      >
        <thead className="bg-surface-raised text-text-muted text-left">
          <tr>
            <th className="px-3 py-2 font-normal text-[12px] uppercase tracking-wide">Project</th>
            <th className="px-3 py-2 font-normal text-[12px] uppercase tracking-wide">Agents</th>
            <th className="px-3 py-2 font-normal text-[12px] uppercase tracking-wide">Runs</th>
            <th className="px-3 py-2 font-normal text-[12px] uppercase tracking-wide">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.project_id ?? 'null'}
              className="border-b border-border last:border-b-0 hover:bg-surface-raised"
              data-testid={`costs-project-row-${row.project_id ?? 'unassigned'}`}
            >
              <td className="px-3 py-2">{row.project_name ?? '(unassigned)'}</td>
              <td className="px-3 py-2 tabular-nums">{row.agent_count}</td>
              <td className="px-3 py-2 tabular-nums">{row.runs_count}</td>
              <td className="px-3 py-2 tabular-nums">${row.cost.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
