import { cn } from '@waffarly/ui';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { MarketplaceInput as Input } from '@/components/marketplace/marketplace-form-controls';
import { useEffect, useRef } from 'react';
import type { CheckoutDraft, CheckoutErrors } from '@/features/marketplace/checkout/model/checkout';
import { CheckoutFulfillmentFields } from '@/features/marketplace/checkout/components/checkout-fulfillment-fields';

export function CheckoutContactForm({
  draft,
  demo = true,
  errors,
  onChange,
  onContinue,
}: {
  draft: CheckoutDraft;
  demo?: boolean;
  errors: CheckoutErrors;
  onChange: (values: Partial<CheckoutDraft>) => void;
  onContinue: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
  return (
    <form
      ref={form}
      className={cn(
        'checkout-panel min-w-0 bg-card border border-solid border-border rounded-[18px] p-5',
        '[&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-1 [&_h2]:text-[18px] [&_h2]:font-bold [&_>_.add]:mt-3 [&_>_.add]:py-2.5 max-[700px]:py-4 max-[700px]:px-4',
      )}
      noValidate
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <h2>بيانات التواصل</h2>
      <p className={'detail-note mt-0 mb-4 text-[12px] leading-[1.8] text-muted-foreground'}>
        {demo
          ? 'استخدم بيانات تجريبية فقط. لن يتم إرسالها أو حفظها بعد مغادرة الصفحة.'
          : 'بيانات التواصل تُرسل للمطعم عند تأكيد الطلب، ولا تُحفظ في تخزين المتصفح.'}
      </p>
      {Object.keys(errors).length > 0 && (
        <p
          className={
            'checkout-error border border-solid border-destructive rounded-[10px] p-3 text-destructive text-[13px] leading-[1.8]'
          }
          role="alert"
        >
          راجع الحقول الموضّحة قبل المتابعة.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label
          className={cn(
            'checkout-field min-w-0 grid content-start gap-1.5 text-foreground text-[13px] font-medium [&_input]:[box-sizing:border-box]',
            '[&_input]:block [&_input]:w-full [&_input]:min-w-0 [&_input]:border [&_input]:border-solid [&_input]:border-border [&_input]:rounded-[10px] [&_input]:h-10 [&_input]:py-2',
            '[&_input]:px-3.5 [&_input]:bg-card [&_input]:text-foreground  [&_input]:font-normal [&_input]:leading-[1.6] [&_textarea]:[box-sizing:border-box] [&_textarea]:block',
            '[&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:border [&_textarea]:border-solid [&_textarea]:border-border [&_textarea]:rounded-[10px] [&_textarea]:py-3 [&_textarea]:px-3.5',
            "[&_textarea]:bg-card [&_textarea]:text-foreground  [&_textarea]:font-normal [&_textarea]:leading-[1.6] [&_textarea]:resize-y [&_[aria-invalid='true']]:border-destructive",
          )}
        >
          {demo ? 'الاسم التجريبي' : 'الاسم'}
          <Input
            name="name"
            maxLength={80}
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'checkout-name-error' : undefined}
          />
          <span
            id="checkout-name-error"
            className={
              'checkout-field-error text-destructive text-[12px] leading-[1.7] font-normal empty:hidden'
            }
          >
            {errors.name}
          </span>
        </label>
        <label
          className={cn(
            'checkout-field min-w-0 grid content-start gap-1.5 text-foreground text-[13px] font-medium [&_input]:[box-sizing:border-box]',
            '[&_input]:block [&_input]:w-full [&_input]:min-w-0 [&_input]:border [&_input]:border-solid [&_input]:border-border [&_input]:rounded-[10px] [&_input]:h-10 [&_input]:py-2',
            '[&_input]:px-3.5 [&_input]:bg-card [&_input]:text-foreground  [&_input]:font-normal [&_input]:leading-[1.6] [&_textarea]:[box-sizing:border-box] [&_textarea]:block',
            '[&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:border [&_textarea]:border-solid [&_textarea]:border-border [&_textarea]:rounded-[10px] [&_textarea]:py-3 [&_textarea]:px-3.5',
            "[&_textarea]:bg-card [&_textarea]:text-foreground  [&_textarea]:font-normal [&_textarea]:leading-[1.6] [&_textarea]:resize-y [&_[aria-invalid='true']]:border-destructive",
          )}
        >
          {demo ? 'رقم الموبايل التجريبي' : 'رقم الموبايل'}
          <Input
            name="phone"
            type="tel"
            dir="ltr"
            inputMode="tel"
            maxLength={24}
            value={draft.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'checkout-phone-error' : undefined}
          />
          <span
            id="checkout-phone-error"
            className={
              'checkout-field-error text-destructive text-[12px] leading-[1.7] font-normal empty:hidden'
            }
          >
            {errors.phone}
          </span>
        </label>
      </div>
      <CheckoutFulfillmentFields demo={demo} draft={draft} errors={errors} onChange={onChange} />
      <Button
        type="submit"
        className={cn(
          'add disabled:cursor-not-allowed disabled:opacity-[0.5] w-full border-0 rounded-[9px] bg-waffarly-gold text-[#30113a]',
          'p-2.5 min-h-11 text-[14px] font-medium mt-2.5 hover:bg-[#ffd353]',
        )}
      >
        متابعة لمراجعة الطلب
      </Button>
    </form>
  );
}
