import type { MarketplaceProduct } from '../../model/catalog';

export function ProductSellerCard({ product }: { product: MarketplaceProduct }) {
  const seller = product.seller.replace('✓', '').trim();
  return (
    <section className="detail-seller-card" aria-label="البائع وبيانات التوصيل">
      <div className="detail-seller-icon" aria-hidden="true">
        {seller.slice(0, 1)}
      </div>
      <div>
        <span className="detail-section-label">يباع بواسطة</span>
        <div className="seller">
          <strong>{seller}</strong>
          <span className="verified" aria-label="علامة التحقق في النموذج">
            ✓
          </span>
        </div>
        <p>
          <span className="delivery">{product.delivery}</span>
          <small>بيانات التوصيل من النموذج المحلي</small>
        </p>
      </div>
    </section>
  );
}
