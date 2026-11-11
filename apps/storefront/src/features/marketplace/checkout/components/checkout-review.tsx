import { cn } from '@waffarly/ui';
import { MarketplaceCard as Card } from '@/components/marketplace/marketplace-card';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import Link from 'next/link';
import type { CheckoutDraft } from '@/features/marketplace/checkout/model/checkout';

export function CheckoutReview({
  draft,
  pending,
  notice,
  onEdit,
  onConfirm,
}: {
  draft: CheckoutDraft;
  pending: boolean;
  notice: string;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  return (
    <Card
      className={cn(
        'checkout-panel min-w-0 bg-card border border-solid border-border rounded-[18px] p-7',
        '[&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-4.5 [&_h2]:text-[22px] [&_>_.add]:mt-5 [&_>_.add]:p-3.5 max-[700px]:py-5 max-[700px]:px-4',
      )}
      aria-labelledby="checkout-review-title"
      aria-busy={pending}
    >
      <h2 id="checkout-review-title">راجع قبل التأكيد</h2>
      <dl
        className={cn(
          'checkout-review-details mt-0 mx-0 mb-6 [&_>_div]:grid [&_>_div]:grid-cols-[110px_minmax(0,1fr)] [&_>_div]:gap-3 [&_>_div]:py-3.5',
          '[&_>_div]:px-0 [&_>_div]:[border-bottom-width:1px] [&_>_div]:[border-bottom-style:solid] [&_>_div]:[border-bottom-color:var(--line)] [&_>_div]:text-[14px] [&_>_div]:leading-[1.8] [&_dt]:text-muted-foreground [&_dd]:m-0',
          '[&_dd]:whitespace-pre-wrap [&_dd]:[overflow-wrap:anywhere] max-[700px]:[&_>_div]:grid-cols-[80px_minmax(0,1fr)] max-[700px]:[&_>_div]:text-[13px]',
        )}
      >
        <div>
          <dt>الاسم</dt>
          <dd>{draft.name.trim()}</dd>
        </div>
        <div>
          <dt>رقم الموبايل</dt>
          <dd>
            <bdi dir="ltr">{draft.phone.trim()}</bdi>
          </dd>
        </div>
        <div>
          <dt>الاستلام</dt>
          <dd>{draft.fulfillment === 'delivery' ? 'توصيل تجريبي' : 'استلام تجريبي من المتجر'}</dd>
        </div>
        {draft.fulfillment === 'delivery' && (
          <div>
            <dt>العنوان</dt>
            <dd>{draft.address.trim()}</dd>
          </div>
        )}
      </dl>
      <p
        className={
          'checkout-demo-notice bg-[var(--purple-50)] rounded-[10px] p-3.5 text-accent text-[13px] leading-[1.8]'
        }
      >
        التأكيد محاكاة محلية فقط. لن يتم إرسال طلب أو حجز منتجات أو خصم أي مبلغ.
      </p>
      {notice && (
        <p
          className={
            'checkout-error border border-solid border-destructive rounded-[10px] p-3 text-destructive text-[13px] leading-[1.8]'
          }
          role="alert"
        >
          {notice}
        </p>
      )}
      <Button
        type="button"
        className={cn(
          'add disabled:cursor-not-allowed disabled:opacity-[0.5] w-full border-0 rounded-[9px] bg-waffarly-gold text-[#30113a]',
          'p-2.5 font-black mt-2.5 hover:bg-[#ffd353]',
        )}
        disabled={pending}
        onClick={onConfirm}
      >
        {pending ? 'جارٍ تجهيز التأكيد التجريبي…' : 'تأكيد الطلب التجريبي'}
      </Button>
      <div
        className={cn(
          'checkout-secondary-actions flex items-center justify-between gap-3 mt-4.5 text-[13px] [&_button]:border-0',
          '[&_button]:p-0 [&_button]:bg-transparent [&_button]:text-accent [&_a]:text-accent [&_a]:no-underline',
        )}
      >
        <Button
          type="button"
          disabled={pending}
          onClick={onEdit}
          className={'disabled:cursor-not-allowed disabled:opacity-[0.5]'}
        >
          تعديل البيانات
        </Button>
        <Link href="/marketplace/cart">الرجوع للسلة</Link>
      </div>
    </Card>
  );
}
