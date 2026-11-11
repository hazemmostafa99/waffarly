import { cn } from '@waffarly/ui';
import type { ComponentPropsWithoutRef } from 'react';

export function MarketplaceContainer({
  className = '',
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        `marketplace-container ${className}`,
        'w-[min(1480px,_calc(100%_-_32px))] m-auto max-[700px]:w-[min(100%_-_20px,_1480px)]',
      )}
      {...props}
    />
  );
}
