import * as React from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-8 w-full rounded border bg-surface px-2 text-[13px] font-sans text-text placeholder:text-text-placeholder',
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
Input.displayName = 'Input';
