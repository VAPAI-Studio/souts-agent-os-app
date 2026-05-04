import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind utility classes with conflict resolution.
 * - clsx: handles conditional and array inputs
 * - twMerge: resolves conflicting Tailwind utilities (e.g., bg-red bg-blue → bg-blue)
 *
 * Usage:
 *   <div className={cn('p-md', isActive && 'bg-accent', className)} />
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
