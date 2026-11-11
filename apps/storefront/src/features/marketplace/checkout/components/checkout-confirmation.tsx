import { cn } from '@waffarly/ui';
import Link from 'next/link';
import type { DemoReceipt } from '@/features/marketplace/checkout/model/checkout';
import { CheckoutOrderSummary } from '@/features/marketplace/checkout/components/checkout-order-summary';

export function CheckoutConfirmation({ receipt }: { receipt: DemoReceipt }) {
  return (
    <section
      className={
        'checkout-confirmation grid grid-cols-[minmax(0,1fr)_330px] gap-6 items-start max-[1000px]:grid-cols-[minmax(0,1fr)_290px] max-[1000px]:gap-4 max-[768px]:grid-cols-[1fr]'
      }
      aria-labelledby="checkout-success-title"
    >
      <div
        className={cn(
          'checkout-panel checkout-success-panel min-w-0 bg-card border border-solid border-border rounded-[18px]',
          'py-11 px-7 [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-4.5 [&_h2]:text-[22px] [&_>_.add]:mt-5 [&_>_.add]:p-3.5',
          'max-[700px]:py-8 max-[700px]:px-5 text-center [&_>_p]:leading-[1.9] [&_.cart-demo-label]:block [&_.cart-demo-label]:w-[fit-content] [&_.cart-demo-label]:my-5 [&_.cart-demo-label]:mx-auto',
          '[&_>_a]:inline-block [&_>_a]:no-underline',
        )}
      >
        <span
          className={cn(
            'checkout-success-icon grid place-items-center w-17 h-17 mt-0 mx-auto mb-6',
            'bg-secondary text-accent rounded-full text-[30px]',
          )}
          aria-hidden="true"
        >
          ✓
        </span>
        <h2 id="checkout-success-title">اكتملت التجربة بنجاح</h2>
        <p role="status">ده تأكيد تجريبي فقط — مفيش طلب حقيقي اتبعت، ومفيش مبلغ اتخصم.</p>
        <p className={'detail-note text-[12px] leading-[1.8] text-muted-foreground'}>
          تم تفريغ سلة التجربة ومسح بيانات التواصل من الشاشة. الملخص هنا محلي ومؤقت، ومفيش رقم طلب
          أو موعد استلام حقيقي.
        </p>
        <span
          className={
            'cart-demo-label whitespace-nowrap py-[7px] px-2.5 rounded-[8px] bg-secondary text-accent text-[11px]'
          }
        >
          {receipt.fulfillment === 'delivery' ? 'توصيل تجريبي' : 'استلام تجريبي'}
        </span>
        <Link
          className={
            'btn btn-gold border-0 rounded-[11px] py-[13px] px-5 font-extrabold bg-waffarly-gold text-[#2d1038]'
          }
          href="/marketplace"
        >
          العودة للتسوق
        </Link>
      </div>
      <CheckoutOrderSummary items={receipt.items} />
    </section>
  );
}
