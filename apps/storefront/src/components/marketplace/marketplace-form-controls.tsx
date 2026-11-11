import type { ComponentProps } from 'react';
import { Input, Textarea, cn } from '@waffarly/ui';

export function MarketplaceInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(
        'block h-auto rounded-none border-0 bg-transparent p-0 text-[length:inherit] leading-[inherit] shadow-none md:text-[length:inherit]',
        className,
      )}
    />
  );
}

export function MarketplaceTextarea({ className, ...props }: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      {...props}
      className={cn(
        'block min-h-0 rounded-none border-0 bg-transparent p-0 text-[length:inherit] leading-[inherit] shadow-none',
        className,
      )}
    />
  );
}
