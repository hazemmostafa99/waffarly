import type { CatalogProductPromotionFields } from '@waffarly/contracts';

export function ProductPromotionFields({
  enabled,
  onEnabledChange,
  type,
  onTypeChange,
  value,
  onValueChange,
  startsAt,
  onStartsAtChange,
  endsAt,
  onEndsAtChange,
  previewPrices,
  formatNumber,
  text,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  type: Exclude<CatalogProductPromotionFields['type'], null>;
  onTypeChange: (value: Exclude<CatalogProductPromotionFields['type'], null>) => void;
  value: string;
  onValueChange: (value: string) => void;
  startsAt: string;
  onStartsAtChange: (value: string) => void;
  endsAt: string;
  onEndsAtChange: (value: string) => void;
  previewPrices: string[];
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  text: (english: string, arabic: string) => string;
}) {
  const prices = previewPrices.map(Number).filter((price) => Number.isFinite(price) && price > 0);
  const originalPrice = prices.length ? Math.min(...prices) : 0;
  const valueNumber = Number(value);
  const hasValidValue = Number.isFinite(valueNumber) && valueNumber > 0;
  const discountAmount =
    type === 'percentage'
      ? Math.round((Math.round(originalPrice * 100) * Math.round(valueNumber * 100)) / 10_000)
      : Math.round(valueNumber * 100);
  const previewPrice = Math.max(0, Math.round(originalPrice * 100) - discountAmount) / 100;

  return (
    <fieldset className="builder-choice-fieldset product-promotion-fieldset">
      <legend>{text('Product discount', 'خصم على المنتج')}</legend>
      <label className="product-promotion-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
        <span>
          <strong>{text('Enable discount', 'تفعيل الخصم')}</strong>
          <small>
            {text(
              'Customers see the reduced price automatically. No coupon code is needed.',
              'السعر المخفّض يظهر للعملاء تلقائيًا من غير كود خصم.',
            )}
          </small>
        </span>
      </label>
      {enabled && (
        <div className="product-promotion-details">
          <div className="product-promotion-fields">
            <label className="builder-field">
              <span>{text('Discount type', 'نوع الخصم')}</span>
              <select
                value={type}
                onChange={(event) => onTypeChange(event.target.value as typeof type)}
              >
                <option value="percentage">{text('Percentage', 'نسبة مئوية')}</option>
                <option value="amount">{text('Fixed EGP amount', 'مبلغ ثابت بالجنيه')}</option>
              </select>
            </label>
            <label className="builder-field">
              <span>
                {text('Discount value', 'قيمة الخصم')} {type === 'percentage' ? '(%)' : '(EGP)'}
              </span>
              <input
                type="number"
                min="0.01"
                max={type === 'percentage' ? '99.99' : undefined}
                step="0.01"
                inputMode="decimal"
                dir="ltr"
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className="builder-field">
              <span>{text('Starts at (optional)', 'يبدأ في (اختياري)')}</span>
              <input
                type="datetime-local"
                dir="ltr"
                value={startsAt}
                onChange={(event) => onStartsAtChange(event.target.value)}
              />
            </label>
            <label className="builder-field">
              <span>{text('Ends at (optional)', 'ينتهي في (اختياري)')}</span>
              <input
                type="datetime-local"
                dir="ltr"
                value={endsAt}
                onChange={(event) => onEndsAtChange(event.target.value)}
              />
            </label>
          </div>
          <small className="product-promotion-timezone">
            {text('Schedule uses Cairo time.', 'مواعيد العرض بتوقيت القاهرة.')}
          </small>
          {hasValidValue && originalPrice > 0 && (
            <p className="product-promotion-preview">
              {text('Lowest listed price:', 'أقل سعر حالي:')}{' '}
              <del dir="ltr">EGP {formatNumber(originalPrice, { minimumFractionDigits: 2 })}</del>
              {'  →  '}
              <strong dir="ltr">EGP {formatNumber(previewPrice, { minimumFractionDigits: 2 })}</strong>
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
