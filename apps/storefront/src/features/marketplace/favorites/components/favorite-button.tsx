'use client';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { cn } from '@waffarly/ui';
import { useFavoritesStore } from '@/features/marketplace/favorites/hooks/use-favorites-store';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export function FavoriteButton({
  productId,
  name,
  product,
  className,
}: {
  productId: string;
  name: string;
  product?: MarketplaceProduct;
  className?: string;
}) {
  const favorite = useFavoritesStore((state) => state.favorites.includes(productId));
  const toggle = useFavoritesStore((state) => state.toggleFavorite);
  return (
    <Button
      type="button"
      className={cn(
        `wish${favorite ? ' on' : ''}`,
        'disabled:cursor-not-allowed disabled:opacity-[0.5] absolute top-2.5 left-[10px] w-8.5 h-8.5 border-0 rounded-full bg-[rgba(255,_255,_255,_0.92)] text-[18px] [&.on]:text-destructive',
        className,
      )}
      aria-label={`${favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}: ${name}`}
      aria-pressed={favorite}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(productId, product);
      }}
    >
      {favorite ? '♥' : '♡'}
    </Button>
  );
}
