'use client';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import { cn } from '@waffarly/ui';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { cartProducts, cartTotal } from '@/features/marketplace/cart/model/cart';
import { money } from '@/features/marketplace/shared/lib/format-money';
import { QuantitySelector } from '@/components/marketplace/quantity-selector';

export function MarketplaceCart() {
  const open = useCartStore((s) => s.cartOpen);
  const setOpen = useCartStore((s) => s.setCartOpen);
  const ids = useCartStore((s) => s.cart);
  const remove = useCartStore((s) => s.removeCartItem);
  const setQuantity = useCartStore((s) => s.setCartQuantity);
  const drawer = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const products = cartProducts(ids);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    closeButton.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab') {
        const buttons = drawer.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href]',
        );
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
      else document.getElementById('marketplace-main')?.focus();
    };
  }, [open, setOpen]);
  return (
    <>
      <div
        className={cn(
          `overlay${open ? ' show' : ''}`,
          'fixed [inset:0] bg-[rgba(20,_5,_27,_0.5)] z-[29] opacity-[0] [pointer-events:none] [transition:0.25s] [&.show]:opacity-[1] [&.show]:[pointer-events:auto]',
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        ref={drawer}
        className={cn(
          `cart-drawer${open ? ' open' : ''}`,
          'fixed z-[30] top-0 left-0 w-[min(390px,_92vw)] h-full bg-white [box-shadow:15px_0_50px_rgba(0,_0,_0,_0.2)] [transform:translateX(-105%)] [transition:0.28s] flex flex-col [&.open]:[transform:none] [&:not(.open)]:invisible',
        )}
        role="dialog"
        aria-modal={open || undefined}
        aria-hidden={!open}
        aria-label="سلة التسوق"
      >
        <div
          className={
            'drawer-head p-5 flex items-center justify-between [border-bottom-width:1px] [border-bottom-style:solid] [border-bottom-color:var(--line)] [&_h3]:m-0'
          }
        >
          <h3>سلة التسوق</h3>
          <Button
            ref={closeButton}
            className={
              'close disabled:cursor-not-allowed disabled:opacity-[0.5] border-0 bg-[#f2eef4] w-9.5 h-9.5 rounded-[10px] text-[21px]'
            }
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
          >
            ×
          </Button>
        </div>
        <div className={'cart-list p-3.5 overflow-auto [flex:1]'}>
          {products[0]?.merchantType === 'restaurant' && <p className="rounded-xl bg-secondary p-3 text-xs font-bold text-accent">{products[0].merchantName} · طلب من مطعم واحد · رسوم التوصيل التجريبية في إتمام الطلب</p>}
          {products.length === 0 ? (
            <p className={'text-center text-muted-foreground py-[35px] px-2.5'}>
              السلة فارغة حاليًا
            </p>
          ) : (
            products.map((p) => (
              <div
                className={cn(
                  'cart-item grid grid-cols-[58px_1fr_auto] gap-2.5 items-center p-[11px] [border-bottom-width:1px] [border-bottom-style:solid]',
                  '[border-bottom-color:var(--line)] [&_b]:text-[12px] [&_b]:block [&_span]:text-[11px] [&_span]:text-accent [&_.quantity-selector]:mt-2 [&_.quantity-selector_button]:w-7 [&_.quantity-selector_button]:h-7',
                )}
                key={p.lineId}
              >
                <img
                  className={'cart-thumb w-14.5 h-14.5 rounded-[10px] object-cover'}
                  src={p.cartImage}
                  alt=""
                />
                <div>
                  <b>{p.cartName}</b>
                  {p.optionsLabel && <p className="my-1 text-xs text-accent">{p.optionsLabel}</p>}
                  <span>
                    {money(p.price)} للقطعة · الإجمالي {money(p.price * p.quantity)}
                  </span>
                  <QuantitySelector
                    value={p.quantity}
                    onChange={(quantity) => setQuantity(p.lineId, quantity)}
                    label={`كمية ${p.cartName}`}
                  />
                </div>
                <Button
                  className={
                    'remove disabled:cursor-not-allowed disabled:opacity-[0.5] border-0 bg-transparent text-destructive text-[18px]'
                  }
                  onClick={() => {
                    remove(p.lineId);
                    closeButton.current?.focus();
                  }}
                  aria-label={`حذف ${p.cartName}`}
                >
                  ×
                </Button>
              </div>
            ))
          )}
        </div>
        <div
          className={
            'drawer-foot p-4.5 [border-top-width:1px] [border-top-style:solid] [border-top-color:var(--line)] [&_a.checkout]:block [&_a.checkout]:text-center [&_a.checkout]:no-underline [&_a.checkout:hover]:bg-accent'
          }
        >
          <div className={'total flex justify-between font-black mb-[13px]'}>
            <span>الإجمالي</span>
            <span>{money(cartTotal(ids))}</span>
          </div>
          <p className={'detail-note text-[12px] leading-[1.8] text-muted-foreground'}>
            سلة تجريبية محلية — راجع المنتجات للمتابعة إلى التأكيد التجريبي. الإجمالي لا يشمل رسومًا
            إضافية.
          </p>
          <Link
            href="/cart"
            className={
              'checkout w-full border-0 bg-[var(--purple-800)] text-[#fff] p-3.5 rounded-[11px] font-black'
            }
            onClick={() => setOpen(false)}
          >
            مراجعة السلة
          </Link>
        </div>
      </aside>
    </>
  );
}
