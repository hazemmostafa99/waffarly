'use client';

import Link from 'next/link';
import { ShoppingBag, Store, Trash2, Volume2, VolumeX, ChevronLeft } from 'lucide-react';
import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { MarketplaceDialog } from '@/components/marketplace/marketplace-dialog';
import { QuantitySelector } from '@/components/marketplace/quantity-selector';
import { useCartStore } from '../hooks/use-cart-store';
import { cartProducts, cartQuantity, cartTotal } from '../model/cart';
import { money } from '@/features/marketplace/shared/lib/format-money';
import { CartAdditionNotice } from './cart-addition-notice';
import { useCartAdditionSound } from '../hooks/use-cart-addition-sound';
import { productHref } from '@/features/marketplace/product-detail/model/product-navigation';

export function MarketplaceCart() {
  const open = useCartStore((state) => state.cartOpen);
  const setOpen = useCartStore((state) => state.setCartOpen);
  const lines = useCartStore((state) => state.cart);
  const remove = useCartStore((state) => state.removeCartItem);
  const setQuantity = useCartStore((state) => state.setCartQuantity);
  const products = cartProducts(lines);
  const restaurant = products[0]?.merchantType === 'restaurant' ? products[0] : undefined;
  const { soundEnabled, toggleSound } = useCartAdditionSound();
  return (
    <>
      <CartAdditionNotice />
      <MarketplaceDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`سلتك · ${cartQuantity(lines)} قطعة`}
        className="cart-drawer inset-y-0 left-0 right-auto m-0 h-dvh max-h-dvh w-[min(400px,100vw)] rounded-none open:flex open:flex-col [&_[data-slot=dialog-header]]:shrink-0 [&_[data-slot=dialog-header]]:px-4 [&_[data-slot=dialog-header]]:py-3 [&_[data-slot=dialog-header]_h2]:text-[17px] max-[700px]:inset-x-0 max-[700px]:bottom-0 max-[700px]:top-auto max-[700px]:h-auto max-[700px]:max-h-[85dvh] max-[700px]:w-full max-[700px]:rounded-t-[24px]"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        {restaurant && (
          <Link
            href={`/restaurants/${encodeURIComponent(restaurant.restaurantSlug ?? restaurant.merchantName ?? restaurant.seller)}`}
            onClick={() => setOpen(false)}
            aria-label={`العودة إلى منيو ${restaurant.merchantName ?? restaurant.seller}`}
            className="flex shrink-0 items-center gap-2 border-b border-border bg-[var(--purple-50)] px-4 py-2 text-[12px] font-medium text-accent no-underline hover:bg-secondary"
          >
            <Store size={15} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              {restaurant.merchantName ?? restaurant.seller}
            </span>
            <ChevronLeft size={15} aria-hidden="true" />
          </Link>
        )}
        <div className="cart-list min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {!products.length ? (
            <div className="grid justify-items-center gap-3 py-10 text-muted-foreground">
              <ShoppingBag size={28} strokeWidth={1.5} aria-hidden="true" />
              <p className="m-0 text-[14px]">سلتك لسه فاضية</p>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-10 rounded-lg bg-secondary px-4 text-[13px] text-accent"
              >
                كمّل تسوّقك
              </Button>
            </div>
          ) : (
            <ul className="m-0 list-none divide-y divide-border p-0">
              {products.map((product) => (
                <li key={product.lineId} className="cart-item flex items-start gap-3 py-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <img
                      src={product.cartImage || product.image.src}
                      alt=""
                      className="block size-12 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex items-start gap-1">
                        <h3 className="m-0 min-w-0 text-[13px] font-medium leading-6 text-primary">
                          <Link
                            href={productHref(
                              product.id,
                              product.restaurantSlug
                                ? new URLSearchParams({
                                    restaurant: product.restaurantSlug,
                                  }).toString()
                                : '',
                            )}
                            onClick={() => setOpen(false)}
                            className="rounded-sm text-inherit no-underline hover:text-accent hover:underline hover:underline-offset-4"
                          >
                            {product.name}
                          </Link>
                        </h3>
                      </div>
                      {product.optionsLabel && (
                        <p className="mb-0 mt-0.5 text-[11px] leading-5 text-muted-foreground">
                          {product.optionsLabel}
                        </p>
                      )}
                      <p className="mb-0 mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[12px] leading-5">
                        <span className="font-medium text-primary">{money(product.price)}</span>
                        <span className="text-[10px] text-muted-foreground">للقطعة</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid shrink-0 justify-items-center gap-1 pt-0.5 [&_.quantity-selector_button]:size-8 [&_.quantity-selector_output]:min-w-7 [&_.quantity-selector_output]:text-[13px]">
                    <div className="flex items-center gap-1.5">
                      <QuantitySelector
                        value={product.quantity}
                        onChange={(quantity) => setQuantity(product.lineId, quantity)}
                        label={`كمية ${product.name}`}
                      />
                      <Button
                        type="button"
                        onClick={() => remove(product.lineId)}
                        aria-label={`حذف ${product.name}`}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-destructive"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 leading-6">
                      <span className="text-[10px] text-muted-foreground">إجمالي الصنف</span>
                      <strong className="whitespace-nowrap text-[14px] font-bold text-primary">
                        {money(product.price * product.quantity)}
                      </strong>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {products.length > 0 && (
          <div className="drawer-foot shrink-0 border-t border-border bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3 text-primary">
              <span className="flex items-center gap-2 text-[14px] font-medium">
                إجمالي المنتجات
                <Button
                  type="button"
                  onClick={toggleSound}
                  aria-pressed={soundEnabled}
                  aria-label={
                    soundEnabled
                      ? 'إيقاف صوت واهتزاز الإضافة للسلة'
                      : 'تشغيل صوت واهتزاز الإضافة للسلة'
                  }
                  title={soundEnabled ? 'إيقاف تنبيه الإضافة' : 'تشغيل تنبيه الإضافة'}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                >
                  {soundEnabled ? (
                    <Volume2 size={15} aria-hidden="true" />
                  ) : (
                    <VolumeX size={15} aria-hidden="true" />
                  )}
                </Button>
              </span>
              <strong className="text-[20px] font-bold">{money(cartTotal(lines))}</strong>
            </div>
            <p className="mb-3 mt-1 text-[11px] leading-5 text-muted-foreground">
              {products[0]?.restaurantSlug
                ? 'التوصيل يُحسب عند إتمام الطلب.'
                : 'تجربة محلية · الإجمالي لا يشمل الرسوم الإضافية.'}
            </p>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-[14px] font-medium text-white no-underline hover:bg-accent"
            >
              مراجعة السلة
            </Link>
          </div>
        )}
      </MarketplaceDialog>
    </>
  );
}
