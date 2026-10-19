import { useId, useState } from 'react';
import { useLocale } from '@waffarly/ui';
import type { GroupDraft, VariantDraft } from './product-builder.types.js';

export function CustomerChoicesPreview({
  groups,
  variants = [],
  basePrice,
  text,
}: {
  groups: GroupDraft[];
  variants?: VariantDraft[];
  basePrice: string;
  text: (english: string, arabic: string) => string;
}) {
  const { formatNumber } = useLocale();
  const prefix = useId();
  const [variantId, setVariantId] = useState('');
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const money = (amount: number) =>
    formatNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const variant =
    variants.find((item) => item.id === variantId && item.availability === 'available') ??
    [...variants]
      .filter((item) => item.availability === 'available')
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0] ??
    variants[0];
  const visibleGroups = groups
    .filter(
      (group) =>
        group.variantOverrides?.find((override) => override.variantId === variant?.id)
          ?.available !== false,
    )
    .map((group) => {
      const options = group.options
        .filter(
          (option) =>
            option.variantOverrides?.find((override) => override.variantId === variant?.id)
              ?.available !== false,
        )
        .map((option) => ({
          ...option,
          price:
            Number(
              option.variantOverrides?.find((override) => override.variantId === variant?.id)
                ?.priceAdjustment ??
                option.priceAdjustment ??
                0,
            ) || 0,
        }));
      const key = `${variant?.id ?? 'product'}:${group.id}`;
      const chosen = (
        selections[key] ??
        options.filter((option) => option.defaultSelected).map((option) => option.id)
      )
        .filter((id) => options.some((option) => option.id === id))
        .slice(0, group.maxSelections);
      return { ...group, options, key, chosen };
    });
  const total =
    (Number(variant?.price ?? basePrice) || 0) +
    visibleGroups.reduce(
      (sum, group) =>
        sum +
        group.options.reduce(
          (subtotal, option) => subtotal + (group.chosen.includes(option.id) ? option.price : 0),
          0,
        ),
      0,
    );
  return (
    <div className="customer-choices-preview">
      <p className="customer-preview-intro">
        {text('Try the choices as your customer would.', 'جرّب الاختيارات كما يراها العميل.')}
      </p>
      {(variantId || Object.keys(selections).length > 0) && (
        <button
          type="button"
          className="builder-text-button"
          onClick={() => {
            setVariantId('');
            setSelections({});
          }}
        >
          {text('Reset preview', 'إعادة المعاينة')}
        </button>
      )}
      {variants.length > 0 && (
        <fieldset className="customer-preview-group">
          <legend>{text('Size or type', 'الحجم أو النوع')}</legend>
          {variants.map((item) => (
            <label className="customer-preview-option" key={item.id}>
              <input
                type="radio"
                name={`${prefix}-variant`}
                checked={variant?.id === item.id}
                disabled={item.availability !== 'available'}
                onChange={() => setVariantId(item.id)}
              />
              <span>{item.name || text('New size or type', 'حجم أو نوع جديد')}</span>
              <b>
                {item.availability === 'available'
                  ? `${money(Number(item.price) || 0)} ${text('EGP', 'ج.م')}`
                  : text('Unavailable', 'غير متاح')}
              </b>
            </label>
          ))}
        </fieldset>
      )}
      {visibleGroups.map((group) => (
        <fieldset className="customer-preview-group" key={group.id}>
          <legend>{group.name || text('Customer choices', 'خيارات العميل')}</legend>
          <small className="customer-preview-rule">
            {group.minSelections > 0 ? text('Required', 'مطلوب') : text('Optional', 'اختياري')}
            {' · '}
            {group.selectionMode === 'single'
              ? text('Choose one', 'اختر واحدًا')
              : text(`Choose up to ${group.maxSelections}`, `اختر حتى ${group.maxSelections}`)}
          </small>
          {group.options.map((option) => {
            const checked = group.chosen.includes(option.id);
            return (
              <label className="customer-preview-option" key={option.id}>
                <input
                  type={group.selectionMode === 'single' ? 'radio' : 'checkbox'}
                  name={`${prefix}-${group.key}`}
                  checked={checked}
                  disabled={
                    !checked &&
                    group.selectionMode === 'multiple' &&
                    group.chosen.length >= group.maxSelections
                  }
                  onChange={() =>
                    setSelections((current) => ({
                      ...current,
                      [group.key]:
                        group.selectionMode === 'single'
                          ? [option.id]
                          : checked
                            ? group.chosen.filter((id) => id !== option.id)
                            : [...group.chosen, option.id],
                    }))
                  }
                />
                <span>{option.name}</span>
                <b>
                  {option.price
                    ? `+${money(option.price)} ${text('EGP', 'ج.م')}`
                    : text('Free', 'مجانًا')}
                </b>
              </label>
            );
          })}
          {group.minSelections === 0 && group.chosen.length > 0 && (
            <button
              type="button"
              className="builder-text-button"
              onClick={() => setSelections((current) => ({ ...current, [group.key]: [] }))}
            >
              {text('Clear selection', 'إلغاء الاختيار')}
            </button>
          )}
          {group.chosen.length < group.minSelections && (
            <small className="customer-preview-rule">
              {text(
                `Choose at least ${group.minSelections} to complete this choice.`,
                `اختر ${group.minSelections} على الأقل لإكمال الاختيار.`,
              )}
            </small>
          )}
        </fieldset>
      ))}
      <div className="preview-total" aria-live="polite" aria-atomic="true">
        <span>{text('Preview total', 'الإجمالي في المعاينة')}</span>
        <strong>
          {money(total)} {text('EGP', 'ج.م')}
        </strong>
      </div>
    </div>
  );
}
