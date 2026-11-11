'use client';

import { cn } from '@waffarly/ui';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import { MAX_CART_QUANTITY } from '@/features/marketplace/cart/model/cart';

export function QuantitySelector({
  value,
  onChange,
  label = 'الكمية',
}: {
  value: number;
  onChange: (quantity: number) => void;
  label?: string;
}) {
  return (
    <div
      className={cn(
        'quantity-selector inline-flex items-center border border-solid border-border rounded-[9px] overflow-hidden',
        '[&_button]:w-9 [&_button]:h-9 [&_button]:border-0 [&_button]:bg-[var(--purple-50)] [&_button]:text-primary [&_button]:text-[18px] [&_output]:min-w-9 [&_output]:text-center',
        '[&_output]:text-[14px]',
      )}
      role="group"
      aria-label={label}
    >
      <Button
        type="button"
        aria-label={`تقليل ${label}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className={'disabled:cursor-not-allowed disabled:opacity-[0.5]'}
      >
        −
      </Button>
      <output aria-label={label} aria-live="polite">
        {value}
      </output>
      <Button
        type="button"
        aria-label={`زيادة ${label}`}
        disabled={value >= MAX_CART_QUANTITY}
        onClick={() => onChange(value + 1)}
        className={'disabled:cursor-not-allowed disabled:opacity-[0.5]'}
      >
        +
      </Button>
    </div>
  );
}
