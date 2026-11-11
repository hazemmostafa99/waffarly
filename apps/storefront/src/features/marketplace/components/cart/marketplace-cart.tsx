'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
import { cartProducts, cartTotal, money } from '../../model/catalog';
import { QuantitySelector } from '@/components/marketplace/quantity-selector';

export function MarketplaceCart() {
  const open = useMarketplaceStore((s) => s.cartOpen);
  const setOpen = useMarketplaceStore((s) => s.setCartOpen);
  const ids = useMarketplaceStore((s) => s.cart);
  const remove = useMarketplaceStore((s) => s.removeCartItem);
  const setQuantity = useMarketplaceStore((s) => s.setCartQuantity);
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
        const buttons =
          drawer.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
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
        className={`overlay${open ? ' show' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        ref={drawer}
        className={`cart-drawer${open ? ' open' : ''}`}
        role="dialog"
        aria-modal={open || undefined}
        aria-hidden={!open}
        aria-label="سلة التسوق"
      >
        <div className="drawer-head">
          <h3>سلة التسوق</h3>
          <button
            ref={closeButton}
            className="close"
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>
        <div className="cart-list">
          {products.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '35px 10px' }}>
              السلة فارغة حاليًا
            </p>
          ) : (
            products.map((p) => (
              <div className="cart-item" key={p.id}>
                <img className="cart-thumb" src={p.cartImage} alt="" />
                <div>
                  <b>{p.cartName}</b>
                  <span>
                    {money(p.price)} للقطعة · الإجمالي {money(p.price * p.quantity)}
                  </span>
                  <QuantitySelector
                    value={p.quantity}
                    onChange={(quantity) => setQuantity(p.id, quantity)}
                    label={`كمية ${p.cartName}`}
                  />
                </div>
                <button
                  className="remove"
                  onClick={() => {
                    remove(p.id);
                    closeButton.current?.focus();
                  }}
                  aria-label={`حذف ${p.cartName}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <div className="drawer-foot">
          <div className="total">
            <span>الإجمالي</span>
            <span>{money(cartTotal(ids))}</span>
          </div>
          <p className="detail-note">
            سلة تجريبية محلية — راجع المنتجات للمتابعة إلى التأكيد التجريبي. الإجمالي لا يشمل رسومًا إضافية.
          </p>
          <Link href="/marketplace/cart" className="checkout" onClick={() => setOpen(false)}>
            مراجعة السلة
          </Link>
        </div>
      </aside>
    </>
  );
}
