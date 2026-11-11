'use client';

import { Button, cn, type ButtonProps } from '@waffarly/ui';
import type { Ref } from 'react';

// Marketplace appearance on the shared shadcn-style primitive; no duplicated DOM.
export function MarketplaceButton({
  className,
  ...props
}: Omit<ButtonProps, 'variant' | 'size'> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <Button
      variant="solid"
      {...props}
      className={cn(
        'inline-block h-auto gap-0 whitespace-normal rounded-none border-0 bg-transparent p-0 text-[length:inherit] font-normal leading-[inherit] text-inherit shadow-none hover:bg-transparent',
        className,
      )}
    />
  );
}
