import type { CheckoutDraft, CheckoutErrors } from '../../model/checkout';

export function CheckoutFulfillmentFields({ draft, errors, onChange }: { draft: CheckoutDraft; errors: CheckoutErrors; onChange: (values: Partial<CheckoutDraft>) => void }) {
  return <fieldset className="checkout-fieldset"><legend>طريقة الاستلام التجريبية</legend>
    <div className="checkout-fulfillment-options">
      <label className={draft.fulfillment === 'delivery' ? 'selected' : ''}><input type="radio" name="fulfillment" value="delivery" checked={draft.fulfillment === 'delivery'} onChange={() => onChange({ fulfillment: 'delivery' })} /><span>توصيل إلى عنوان</span></label>
      <label className={draft.fulfillment === 'pickup' ? 'selected' : ''}><input type="radio" name="fulfillment" value="pickup" checked={draft.fulfillment === 'pickup'} onChange={() => onChange({ fulfillment: 'pickup', address: '' })} /><span>استلام من المتجر</span></label>
    </div>
    {draft.fulfillment === 'delivery' ? <label className="checkout-field">العنوان التجريبي<textarea name="address" rows={3} maxLength={300} autoComplete="off" value={draft.address} onChange={event => onChange({ address: event.target.value })} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'checkout-address-error' : undefined} /><span id="checkout-address-error" className="checkout-field-error">{errors.address}</span></label> : <p className="detail-note">الاستلام هنا للتجربة فقط؛ لم يتم تحديد فرع أو موعد حقيقي.</p>}
  </fieldset>;
}
