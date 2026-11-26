import { isStorefrontHandle } from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import { storefrontUrl } from '../../lib/storefront-url.js';

/** Required subdomain input; the value is also the first part of every POS sign-in name. */
export function StorefrontHandleField({
  id = 'storefront-handle',
  value,
  onChange,
  disabled = false,
}: {
  /** Unique per page when several fields are shown, e.g. one per application. */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const valid = isStorefrontHandle(value);
  const hint = ar
    ? 'من 3 إلى 63 حرفًا إنجليزيًا صغيرًا أو رقمًا، ويمكن استخدام شرطة بين الكلمات. الكاشير يدخل نقاط البيع بالاسم ده، مثل abo-ali.ali.'
    : 'Use 3–63 lowercase letters, digits or internal hyphens. Cashiers sign in to POS with it, e.g. abo-ali.ali.';
  const error = ar
    ? 'الاسم غير صالح أو محجوز لتطبيق آخر.'
    : 'This name is invalid or reserved for another application.';
  const url = valid ? storefrontUrl(value) : null;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold">
        {ar ? 'السب دومين (اسم رابط المتجر)' : 'Subdomain (storefront address name)'}
      </label>
      <Input
        id={id}
        dir="ltr"
        value={value}
        disabled={disabled}
        required
        minLength={3}
        maxLength={63}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        aria-describedby={`${id}-hint ${id}-preview`}
        aria-invalid={Boolean(value && !valid)}
        placeholder="abo-ali"
        onChange={(event) => {
          const next = event.target.value.toLowerCase().trim();
          event.target.setCustomValidity(next && !isStorefrontHandle(next) ? error : '');
          onChange(next);
        }}
      />
      <p id={`${id}-hint`} className="m-0 text-xs leading-5 text-waffarly-muted">
        {hint}
      </p>
      <p id={`${id}-preview`} className="m-0 break-all text-xs" aria-live="polite">
        {value && !valid ? error : url ? <bdi dir="ltr">{url}</bdi> : null}
      </p>
    </div>
  );
}
