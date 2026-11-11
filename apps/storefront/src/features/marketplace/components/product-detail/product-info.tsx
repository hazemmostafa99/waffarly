import type { MarketplaceProduct } from '../../model/catalog';
import { ProductPrice } from '../catalog/product-price';
import { ProductRating } from '../catalog/product-rating';
import { ProductSellerCard } from './product-seller-card';

export function ProductInfo({ product }: { product: MarketplaceProduct }) {
  return (
    <>
      <p className="detail-demo">تجربة محلية — بيانات النموذج</p>
      <h1>{product.name}</h1>
      <ProductRating rating={product.rating} />
      <div className="detail-price-block">
        <ProductPrice product={product} />
        <span className="detail-saving">خصم {product.discount.replace('-', '')}</span>
      </div>
      <ProductSellerCard product={product} />
    </>
  );
}
