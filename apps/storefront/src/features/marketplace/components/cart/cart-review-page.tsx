'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useMarketplaceStore } from '../../providers/marketplace-providers';
import { cartProducts, cartQuantity, cartTotal } from '../../model/catalog';
import { CartReviewItem } from './cart-review-item';
import { CartSummary } from './cart-summary';
import { CartEmptyState } from './cart-empty-state';

export function CartReviewPage() {
  const lines = useMarketplaceStore(state => state.cart);
  const setQuantity = useMarketplaceStore(state => state.setCartQuantity);
  const remove = useMarketplaceStore(state => state.removeCartItem);
  const products = cartProducts(lines);
  const heading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState('');

  function removeProduct(id: string, name: string) {
    remove(id);
    setNotice(`تم حذف ${name} من السلة.`);
    heading.current?.focus({ preventScroll: true });
  }

  return (
    <main id="marketplace-main" tabIndex={-1} className="cart-review-page">
      <MarketplaceContainer>
        <nav className="cart-breadcrumbs" aria-label="مسار التنقل">
          <Link href="/marketplace">الرئيسية</Link><span aria-hidden="true">/</span><span aria-current="page">سلة التسوق</span>
        </nav>
        <div className="cart-review-heading">
          <div><h1 ref={heading} tabIndex={-1}>سلة التسوق</h1><p>راجع اختياراتك وعدّل الكميات قبل الخطوة الجاية.</p></div>
          <span className="cart-demo-label">تجربة محلية</span>
        </div>
        <p role="status" className="cart-review-notice">{notice}</p>
        {products.length ? (
          <div className="cart-review-layout">
            <section className="cart-review-products" aria-label="المنتجات في السلة">
              <div className="cart-review-list-heading"><h2>منتجاتك</h2><span aria-live="polite">{cartQuantity(lines)} قطعة</span></div>
              <ul>{products.map(product => (
                <CartReviewItem key={product.id} product={product}
                  onQuantityChange={quantity => setQuantity(product.id, quantity)}
                  onRemove={() => removeProduct(product.id, product.cartName)} />
              ))}</ul>
            </section>
            <CartSummary total={cartTotal(lines)} quantity={cartQuantity(lines)} productCount={products.length} />
          </div>
        ) : <CartEmptyState />}
        <p className="cart-storage-note">السلة محفوظة أثناء التنقل داخل الموقع فقط؛ تحديث الصفحة يمسح اختيارات التجربة.</p>
      </MarketplaceContainer>
    </main>
  );
}
