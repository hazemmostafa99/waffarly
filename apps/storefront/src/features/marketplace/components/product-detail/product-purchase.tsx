'use client';

import { useState } from 'react';
import { QuantitySelector } from '@/components/marketplace/quantity-selector';
import { useMarketplaceStore } from '../../providers/marketplace-providers';
import { MAX_CART_QUANTITY, money, type MarketplaceProduct } from '../../model/catalog';

export function ProductPurchase({ product }: { product: MarketplaceProduct }) {
  const [quantity, setQuantity] = useState(1);
  const existing = useMarketplaceStore(
    (state) => state.cart.find((line) => line.productId === product.id)?.quantity ?? 0,
  );
  const add = useMarketplaceStore((state) => state.addToCart);
  const open = useMarketplaceStore((state) => state.setCartOpen);
  const remaining = MAX_CART_QUANTITY - existing;
  const allowed = quantity <= remaining;
  return (
    <section className="detail-purchase" aria-label="إضافة المنتج للسلة">
      <h2 className="detail-purchase-title">أضف إلى سلتك</h2>
      <div className="detail-quantity">
        <span>الكمية</span>
        <QuantitySelector value={quantity} onChange={setQuantity} />
      </div>
      <div className="total">
        <span>الإجمالي ({quantity} قطعة)</span>
        <span>{money(product.price * quantity)}</span>
      </div>
      <button
        type="button"
        className="add"
        disabled={!allowed}
        onClick={() => {
          if (add(product.id, quantity)) open(true);
        }}
      >
        أضف للسلة
      </button>
      <p className="detail-note">
        تجربة محلية · الإجمالي لا يشمل رسومًا إضافية، وحد الكمية ليس تأكيدًا للمخزون.
      </p>
      {!allowed && (
        <p role="status" className="detail-note">
          الكمية دي هتتجاوز حد التجربة ({MAX_CART_QUANTITY} قطعة لكل منتج). عدّل الكمية أو راجع
          السلة.
        </p>
      )}
    </section>
  );
}
