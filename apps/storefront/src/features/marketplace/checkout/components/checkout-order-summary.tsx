import { cn } from '@waffarly/ui';
import Link from 'next/link';
import { money } from '@/features/marketplace/shared/lib/format-money';
import type { CheckoutItem } from '@/features/marketplace/checkout/model/checkout';
import type { Fulfillment } from '@/features/marketplace/checkout/model/checkout';
import { restaurantCheckout } from '@/features/marketplace/checkout/model/restaurant-checkout';

export function CheckoutOrderSummary({
  items,
  editable = false,
  fulfillment = 'pickup',
}: {
  items: CheckoutItem[];
  editable?: boolean;
  fulfillment?: Fulfillment;
}) {
  const summary = restaurantCheckout(items, fulfillment);
  const total = summary.total;
  return (
    <aside
      className={cn(
        'cart-summary checkout-summary min-w-0 bg-card border border-solid border-border rounded-[18px]',
        'p-6 sticky top-5 [box-shadow:var(--shadow)] [&_h2]:text-[20px] [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-6',
        '[&_dl]:m-0 [&_dl_>_div]:flex [&_dl_>_div]:items-center [&_dl_>_div]:justify-between [&_dl_>_div]:gap-3 [&_dl_>_div]:mb-4 [&_dl_>_div]:text-[13px] [&_dt]:text-muted-foreground',
        '[&_dd]:m-0 [&_dd]:font-bold [&_dl_.cart-summary-total]:[border-top-width:1px] [&_dl_.cart-summary-total]:[border-top-style:solid] [&_dl_.cart-summary-total]:[border-top-color:var(--line)] [&_dl_.cart-summary-total]:pt-5 [&_dl_.cart-summary-total]:mt-5 max-[768px]:[position:static]',
        'max-[700px]:p-5',
      )}
      aria-labelledby="checkout-summary-title"
    >
      <div
        className={
          'checkout-summary-heading flex items-center justify-between gap-3 [&_h2]:m-0 [&_a]:text-accent [&_a]:no-underline [&_a]:text-[12px]'
        }
      >
        <h2 id="checkout-summary-title">ملخص المنتجات</h2>
        {editable && <Link href="/cart">تعديل السلة</Link>}
      </div>
      {summary.name && <p className="text-sm font-bold text-accent">{summary.name} · {fulfillment === 'delivery' ? 'توصيل تجريبي' : 'استلام تجريبي'}</p>}
      {summary.issue && <p role="status" className="text-sm text-destructive">{summary.issue}</p>}
      <ul
        className={cn(
          'checkout-summary-items list-none my-6 mx-0 p-0 [&_li]:grid [&_li]:grid-cols-[42px_minmax(0,1fr)_auto] [&_li]:items-center',
          '[&_li]:gap-2.5 [&_li]:py-3 [&_li]:px-0 [&_li]:[border-bottom-width:1px] [&_li]:[border-bottom-style:solid] [&_li]:[border-bottom-color:var(--line)] [&_img]:w-10.5 [&_img]:h-10.5',
          '[&_img]:object-cover [&_img]:rounded-[8px] [&_b]:block [&_b]:text-[11px] [&_b]:leading-[1.6] [&_span]:block [&_span]:text-muted-foreground [&_span]:text-[10px]',
          '[&_span]:mt-1 [&_strong]:text-primary [&_strong]:text-[11px] [&_strong]:whitespace-nowrap',
        )}
      >
        {items.map((item) => (
          <li key={item.lineId ?? item.id}>
            <img src={item.cartImage} alt="" />
            <div>
              <b>{item.cartName}</b>
              {item.optionsLabel && <span>{item.optionsLabel}</span>}
              <span>
                {item.quantity} × {money(item.price)}
              </span>
            </div>
            <strong>{money(item.price * item.quantity)}</strong>
          </li>
        ))}
      </ul>
      <dl>
        {summary.name && <>
          <div><dt>إجمالي الوجبات</dt><dd>{money(summary.subtotal)}</dd></div>
          <div><dt>رسوم التوصيل التجريبية</dt><dd>{money(summary.deliveryFee)}</dd></div>
        </>}
        <div>
          <dt>عدد القطع</dt>
          <dd>{items.reduce((sum, item) => sum + item.quantity, 0)}</dd>
        </div>
        <div
          className={
            'cart-summary-total [&_dd]:text-[22px] [&_dd]:text-primary [&_dt]:text-foreground'
          }
        >
          <dt>{summary.name ? 'إجمالي الطلب التجريبي' : 'إجمالي المنتجات'}</dt>
          <dd>{money(total)}</dd>
        </div>
      </dl>
      <p className={'detail-note text-[12px] leading-[1.8] text-muted-foreground'}>
        {summary.name ? 'رسوم توضيحية محلية فقط؛ لا يوجد دفع فعلي أو ضرائب إضافية في التجربة.' : 'بدون احتساب شحن أو ضرائب أو رسوم إضافية. لا يوجد دفع فعلي في التجربة.'}
      </p>
    </aside>
  );
}
