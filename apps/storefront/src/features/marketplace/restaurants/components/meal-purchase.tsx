'use client';
import { useQuery } from '@tanstack/react-query';
import type { CatalogProductQuoteResponse } from '@waffarly/contracts';
import { apiPost } from '@/lib/api-client';

import { useState } from 'react';
import { cn } from '@waffarly/ui';
import { Layers3, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { MarketplaceDialog } from '@/components/marketplace/marketplace-dialog';
import { QuantitySelector } from '@/components/marketplace/quantity-selector';
import { defaultMealSelection, mealGroups, mealAvailable, mealConfiguration, validMealSelection, type MealSelection } from '@/features/marketplace/restaurants/model/meal-options';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { conflictsWithRestaurant } from '@/features/marketplace/cart/state/cart-slice';
import { cartLineId, MAX_CART_QUANTITY } from '@/features/marketplace/cart/model/cart';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { money } from '@/features/marketplace/shared/lib/format-money';

export function MealPurchase({ product, onAdded, presentation = 'inline' }: {
  product: MarketplaceProduct;
  onAdded?: () => void;
  presentation?: 'inline' | 'dialog' | 'page';
}) {
  const [selection, setSelection] = useState<MealSelection>(() => defaultMealSelection(product));
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(false);
  const cart = useCartStore((state) => state.cart);
  const add = useCartStore((state) => state.addToCart);
  const openCart = useCartStore((state) => state.setCartOpen);
  const configuration = mealConfiguration(selection, product);
  const available = mealAvailable(product);
  const serverProduct = Boolean(product.restaurantSlug);
  const quote = useQuery({
    queryKey: ['marketplace', 'meal-quote', product.restaurantSlug, product.id, selection],
    enabled: serverProduct && available && validMealSelection(selection, product),
    retry: false,
    queryFn: () => apiPost<CatalogProductQuoteResponse>(`catalog/stores/${encodeURIComponent(product.restaurantSlug!)}/products/${product.id}/quote`, {
      ...(selection.size?.[0] ? { variantId: selection.size[0] } : {}),
      selections: (product.apiModifierGroups ?? []).filter((group) => mealGroups(product, selection).some((availableGroup) => availableGroup.id === group.id)).map((group) => ({ groupId: group.id, optionIds: selection[group.id] ?? [] })),
    }),
  });
  const quoteReady = !serverProduct || (quote.isSuccess && !quote.isFetching);
  const total = serverProduct ? (quote.data ? Number(quote.data.totalPrice) * quantity : null) : (product.price + configuration.extraPrice) * quantity;


  function addMeal(replace = false) {
    if (!quoteReady) return;
    if (!validMealSelection(selection, product)) { setNotice('اختار الحجم المطلوب الأول.'); return; }
    const existing = cart.find((line) => cartLineId(line) === cartLineId({ productId: product.id, selection }));
    if ((existing?.quantity ?? 0) + quantity > MAX_CART_QUANTITY) { setNotice('الكمية دي هتتجاوز الحد التجريبي للصنف بنفس الاختيارات.'); return; }
    if (!replace && conflictsWithRestaurant(cart, product.id, product)) { setReplaceOpen(true); return; }
    if (!add(product.id, quantity, selection, replace, serverProduct ? product : undefined, quote.data ? Number(quote.data.totalPrice) : undefined)) { setNotice('تعذرت الإضافة. راجع توفر الوجبة والكمية.'); setReplaceOpen(false); return; }
    setReplaceOpen(false);
    setNotice('اتضافت الوجبة باختياراتك.');
    onAdded?.();
    openCart(true);
  }

  return (
    <section className={cn('flex min-h-0 flex-col bg-card', presentation === 'dialog' ? 'flex-1 overflow-hidden' : 'overflow-hidden rounded-2xl border border-border', presentation === 'page' ? 'mt-3' : presentation === 'inline' && 'mt-5')} aria-label="اختيارات الوجبة التجريبية">
      <div className={cn('min-h-0 px-5 pb-4 pt-3', presentation === 'dialog' && 'flex-1 overflow-y-auto overscroll-contain', presentation === 'page' && 'px-4')}>
        {presentation !== 'page' && <div className="mb-4 border-b border-border pb-4">
          {presentation === 'dialog' && <img {...product.image} className="mb-3 block h-[138px] w-full rounded-[14px] object-cover" />}
          <div className="min-w-0">
            {presentation === 'dialog' && <h3 className="mb-1.5 mt-0 text-[20px] font-extrabold leading-7 text-primary">{product.name}</h3>}
            <p className="mb-3 text-[11px] leading-5 text-muted-foreground">{product.description ?? 'وجبة توضيحية بحجم وإضافات حسب اختيارك.'}</p>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-muted-foreground">السعر الأساسي</span><strong className="text-[19px] font-extrabold text-accent">{money(product.price)}</strong></div>
            <span className="mt-2 inline-block text-[9px] text-muted-foreground">أصناف واختيارات تجريبية · {product.merchantName}</span>
          </div>
        </div>}
        {!available && <p role="status" className="mb-4 rounded-xl bg-secondary p-3 text-xs leading-5 text-destructive">الوجبة غير متاحة أو المطعم مغلق في السيناريو التجريبي.</p>}
        <div className="space-y-4">
          {mealGroups(product, selection).map((group) => (
            <fieldset key={group.id} disabled={!available} className={cn('m-0 min-w-0 border-0 p-0', presentation === 'page' && '[&+fieldset]:border-t [&+fieldset]:border-border/70 [&+fieldset]:pt-3')}>
              <legend className="mb-2.5 w-full p-0">
                <span className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[14px] font-bold text-foreground">{presentation === 'page' && <span className="grid size-6 place-items-center rounded-lg bg-[var(--purple-50)] text-accent">{group.required ? <Layers3 size={14} aria-hidden="true" /> : <SlidersHorizontal size={14} aria-hidden="true" />}</span>}{group.label}</span>
                  <span className={cn('rounded-md px-2 py-1 text-[10px] font-medium', group.required ? 'bg-[var(--purple-50)] text-accent' : 'text-muted-foreground')}>{group.required ? 'مطلوب' : 'اختياري'}</span>
                </span>
                {group.required && <span className="mt-1 block text-[11px] font-normal text-muted-foreground">اختار الحجم المناسب ليك</span>}
              </legend>
              <div className={group.required ? 'grid grid-cols-2 gap-2.5' : 'grid gap-2'}>
                {group.choices.map((choice) => {
                  const checked = selection[group.id]?.includes(choice.id) ?? false;
                  return (
                    <label key={choice.id} className={cn(
                      'cursor-pointer rounded-xl border px-3 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                      group.required ? 'flex flex-col gap-1.5 py-2.5' : 'flex items-center justify-between gap-3 py-2',
                      checked ? 'border-accent bg-[var(--purple-50)]' : 'border-border bg-card hover:border-[var(--purple-100)] hover:bg-[var(--purple-50)]',
                      !available && 'cursor-not-allowed opacity-50',
                    )}>
                      <span className="flex items-center gap-2 text-[13px] font-medium">
                        <input type={group.selectionMode === 'single' ? 'radio' : 'checkbox'} name={`${product.id}-${group.id}`}
                          className="m-0 size-4 shrink-0 accent-[var(--purple-700)]" checked={checked}
                          onChange={(event) => {
                            const nextChecked = event.target.checked;
                            if (serverProduct && group.id === 'size') { setSelection({ size: [choice.id] }); setNotice(''); return; }
                            setSelection((current) => ({ ...current, [group.id]: group.selectionMode === 'single' ? [choice.id]
                              : nextChecked ? [...(current[group.id] ?? []), choice.id] : (current[group.id] ?? []).filter((id) => id !== choice.id) }));
                            setNotice('');
                          }} />
                        {choice.label}
                      </span>
                      <span className={cn('whitespace-nowrap text-[11px]', checked ? 'text-accent' : 'text-muted-foreground', group.required && 'ps-6')}>{choice.price ? `+ ${money(choice.price)}` : 'بدون زيادة'}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
      <div className={cn('shrink-0 border-t border-border bg-card px-4 pb-4 pt-3', presentation === 'page' && 'bg-[var(--purple-50)] sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-x-4 sm:py-3')}>
        {serverProduct && quote.isError && <p role="alert" className="mb-2 text-xs text-destructive">تعذر تسعير الاختيارات من الخادم. <Button type="button" onClick={() => quote.refetch()} className="underline">إعادة المحاولة</Button></p>}
        {notice && <p role="status" className="mb-3 rounded-lg bg-[var(--purple-50)] px-3 py-2 text-[12px] text-accent sm:col-span-2">{notice}</p>}
        <div className={cn('mb-2.5 flex items-center justify-between gap-3 rounded-xl bg-[var(--purple-50)] px-3 py-2.5', presentation === 'page' && 'sm:m-0 sm:flex-col sm:items-start sm:gap-0.5 sm:rounded-none sm:border-e sm:border-[var(--purple-100)] sm:bg-transparent sm:p-0 sm:pe-4')}>
          <div><span className="block text-[13px] font-bold text-primary">الإجمالي</span><span className="mt-0.5 block text-[10px] text-muted-foreground">شامل اختياراتك</span></div>
          <strong className={cn('font-extrabold text-accent', presentation === 'page' ? 'text-[19px]' : 'text-[21px]')}>{total === null ? 'جارٍ حساب السعر…' : money(total)}</strong>
        </div>
        <div className={cn('flex items-center gap-3', presentation === 'page' && 'sm:flex-row-reverse')}>
          <Button type="button" tone="gold" disabled={!available || !quoteReady} onClick={() => addMeal()} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-bold transition-colors disabled:cursor-not-allowed"><ShoppingBag size={17} aria-hidden="true" />أضف للسلة</Button>
          <div className="shrink-0 [&_.quantity-selector]:rounded-xl [&_.quantity-selector]:border-[var(--purple-100)] [&_.quantity-selector_button]:size-9 [&_.quantity-selector_button:hover]:bg-secondary [&_.quantity-selector_output]:min-w-7"><QuantitySelector value={quantity} onChange={setQuantity} /></div>
        </div>
      </div>
      <MarketplaceDialog open={replaceOpen} onClose={() => setReplaceOpen(false)} title="تبدأ سلة جديدة؟">
        <p>طلب المطاعم التجريبي بيكون من مطعم واحد. الإضافة من {product.merchantName} هتستبدل الأصناف الموجودة في السلة.</p>
        <div className="grid gap-3">
          <Button type="button" tone="gold" onClick={() => addMeal(true)} className="min-h-11 rounded-xl px-4 font-bold">استبدل السلة وأضف الوجبة</Button>
          <Button type="button" tone="neutral" onClick={() => setReplaceOpen(false)} className="min-h-10 rounded-xl border border-border">احتفظ بالسلة الحالية</Button>
          <Link href="/cart" className="text-center text-sm text-accent">راجع السلة</Link>
        </div>
      </MarketplaceDialog>
    </section>
  );
}
