import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded px-2 py-[2px] text-[12px] font-sans leading-none border',
  {
    variants: {
      tone: {
        neutral:
          'bg-surface-raised text-text-muted border-border',
        success:
          'bg-success-subtle text-success border-success/20',
        warning:
          'bg-warning-subtle text-warning border-warning/20',
        destructive:
          'bg-destructive-subtle text-destructive border-destructive/20',
        accent:
          'bg-accent-subtle text-accent border-accent/20',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
