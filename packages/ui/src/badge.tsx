import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils.js';

export const badgeVariants = cva(
  'inline-flex min-h-7 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-input bg-background text-foreground',
        destructive: 'bg-waffarly-danger-bg text-waffarly-danger',
        success: 'bg-waffarly-success-bg text-waffarly-primary-dark',
        warning: 'bg-waffarly-warning-bg text-waffarly-gold-ink',
        info: 'bg-waffarly-info-bg text-waffarly-info',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
