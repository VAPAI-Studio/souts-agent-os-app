import * as React from 'react';
import { Label } from './Label';
import { cn } from '@/lib/cn';

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * FormField wraps a Label + control + optional error message.
 *
 * Composes directly with the locked Server Action result shape:
 *   const result = await createAgent(input);
 *   if (!result.ok) setFieldError(result.error);
 *
 *   <FormField label="Name" htmlFor="name" error={fieldError ?? undefined}>
 *     <Input id="name" name="name" error={!!fieldError} />
 *   </FormField>
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  const errorId = error ? `${htmlFor}-error` : undefined;
  const hintId = hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <span
          id={errorId}
          className="text-[12px] text-destructive font-sans"
        >
          {error}
        </span>
      )}
      {!error && hint && (
        <span
          id={hintId}
          className="text-[12px] text-text-muted font-sans"
        >
          {hint}
        </span>
      )}
    </div>
  );
}
