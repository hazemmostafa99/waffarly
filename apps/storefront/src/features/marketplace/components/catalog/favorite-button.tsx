'use client';

import { useMarketplaceStore } from '../../providers/marketplace-providers';
export function FavoriteButton({ productId, name }: { productId: string; name: string }) {
  const favorite = useMarketplaceStore((state) => state.favorites.includes(productId));
  const toggle = useMarketplaceStore((state) => state.toggleFavorite);
  return (
    <button
      type="button"
      className={`wish${favorite ? ' on' : ''}`}
      aria-label={`المفضلة: ${name}`}
      aria-pressed={favorite}
      onClick={() => toggle(productId)}
    >
      {favorite ? '♥' : '♡'}
    </button>
  );
}
