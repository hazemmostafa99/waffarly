'use client';

import type { MarketplaceProduct } from '../../model/catalog';
import { productRecommendations } from '../../model/product-recommendations';
import { useMarketplaceStore } from '../../providers/marketplace-providers';
import { ProductCard } from '../catalog/product-card';

export function ProductRecommendations({ product }: { product: MarketplaceProduct }) {
  const products = productRecommendations(product);
  const openCart = useMarketplaceStore((state) => state.setCartOpen);
  if (!products.length) return null;
  const hasRelated = products.some((item) => item.category === product.category);
  return (
    <section className="product-recommendations" aria-labelledby="recommendations-title">
      <div className="section-head">
        <div>
          <h2 id="recommendations-title">{hasRelated ? 'منتجات قد تعجبك' : 'اكتشف منتجات أخرى'}</h2>
          <p>
            {hasRelated
              ? 'اختيارات من نفس القسم، ومعاها منتجات من أقسام أخرى.'
              : 'اختيارات من الأقسام الأخرى المتاحة للتصفح.'}
          </p>
        </div>
      </div>
      <div className="products">
        {products.map((item) => (
          <div className="recommendation-entry" key={item.id}>
            <span
              className={`recommendation-label${item.category === product.category ? ' related' : ''}`}
            >
              {item.category === product.category ? 'من نفس القسم' : 'من قسم آخر'}
            </span>
            <ProductCard product={item} onAdded={() => openCart(true)} />
          </div>
        ))}
      </div>
    </section>
  );
}
