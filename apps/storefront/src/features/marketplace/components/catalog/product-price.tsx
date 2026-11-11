import { money, type MarketplaceProduct } from '../../model/catalog';
export function ProductPrice({ product }: { product: MarketplaceProduct }) {
  return (
    <div className="price-row">
      <span className="price">{money(product.price)}</span>
      <span className="old">{product.oldPrice}</span>
    </div>
  );
}
