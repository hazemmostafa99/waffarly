'use client';

import type { ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils.js';

// eslint-disable-next-line react-refresh/only-export-components -- This shared library also exposes its variant helper.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-waffarly-primary to-waffarly-primary-deep text-white shadow-button hover:from-waffarly-primary-dark hover:to-waffarly-primary-deep hover:shadow-md',
        accent:
          'bg-gradient-to-br from-waffarly-gold to-waffarly-gold-muted text-waffarly-primary-deep shadow-sm hover:from-waffarly-gold-soft hover:to-waffarly-gold-muted hover:shadow-md',
        secondary: 'bg-waffarly-cream text-waffarly-primary-deep hover:bg-waffarly-gold-light',
        outline:
          'border border-waffarly-outline bg-waffarly-surface text-waffarly-primary-deep hover:bg-waffarly-cream hover:text-waffarly-primary-deep',
        ghost: 'bg-transparent text-waffarly-primary-deep hover:bg-waffarly-cream hover:text-waffarly-primary-deep',
        destructive: 'bg-waffarly-danger text-white hover:bg-waffarly-danger/90',
      },
      size: { default: 'h-11 px-5 py-2.5', sm: 'h-10 px-3', lg: 'h-12 px-6', icon: 'size-11' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
