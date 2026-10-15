import { useState, type ReactNode } from 'react';
import type {
  CatalogModifierEffectFields,
  CatalogModifierOptionVariantFields,
  StockItem,
} from '@waffarly/contracts';
import { StockItemPicker } from '../../inventory/components/InventoryPickers.js';
import { stockUnitOptions } from '../../inventory/stock-unit-options.js';
import type { GroupDraft, OptionDraft, VariantDraft } from './product-builder.types.js';

type Text = (english: string, arabic: string) => string;

function ModifierDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="builder-fields" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{title}</summary>
      {open && children}
    </details>
  );
}

function EffectsEditor({
  value,
  onChange,
  text,
}: {
  value: CatalogModifierEffectFields[];
  onChange: (value: CatalogModifierEffectFields[]) => void;
  text: Text;
}) {
  const [items, setItems] = useState<Record<string, StockItem>>({});
  const change = (index: number, update: Partial<CatalogModifierEffectFields>) =>
    onChange(
      value.map((effect, position) => (position === index ? { ...effect, ...update } : effect)),
    );
  const cache = (item: StockItem) => setItems((current) => ({ ...current, [item.id]: item }));
  return (
    <div className="builder-fields">
      {value.map((effect, index) => (
        <div className="builder-fields" key={index}>
          <StockItemPicker
            value={effect.stockItemId}
            label={text('Ingredient', 'المكوّن')}
            onResolve={cache}
            onSelect={(item) => {
              if (item) cache(item);
              change(index, { stockItemId: item?.id ?? '', unitCode: item?.baseUnit ?? '' });
            }}
          />
          <label className="builder-field">
            <span>{text('Effect', 'التأثير')}</span>
            <select
              value={effect.direction}
              onChange={(event) =>
                change(index, { direction: event.target.value as 'ADD' | 'REMOVE' })
              }
            >
              <option value="ADD">{text('Add consumption', 'زيادة الاستهلاك')}</option>
              <option value="REMOVE">{text('Reduce consumption', 'تقليل الاستهلاك')}</option>
            </select>
          </label>
          <label className="builder-field">
            <span>{text('Quantity per option', 'الكمية لكل اختيار')}</span>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={effect.quantity}
              onChange={(event) => change(index, { quantity: event.target.value })}
            />
          </label>
          <label className="builder-field">
            <span>{text('Unit', 'الوحدة')}</span>
            <select
              value={effect.unitCode}
              onChange={(event) => change(index, { unitCode: event.target.value })}
            >
              <option value={effect.unitCode}>
                {effect.unitCode || text('Choose a unit', 'اختر وحدة')}
              </option>
              {items[effect.stockItemId] &&
                stockUnitOptions(items[effect.stockItemId]!)
                  .filter((unit) => unit.code !== effect.unitCode)
                  .map((unit) => (
                    <option key={unit.code} value={unit.code}>
                      {unit.name}
                    </option>
                  ))}
            </select>
          </label>
          <button
            type="button"
            className="builder-text-button"
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            {text('Remove ingredient effect', 'حذف تأثير المكوّن')}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="builder-text-button"
        onClick={() =>
          onChange([...value, { stockItemId: '', direction: 'ADD', unitCode: '', quantity: '1' }])
        }
      >
        {text('Add ingredient effect', 'إضافة تأثير مكوّن')}
      </button>
    </div>
  );
}

export function ModifierDetailsEditor({
  group,
  variants,
  recipe,
  onGroupChange,
  onOptionChange,
  text,
}: {
  group: GroupDraft;
  variants: VariantDraft[];
  recipe: boolean;
  onGroupChange: (id: string, update: Partial<GroupDraft>) => void;
  onOptionChange: (groupId: string, optionId: string, update: Partial<OptionDraft>) => void;
  text: Text;
}) {
  return (
    <ModifierDisclosure
      title={text('Quantities, variants and ingredients', 'الكميات والمتغيرات والمكونات')}
    >
      {variants.map((variant) => (
        <label className="builder-default-choice" key={variant.id}>
          <input
            type="checkbox"
            checked={
              group.variantOverrides?.find((override) => override.variantId === variant.id)
                ?.available !== false
            }
            onChange={(event) =>
              onGroupChange(group.id, {
                variantOverrides: [
                  ...(group.variantOverrides ?? []).filter(
                    (override) => override.variantId !== variant.id,
                  ),
                  { variantId: variant.id, available: event.target.checked },
                ],
              })
            }
          />
          <span>
            {text('Show group for', 'إظهار المجموعة لـ')} {variant.name}
          </span>
        </label>
      ))}
      {group.options.map((option) => {
        const update = (value: Partial<OptionDraft>) => onOptionChange(group.id, option.id, value);
        const changeOverride = (
          variantId: string,
          patch: Partial<CatalogModifierOptionVariantFields>,
        ) =>
          update({
            variantOverrides: [
              ...(option.variantOverrides ?? []).filter(
                (override) => override.variantId !== variantId,
              ),
              {
                variantId,
                available: true,
                ...option.variantOverrides?.find((override) => override.variantId === variantId),
                ...patch,
              },
            ],
          });
        return (
          <fieldset className="builder-fields" key={option.id}>
            <legend>{option.name}</legend>
            <label className="builder-field">
              <span>{text('Maximum quantity per option', 'أقصى كمية للاختيار')}</span>
              <input
                type="number"
                min="1"
                max="99"
                value={option.maxQuantity ?? 1}
                onChange={(event) => update({ maxQuantity: Number(event.target.value) })}
              />
            </label>
            {recipe && (
              <>
                <strong>{text('Default ingredient effects', 'تأثيرات المكونات الافتراضية')}</strong>
                <EffectsEditor
                  value={option.effects ?? []}
                  onChange={(effects) => update({ effects })}
                  text={text}
                />
              </>
            )}
            {variants.map((variant) => {
              const override = option.variantOverrides?.find(
                (value) => value.variantId === variant.id,
              );
              return (
                <ModifierDisclosure key={variant.id} title={variant.name}>
                  <div className="builder-fields">
                    <label className="builder-default-choice">
                      <input
                        type="checkbox"
                        checked={override?.available !== false}
                        onChange={(event) =>
                          changeOverride(variant.id, { available: event.target.checked })
                        }
                      />
                      <span>{text('Option available', 'الاختيار متاح')}</span>
                    </label>
                    <label className="builder-field">
                      <span>
                        {text(
                          'Variant price (blank inherits product price)',
                          'سعر المتغير (الفارغ يرث سعر المنتج)',
                        )}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={override?.priceAdjustment ?? ''}
                        onChange={(event) =>
                          changeOverride(variant.id, {
                            priceAdjustment: event.target.value || undefined,
                          })
                        }
                      />
                    </label>
                    {recipe && (
                      <>
                        <label className="builder-default-choice">
                          <input
                            type="checkbox"
                            checked={override?.effects !== undefined}
                            onChange={(event) =>
                              changeOverride(variant.id, {
                                effects: event.target.checked ? [] : undefined,
                              })
                            }
                          />
                          <span>
                            {text(
                              'Replace all ingredient effects',
                              'استبدال تأثيرات المكونات بالكامل',
                            )}
                          </span>
                        </label>
                        {override?.effects !== undefined && (
                          <>
                            <p>
                              {text(
                                'An empty list means no ingredient effects.',
                                'القائمة الفارغة تعني عدم التأثير على المكونات.',
                              )}
                            </p>
                            <EffectsEditor
                              value={override.effects}
                              onChange={(effects) => changeOverride(variant.id, { effects })}
                              text={text}
                            />
                          </>
                        )}
                      </>
                    )}
                  </div>
                </ModifierDisclosure>
              );
            })}
          </fieldset>
        );
      })}
    </ModifierDisclosure>
  );
}
