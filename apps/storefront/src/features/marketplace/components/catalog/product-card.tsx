'use client';

import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
import type { MarketplaceProduct } from '../../model/catalog';

export function ProductCard({
  product: p,
  onAdded,
}: {
  product: MarketplaceProduct;
  onAdded: () => void;
}) {
  const favorite = useMarketplaceStore((s) => s.favorites.includes(p.id));
  const toggleFavorite = useMarketplaceStore((s) => s.toggleFavorite);
  const addToCart = useMarketplaceStore((s) => s.addToCart);
  const rating = p.rating.split(' ')[0] ?? '';
  const reviews = p.rating.slice(rating.length).trim();
  return (
    <article className="product">
      <div className="product-image">
        <img {...p.image} loading="lazy" />
        <span className="discount">{p.discount}</span>
        <button
          className={`wish${favorite ? ' on' : ''}`}
          aria-label={`المفضلة: ${p.cartName}`}
          aria-pressed={favorite}
          onClick={() => toggleFavorite(p.id)}
        >
          {favorite ? '♥' : '♡'}
        </button>
      </div>
      <div className="product-body">
        <div className="seller">
          <span className="verified">✓</span>
          {p.seller.replace('✓', '').trim()}
        </div>
        <h3>{p.name}</h3>
        <div className="rating">
          {rating} <span>{reviews}</span>
        </div>
        <div className="price-row">
          <span className="price">{p.displayPrice}</span>
          <span className="old">{p.oldPrice}</span>
        </div>
        <div className="delivery">{p.delivery}</div>
        <button
          className="add"
          onClick={() => {
            addToCart(p.id);
            onAdded();
          }}
        >
          أضف للسلة
        </button>
      </div>
    </article>
  );
}
