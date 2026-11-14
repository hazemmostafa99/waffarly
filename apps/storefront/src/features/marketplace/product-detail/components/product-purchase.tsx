'use client';

import { cn } from '@waffarly/ui';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import { useState } from 'react';
import { MealPurchase } from '@/features/marketplace/restaurants/components/meal-purchase';
import { QuantitySelector } from '@/components/marketplace/quantity-selector';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { MAX_CART_QUANTITY } from '@/features/marketplace/cart/model/cart';
import { money } from '@/features/marketplace/shared/lib/format-money';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export function ProductPurchase({ product }: { product: MarketplaceProduct }) {
  return product.merchantType === 'restaurant' ? <MealPurchase product={product} /> : <GenericProductPurchase product={product} />;
}

function GenericProductPurchase({ product }: { product: MarketplaceProduct }) {
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState('');
  const existing = useCartStore(
    (state) => state.cart.find((line) => line.productId === product.id)?.quantity ?? 0,
  );
  const add = useCartStore((state) => state.addToCart);
  const remaining = MAX_CART_QUANTITY - existing;
  const allowed = quantity <= remaining;
  return (
    <section
      className={cn(
        'detail-purchase mt-4.5 p-4.5 border border-solid border-border rounded-[14px] bg-[var(--purple-50)]',
        '[&_.total]:items-center [&_.total]:gap-3 [&_.total]:m-0 [&_.total]:text-[13px] [&_.total_>_span:last-child]:text-[20px] [&_.total_>_span:last-child]:text-primary [&_.add]:mt-4 [&_.add]:p-[13px]',
        '[&_.detail-note]:mt-2.5 [&_.detail-note]:mx-0 [&_.detail-note]:mb-0 [&_.detail-note]:text-[11px] max-[700px]:p-3.5',
      )}
      aria-label="إضافة المنتج للسلة"
    >
      <h2 className={'detail-purchase-title mt-0 mx-0 mb-4 text-[16px]'}>أضف إلى سلتك</h2>
      <div className={'detail-quantity flex items-center justify-between gap-3 mb-4'}>
        <span>الكمية</span>
        <QuantitySelector value={quantity} onChange={setQuantity} />
      </div>
      <div className={'total flex justify-between font-black mb-[13px]'}>
        <span>الإجمالي ({quantity} قطعة)</span>
        <span>{money(product.price * quantity)}</span>
      </div>
      <Button
        type="button"
        className={cn(
          'add disabled:cursor-not-allowed disabled:opacity-[0.5] w-full border-0 rounded-[9px] bg-waffarly-gold text-[#30113a]',
          'p-2.5 font-black mt-2.5 hover:bg-[#ffd353]',
        )}
        disabled={!allowed}
        onClick={() => {
          if (add(product.id, quantity)) setNotice('');
          else setNotice('السلة فيها طلب من مطعم. راجع السلة واحذف أصنافه قبل إضافة منتجات متجر.');
        }}
      >
        أضف للسلة
      </Button>
      <p className={'detail-note text-[12px] leading-[1.8] text-muted-foreground'}>
        تجربة محلية · الإجمالي لا يشمل رسومًا إضافية، وحد الكمية ليس تأكيدًا للمخزون.
      </p>
      <p role="status" className="text-sm text-destructive empty:hidden">{notice}</p>
      {!allowed && (
        <p role="status" className={'detail-note text-[12px] leading-[1.8] text-muted-foreground'}>
          الكمية دي هتتجاوز حد التجربة ({MAX_CART_QUANTITY} قطعة لكل منتج). عدّل الكمية أو راجع
          السلة.
        </p>
      )}
    </section>
  );
}
