import { useEffect, useId, useRef, useState } from 'react';
import type {
  CatalogModifierEffectFields,
  CatalogModifierOptionVariantFields,
  StockItem,
} from '@waffarly/contracts';
import { Icon } from '../../../Icons.js';
import { StockItemPicker } from '../../inventory/components/InventoryPickers.js';
import { useLocale } from '@waffarly/ui';
import { stockUnitLabel, stockUnitOptions } from '../../inventory/stock-unit-options.js';
import type { GroupDraft, OptionDraft, VariantDraft } from './product-builder.types.js';
import { StockEffectsSummary } from './ChoiceConfigurationOverview.js';

type Text = (english: string, arabic: string) => string;

function EffectsEditor({
  value,
  onChange,
  text,
}: {
  value: CatalogModifierEffectFields[];
  onChange: (value: CatalogModifierEffectFields[]) => void;
  text: Text;
}) {
  const { locale } = useLocale();
  const fieldId = useId();
  const [items, setItems] = useState<Record<string, StockItem>>({});
  const [pending, setPending] = useState<CatalogModifierEffectFields | null>(() =>
    value.length ? null : { stockItemId: '', direction: 'ADD', unitCode: '', quantity: '1' },
  );
  const pendingCard = useRef<HTMLDivElement>(null);
  const effectsEditor = useRef<HTMLDivElement>(null);
  const hasPending = pending !== null;
  useEffect(() => {
    if (!hasPending) return;
    const frame = requestAnimationFrame(() =>
      pendingCard.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [hasPending]);
  const unitName = (code: string, item?: StockItem) =>
    stockUnitLabel(
      code,
      locale,
      stockUnitOptions(item).find((unit) => unit.code === code)?.name ?? code,
    );
  const change = (index: number, update: Partial<CatalogModifierEffectFields>) => {
    if (index === value.length && pending) {
      const next = { ...pending, ...update };
      if (next.stockItemId) {
        onChange([...value, next]);
        setPending(null);
      } else setPending(next);
      return;
    }
    onChange(
      value.map((effect, position) => (position === index ? { ...effect, ...update } : effect)),
    );
  };
  const cache = (item: StockItem) => setItems((current) => ({ ...current, [item.id]: item }));
  return (
    <div className="modifier-effects" ref={effectsEditor}>
      {!value.length && !pending && (
        <p className="modifier-stock-empty">
          {text(
            'No stock change. Link an ingredient below.',
            'لا تغيير في المخزون. اربط مكوّنًا أدناه.',
          )}
        </p>
      )}
      {(pending ? [...value, pending] : value).map((effect, index) => (
        <div
          className="modifier-effect-card"
          key={index}
          ref={index === value.length ? pendingCard : undefined}
        >
          <div className="modifier-effect-row">
            <div className="builder-field modifier-ingredient-field">
              <span>{text('Ingredient', 'المكوّن')}</span>
              <StockItemPicker
                value={effect.stockItemId}
                label={text('Ingredient', 'المكوّن')}
                onResolve={cache}
                onSelect={(item) => {
                  if (item) cache(item);
                  change(index, { stockItemId: item?.id ?? '', unitCode: item?.baseUnit ?? '' });
                  if (item)
                    requestAnimationFrame(() => {
                      const quantity = effectsEditor.current?.querySelectorAll<HTMLInputElement>(
                        'input[inputmode="decimal"]',
                      )[index];
                      quantity?.focus();
                      quantity?.select();
                    });
                }}
              />
            </div>
            <label className="builder-field">
              <span>{text('Quantity', 'الكمية')}</span>
              <input
                inputMode="decimal"
                dir="ltr"
                aria-label={text('Quantity', 'الكمية')}
                aria-describedby={
                  effect.stockItemId &&
                  (!Number.isFinite(Number(effect.quantity)) || Number(effect.quantity) <= 0)
                    ? `${fieldId}-quantity-${index}-error`
                    : undefined
                }
                value={effect.quantity}
                disabled={!effect.stockItemId}
                aria-invalid={
                  Boolean(effect.stockItemId) &&
                  (!Number.isFinite(Number(effect.quantity)) || Number(effect.quantity) <= 0)
                }
                onChange={(event) => change(index, { quantity: event.target.value })}
              />
              {effect.stockItemId &&
                (!Number.isFinite(Number(effect.quantity)) || Number(effect.quantity) <= 0) && (
                  <small className="choice-field-error" id={`${fieldId}-quantity-${index}-error`}>
                    {text('Enter a quantity greater than zero.', 'أدخل كمية أكبر من صفر.')}
                  </small>
                )}
            </label>
            <label className="builder-field">
              <span>{text('Unit', 'الوحدة')}</span>
              <select
                value={effect.unitCode}
                disabled={!effect.stockItemId}
                aria-invalid={Boolean(effect.stockItemId) && !effect.unitCode}
                onChange={(event) => change(index, { unitCode: event.target.value })}
              >
                <option value={effect.unitCode}>
                  {effect.unitCode
                    ? unitName(effect.unitCode, items[effect.stockItemId])
                    : text('Choose a unit', 'اختر وحدة')}
                </option>
                {items[effect.stockItemId] &&
                  stockUnitOptions(items[effect.stockItemId]!)
                    .filter((unit) => unit.code !== effect.unitCode)
                    .map((unit) => (
                      <option key={unit.code} value={unit.code}>
                        {unitName(unit.code, items[effect.stockItemId])}
                      </option>
                    ))}
              </select>
            </label>
            <button
              type="button"
              className="builder-remove-button"
              aria-label={
                index === value.length
                  ? text('Cancel adding ingredient', 'إلغاء إضافة المكوّن')
                  : text(`Remove ingredient ${index + 1}`, `حذف المكوّن ${index + 1}`)
              }
              onClick={() =>
                index === value.length
                  ? setPending(null)
                  : onChange(value.filter((_, position) => position !== index))
              }
            >
              <Icon name="trash" />
            </button>
          </div>
          {effect.stockItemId && (
            <details
              className="modifier-effect-advanced"
              open={effect.direction === 'REMOVE' ? true : undefined}
            >
              <summary>{text('Change stock behavior', 'تغيير طريقة الخصم')}</summary>
              <label className="builder-field">
                <span>
                  {text('When the customer selects this choice', 'عند اختيار العميل لهذه الإضافة')}
                </span>
                <select
                  value={effect.direction}
                  onChange={(event) =>
                    change(index, { direction: event.target.value as 'ADD' | 'REMOVE' })
                  }
                >
                  <option value="ADD">
                    {text('Deduct an extra quantity', 'خصم كمية إضافية من المخزون')}
                  </option>
                  <option value="REMOVE">
                    {text(
                      'Reduce the base recipe deduction',
                      'تقليل الكمية المخصومة من الوصفة الأساسية',
                    )}
                  </option>
                </select>
              </label>
            </details>
          )}
          {items[effect.stockItemId] && effect.quantity && (
            <p className="modifier-effect-summary">
              {text(
                effect.direction === 'ADD'
                  ? `Each selection deducts ${effect.quantity} ${unitName(effect.unitCode, items[effect.stockItemId])} of ${items[effect.stockItemId]!.name} from stock.`
                  : `Each selection reduces the base recipe deduction of ${items[effect.stockItemId]!.name} by ${effect.quantity} ${unitName(effect.unitCode, items[effect.stockItemId])}.`,
                effect.direction === 'ADD'
                  ? `عند اختيار هذه الإضافة، يُخصم ${effect.quantity} ${unitName(effect.unitCode, items[effect.stockItemId])} من ${items[effect.stockItemId]!.name}.`
                  : `عند اختيار هذه الإضافة، يقلّ الخصم من ${items[effect.stockItemId]!.name} بمقدار ${effect.quantity} ${unitName(effect.unitCode, items[effect.stockItemId])}.`,
              )}
            </p>
          )}
        </div>
      ))}
      <button
        type="button"
        className="builder-button modifier-add"
        onClick={() => {
          if (pending)
            pendingCard.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus();
          else setPending({ stockItemId: '', direction: 'ADD', unitCode: '', quantity: '1' });
        }}
        hidden={hasPending}
      >
        <Icon name="plus" />
        {value.length
          ? text('Add another ingredient', 'ربط مكوّن آخر')
          : text('Link ingredient', 'ربط مكوّن')}
      </button>
    </div>
  );
}

export function ModifierDetailsEditor({
  group,
  variants,
  section,
  initialOptionId,
  initialVariantId,
  stockItems,
  failedItems,
  onGroupChange,
  onOptionChange,
  text,
}: {
  group: GroupDraft;
  variants: VariantDraft[];
  section: 'sizes' | 'inventory';
  initialOptionId?: string | undefined;
  initialVariantId?: string | undefined;
  stockItems: Record<string, StockItem>;
  failedItems: string[];
  onGroupChange: (id: string, update: Partial<GroupDraft>) => void;
  onOptionChange: (groupId: string, optionId: string, update: Partial<OptionDraft>) => void;
  text: Text;
}) {
  const editorId = useId();
  const [optionId, setOptionId] = useState(initialOptionId ?? '');
  const [scope, setScope] = useState(initialVariantId ?? '');
  const [search, setSearch] = useState('');
  const stockEditor = useRef<HTMLElement>(null);
  const sizePriceInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!initialOptionId) return;
    const frame = requestAnimationFrame(() => {
      if (section === 'sizes') sizePriceInput.current?.focus();
      else if (stockEditor.current?.offsetParent) {
        stockEditor.current.focus({ preventScroll: true });
        stockEditor.current.scrollIntoView({ block: 'start' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [section, initialOptionId, initialVariantId]);
  const options = group.options.filter((option) => option.name.trim());
  const variant = variants.find((entry) => entry.id === scope);
  const changeOverride = (
    option: OptionDraft,
    variantId: string,
    patch: Partial<CatalogModifierOptionVariantFields>,
  ) =>
    onOptionChange(group.id, option.id, {
      variantOverrides: [
        ...(option.variantOverrides ?? []).filter((entry) => entry.variantId !== variantId),
        {
          variantId,
          available: true,
          ...option.variantOverrides?.find((entry) => entry.variantId === variantId),
          ...patch,
        },
      ],
    });
  if (section === 'sizes')
    return (
      <div className="modifier-section">
        <div className="modifier-section-heading">
          <h3>
            {text('Availability and extra prices by size', 'التوفّر والأسعار الإضافية حسب الحجم')}
          </h3>
          <p>
            {text(
              'Start with the default extra price. Customize only the sizes that differ.',
              'يُستخدم السعر الإضافي الافتراضي. خصّص فقط الأحجام التي تختلف عنه.',
            )}
          </p>
        </div>
        <fieldset className="modifier-visibility">
          <legend>{text('Show this group for', 'إظهار هذه المجموعة للأحجام')}</legend>
          {variants.map((size) => (
            <label key={size.id}>
              <input
                type="checkbox"
                checked={
                  group.variantOverrides?.find((entry) => entry.variantId === size.id)
                    ?.available !== false
                }
                onChange={(event) =>
                  onGroupChange(group.id, {
                    variantOverrides: [
                      ...(group.variantOverrides ?? []).filter(
                        (entry) => entry.variantId !== size.id,
                      ),
                      { variantId: size.id, available: event.target.checked },
                    ],
                  })
                }
              />
              <span>{size.name}</span>
            </label>
          ))}
        </fieldset>
        {!options.length ? (
          <p className="modifier-empty">
            {text(
              'Name your choices first in Choices and prices.',
              'اكتب أسماء الخيارات أولًا في الاختيارات والأسعار.',
            )}
          </p>
        ) : (
          <div className="modifier-matrix-scroll">
            <table className="modifier-matrix">
              <caption className="sr-only">
                {text(
                  'Choice availability and extra prices by size',
                  'توفّر الخيارات وأسعارها الإضافية حسب الحجم',
                )}
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    {text('Choice / default extra price', 'الخيار / السعر الإضافي الافتراضي')}
                  </th>
                  {variants.map((size) => (
                    <th key={size.id} scope="col">
                      {size.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {options.map((option) => (
                  <tr key={option.id}>
                    <th scope="row">
                      {option.name}
                      <small>
                        <bdi>
                          {option.priceAdjustment || '0'} {text('EGP', 'ج.م')}
                        </bdi>
                      </small>
                    </th>
                    {variants.map((size) => {
                      const override = option.variantOverrides?.find(
                        (entry) => entry.variantId === size.id,
                      );
                      const groupVisible =
                        group.variantOverrides?.find((entry) => entry.variantId === size.id)
                          ?.available !== false;
                      const custom = override?.priceAdjustment !== undefined;
                      return (
                        <td key={size.id}>
                          <fieldset className="modifier-size-cell" disabled={!groupVisible}>
                            <label className="modifier-available">
                              <input
                                type="checkbox"
                                checked={override?.available !== false}
                                onChange={(event) =>
                                  changeOverride(option, size.id, {
                                    available: event.target.checked,
                                  })
                                }
                              />
                              {text('Available', 'متاح')}
                            </label>
                            <label className="builder-field">
                              <span className="sr-only">
                                {text(
                                  `${option.name}, ${size.name}: extra price (EGP)`,
                                  `${option.name}، ${size.name}: السعر الإضافي (ج.م)`,
                                )}
                              </span>
                              <input
                                ref={
                                  option.id === initialOptionId && size.id === initialVariantId
                                    ? sizePriceInput
                                    : undefined
                                }
                                inputMode="decimal"
                                dir="ltr"
                                disabled={override?.available === false}
                                placeholder={option.priceAdjustment || '0.00'}
                                value={override?.priceAdjustment ?? ''}
                                aria-invalid={
                                  Boolean(override?.priceAdjustment) &&
                                  !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(
                                    override?.priceAdjustment ?? '',
                                  )
                                }
                                onChange={(event) =>
                                  changeOverride(option, size.id, {
                                    priceAdjustment: event.target.value || undefined,
                                  })
                                }
                              />
                            </label>
                            <small>
                              {!groupVisible
                                ? text('Group hidden', 'المجموعة مخفية')
                                : custom
                                  ? text('Custom price', 'سعر مخصّص')
                                  : text('Uses default price', 'السعر الافتراضي')}
                            </small>
                            {custom && (
                              <button
                                type="button"
                                className="builder-text-button"
                                onClick={() =>
                                  changeOverride(option, size.id, { priceAdjustment: undefined })
                                }
                              >
                                {text('Reset price', 'استعادة السعر الافتراضي')}
                              </button>
                            )}
                          </fieldset>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  const visibleOptions = options.filter((option) =>
    option.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="modifier-section modifier-stock-workspace">
      <div className="modifier-section-heading">
        <h3>{text('Stock consumption', 'استهلاك المخزون')}</h3>
        <p>
          {text(
            'Choose an ingredient and the quantity deducted when a customer selects each extra.',
            'حدّد المكوّن والكمية التي تُخصم عند اختيار العميل لكل إضافة.',
          )}
        </p>
      </div>
      {variants.length > 0 && (
        <div className="modifier-stock-scope">
          {variants.length <= 4 ? (
            <div
              role="group"
              aria-label={text('Stock settings for', 'إعدادات المخزون للحجم')}
              className="modifier-stock-size-buttons"
            >
              {[{ id: '', name: text('All sizes', 'كل الأحجام') }, ...variants].map((size) => (
                <button
                  type="button"
                  key={size.id}
                  aria-pressed={(variant?.id ?? '') === size.id}
                  onClick={() => setScope(size.id)}
                >
                  {size.name}
                </button>
              ))}
            </div>
          ) : (
            <label className="builder-field">
              <span>{text('Stock settings for', 'إعدادات المخزون للحجم')}</span>
              <select value={variant?.id ?? ''} onChange={(event) => setScope(event.target.value)}>
                <option value="">{text('All sizes', 'كل الأحجام')}</option>
                {variants.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {options.length > 8 && (
        <label className="builder-field modifier-stock-search">
          <span>{text('Find a choice', 'البحث عن خيار')}</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      )}
      {!options.length ? (
        <p className="modifier-empty">
          {text(
            'Name your choices first in Choices and prices.',
            'اكتب أسماء الخيارات أولًا في الاختيارات والأسعار.',
          )}
        </p>
      ) : (
        <div
          className="modifier-stock-list"
          role="group"
          aria-label={text('Configured choices', 'الخيارات المعدّة')}
        >
          <div className="modifier-stock-list-heading" aria-hidden="true">
            <span>{text('Choice', 'الاختيار')}</span>
            <span>{text('Stock consumption', 'استهلاك المخزون')}</span>
            <span>{text('Action', 'الإجراء')}</span>
          </div>
          {visibleOptions.map((option) => {
            const specific = option.variantOverrides?.find(
              (entry) => entry.variantId === variant?.id,
            );
            const effects = variant
              ? (specific?.effects ?? option.effects ?? [])
              : (option.effects ?? []);
            const inherited = Boolean(variant) && specific?.effects === undefined;
            const custom = Boolean(variant) && !inherited;
            const hidden =
              Boolean(variant) &&
              (specific?.available === false ||
                group.variantOverrides?.find((entry) => entry.variantId === variant?.id)
                  ?.available === false);
            const open = optionId === option.id;
            const rowId = editorId + '-' + option.id;
            return (
              <article
                key={option.id}
                className={'modifier-stock-option' + (open ? ' is-open' : '')}
              >
                <div className="modifier-stock-option-summary">
                  <div>
                    <h4 id={rowId + '-name'}>{option.name}</h4>
                    {hidden ? (
                      <small>{text('Not offered for this size', 'غير متاح لهذا الحجم')}</small>
                    ) : (
                      variant && (
                        <small className={custom ? 'is-custom' : ''}>
                          {custom
                            ? text('Custom consumption', 'استهلاك مخصّص')
                            : text('Same quantities as all sizes', 'نفس كميات كل الأحجام')}
                        </small>
                      )
                    )}
                  </div>
                  <StockEffectsSummary
                    effects={effects}
                    items={stockItems}
                    failed={failedItems}
                    text={text}
                  />
                  <button
                    type="button"
                    className="builder-button modifier-stock-edit"
                    aria-label={
                      open
                        ? text('Finish editing ' + option.name, 'إنهاء تعديل ' + option.name)
                        : text('Edit stock for ' + option.name, 'تعديل مخزون ' + option.name)
                    }
                    aria-expanded={open}
                    aria-controls={rowId + '-editor'}
                    onClick={() => setOptionId(open ? '' : option.id)}
                  >
                    <Icon name={open ? 'check' : effects.length ? 'edit' : 'plus'} />
                    {open
                      ? text('Done', 'تم')
                      : effects.length
                        ? text('Edit', 'تعديل')
                        : text('Link ingredient', 'ربط مكوّن')}
                  </button>
                </div>
                {open && (
                  <section
                    id={rowId + '-editor'}
                    aria-labelledby={rowId + '-name'}
                    className="modifier-stock-inline-editor"
                    ref={stockEditor}
                    tabIndex={-1}
                  >
                    {variant && (
                      <div className="modifier-stock-inheritance">
                        <p>
                          {inherited
                            ? text(
                                'Uses the default ingredients shown above. Customize only when this size needs different consumption.',
                                'تُستخدم المكوّنات الافتراضية الموضّحة أعلاه. خصّص فقط إذا اختلف استهلاك هذا الحجم.',
                              )
                            : text(
                                'These ingredients replace the default list for this size.',
                                'هذه المكوّنات تحل محل القائمة الافتراضية لهذا الحجم.',
                              )}
                        </p>
                        <button
                          type="button"
                          className="builder-button"
                          onClick={() =>
                            changeOverride(option, variant.id, {
                              effects: inherited
                                ? structuredClone(option.effects ?? [])
                                : undefined,
                            })
                          }
                        >
                          {inherited
                            ? text('Customize', 'تخصيص')
                            : text('Use defaults', 'استعادة الافتراضي')}
                        </button>
                      </div>
                    )}
                    {!inherited && (
                      <EffectsEditor
                        key={option.id + ':' + (variant?.id ?? 'default')}
                        value={effects}
                        onChange={(value) =>
                          variant
                            ? changeOverride(option, variant.id, { effects: value })
                            : onOptionChange(group.id, option.id, { effects: value })
                        }
                        text={text}
                      />
                    )}
                    {custom && !effects.length && (
                      <p className="modifier-help">
                        {text('This size has no stock changes.', 'لا تغيير في المخزون لهذا الحجم.')}
                      </p>
                    )}
                  </section>
                )}
              </article>
            );
          })}
          {!visibleOptions.length && (
            <p className="modifier-empty">
              {text('No matching choices.', 'لا توجد خيارات مطابقة.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
