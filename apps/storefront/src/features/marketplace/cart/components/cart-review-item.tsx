'use client';

import { cn } from '@waffarly/ui';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import Link from 'next/link';
import { QuantitySelector } from '@/components/marketplace/quantity-selector';
import { money } from '@/features/marketplace/shared/lib/format-money';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { productHref } from '@/features/marketplace/product-detail/model/product-navigation';

export function CartReviewItem({
  product,
  onQuantityChange,
  onRemove,
  onEdit,
}: {
  product: MarketplaceProduct & { quantity: number; optionsLabel?: string };
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onEdit?: () => void;
}) {
  const href = productHref(product.id) + (product.restaurantSlug ? `?restaurant=${encodeURIComponent(product.restaurantSlug)}` : '');
  return (
    <li
      className={cn(
        'cart-review-item grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-3.5 py-3.5 px-4 [&_+_.cart-review-item]:[border-top-width:1px]',
        '[&_+_.cart-review-item]:[border-top-style:solid] [&_+_.cart-review-item]:[border-top-color:var(--line)] max-[600px]:grid-cols-[64px_minmax(0,1fr)] max-[600px]:gap-x-3 max-[600px]:gap-y-2 max-[700px]:px-3.5',
      )}
    >
      <Link
        href={href}
        className={cn(
          'cart-review-image block overflow-hidden rounded-[12px] bg-[var(--purple-50)] [&_img]:block [&_img]:w-20 [&_img]:h-20',
          '[&_img]:object-cover max-[600px]:[&_img]:w-16 max-[600px]:[&_img]:h-16',
        )}
        aria-label={product.name}
      >
        <img {...product.image} />
      </Link>
      <div
        className={
          'cart-review-info min-w-0 [&_h2]:text-[14px] [&_h2]:font-medium [&_h2]:leading-[1.8] [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-0 [&_h2_a]:text-foreground [&_h2_a]:no-underline [&_h2_a:hover]:text-accent'
        }
      >
        <span
          className={
            'seller flex items-center gap-1.5 text-accent text-[12px] font-medium mb-0.5'
          }
        >
          {product.seller}
        </span>
        <h2>
          <Link href={href}>{product.name}</Link>
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {product.optionsLabel && <span className="text-xs text-accent">{product.optionsLabel}</span>}
          <p className={'cart-review-unit-price text-[12px] text-muted-foreground m-0'}>
            {money(product.price)} للقطعة
          </p>
        </div>
        {onEdit && (
          <Button
            type="button"
            onClick={onEdit}
            aria-label={`تعديل اختيارات ${product.cartName}`}
            className="mt-1 min-h-9 text-[12px] font-medium text-accent underline underline-offset-4"
          >
            تعديل الاختيارات
          </Button>
        )}
      </div>
      <div
        className={cn(
          'cart-review-line-total grid justify-items-end gap-1.5 text-end [&_>_span]:text-muted-foreground [&_>_span]:text-[10px] [&_strong]:whitespace-nowrap',
          '[&_strong]:text-primary [&_strong]:text-[15px] [&_strong]:font-bold max-[600px]:[grid-column:2] max-[600px]:justify-items-start max-[600px]:text-start',
        )}
      >
        <span>إجمالي المنتج</span>
        <strong>{money(product.price * product.quantity)}</strong>
        <div className={'cart-review-controls flex flex-wrap items-center gap-3'}>
          <QuantitySelector
            value={product.quantity}
            onChange={onQuantityChange}
            label={`كمية ${product.cartName}`}
          />
          <Button
            type="button"
            className={
              'cart-review-remove disabled:cursor-not-allowed disabled:opacity-[0.5] bg-transparent border-0 py-1.5 px-0 text-destructive text-[12px]'
            }
            onClick={onRemove}
            aria-label={`حذف ${product.cartName}`}
          >
            حذف المنتج
          </Button>
        </div>
      </div>
    </li>
  );
}
