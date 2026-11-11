'use client';

import { filterProducts } from '../../model/catalog';
import { FlashCountdown } from './flash-countdown';
import { ProductCard } from './product-card';

export function MarketplaceProducts({
  category,
  term,
  onAdded,
}: {
  category: string;
  term: string;
  onAdded: () => void;
}) {
  const products = filterProducts(category, term);
  return (
    <section className="section deal-panel" id="deals">
      <div className="deal-top">
        <span className="deal-title">عروض خاطفة</span>
        <strong>تنتهي خلال</strong>
        <FlashCountdown />
        <a className="more" style={{ marginRight: 'auto' }} href="#">
          عرض الكل ←
        </a>
      </div>
      <div className="products">
        {products.map((p) => (
          <ProductCard product={p} key={p.id} onAdded={onAdded} />
        ))}
      </div>
      {products.length === 0 && (
        <div style={{ textAlign: 'center', padding: 35, color: 'var(--muted)' }}>
          لا توجد منتجات مطابقة لبحثك.
        </div>
      )}
    </section>
  );
}
