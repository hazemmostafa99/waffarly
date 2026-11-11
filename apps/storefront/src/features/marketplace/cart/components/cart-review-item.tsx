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
}: {
  product: MarketplaceProduct & { quantity: number; optionsLabel?: string };
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const href = productHref(product.id) + (product.restaurantSlug ? `?restaurant=${encodeURIComponent(product.restaurantSlug)}` : '');
  return (
    <li
      className={cn(
        'cart-review-item grid grid-cols-[96px_minmax(0,1fr)_auto] items-start gap-4.5 py-5.5 px-5 [&_+_.cart-review-item]:[border-top-width:1px]',
        '[&_+_.cart-review-item]:[border-top-style:solid] [&_+_.cart-review-item]:[border-top-color:var(--line)] max-[1000px]:grid-cols-[80px_minmax(0,1fr)] max-[1000px]:gap-3.5 max-[700px]:py-4.5 max-[700px]:px-3.5',
      )}
    >
      <Link
        href={href}
        className={cn(
          'cart-review-image block overflow-hidden rounded-[12px] bg-[var(--purple-50)] [&_img]:block [&_img]:w-24 [&_img]:h-24',
          '[&_img]:object-cover max-[1000px]:[&_img]:w-20 max-[1000px]:[&_img]:h-20',
        )}
        aria-label={product.name}
      >
        <img {...product.image} />
      </Link>
      <div
        className={
          'cart-review-info min-w-0 [&_h2]:text-[14px] [&_h2]:leading-[1.8] [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-2 [&_h2_a]:text-foreground [&_h2_a]:no-underline [&_h2_a:hover]:text-accent'
        }
      >
        <span
          className={
            'seller flex items-center gap-1.5 text-accent text-[10px] font-extrabold mb-[7px]'
          }
        >
          {product.seller}
        </span>
        <h2>
          <Link href={href}>{product.name}</Link>
        </h2>
        {product.optionsLabel && <p className="text-xs text-accent">{product.optionsLabel}</p>}
        <p className={'cart-review-unit-price text-[12px] text-muted-foreground mt-0 mx-0 mb-3.5'}>
          {money(product.price)} للقطعة
        </p>
        <div className={'cart-review-controls flex flex-wrap items-center gap-4 max-[700px]:gap-3'}>
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
      <div
        className={cn(
          'cart-review-line-total grid gap-2 text-end pt-1 [&_>_span]:text-muted-foreground [&_>_span]:text-[10px] [&_strong]:whitespace-nowrap',
          '[&_strong]:text-primary [&_strong]:text-[16px] max-[1000px]:[grid-column:2] max-[1000px]:text-start',
        )}
      >
        <span>إجمالي المنتج</span>
        <strong>{money(product.price * product.quantity)}</strong>
      </div>
    </li>
  );
}
