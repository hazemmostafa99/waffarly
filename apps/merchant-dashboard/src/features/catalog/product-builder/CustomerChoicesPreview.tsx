import { useId, useState } from 'react';
import { useLocale } from '@waffarly/ui';
import type { GroupDraft, VariantDraft } from './product-builder.types.js';
import type { StockItem } from '@waffarly/contracts';
import { StockEffectsSummary } from './ChoiceConfigurationOverview.js';

export function CustomerChoicesPreview({
  groups,
  variants = [],
  basePrice,
  text,
  showStockSummary = false,
  stockItems = {},
  failedItems = [],
}: {
  groups: GroupDraft[];
  variants?: VariantDraft[];
  basePrice: string;
  text: (english: string, arabic: string) => string;
  showStockSummary?: boolean;
  stockItems?: Record<string, StockItem>;
  failedItems?: string[];
}) {
  const { formatNumber } = useLocale();
  const prefix = useId();
  const [variantId, setVariantId] = useState('');
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const quantityFor = (key: string, option: GroupDraft['options'][number]) =>
    Math.min(Math.max(1, quantities[`${key}:${option.id}`] ?? 1), option.maxQuantity ?? 1);
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
          (subtotal, option) =>
            subtotal +
            (group.chosen.includes(option.id) ? option.price * quantityFor(group.key, option) : 0),
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
            setQuantities({});
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
              <div key={option.id} className="customer-preview-choice">
                <label className="customer-preview-option">
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
                {checked && (option.maxQuantity ?? 1) > 1 && (
                  <label className="customer-preview-quantity">
                    <span>{text(`${option.name}: quantity`, `${option.name}: الكمية`)}</span>
                    <input
                      type="number"
                      min="1"
                      max={option.maxQuantity ?? 1}
                      value={quantityFor(group.key, option)}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [`${group.key}:${option.id}`]: Math.min(
                            option.maxQuantity ?? 1,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        }))
                      }
                    />
                  </label>
                )}
              </div>
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
      {showStockSummary && (
        <section
          className="customer-preview-stock"
          aria-label={text(
            'Stock changes from selected extras',
            'تغييرات المخزون من الإضافات المحددة',
          )}
        >
          <h4>{text('Stock changes from extras', 'تغييرات المخزون من الإضافات')}</h4>
          <p>
            {text(
              'For this selection. The base product recipe is separate.',
              'لهذه الاختيارات فقط. وصفة المنتج الأساسية منفصلة.',
            )}
          </p>
          <StockEffectsSummary
            effects={visibleGroups.flatMap((group) =>
              group.options
                .filter((option) => group.chosen.includes(option.id))
                .flatMap((option) => {
                  const effects =
                    option.variantOverrides?.find((entry) => entry.variantId === variant?.id)
                      ?.effects ??
                    option.effects ??
                    [];
                  return effects.map((effect) => ({
                    ...effect,
                    quantity: Number.isFinite(Number(effect.quantity))
                      ? String(Number(effect.quantity) * quantityFor(group.key, option))
                      : effect.quantity,
                  }));
                }),
            )}
            items={stockItems}
            failed={failedItems}
            text={text}
          />
        </section>
      )}
    </div>
  );
}
