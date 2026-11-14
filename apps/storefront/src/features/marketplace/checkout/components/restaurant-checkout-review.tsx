import { MapPin, Phone, ShoppingBag, Store, Truck, UserRound } from 'lucide-react';
import type { StorefrontCheckoutQuote } from '@waffarly/contracts';
import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { MarketplaceCard as Card } from '@/components/marketplace/marketplace-card';
import { money } from '@/features/marketplace/shared/lib/format-money';
import type { CheckoutDraft, CheckoutItem } from '../model/checkout';

export function RestaurantCheckoutReview({
  products,
  draft,
  quote,
  pending,
  uncertain,
  onConfirm,
  onEdit,
}: {
  products: CheckoutItem[];
  draft: CheckoutDraft;
  quote: StorefrontCheckoutQuote | null;
  pending: boolean;
  uncertain: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const delivery = draft.fulfillment === 'delivery';
  const FulfillmentIcon = delivery ? Truck : Store;
  return (
    <section
      aria-label="مراجعة الطلب قبل التأكيد"
      aria-busy={pending}
      className="grid items-start gap-4 min-[850px]:grid-cols-[minmax(0,1fr)_290px]"
    >
      <div className="grid min-w-0 gap-4">
        <Card className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-accent">
                <ShoppingBag size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="m-0 text-[16px] font-bold text-primary">ملخص طلبك</h2>
                <p className="m-0 text-[12px] text-muted-foreground">
                  {products[0]?.merchantName ?? products[0]?.seller}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[12px] text-accent">
              {products.reduce((sum, item) => sum + item.quantity, 0)} قطعة
            </span>
          </div>
          <ul className="m-0 list-none divide-y divide-border p-0">
            {products.map((product, index) => (
              <li key={product.lineId ?? product.id} className="flex items-center gap-3 p-4">
                <img
                  {...product.image}
                  className="block size-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 text-[14px] font-medium leading-6">{product.cartName}</h3>
                  {product.optionsLabel && (
                    <p className="m-0 text-[12px] leading-5 text-muted-foreground">
                      {product.optionsLabel}
                    </p>
                  )}
                  <span className="text-[12px] text-accent">الكمية: {product.quantity}</span>
                </div>
                {quote?.unitPrices[index] !== undefined && (
                  <strong className="shrink-0 text-[14px] font-bold text-primary">
                    {money(Number(quote.unitPrices[index]) * product.quantity)}
                  </strong>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <FulfillmentIcon size={18} aria-hidden="true" />
            <h2 className="m-0 text-[15px] font-bold">
              {delivery ? 'بيانات التوصيل' : 'بيانات الاستلام'}
            </h2>
          </div>
          <dl className="m-0 grid gap-3 text-[13px] sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <UserRound size={14} aria-hidden="true" />
                الاسم
              </dt>
              <dd className="m-0 break-words font-medium">{draft.name}</dd>
            </div>
            <div>
              <dt className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Phone size={14} aria-hidden="true" />
                رقم الموبايل
              </dt>
              <dd className="m-0 font-medium">
                <bdi dir="ltr">{draft.phone}</bdi>
              </dd>
            </div>
            <div className="min-w-0 border-t border-border pt-3 sm:col-span-2">
              <dt className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <MapPin size={14} aria-hidden="true" />
                {delivery ? 'عنوان التوصيل' : 'طريقة الاستلام'}
              </dt>
              <dd className="m-0 break-words leading-6">
                {delivery ? draft.address : 'استلام من المطعم'}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
      <Card
        role="complementary"
        aria-label="حساب الطلب"
        className="rounded-2xl border border-border bg-card p-4 min-[850px]:sticky min-[850px]:top-4"
      >
        <h2 className="mb-4 mt-0 text-[16px] font-bold text-primary">حساب الطلب</h2>
        {quote && (
          <dl className="m-0 grid gap-3 text-[13px] [&_dd]:m-0">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">إجمالي الأصناف</dt>
              <dd>{money(Number(quote.subtotal))}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">رسوم التوصيل</dt>
              <dd>{money(Number(quote.deliveryFee))}</dd>
            </div>
            {quote.discount && (
              <div className="flex justify-between gap-3 text-success">
                <dt>الخصم</dt>
                <dd>− {money(Number(quote.discount.amount))}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-primary">
              <dt className="font-medium">الإجمالي</dt>
              <dd className="text-[22px] font-bold">{money(Number(quote.total))}</dd>
            </div>
          </dl>
        )}
        <p className="mb-3 mt-3 rounded-xl bg-[var(--purple-50)] px-3 py-2 text-[12px] leading-5 text-muted-foreground">
          {uncertain
            ? 'لم يصل تأكيد الطلب بعد. أعد نفس المحاولة لحسم النتيجة.'
            : 'تأكيد الطلب يرسله للمطعم للمراجعة. لا يتم خصم أي مبلغ إلكترونيًا.'}
        </p>
        <Button
          type="button"
          tone="gold"
          disabled={pending}
          onClick={onConfirm}
          className="min-h-11 w-full rounded-xl px-3 py-2 text-[14px] font-medium"
        >
          {pending ? 'جارٍ التأكيد…' : uncertain ? 'إعادة نفس المحاولة' : 'تأكيد وإرسال الطلب'}
        </Button>
        {!pending && !uncertain && (
          <Button
            type="button"
            onClick={onEdit}
            className="mt-2 min-h-10 w-full rounded-xl px-3 text-[12px] text-accent hover:bg-secondary"
          >
            تعديل البيانات ومراجعة السعر
          </Button>
        )}
      </Card>
    </section>
  );
}
