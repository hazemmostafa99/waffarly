import { isStorefrontHandle } from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import { storefrontUrl } from '../../lib/storefront-url.js';

export function StorefrontHandleField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const valid = isStorefrontHandle(value);
  const hint = ar
    ? 'من 3 إلى 63 حرفًا إنجليزيًا صغيرًا أو رقمًا، ويمكن استخدام شرطة بين الكلمات. الاسم ثابت بعد الحفظ.'
    : 'Use 3–63 lowercase letters, digits or internal hyphens. The address cannot be changed after saving.';
  const error = ar
    ? 'الاسم غير صالح أو محجوز لتطبيق آخر.'
    : 'This name is invalid or reserved for another application.';
  const url = valid ? storefrontUrl(value) : null;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor="storefront-handle" className="text-xs font-semibold">
        {ar ? 'اسم رابط المتجر' : 'Storefront address name'}
      </label>
      <Input
        id="storefront-handle"
        dir="ltr"
        value={value}
        disabled={disabled}
        minLength={3}
        maxLength={63}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        aria-describedby="storefront-handle-hint storefront-handle-preview"
        aria-invalid={Boolean(value && !valid)}
        placeholder="abo-ali"
        onChange={(event) => {
          const next = event.target.value.toLowerCase().trim();
          event.target.setCustomValidity(next && !isStorefrontHandle(next) ? error : '');
          onChange(next);
        }}
      />
      <p id="storefront-handle-hint" className="m-0 text-xs leading-5 text-waffarly-muted">
        {hint}
      </p>
      <p id="storefront-handle-preview" className="m-0 break-all text-xs" aria-live="polite">
        {value && !valid ? error : url ? <bdi dir="ltr">{url}</bdi> : null}
      </p>
    </div>
  );
}
