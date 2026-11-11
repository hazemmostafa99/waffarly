'use client';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import { cn } from '@waffarly/ui';

import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
export function FavoriteButton({ productId, name }: { productId: string; name: string }) {
  const favorite = useMarketplaceStore((state) => state.favorites.includes(productId));
  const toggle = useMarketplaceStore((state) => state.toggleFavorite);
  return (
    <Button
      type="button"
      className={cn(
        `wish${favorite ? ' on' : ''}`,
        'disabled:cursor-not-allowed disabled:opacity-[0.5] absolute top-2.5 left-[10px] w-8.5 h-8.5 border-0 rounded-full bg-[rgba(255,_255,_255,_0.92)] text-[18px] [&.on]:text-destructive',
      )}
      aria-label={`المفضلة: ${name}`}
      aria-pressed={favorite}
      onClick={() => toggle(productId)}
    >
      {favorite ? '♥' : '♡'}
    </Button>
  );
}
