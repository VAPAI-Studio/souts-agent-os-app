'use client';
/**
 * Phase 9 / Plan 09-02 — Cost by agent stacked bar chart.
 *
 * Renders a Recharts stacked BarChart for daily cost breakdown.
 * 'use client' is REQUIRED (Recharts uses browser DOM APIs — Pitfall 1).
 *
 * Data shape: DailyAgentCost[] (long format: one row per date+agent_id).
 * This component pivots to wide format for Recharts (one row per date).
 *
 * Colors: CSS variables from Tailwind v4 design tokens.
 * No hex literals in code — Recharts SVG fill accepts CSS var() values.
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DailyAgentCost } from '../_data/costs';

// ── Color palette using CSS variables (no hex literals) ───────────────────
// Recharts SVG fill accepts CSS custom properties via var()
const AGENT_COLORS = [
  'var(--color-accent)',
  'var(--color-chart-2, hsl(200 90% 50%))',
  'var(--color-chart-3, hsl(140 60% 45%))',
  'var(--color-chart-4, hsl(30 90% 55%))',
  'var(--color-chart-5, hsl(300 60% 55%))',
];
const COLOR_OTHER = 'var(--color-border, hsl(0 0% 70%))';

interface ChartRow {
  date: string;
  [agentId: string]: number | string;
}

function pivotToWide(data: DailyAgentCost[]): {
  rows: ChartRow[];
  agentKeys: string[];
  agentNames: Map<string, string>;
} {
  const agentNames = new Map<string, string>();
  const dateMap = new Map<string, ChartRow>();

  for (const d of data) {
    const key = d.agent_id ?? 'other';
    if (d.agent_id && d.agent_name) agentNames.set(d.agent_id, d.agent_name);

    if (!dateMap.has(d.date)) {
      dateMap.set(d.date, { date: d.date });
    }
    const row = dateMap.get(d.date)!;
    row[key] = ((row[key] as number) || 0) + d.cost;
  }

  // Collect agent keys (non-"other") in order of appearance
  const agentKeySet = new Set<string>();
  for (const d of data) {
    if (d.agent_id) agentKeySet.add(d.agent_id);
  }
  const agentKeys = [...agentKeySet];

  const rows = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { rows, agentKeys, agentNames };
}

export function CostByAgentChart({ data }: { data: DailyAgentCost[] }) {
  const { rows, agentKeys, agentNames } = pivotToWide(data);
  const hasOther = data.some((d) => d.agent_id === null);

  return (
    <div data-testid="chart-cost-by-agent" className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(5)} // MM-DD
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            width={60}
          />
          <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {agentKeys.map((agentId, i) => (
            <Bar
              key={agentId}
              dataKey={agentId}
              name={agentNames.get(agentId) ?? agentId}
              stackId="a"
              fill={AGENT_COLORS[i % AGENT_COLORS.length]}
            />
          ))}
          {hasOther && (
            <Bar dataKey="other" name="Other" stackId="a" fill={COLOR_OTHER} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
