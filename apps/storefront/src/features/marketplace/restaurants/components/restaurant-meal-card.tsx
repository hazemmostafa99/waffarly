'use client';

import Link from 'next/link';
import { cn } from '@waffarly/ui';
import { Plus } from 'lucide-react';
import { FavoriteButton } from '@/features/marketplace/favorites/components/favorite-button';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { money } from '@/features/marketplace/shared/lib/format-money';

export function RestaurantMealCard({ product, restaurantOpen, onSelect, selected = false }: {
  product: MarketplaceProduct;
  restaurantOpen: boolean;
  onSelect: () => void;
  selected?: boolean;
}) {
  const available = restaurantOpen && product.available !== false;

  return (
    <article className={cn('group grid w-full min-w-0 grid-cols-[96px_minmax(0,1fr)] items-start gap-3 rounded-2xl border bg-card p-3 max-[380px]:grid-cols-[80px_minmax(0,1fr)] shadow-[0_5px_18px_rgba(43,13,55,0.045)] transition-[border-color,box-shadow] duration-200 hover:shadow-[0_7px_22px_rgba(43,13,55,0.09)]', selected ? 'border-accent shadow-[0_0_0_1px_var(--purple-100)]' : 'border-border/70 hover:border-[var(--purple-100)]')}>
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-[var(--purple-50)] max-[380px]:size-20">
        <img {...product.image} loading="lazy" className={`block aspect-square h-full w-full object-cover object-center ${available ? '' : 'opacity-60 grayscale-[35%]'}`} />
        <FavoriteButton className="left-1.5 top-1.5 size-[30px] text-[16px] shadow-sm" productId={product.id} name={product.cartName} product={product} />
        {!available && <span className="absolute inset-x-1 bottom-1 rounded-md bg-white/95 px-1 py-1 text-center text-[9px] font-bold text-muted-foreground">{product.restaurantSlug ? 'غير متاح' : 'غير متاح — تجربة'}</span>}
      </div>
      <div className="flex min-h-24 min-w-0 flex-col items-start">
        <h4 className="mb-1 mt-0 line-clamp-2 text-[14px] font-medium leading-5 text-foreground">
          <Link href={`/products/${product.id}${product.restaurantSlug ? `?restaurant=${encodeURIComponent(product.restaurantSlug)}` : ''}`} className="text-inherit no-underline transition-colors hover:text-accent">{product.name}</Link>
        </h4>
        <p className="mb-2 mt-0 line-clamp-2 text-[11px] leading-[1.6] text-muted-foreground">{product.description ?? 'وجبة توضيحية بحجم وإضافات حسب اختيارك.'}</p>
        <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1">
          <span className="whitespace-nowrap text-[14px] font-bold text-primary"><small className="me-1 text-[10px] font-normal text-muted-foreground">من</small>{money(product.price)}</span>
          <MarketplaceButton type="button" tone={available ? 'gold' : 'neutral'} disabled={!available} onClick={onSelect}
            aria-label={available ? `اختار حجم وإضافات ${product.name}` : `${product.name} غير متاح`}
            aria-expanded={available ? selected : undefined}
            className="inline-flex min-h-8 items-center justify-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed">
            {available ? <><Plus size={15} aria-hidden="true" />اختار</> : !restaurantOpen ? 'مغلق' : 'غير متاح'}
          </MarketplaceButton>
        </div>
      </div>
    </article>
  );
}
