import { cn } from '@waffarly/ui';
import Link from 'next/link';
import type { DemoOrder } from '@/features/marketplace/orders/model/demo-order';
import { CheckoutOrderSummary } from '@/features/marketplace/checkout/components/checkout-order-summary';
import { formatDemoOrderDate } from '@/features/marketplace/orders/model/demo-order';

export function CheckoutConfirmation({ receipt }: { receipt: DemoOrder }) {
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
          تم تفريغ سلة التجربة. بيانات التواصل لا تُحفظ، والملخص يظل متاحًا في «طلباتي» طوال الجلسة
          الحالية فقط.
        </p>
        <dl className="my-5 grid gap-2 text-[13px]">
          <div className="flex justify-center gap-2">
            <dt className="text-muted-foreground">رقم تجريبي</dt>
            <dd className="m-0 font-bold" dir="ltr">
              {receipt.id}
            </dd>
          </div>
          <div className="flex justify-center gap-2">
            <dt className="text-muted-foreground">وقت التجربة</dt>
            <dd className="m-0">{formatDemoOrderDate(receipt.createdAt)}</dd>
          </div>
        </dl>
        <span
          className={
            'cart-demo-label whitespace-nowrap py-[7px] px-2.5 rounded-[8px] bg-secondary text-accent text-[11px]'
          }
        >
          {receipt.fulfillment === 'delivery' ? 'توصيل تجريبي' : 'استلام تجريبي'}
        </span>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            className={
              'btn btn-gold border-0 rounded-[11px] py-[13px] px-5 font-extrabold bg-waffarly-gold text-[#2d1038]'
            }
            href={`/marketplace/orders/${receipt.id}`}
          >
            عرض تفاصيل الطلب
          </Link>
          <Link
            className="rounded-[11px] border border-border px-5 py-3 text-primary no-underline"
            href="/marketplace/orders"
          >
            كل طلباتي
          </Link>
        </div>
      </div>
      <CheckoutOrderSummary items={receipt.items} />
    </section>
  );
}
