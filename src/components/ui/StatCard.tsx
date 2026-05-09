/**
 * Phase 9 / Plan 09-02 — StatCard primitive.
 *
 * Thin wrapper around the existing Card primitive for stat display.
 * Server-renderable — no 'use client' required.
 *
 * Usage:
 *   <StatCard label="Total cost" value="$12.34" testId="stat-total-cost" />
 *   <StatCard label="Runs" value="47" href="/agentos/costs" />
 *
 * Design discipline (Phase 03.1):
 *   - No hex literals in JSX attributes (use Tailwind v4 tokens instead)
 *   - All colors via Tailwind v4 tokens (text-text-muted, text-destructive, etc.)
 */
import * as React from 'react';
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

const subStatTone = {
  destructive: 'text-destructive',
  warning: 'text-warning',
  neutral: 'text-text-muted',
} as const;

export interface StatCardProps {
  label: string;
  value: string;
  subStat?: {
    label: string;
    tone?: keyof typeof subStatTone;
  };
  href?: string;
  testId?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  subStat,
  href,
  testId,
  className,
}: StatCardProps) {
  const content = (
    <CardBody className="flex flex-col gap-1">
      {/* Label */}
      <span className="text-[11px] uppercase tracking-wider text-text-muted font-sans leading-none">
        {label}
      </span>
      {/* Value */}
      <span className="text-[28px] font-medium leading-tight tabular-nums">
        {value}
      </span>
      {/* Optional sub-stat */}
      {subStat && (
        <span
          className={cn(
            'text-[12px] font-sans leading-none',
            subStatTone[subStat.tone ?? 'neutral'],
          )}
        >
          {subStat.label}
        </span>
      )}
    </CardBody>
  );

  if (href) {
    return (
      <Card
        data-testid={testId}
        className={cn('cursor-pointer transition-colors hover:bg-surface hover:border-accent', className)}
      >
        <Link href={href} className="block w-full h-full">
          {content}
        </Link>
      </Card>
    );
  }

  return (
    <Card
      data-testid={testId}
      className={cn(className)}
    >
      {content}
    </Card>
  );
}
