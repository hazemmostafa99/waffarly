import { cn } from '@waffarly/ui';

import { MarketplaceTextarea as Textarea } from '@/components/marketplace/marketplace-form-controls';
import type { CheckoutDraft, CheckoutErrors } from '@/features/marketplace/checkout/model/checkout';

export function CheckoutFulfillmentFields({
  draft,
  demo = true,
  errors,
  onChange,
}: {
  draft: CheckoutDraft;
  demo?: boolean;
  errors: CheckoutErrors;
  onChange: (values: Partial<CheckoutDraft>) => void;
}) {
  return (
    <fieldset
      className={cn(
        'checkout-fieldset min-w-0 mt-4 mx-0 mb-0 pt-3 px-0 pb-0',
        'border-0 [border-top-width:1px] [border-top-style:solid] [border-top-color:var(--line)] [&_legend]:text-[14px] [&_legend]:font-bold [&_legend]:pe-3',
      )}
    >
      <legend>{demo ? 'طريقة الاستلام التجريبية' : 'طريقة الاستلام'}</legend>
      <div
        className={cn(
          'checkout-fulfillment-options grid grid-cols-[1fr_1fr] gap-3 [&_label]:flex [&_label]:items-center [&_label]:gap-2.5 [&_label]:border',
          '[&_label]:border-solid [&_label]:border-border [&_label]:rounded-[12px] [&_label]:min-h-11 [&_label]:py-2 [&_label]:px-3 [&_label]:text-[13px] [&_label]:cursor-pointer [&_label.selected]:border-accent',
          '[&_label.selected]:bg-[var(--purple-50)] [&_input]:m-0 [&_input]:[accent-color:var(--purple-700)] max-[700px]:grid-cols-[1fr]',
        )}
      >
        <label className={draft.fulfillment === 'delivery' ? 'selected' : ''}>
          <input
            type="radio"
            name="fulfillment"
            value="delivery"
            checked={draft.fulfillment === 'delivery'}
            onChange={() => onChange({ fulfillment: 'delivery' })}
          />
          <span>توصيل إلى عنوان</span>
        </label>
        <label className={draft.fulfillment === 'pickup' ? 'selected' : ''}>
          <input
            type="radio"
            name="fulfillment"
            value="pickup"
            checked={draft.fulfillment === 'pickup'}
            onChange={() => onChange({ fulfillment: 'pickup', address: '' })}
          />
          <span>استلام من المتجر</span>
        </label>
      </div>
      {draft.fulfillment === 'delivery' ? (
        <>
          {demo && (
            <p className="mb-0 mt-3 text-xs leading-5 text-muted-foreground">
              عنوان الحساب التجريبي يظهر هنا تلقائيًا عند استخدامه، وتقدر تعدّله قبل المتابعة.
            </p>
          )}
          <label
            className={cn(
              'checkout-field grid gap-2 mt-3 text-foreground text-[13px] font-medium [&_input]:[box-sizing:border-box]',
              '[&_input]:block [&_input]:w-full [&_input]:min-w-0 [&_input]:border [&_input]:border-solid [&_input]:border-border [&_input]:rounded-[10px] [&_input]:py-3',
              '[&_input]:px-3.5 [&_input]:bg-card [&_input]:text-foreground  [&_input]:font-normal [&_input]:leading-[1.6] [&_textarea]:[box-sizing:border-box] [&_textarea]:block',
              '[&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:border [&_textarea]:border-solid [&_textarea]:border-border [&_textarea]:rounded-[10px] [&_textarea]:py-2 [&_textarea]:px-3.5',
              "[&_textarea]:bg-card [&_textarea]:text-foreground  [&_textarea]:font-normal [&_textarea]:leading-[1.6] [&_textarea]:resize-y [&_[aria-invalid='true']]:border-destructive",
            )}
          >
            {demo ? 'العنوان التجريبي' : 'عنوان التوصيل'}
            <Textarea
              name="address"
              rows={2}
              maxLength={300}
              autoComplete="off"
              value={draft.address}
              onChange={(event) => onChange({ address: event.target.value })}
              aria-invalid={Boolean(errors.address)}
              aria-describedby={errors.address ? 'checkout-address-error' : undefined}
            />
            <span
              id="checkout-address-error"
              className={
                'checkout-field-error text-destructive text-[12px] leading-[1.7] font-normal empty:hidden'
              }
            >
              {errors.address}
            </span>
          </label>
        </>
      ) : (
        <p className={'detail-note text-[12px] leading-[1.8] text-muted-foreground'}>
          {demo
            ? 'الاستلام هنا للتجربة فقط؛ لم يتم تحديد فرع أو موعد حقيقي.'
            : 'استلام الطلب من المطعم بعد قبول الطلب وتجهيزه.'}
        </p>
      )}
    </fieldset>
  );
}
