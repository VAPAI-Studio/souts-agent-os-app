import * as React from 'react';
import { cn } from '@/lib/cn';

export interface PageHeaderProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Optional sub-element rendered below the title (e.g., status badge) */
  meta?: React.ReactNode;
}

export function PageHeader({
  title,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center gap-4 mb-6 pb-4 border-b border-border',
        className,
      )}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <h1 className="text-[16px] font-semibold leading-tight truncate">
          {title}
        </h1>
        {meta && <div className="flex items-center gap-2">{meta}</div>}
      </div>
      {actions && (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
