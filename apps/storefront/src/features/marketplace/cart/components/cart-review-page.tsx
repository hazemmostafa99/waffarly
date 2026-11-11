'use client';

import { cn } from '@waffarly/ui';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { cartProducts, cartQuantity, cartTotal } from '@/features/marketplace/cart/model/cart';
import { CartReviewItem } from '@/features/marketplace/cart/components/cart-review-item';
import { CartSummary } from '@/features/marketplace/cart/components/cart-summary';
import { CartEmptyState } from '@/features/marketplace/cart/components/cart-empty-state';

export function CartReviewPage() {
  const lines = useCartStore((state) => state.cart);
  const setQuantity = useCartStore((state) => state.setCartQuantity);
  const remove = useCartStore((state) => state.removeCartItem);
  const products = cartProducts(lines);
  const heading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState('');

  function removeProduct(id: string, name: string) {
    remove(id);
    setNotice(`تم حذف ${name} من السلة.`);
    heading.current?.focus({ preventScroll: true });
  }

  return (
    <main
      id="marketplace-main"
      tabIndex={-1}
      className={
        'cart-review-page pb-16 min-h-[60vh] pt-6 [&_>_.marketplace-container]:max-w-310 max-[700px]:pt-4.5'
      }
    >
      <MarketplaceContainer>
        <nav
          className={
            'cart-breadcrumbs flex items-center gap-2.5 text-muted-foreground text-[12px] mb-3 [&_a]:text-accent [&_a]:no-underline'
          }
          aria-label="مسار التنقل"
        >
          <Link href="/">الرئيسية</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">سلة التسوق</span>
        </nav>
        <h1 ref={heading} tabIndex={-1} className="sr-only">
          سلة التسوق
        </h1>
        <div className="mb-3 flex justify-end">
          <span
            className={
              'cart-demo-label whitespace-nowrap py-[7px] px-2.5 rounded-[8px] bg-secondary text-accent text-[11px]'
            }
          >
            تجربة محلية
          </span>
        </div>
        <p
          role="status"
          className={
            'cart-review-notice bg-secondary text-accent py-3 px-4 rounded-[10px] text-[13px] empty:hidden'
          }
        >
          {notice}
        </p>
        {products.length ? (
          <div
            className={
              'cart-review-layout grid grid-cols-[minmax(0,1fr)_330px] items-start gap-6 max-[1000px]:grid-cols-[minmax(0,1fr)_290px] max-[1000px]:gap-4 max-[768px]:grid-cols-[1fr]'
            }
          >
            <section
              className={
                'cart-review-products min-w-0 bg-card border border-solid border-border rounded-[18px] [&_ul]:p-0 [&_ul]:m-0 [&_ul]:list-none'
              }
              aria-label="المنتجات في السلة"
            >
              <div
                className={cn(
                  'cart-review-list-heading flex items-center justify-between p-5 [border-bottom-width:1px] [border-bottom-style:solid] [border-bottom-color:var(--line)]',
                  '[&_h2]:m-0 [&_h2]:text-[18px] [&_>_span]:text-muted-foreground [&_>_span]:text-[12px] max-[700px]:py-4.5 max-[700px]:px-3.5',
                )}
              >
                <h2>منتجاتك</h2>
                <span aria-live="polite">{cartQuantity(lines)} قطعة</span>
              </div>
              <ul>
                {products.map((product) => (
                  <CartReviewItem
                    key={product.lineId}
                    product={product}
                    onQuantityChange={(quantity) => setQuantity(product.lineId, quantity)}
                    onRemove={() => removeProduct(product.lineId, product.cartName)}
                  />
                ))}
              </ul>
            </section>
            <CartSummary
              total={cartTotal(lines)}
              quantity={cartQuantity(lines)}
              productCount={products.length}
              {...(products[0]?.merchantType === 'restaurant' && products[0].merchantName !== undefined ? { restaurantName: products[0].merchantName } : {})}
            />
          </div>
        ) : (
          <CartEmptyState />
        )}
        <p
          className={
            'cart-storage-note text-muted-foreground text-[11px] leading-[1.8] mt-5 mx-0 mb-0'
          }
        >
          السلة محفوظة أثناء التنقل داخل الموقع فقط؛ تحديث الصفحة يمسح اختيارات التجربة.
        </p>
      </MarketplaceContainer>
    </main>
  );
}
