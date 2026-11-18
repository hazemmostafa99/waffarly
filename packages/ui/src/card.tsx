import type { ComponentProps } from 'react';
import { cn } from './utils.js';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      data-slot="card"
      className={cn(
        'rounded-card border border-border bg-card p-6 text-card-foreground shadow-card',
        className,
      )}
      {...props}
    />
  );
}
