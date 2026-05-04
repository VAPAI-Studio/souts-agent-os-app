import * as React from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-20 w-full rounded border bg-surface px-2 py-1.5 text-[13px] font-sans text-text placeholder:text-text-placeholder leading-1.5',
          'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-destructive' : 'border-border',
          className,
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
