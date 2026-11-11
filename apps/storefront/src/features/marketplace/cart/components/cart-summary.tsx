import { cn } from '@waffarly/ui';
import Link from 'next/link';
import { money } from '@/features/marketplace/shared/lib/format-money';

export function CartSummary({
  total,
  quantity,
  productCount,
  restaurantName,
}: {
  total: number;
  quantity: number;
  productCount: number;
  restaurantName?: string;
}) {
  return (
    <aside
      className={cn(
        'cart-summary min-w-0 bg-card border border-solid border-border rounded-[18px] p-6',
        'sticky top-5 [box-shadow:var(--shadow)] [&_h2]:text-[20px] [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-6 [&_dl]:m-0',
        '[&_dl_>_div]:flex [&_dl_>_div]:items-center [&_dl_>_div]:justify-between [&_dl_>_div]:gap-3 [&_dl_>_div]:mb-4 [&_dl_>_div]:text-[13px] [&_dt]:text-muted-foreground [&_dd]:m-0',
        '[&_dd]:font-bold [&_dl_.cart-summary-total]:[border-top-width:1px] [&_dl_.cart-summary-total]:[border-top-style:solid] [&_dl_.cart-summary-total]:[border-top-color:var(--line)] [&_dl_.cart-summary-total]:pt-5 [&_dl_.cart-summary-total]:mt-5 max-[768px]:[position:static] max-[700px]:p-5',
      )}
      aria-labelledby="cart-summary-title"
    >
      <h2 id="cart-summary-title">ملخص السلة</h2>
      {restaurantName && <p className="text-sm font-bold text-accent">{restaurantName} · طلب تجريبي من مطعم واحد</p>}
      <dl>
        <div>
          <dt>المنتجات المختلفة</dt>
          <dd>{productCount}</dd>
        </div>
        <div>
          <dt>عدد القطع</dt>
          <dd>{quantity}</dd>
        </div>
        <div
          className={
            'cart-summary-total [&_dd]:text-[22px] [&_dd]:text-primary [&_dt]:text-foreground'
          }
        >
          <dt>إجمالي المنتجات</dt>
          <dd>{money(total)}</dd>
        </div>
      </dl>
      <p className={'detail-note text-[12px] leading-[1.8] text-muted-foreground'}>
        {restaurantName ? 'الإجمالي يشمل اختيارات الوجبات. رسوم التوصيل التجريبية تظهر في الخطوة التالية؛ الاستلام بدون رسوم توصيل.' : 'الشحن وأي رسوم إضافية غير محسوبة في هذه التجربة.'}
      </p>
      <Link
        className={cn(
          'add cart-checkout-link w-full border-0 rounded-[9px] bg-waffarly-gold text-[#30113a] p-2.5',
          'font-black mt-2.5 hover:bg-[#ffd353] block text-center no-underline',
        )}
        href="/checkout"
      >
        متابعة لإتمام الطلب
      </Link>
      <p className={'cart-checkout-note text-muted-foreground text-[11px] leading-[1.8] my-3 mx-0'}>
        الخطوة التالية تجربة محلية فقط، بدون إرسال طلب أو دفع حقيقي.
      </p>
      <Link
        className={'cart-continue-link block text-center text-accent no-underline text-[13px] pt-2'}
        href={restaurantName ? `/restaurants/${encodeURIComponent(restaurantName)}` : '/#deals'}
      >
        {restaurantName ? 'كمّل من منيو المطعم ←' : 'متابعة التسوق ←'}
      </Link>
    </aside>
  );
}
