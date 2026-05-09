/**
 * Phase 9 / Plan 09-02 — ChartCard primitive.
 *
 * Thin wrapper around the existing Card primitive for Recharts charts.
 * Server-renderable — no 'use client' required. The chart content passed
 * as children handles its own 'use client' boundary.
 *
 * Usage:
 *   <ChartCard title="Cost by agent over time" testId="chart-cost-by-agent">
 *     <CostByAgentChart data={byAgent} />
 *   </ChartCard>
 *
 * Design discipline (Phase 03.1):
 *   - No hex literals in JSX attributes (use Tailwind v4 tokens instead)
 *   - All colors via Tailwind v4 tokens
 */
import * as React from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';

export interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  testId?: string;
}

export function ChartCard({ title, children, testId }: ChartCardProps) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <h3 className="text-[13px] font-medium text-text">{title}</h3>
      </CardHeader>
      <CardBody className="min-h-[240px]">
        {children}
      </CardBody>
    </Card>
  );
}
