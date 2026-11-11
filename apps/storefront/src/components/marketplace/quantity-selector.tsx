'use client';

import { MAX_CART_QUANTITY } from '@/features/marketplace/model/catalog';

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
    <div className="quantity-selector" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`تقليل ${label}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-label={label} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        aria-label={`زيادة ${label}`}
        disabled={value >= MAX_CART_QUANTITY}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
