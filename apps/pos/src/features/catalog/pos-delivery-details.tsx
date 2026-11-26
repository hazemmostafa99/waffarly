import { Input, Textarea, useLocale } from '@waffarly/ui';
import type { CustomerErrors, CustomerField } from './pos-customer-validation.js';

const fields = [
  {
    field: 'customerName',
    label: 'Customer name',
    hint: 'At least 2 characters',
    autoComplete: 'name',
  },
  { field: 'customerPhone', label: 'Phone number', hint: 'At least 7 digits', autoComplete: 'tel' },
  {
    field: 'deliveryAddress',
    label: 'Delivery address',
    hint: 'At least 8 characters. Include street and building details.',
    autoComplete: 'street-address',
  },
] as const;

export function PosDeliveryDetails({
  values,
  errors,
  disabled,
  onChange,
  onBlur,
  deliveryFee,
  onDeliveryFeeChange,
}: {
  values: Partial<Record<CustomerField, string>>;
  errors: CustomerErrors;
  disabled: boolean;
  onChange: (field: CustomerField, value: string) => void;
  onBlur: (field: CustomerField) => void;
  deliveryFee: string;
  onDeliveryFeeChange: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <fieldset
      className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-3"
      disabled={disabled}
    >
      <legend className="sr-only">{t('Delivery details')}</legend>
      {fields.map(({ field, label, hint, autoComplete }) => {
        const error = errors[field];
        const props = {
          id: `pos-${field}`,
          value: values[field] ?? '',
          required: true,
          autoComplete,
          'aria-invalid': Boolean(error),
          'aria-describedby': `pos-${field}-help`,
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange(field, event.target.value),
          onBlur: () => onBlur(field),
          className: `rounded-lg text-base lg:text-xs ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`,
        };
        return (
          <div
            key={field}
            className={field === 'deliveryAddress' ? 'col-span-2 min-w-0' : 'min-w-0'}
          >
            <label htmlFor={props.id} className="mb-1 block text-xs font-medium">
              {t(label)}{' '}
              <span aria-hidden="true" className="text-muted-foreground">
                *
              </span>
            </label>
            {field === 'deliveryAddress' ? (
              <Textarea {...props} />
            ) : (
              <Input
                {...props}
                type={field === 'customerPhone' ? 'tel' : 'text'}
                dir={field === 'customerPhone' ? 'ltr' : undefined}
              />
            )}
            <p
              id={`pos-${field}-help`}
              className={`mt-1 text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}
              aria-live="polite"
            >
              {t(error ?? hint)}
            </p>
          </div>
        );
      })}
      {/* Optional; added to the items total and saved as the order's delivery fee. */}
      <div className="min-w-0">
        <label htmlFor="pos-deliveryFee" className="mb-1 block text-xs font-medium">
          {t('Delivery fee (EGP)')}
        </label>
        <Input
          id="pos-deliveryFee"
          inputMode="decimal"
          dir="ltr"
          placeholder="0.00"
          value={deliveryFee}
          aria-invalid={Boolean(deliveryFee) && !isValidDeliveryFee(deliveryFee)}
          onChange={(event) => onDeliveryFeeChange(event.target.value)}
          className="rounded-lg text-base lg:text-xs"
        />
      </div>
    </fieldset>
  );
}

/** Accepts an empty value or EGP with up to two decimals, e.g. "25" or "12.50". */
export function isValidDeliveryFee(value: string): boolean {
  return value.trim() === '' || /^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim());
}
