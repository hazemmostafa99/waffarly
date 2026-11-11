import type { MarketplaceProduct } from '../../model/catalog';
import { FavoriteButton } from '../catalog/favorite-button';

export function ProductMedia({ product }: { product: MarketplaceProduct }) {
  return (
    <div className="detail-media">
      <img {...product.image} />
      <span className="discount">{product.discount}</span>
      <FavoriteButton productId={product.id} name={product.cartName} />
    </div>
  );
}
