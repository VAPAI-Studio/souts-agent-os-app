'use client';
/**
 * Phase 9 / Plan 09-02 — Cost by model horizontal bar chart.
 *
 * Renders a Recharts horizontal BarChart (layout="vertical").
 * 'use client' is REQUIRED (Recharts uses browser DOM APIs — Pitfall 1).
 *
 * No hex literals — uses CSS variables for colors.
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { ModelCost } from '../_data/costs';

export function CostByModelChart({ data }: { data: ModelCost[] }) {
  return (
    <div data-testid="chart-cost-by-model" className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          />
          <YAxis
            dataKey="model"
            type="category"
            tick={{ fontSize: 11 }}
            width={140}
          />
          <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
          <Bar
            dataKey="cost"
            name="Cost (USD)"
            fill="var(--color-accent)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
