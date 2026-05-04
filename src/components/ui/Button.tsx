import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded font-sans text-[13px] leading-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
  {
    variants: {
      intent: {
        primary:
          'bg-accent text-accent-fg hover:opacity-90 active:opacity-85',
        secondary:
          'bg-surface-raised text-text border border-border hover:bg-border',
        ghost:
          'bg-transparent text-text hover:bg-surface-raised',
        destructive:
          'bg-destructive text-accent-fg hover:opacity-90 active:opacity-85',
      },
      size: {
        sm: 'h-7 px-2 gap-1',
        md: 'h-8 px-3 gap-1.5',
      },
    },
    defaultVariants: {
      intent: 'secondary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, intent, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ intent, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
