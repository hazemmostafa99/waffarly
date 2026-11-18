'use client';

import { cn } from '@waffarly/ui';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import {
  cartLineId,
  cartProducts,
  cartQuantity,
  cartTotal,
} from '@/features/marketplace/cart/model/cart';
import { CartReviewItem } from '@/features/marketplace/cart/components/cart-review-item';
import { CartSummary } from '@/features/marketplace/cart/components/cart-summary';
import { CartEmptyState } from '@/features/marketplace/cart/components/cart-empty-state';
import { findProduct } from '@/features/marketplace/catalog/model/catalog';
import { mealGroups } from '@/features/marketplace/restaurants/model/meal-options';
import { MealCustomizerDialog } from '@/features/marketplace/restaurants/components/meal-customizer-dialog';

export function CartReviewPage() {
  const lines = useCartStore((state) => state.cart);
  const setQuantity = useCartStore((state) => state.setCartQuantity);
  const remove = useCartStore((state) => state.removeCartItem);
  const products = cartProducts(lines);
  const heading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingLine = lines.find((line) => cartLineId(line) === editingId);
  const editingProduct =
    editingLine && (editingLine.snapshot ?? findProduct(editingLine.productId));

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
        'cart-review-page pb-16 min-h-[60vh] pt-4 [&_>_.marketplace-container]:max-w-310 max-[700px]:pt-3'
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
        {!products[0]?.restaurantSlug && products.length > 0 && (
          <p className="mb-3 mt-0 text-[12px] text-accent">تجربة محلية</p>
        )}
        <p
          role="status"
          className={
            'cart-review-notice mt-0 mb-3 bg-secondary text-accent py-3 px-4 rounded-[10px] text-[13px] empty:hidden'
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
                  'cart-review-list-heading flex items-center justify-between px-4 py-3 [border-bottom-width:1px] [border-bottom-style:solid] [border-bottom-color:var(--line)]',
                  '[&_h2]:m-0 [&_h2]:text-[17px] [&_h2]:font-bold [&_>_span]:text-muted-foreground [&_>_span]:text-[12px] max-[700px]:py-3 max-[700px]:px-3.5',
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
                    {...(product.merchantType === 'restaurant' &&
                    mealGroups(product, product.selection).length > 0
                      ? { onEdit: () => setEditingId(product.lineId) }
                      : {})}
                  />
                ))}
              </ul>
            </section>
            <CartSummary
              total={cartTotal(lines)}
              quantity={cartQuantity(lines)}
              productCount={products.length}
              {...(products[0]?.restaurantSlug
                ? { restaurantSlug: products[0].restaurantSlug }
                : {})}
              {...(products[0]?.merchantType === 'restaurant' &&
              products[0].merchantName !== undefined
                ? { restaurantName: products[0].merchantName }
                : {})}
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
        {editingLine && editingProduct && editingId && (
          <MealCustomizerDialog
            product={editingProduct}
            onClose={() => setEditingId(null)}
            editLine={{
              lineId: editingId,
              quantity: editingLine.quantity,
              ...(editingLine.selection ? { selection: editingLine.selection } : {}),
            }}
            onSaved={() => {
              setEditingId(null);
              setNotice('تم تحديث اختيارات المنتج وإجمالي السلة.');
              heading.current?.focus({ preventScroll: true });
            }}
          />
        )}
      </MarketplaceContainer>
    </main>
  );
}
