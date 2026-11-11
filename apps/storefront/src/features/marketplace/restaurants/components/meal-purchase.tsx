'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { MarketplaceDialog } from '@/components/marketplace/marketplace-dialog';
import { QuantitySelector } from '@/components/marketplace/quantity-selector';
import { mealOptionGroups } from '@/features/marketplace/data/restaurant-scenarios';
import { mealAvailable, mealConfiguration, validMealSelection, type MealSelection } from '@/features/marketplace/restaurants/model/meal-options';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { conflictsWithRestaurant } from '@/features/marketplace/cart/state/cart-slice';
import { cartLineId, MAX_CART_QUANTITY } from '@/features/marketplace/cart/model/cart';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { money } from '@/features/marketplace/shared/lib/format-money';

export function MealPurchase({ product, onAdded }: { product: MarketplaceProduct; onAdded?: () => void }) {
  const [selection, setSelection] = useState<MealSelection>({});
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(false);
  const cart = useCartStore((state) => state.cart);
  const add = useCartStore((state) => state.addToCart);
  const openCart = useCartStore((state) => state.setCartOpen);
  const configuration = mealConfiguration(selection);
  const available = mealAvailable(product);

  function addMeal(replace = false) {
    if (!validMealSelection(selection)) { setNotice('اختار الحجم المطلوب الأول.'); return; }
    const existing = cart.find((line) => cartLineId(line) === cartLineId({ productId: product.id, selection }));
    if ((existing?.quantity ?? 0) + quantity > MAX_CART_QUANTITY) { setNotice('الكمية دي هتتجاوز الحد التجريبي للصنف بنفس الاختيارات.'); return; }
    if (!replace && conflictsWithRestaurant(cart, product.id)) { setReplaceOpen(true); return; }
    if (!add(product.id, quantity, selection, replace)) { setNotice('تعذرت الإضافة. راجع توفر الوجبة والكمية.'); setReplaceOpen(false); return; }
    setReplaceOpen(false);
    setNotice('اتضافت الوجبة باختياراتك.');
    onAdded?.();
    openCart(true);
  }

  return (
    <section className="mt-4 space-y-4 rounded-2xl border border-border bg-secondary p-4" aria-label="اختيارات الوجبة التجريبية">
      <p className="m-0 text-xs leading-5 text-accent">اختيارات وأسعار تجريبية محلية، مش منيو فعلي للمطعم.</p>
      {!available && <p role="status" className="font-bold text-destructive">الوجبة غير متاحة أو المطعم مغلق في السيناريو التجريبي.</p>}
      {mealOptionGroups.map((group) => (
        <fieldset key={group.id} disabled={!available} className="m-0 min-w-0 space-y-2 border-0 p-0">
          <legend className="mb-2 text-sm font-bold">{group.label} · {group.required ? 'مطلوب — اختيار واحد' : 'اختياري'}</legend>
          {group.choices.map((choice) => (
            <label key={choice.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
              <span className="flex items-center gap-2">
                <input type={group.required ? 'radio' : 'checkbox'} name={`${product.id}-${group.id}`}
                  checked={selection[group.id]?.includes(choice.id) ?? false}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelection((current) => ({ ...current, [group.id]: group.required ? [choice.id]
                      : checked ? [...(current[group.id] ?? []), choice.id] : (current[group.id] ?? []).filter((id) => id !== choice.id) }));
                    setNotice('');
                  }} />
                {choice.label}
              </span>
              <span>{choice.price ? `+ ${money(choice.price)}` : 'بدون زيادة'}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <QuantitySelector value={quantity} onChange={setQuantity} />
        <strong className="text-primary">{money((product.price + configuration.extraPrice) * quantity)}</strong>
      </div>
      <Button disabled={!available} onClick={() => addMeal()} className="min-h-11 w-full rounded-xl bg-waffarly-gold px-4 font-bold text-primary disabled:opacity-50">أضف الوجبة للسلة</Button>
      <p role="status" className="m-0 text-sm empty:hidden">{notice}</p>
      <MarketplaceDialog open={replaceOpen} onClose={() => setReplaceOpen(false)} title="تبدأ سلة جديدة؟">
        <p>طلب المطاعم التجريبي بيكون من مطعم واحد. الإضافة من {product.merchantName} هتستبدل الأصناف الموجودة في السلة.</p>
        <div className="grid gap-3">
          <Button onClick={() => addMeal(true)} className="min-h-11 rounded-xl bg-waffarly-gold px-4 font-bold">استبدل السلة وأضف الوجبة</Button>
          <Button onClick={() => setReplaceOpen(false)} className="min-h-10 rounded-xl border border-border">احتفظ بالسلة الحالية</Button>
          <Link href="/cart" className="text-center text-sm text-accent">راجع السلة</Link>
        </div>
      </MarketplaceDialog>
    </section>
  );
}
