'use client';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export const STEPS = [
  { num: 1, slug: 'basic-info', label: 'Basic Info' },
  { num: 2, slug: 'role-goals', label: 'Role / Goals' },
  { num: 3, slug: 'instructions', label: 'Instructions' },
  { num: 4, slug: 'context-sources', label: 'Context Sources' },
  { num: 5, slug: 'tools-permissions', label: 'Tools / Permissions' },
  { num: 6, slug: 'autonomy', label: 'Autonomy' },
  { num: 7, slug: 'schedule', label: 'Schedule' },
  { num: 8, slug: 'review', label: 'Review / Test' },
];

export function WizardStepper({
  currentStep,
  draftId,
  maxCompletedStep,
}: {
  currentStep: number;
  draftId: string;
  maxCompletedStep: number;
}) {
  return (
    <nav
      aria-label="Wizard progress"
      className="flex flex-wrap items-center gap-2 mb-6"
      data-testid="wizard-stepper"
    >
      {STEPS.map((s) => {
        const status =
          s.num === currentStep
            ? 'current'
            : s.num <= maxCompletedStep
              ? 'complete'
              : 'locked';
        const href = `/agentos/agents/new/${s.slug}?draft=${draftId}`;
        const cls = cn(
          'flex items-center gap-1 px-3 py-1 rounded-md text-sm',
          status === 'current' && 'bg-accent/10 text-accent border border-accent',
          status === 'complete' && 'text-foreground hover:bg-muted',
          status === 'locked' && 'text-muted-foreground pointer-events-none opacity-50',
        );
        return (
          <Link
            key={s.num}
            href={href}
            data-testid={`wizard-stepper-${s.num}`}
            className={cls}
            aria-current={status === 'current' ? 'step' : undefined}
          >
            <span className="font-mono text-xs">{s.num}</span>
            <span>{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
