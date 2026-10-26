import { useLocale } from '@waffarly/ui';
import type { CatalogModifierEffectFields, StockItem } from '@waffarly/contracts';
import { stockUnitLabel, stockUnitOptions } from '../../inventory/stock-unit-options.js';
import type { GroupDraft, VariantDraft } from './product-builder.types.js';

type Text = (english: string, arabic: string) => string;
export type ChoiceEditorView = {
  section: 'overview' | 'choices' | 'sizes' | 'inventory';
  optionId?: string;
  variantId?: string;
};

export function StockEffectsSummary({
  effects,
  items,
  failed = [],
  text,
}: {
  effects: CatalogModifierEffectFields[];
  items: Record<string, StockItem>;
  failed?: string[];
  text: Text;
}) {
  const { locale, formatDigits } = useLocale();
  if (!effects.length)
    return (
      <span className="choice-no-stock">{text('No stock change', 'لا تغيير في المخزون')}</span>
    );
  return (
    <ul className="choice-stock-summary">
      {effects.map((effect, index) => {
        const item = items[effect.stockItemId];
        return (
          <li key={index}>
            <span>
              {item?.name ??
                (!effect.stockItemId
                  ? text('Choose an ingredient', 'اختر مكوّنًا')
                  : failed.includes(effect.stockItemId)
                    ? text('Ingredient could not be loaded', 'تعذّر تحميل المكوّن')
                    : text('Loading ingredient…', 'جارٍ تحميل المكوّن…'))}
            </span>
            <strong>
              {effect.direction === 'ADD'
                ? text('Deduct', 'خصم')
                : text('Deduct less', 'تقليل الخصم')}{' '}
              ·{' '}
              <bdi>
                {formatDigits(effect.quantity || '—')}{' '}
                {stockUnitLabel(
                  effect.unitCode,
                  locale,
                  stockUnitOptions(item).find((unit) => unit.code === effect.unitCode)?.name,
                )}
              </bdi>
            </strong>
          </li>
        );
      })}
    </ul>
  );
}

export function ChoiceConfigurationOverview({
  group,
  variants,
  recipe,
  items,
  failed,
  onEdit,
  text,
}: {
  group: GroupDraft;
  variants: VariantDraft[];
  recipe: boolean;
  items: Record<string, StockItem>;
  failed: string[];
  onEdit: (view: ChoiceEditorView) => void;
  text: Text;
}) {
  const { formatNumber } = useLocale();
  const options = group.options.filter((option) => option.name.trim());
  const validPrice = (value: string) => /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value || '0');
  const money = (value: string) =>
    validPrice(value)
      ? `${formatNumber(Number(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${text('EGP', 'ج.م')}`
      : text('Enter a valid price', 'أدخل سعرًا صحيحًا');
  if (!options.length)
    return (
      <p className="modifier-empty">
        {text(
          'Add a named choice to see its configuration here.',
          'أضف خيارًا باسم ليظهر إعداده هنا.',
        )}
      </p>
    );
  return (
    <div className="choice-configuration-overview">
      <div className="choice-overview-scroll">
        <table className="choice-overview-table">
          <caption className="sr-only">
            {text(`Configuration for ${group.name}`, `إعدادات ${group.name}`)}
          </caption>
          <thead>
            <tr>
              <th scope="col">{text('Choice', 'الاختيار')}</th>
              {variants.length > 0 && <th scope="col">{text('Size', 'الحجم')}</th>}
              <th scope="col">{text('Extra price', 'السعر الإضافي')}</th>
              {recipe && <th scope="col">{text('Stock consumption', 'استهلاك المخزون')}</th>}
              <th scope="col">{text('Actions', 'الإجراءات')}</th>
            </tr>
          </thead>
          <tbody>
            {options.flatMap((option) =>
              (variants.length ? variants : [undefined]).map((variant, index) => {
                const override = variant
                  ? option.variantOverrides?.find((entry) => entry.variantId === variant.id)
                  : undefined;
                const hidden =
                  Boolean(variant) &&
                  (override?.available === false ||
                    group.variantOverrides?.find((entry) => entry.variantId === variant?.id)
                      ?.available === false);
                const effects = override?.effects ?? option.effects ?? [];
                const incomplete =
                  !validPrice(override?.priceAdjustment ?? option.priceAdjustment) ||
                  !Number.isInteger(option.maxQuantity ?? 1) ||
                  (option.maxQuantity ?? 1) < 1 ||
                  (option.maxQuantity ?? 1) > 99 ||
                  effects.some(
                    (effect) =>
                      !effect.stockItemId ||
                      !effect.unitCode ||
                      !Number.isFinite(Number(effect.quantity)) ||
                      Number(effect.quantity) <= 0,
                  );
                return (
                  <tr key={`${option.id}:${variant?.id ?? 'product'}`}>
                    <th scope="row">
                      {option.name}
                      {index === 0 && (
                        <small>
                          {text(
                            `Max quantity: ${option.maxQuantity ?? 1}`,
                            `أقصى كمية: ${option.maxQuantity ?? 1}`,
                          )}
                          {option.defaultSelected && (
                            <> · {text('Selected by default', 'محدد افتراضيًا')}</>
                          )}
                        </small>
                      )}
                      {(hidden || incomplete || variant?.availability === 'unavailable') && (
                        <span className="choice-config-badge is-attention">
                          {hidden
                            ? text('Hidden for this size', 'مخفي لهذا الحجم')
                            : incomplete
                              ? text('Needs attention', 'يحتاج إكمال')
                              : text('Size unavailable', 'الحجم غير متاح')}
                        </span>
                      )}
                    </th>
                    {variant && (
                      <td data-label={text('Size', 'الحجم')}>
                        <strong>{variant.name}</strong>
                      </td>
                    )}
                    <td data-label={text('Extra price', 'السعر الإضافي')}>
                      <bdi>{money(override?.priceAdjustment ?? option.priceAdjustment ?? '0')}</bdi>
                      {variant && override?.priceAdjustment === undefined && (
                        <span className="choice-shared-value">{text('Shared', 'مشترك')}</span>
                      )}
                    </td>
                    {recipe && (
                      <td
                        data-label={text('Stock consumption', 'استهلاك المخزون')}
                        className="choice-overview-stock-cell"
                      >
                        <StockEffectsSummary
                          effects={effects}
                          items={items}
                          failed={failed}
                          text={text}
                        />
                        {variant && override?.effects === undefined && (
                          <span className="choice-shared-value">{text('Shared', 'مشترك')}</span>
                        )}
                      </td>
                    )}
                    <td className="choice-overview-actions-cell">
                      <div className="choice-overview-actions">
                        <button
                          type="button"
                          className="builder-text-button"
                          onClick={() =>
                            onEdit({
                              section: variant ? 'sizes' : 'choices',
                              optionId: option.id,
                              ...(variant ? { variantId: variant.id } : {}),
                            })
                          }
                        >
                          {text('Edit price', 'تعديل السعر')}
                        </button>
                        {recipe && (
                          <button
                            type="button"
                            className="builder-text-button"
                            onClick={() =>
                              onEdit({
                                section: 'inventory',
                                optionId: option.id,
                                ...(variant ? { variantId: variant.id } : {}),
                              })
                            }
                          >
                            {text('Edit stock', 'تعديل المخزون')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      {variants.length > 0 && (
        <details className="choice-shared-settings">
          <summary>{text('Shared settings', 'إعدادات مشتركة')}</summary>
          <p>
            {text(
              'Used when a size has no custom value, including new sizes. Editing these values keeps size-specific settings intact.',
              'تُستخدم عند عدم تخصيص القيمة للحجم، بما في ذلك الأحجام الجديدة. تعديلها يحافظ على إعدادات الأحجام المخصّصة.',
            )}
          </p>
          <div className="choice-shared-settings-list">
            {options.map((option) => {
              const priceUsers = variants.filter(
                (variant) =>
                  option.variantOverrides?.find((entry) => entry.variantId === variant.id)
                    ?.priceAdjustment === undefined,
              ).length;
              const stockUsers = variants.filter(
                (variant) =>
                  option.variantOverrides?.find((entry) => entry.variantId === variant.id)
                    ?.effects === undefined,
              ).length;
              const usage = (count: number) =>
                count
                  ? text(`Used by ${count} sizes`, `تستخدمه ${count} أحجام`)
                  : text('Not used by current sizes', 'لا تستخدمه الأحجام الحالية');
              return (
                <section className="choice-shared-setting" key={option.id} aria-label={option.name}>
                  <h4>{option.name}</h4>
                  <div>
                    <span className="choice-shared-field-label">
                      {text('Shared extra price', 'السعر الإضافي المشترك')}
                    </span>
                    <bdi>{money(option.priceAdjustment || '0')}</bdi>
                    <small>{usage(priceUsers)}</small>
                    <button
                      type="button"
                      className="builder-text-button"
                      onClick={() => onEdit({ section: 'choices', optionId: option.id })}
                    >
                      {text('Edit shared price', 'تعديل السعر المشترك')}
                    </button>
                  </div>
                  {recipe && (
                    <div>
                      <span className="choice-shared-field-label">
                        {text('Shared stock consumption', 'استهلاك المخزون المشترك')}
                      </span>
                      <StockEffectsSummary
                        effects={option.effects ?? []}
                        items={items}
                        failed={failed}
                        text={text}
                      />
                      <small>{usage(stockUsers)}</small>
                      <button
                        type="button"
                        className="builder-text-button"
                        onClick={() => onEdit({ section: 'inventory', optionId: option.id })}
                      >
                        {text('Edit shared stock', 'تعديل المخزون المشترك')}
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
