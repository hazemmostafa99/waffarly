'use client';

import { Button, cn, type ButtonProps } from '@waffarly/ui';
import type { Ref } from 'react';

// Marketplace appearance on the shared shadcn-style primitive; no duplicated DOM.
export function MarketplaceButton({
  className,
  tone,
  ...props
}: Omit<ButtonProps, 'variant' | 'size'> & {
  ref?: Ref<HTMLButtonElement>;
  tone?: 'gold' | 'primary' | 'neutral';
}) {
  return (
    <Button
      variant="solid"
      {...props}
      className={cn(
        'inline-block h-auto gap-0 whitespace-normal rounded-none border-0 bg-transparent p-0 text-[length:inherit] font-normal leading-[inherit] text-inherit shadow-none hover:bg-transparent',
        tone === 'gold' &&
          'bg-waffarly-gold text-primary hover:bg-[#e9ad0e] active:bg-[#dca20a] disabled:bg-[#f3f0f4] disabled:text-muted-foreground disabled:opacity-100',
        tone === 'primary' &&
          'bg-primary text-white hover:bg-[var(--purple-800)] active:bg-[var(--purple-700)]',
        tone === 'neutral' &&
          'bg-[var(--purple-50)] text-primary hover:bg-secondary active:bg-[var(--purple-100)]',
        className,
      )}
    />
  );
}
