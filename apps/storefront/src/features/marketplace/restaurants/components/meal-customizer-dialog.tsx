'use client';

import type { ComponentProps } from 'react';
import { MarketplaceDialog } from '@/components/marketplace/marketplace-dialog';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { MealPurchase } from './meal-purchase';

type MealCustomizerDialogProps = Pick<ComponentProps<typeof MealPurchase>, 'editLine' | 'onSaved' | 'onAdded'> & {
  product: MarketplaceProduct | null;
  onClose: () => void;
};

export function MealCustomizerDialog({ product, onClose, ...purchaseProps }: MealCustomizerDialogProps) {
  return (
    <MarketplaceDialog
      open={product !== null}
      onClose={onClose}
      title="تخصيص المنتج"
      className="w-[calc(100vw-24px)] max-w-[360px] max-h-[calc(100dvh-20px)] overflow-hidden rounded-[24px] open:flex open:flex-col [&_[data-slot=dialog-header]]:shrink-0 [&_[data-slot=dialog-header]]:border-0 [&_[data-slot=dialog-header]]:px-5 [&_[data-slot=dialog-header]]:pb-2 [&_[data-slot=dialog-header]]:pt-5 [&_[data-slot=dialog-header]_h2]:text-[18px] [&_[data-slot=dialog-header]_button]:size-8 [&_[data-slot=dialog-header]_button]:rounded-full [&_[data-slot=dialog-header]_button]:bg-[var(--purple-50)] [&_[data-slot=dialog-header]_button:hover]:bg-secondary"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      {product && (
        <MealPurchase
          key={purchaseProps.editLine?.lineId ?? product.id}
          product={product}
          presentation="dialog"
          {...purchaseProps}
        />
      )}
    </MarketplaceDialog>
  );
}
