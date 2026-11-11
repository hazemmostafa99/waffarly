import type { ComponentProps } from 'react';
import { Card, cn } from '@waffarly/ui';

export function MarketplaceCard({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      {...props}
      className={cn('rounded-none border-0 bg-transparent p-0 text-inherit shadow-none', className)}
    />
  );
}
