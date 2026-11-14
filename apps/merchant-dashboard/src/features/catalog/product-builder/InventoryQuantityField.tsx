import { useId, useState, type Ref } from 'react';
import { isPositiveStockQuantity, type StockItem } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { Icon } from '../../../Icons.js';
import { stockUnitLabel, stockUnitOptions } from '../../inventory/stock-unit-options.js';

export function InventoryQuantityField({
  item,
  quantity,
  unitCode,
  onQuantityChange,
  onUnitChange,
  label,
  inputRef,
  showErrors = false,
}: {
  item: StockItem | undefined;
  quantity: string;
  unitCode: string;
  onQuantityChange: (quantity: string) => void;
  onUnitChange: (unit: string) => void;
  label: string;
  inputRef?: Ref<HTMLInputElement> | undefined;
  showErrors?: boolean;
}) {
  const { locale } = useLocale();
  const text = (english: string, arabic: string) => (locale === 'ar' ? arabic : english);
  const id = useId();
  const [touched, setTouched] = useState(false);
  const units = stockUnitOptions(item);
  const validUnit = units.some((unit) => unit.code === unitCode);
  const error =
    item && (touched || showErrors)
      ? !validUnit
        ? text('Choose a valid unit.', 'اختر وحدة صالحة للصنف.')
        : !isPositiveStockQuantity(quantity)
          ? text(
              'Enter a quantity greater than zero (up to 6 decimals).',
              'أدخل كمية أكبر من صفر، حتى 6 منازل عشرية.',
            )
          : ''
      : '';
  const example =
    unitCode === 'g'
      ? '150'
      : unitCode === 'kg'
        ? '0.15'
        : unitCode === 'ml'
          ? '30'
          : unitCode === 'l'
            ? '0.03'
            : '1';
  return (
    <div className="builder-field inventory-quantity-field">
      <span id={`${id}-label`}>{text('Quantity used per sale', 'الكمية لكل عملية بيع')}</span>
      <div
        className={`inventory-quantity-control${!item ? ' is-disabled' : ''}${error ? ' is-invalid' : ''}`}
      >
        {item ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            dir="ltr"
            maxLength={19}
            value={quantity}
            placeholder={example}
            aria-label={label}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onBlur={() => setTouched(true)}
            onChange={(event) => onQuantityChange(event.target.value)}
          />
        ) : (
          <span className="inventory-quantity-disabled-hint">
            {text('Select a stock item to set its unit.', 'اختر صنف المخزون أولًا لتحديد الوحدة')}
          </span>
        )}
        {item && (units.length > 1 || !validUnit) ? (
          <div className="inventory-quantity-unit">
            <select
              value={unitCode}
              aria-label={`${text('Unit', 'الوحدة')}: ${item.name}`}
              onBlur={() => setTouched(true)}
              onChange={(event) => onUnitChange(event.target.value)}
            >
              {!validUnit && <option value="">{text('Unit', 'الوحدة')}</option>}
              {units.map((unit) => (
                <option key={unit.code} value={unit.code}>
                  {stockUnitLabel(unit.code, locale, unit.name)}
                </option>
              ))}
            </select>
            <Icon name="chevron" />
          </div>
        ) : (
          <span className="inventory-quantity-fixed-unit">
            {item ? stockUnitLabel(unitCode, locale, units[0]?.name) : text('Unit', 'الوحدة')}
          </span>
        )}
      </div>
      {error && (
        <small className="inventory-field-error" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}
