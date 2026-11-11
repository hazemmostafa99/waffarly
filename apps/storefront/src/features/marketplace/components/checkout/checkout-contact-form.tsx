import { useEffect, useRef } from 'react';
import type { CheckoutDraft, CheckoutErrors } from '../../model/checkout';
import { CheckoutFulfillmentFields } from './checkout-fulfillment-fields';

export function CheckoutContactForm({ draft, errors, onChange, onContinue }: { draft: CheckoutDraft; errors: CheckoutErrors; onChange: (values: Partial<CheckoutDraft>) => void; onContinue: () => void }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [errors]);
  return <form ref={form} className="checkout-panel" noValidate autoComplete="off" onSubmit={event => { event.preventDefault(); onContinue(); }}>
    <h2>بيانات التواصل</h2><p className="detail-note">استخدم بيانات تجريبية فقط. لن يتم إرسالها أو حفظها بعد مغادرة الصفحة.</p>
    {Object.keys(errors).length > 0 && <p className="checkout-error" role="alert">راجع الحقول الموضّحة قبل المتابعة.</p>}
    <label className="checkout-field">الاسم التجريبي<input name="name" maxLength={80} value={draft.name} onChange={event => onChange({ name: event.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'checkout-name-error' : undefined} /><span id="checkout-name-error" className="checkout-field-error">{errors.name}</span></label>
    <label className="checkout-field">رقم الموبايل التجريبي<input name="phone" type="tel" dir="ltr" inputMode="tel" maxLength={24} value={draft.phone} onChange={event => onChange({ phone: event.target.value })} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'checkout-phone-error' : undefined} /><span id="checkout-phone-error" className="checkout-field-error">{errors.phone}</span></label>
    <CheckoutFulfillmentFields draft={draft} errors={errors} onChange={onChange} />
    <button type="submit" className="add">متابعة لمراجعة الطلب</button>
  </form>;
}
