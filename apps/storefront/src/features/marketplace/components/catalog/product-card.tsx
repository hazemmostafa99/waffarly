'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { productHref } from '../../model/product-navigation';
import { ProductPrice } from './product-price';
import { ProductRating } from './product-rating';
import { FavoriteButton } from './favorite-button';
import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
import { MAX_CART_QUANTITY, type MarketplaceProduct } from '../../model/catalog';

export function ProductCard({
  product: p,
  onAdded,
}: {
  product: MarketplaceProduct;
  onAdded: () => void;
}) {
  const params = useSearchParams();
  const href = productHref(p.id, params.toString());
  const addToCart = useMarketplaceStore((s) => s.addToCart);
  const atLimit = useMarketplaceStore(
    (s) => (s.cart.find((line) => line.productId === p.id)?.quantity ?? 0) >= MAX_CART_QUANTITY,
  );
  return (
    <article className="product">
      <div className="product-image">
        <Link href={href} aria-label={p.name}>
          <img {...p.image} loading="lazy" />
        </Link>
        <span className="discount">{p.discount}</span>
        <FavoriteButton productId={p.id} name={p.cartName} />
      </div>
      <div className="product-body">
        <div className="seller">
          <span className="verified">✓</span>
          {p.seller.replace('✓', '').trim()}
        </div>
        <h3>
          <Link href={href}>{p.name}</Link>
        </h3>
        <ProductRating rating={p.rating} />
        <ProductPrice product={p} />
        <div className="delivery">{p.delivery}</div>
        <button
          className="add"
          disabled={atLimit}
          onClick={() => {
            if (addToCart(p.id)) onAdded();
          }}
        >
          أضف للسلة
        </button>
      </div>
    </article>
  );
}
