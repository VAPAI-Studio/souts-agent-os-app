import * as React from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded border border-border bg-surface-raised',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'border-b border-border px-4 py-3 flex items-center gap-2',
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: CardProps) {
  return <div className={cn('p-4', className)} {...props} />;
}
