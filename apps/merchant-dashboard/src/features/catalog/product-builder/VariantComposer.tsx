import { useEffect, useRef, useState } from 'react';
import { Dialog, useLocale } from '@waffarly/ui';
import { Icon } from '../../../Icons.js';
import { CustomerChoicesPreview } from './CustomerChoicesPreview.js';
import type { VariantDraft } from './product-builder.types.js';

export function VariantComposer({
  variants,
  basePrice,
  onApply,
  onClose,
  initialDraft,
  text,
}: {
  variants: VariantDraft[];
  basePrice: string;
  onApply: (variants: VariantDraft[]) => void;
  onClose: (draft?: VariantDraft[]) => void;
  initialDraft?: VariantDraft[] | undefined;
  text: (english: string, arabic: string) => string;
}) {
  const { formatNumber } = useLocale();
  function newVariant(name = ''): VariantDraft {
    return {
      id: crypto.randomUUID(),
      name,
      price: basePrice,
      sku: '',
      barcode: '',
      stockQuantity: '',
      availability: 'available',
      attributes: [],
    };
  }
  const [draft, setDraft] = useState<VariantDraft[]>(() =>
    initialDraft
      ? structuredClone(initialDraft)
      : variants.length
        ? structuredClone(variants)
        : [text('Small', 'صغير'), text('Medium', 'وسط'), text('Large', 'كبير')].map(newVariant),
  );
  const baseline = useRef(JSON.stringify(draft));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [priceUndo, setPriceUndo] = useState<Array<{ id: string; price: string }> | null>(null);
  const [detailFocus, setDetailFocus] = useState<{ key: string } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [focusRow, setFocusRow] = useState('');
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const priceInputs = useRef(new Map<string, HTMLInputElement>());
  const detailInputs = useRef(new Map<string, HTMLInputElement>());
  useEffect(() => {
    if (focusRow) inputs.current.get(focusRow)?.focus();
  }, [focusRow]);
  useEffect(() => {
    if (detailFocus) detailInputs.current.get(detailFocus.key)?.focus();
  }, [detailFocus]);
  const markTouched = (field: string) => setTouched((current) => new Set(current).add(field));
  const showError = (field: string) => attempted || touched.has(field);
  function suspend() {
    onClose(
      initialDraft || JSON.stringify(draft) !== baseline.current
        ? structuredClone(draft)
        : undefined,
    );
  }
  const validPrice = (value: string) =>
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
  function rowErrors(variant: VariantDraft) {
    const name = !variant.name.trim()
      ? text('Enter a size or type name.', 'اكتب اسم الحجم أو النوع.')
      : '';
    const price = !validPrice(variant.price)
      ? text(
          'Enter a price greater than zero, with up to 2 decimals.',
          'أدخل سعرًا أكبر من صفر، بمنزلتين عشريتين كحد أقصى.',
        )
      : '';
    const duplicate = (field: 'sku' | 'barcode') =>
      Boolean(variant[field].trim()) &&
      draft.some(
        (item) =>
          item.id !== variant.id &&
          item[field].trim().toLowerCase() === variant[field].trim().toLowerCase(),
      );
    const attributes = variant.attributes.map((attribute) => attribute.name.trim().toLowerCase());
    const sku = duplicate('sku')
      ? text('This SKU is already used by another size.', 'رمز SKU مستخدم لحجم آخر.')
      : '';
    const barcode = duplicate('barcode')
      ? text('This barcode is already used by another size.', 'الباركود مستخدم لحجم آخر.')
      : '';
    const stockQuantity =
      variant.stockQuantity !== '' &&
      (!/^\d+$/.test(variant.stockQuantity) ||
        !Number.isSafeInteger(Number(variant.stockQuantity)) ||
        Number(variant.stockQuantity) > 2_147_483_647)
        ? text(
            'Enter a whole stock quantity of zero or more.',
            'أدخل كمية مخزون صحيحة من صفر فأكثر.',
          )
        : '';
    const attributeError =
      variant.attributes.some((attribute) => !attribute.name.trim() || !attribute.value.trim()) ||
      new Set(attributes).size !== attributes.length
        ? text(
            'Complete every attribute and use a different attribute name for each row.',
            'أكمل اسم وقيمة كل خاصية، واستخدم اسمًا مختلفًا لكل خاصية.',
          )
        : '';
    return {
      name,
      price,
      sku,
      barcode,
      stockQuantity,
      attributes: attributeError,
      details: sku || barcode || stockQuantity || attributeError,
    };
  }
  function update(id: string, patch: Partial<VariantDraft>) {
    if ('price' in patch) setPriceUndo(null);
    setDraft((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }
  function duplicateVariant(source: VariantDraft) {
    if (draft.length >= 100) return;
    const suffix = ` (${text('copy', 'نسخة')})`;
    const next: VariantDraft = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      name: `${source.name.slice(0, 160 - suffix.length)}${suffix}`,
      sku: '',
      barcode: '',
      stockQuantity: '',
    };
    setDraft((current) =>
      current.flatMap((item) => (item.id === source.id ? [item, next] : [item])),
    );
    setFocusRow(next.id);
  }
  function copyPrice(source: VariantDraft) {
    if (!validPrice(source.price)) return;
    setPriceUndo(draft.map(({ id, price }) => ({ id, price })));
    setDraft((current) => current.map((item) => ({ ...item, price: source.price })));
  }
  function undoPrice() {
    if (!priceUndo) return;
    setDraft((current) =>
      current.map((item) => ({
        ...item,
        price: priceUndo.find((saved) => saved.id === item.id)?.price ?? item.price,
      })),
    );
    setPriceUndo(null);
  }
  function addRow() {
    const empty = draft.find((item) => !item.name.trim());
    if (empty) {
      inputs.current.get(empty.id)?.focus();
      return;
    }
    if (draft.length >= 100) return;
    const next = newVariant();
    setDraft((current) => [...current, next]);
    setFocusRow(next.id);
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    setDraft((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }
  function apply() {
    setAttempted(true);
    const invalid = draft.find((item) => Object.values(rowErrors(item)).some(Boolean));
    if (invalid) {
      const errors = rowErrors(invalid);
      if (errors.name) inputs.current.get(invalid.id)?.focus();
      else if (errors.price) priceInputs.current.get(invalid.id)?.focus();
      else if (errors.sku) setDetailFocus({ key: `${invalid.id}:sku` });
      else if (errors.barcode) setDetailFocus({ key: `${invalid.id}:barcode` });
      else if (errors.stockQuantity) setDetailFocus({ key: `${invalid.id}:stock` });
      else {
        const index = invalid.attributes.findIndex(
          (attribute) =>
            !attribute.name.trim() ||
            !attribute.value.trim() ||
            invalid.attributes.filter(
              (entry) => entry.name.trim().toLowerCase() === attribute.name.trim().toLowerCase(),
            ).length > 1,
        );
        setDetailFocus({
          key: `${invalid.id}:attribute:${index}:${invalid.attributes[index]?.name.trim() && invalid.attributes[index]?.value.trim() === '' ? 'value' : 'name'}`,
        });
      }
      return;
    }
    onApply(
      draft.map((item) => ({
        ...item,
        name: item.name.trim(),
        price: Number(item.price).toFixed(2),
        sku: item.sku.trim(),
        barcode: item.barcode.trim(),
        attributes: item.attributes.map((attribute) => ({
          ...attribute,
          name: attribute.name.trim(),
          value: attribute.value.trim(),
        })),
      })),
    );
    onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) suspend();
      }}
      title={text('Sizes and types', 'الأحجام والأنواع')}
      description={text(
        'Set a selling price for each size or type. Apply when you are ready.',
        'حدّد سعر بيع كل حجم أو نوع، ثم طبّق التغييرات عند الانتهاء.',
      )}
      closeLabel={text('Close', 'إغلاق')}
      className="choice-composer-dialog variant-composer-dialog"
    >
      <div className="choice-composer-layout">
        <div className="choice-composer-editor">
          <div className="composer-section-heading">
            <h3 className="composer-section-title">
              <b>1</b>
              {text('Names and selling prices', 'الأسماء وأسعار البيع')}
            </h3>
            <p>
              {text(
                'Each row is sold at its own full price. Prices start from the product price.',
                'لكل صف سعر بيع كامل مستقل. تبدأ الأسعار بسعر المنتج ويمكنك تعديلها.',
              )}
            </p>
          </div>
          {priceUndo && (
            <div className="composer-inline-notice" role="status">
              <span>{text('Price copied to all sizes.', 'تم نسخ السعر إلى كل الأحجام.')}</span>
              <button type="button" className="builder-text-button" onClick={undoPrice}>
                {text('Undo', 'تراجع')}
              </button>
            </div>
          )}
          <div className="choice-composer-rows variant-composer-rows">
            {draft.length > 0 && (
              <div className="choice-composer-table-head" aria-hidden="true">
                <span>{text('Size or type name', 'اسم الحجم أو النوع')}</span>
                <span>{text('Selling price (EGP)', 'سعر البيع (ج.م)')}</span>
                <span />
              </div>
            )}
            {draft.map((variant, index) => {
              const errors = rowErrors(variant);
              return (
                <section
                  className="variant-composer-item"
                  key={variant.id}
                  aria-label={text(`Size or type ${index + 1}`, `الحجم أو النوع ${index + 1}`)}
                >
                  <div className="choice-composer-row">
                    <label className="builder-field">
                      <span className="composer-mobile-label">
                        {text(`Size or type ${index + 1}`, `الحجم أو النوع ${index + 1}`)}
                      </span>
                      <input
                        autoFocus={index === 0}
                        ref={(element) => {
                          if (element) inputs.current.set(variant.id, element);
                          else inputs.current.delete(variant.id);
                        }}
                        value={variant.name}
                        maxLength={160}
                        placeholder={text('e.g. Large', 'مثال: كبير')}
                        aria-invalid={showError(`${variant.id}:name`) && Boolean(errors.name)}
                        onBlur={() => markTouched(`${variant.id}:name`)}
                        aria-describedby={
                          showError(`${variant.id}:name`) && errors.name
                            ? `variant-name-error-${variant.id}`
                            : undefined
                        }
                        onChange={(event) => update(variant.id, { name: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addRow();
                          }
                        }}
                      />
                      {showError(`${variant.id}:name`) && errors.name && (
                        <small
                          id={`variant-name-error-${variant.id}`}
                          className="choice-field-error"
                        >
                          {errors.name}
                        </small>
                      )}
                    </label>
                    <label className="builder-field">
                      <span className="composer-mobile-label">
                        {text(
                          `Selling price for size or type ${index + 1} (EGP)`,
                          `سعر بيع الحجم أو النوع ${index + 1} (ج.م)`,
                        )}
                      </span>
                      <input
                        ref={(element) => {
                          if (element) priceInputs.current.set(variant.id, element);
                          else priceInputs.current.delete(variant.id);
                        }}
                        type="text"
                        inputMode="decimal"
                        lang="en"
                        dir="ltr"
                        value={variant.price}
                        placeholder="0.00"
                        aria-invalid={showError(`${variant.id}:price`) && Boolean(errors.price)}
                        onBlur={() => markTouched(`${variant.id}:price`)}
                        aria-describedby={
                          showError(`${variant.id}:price`) && errors.price
                            ? `variant-price-error-${variant.id}`
                            : undefined
                        }
                        onChange={(event) => update(variant.id, { price: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addRow();
                          }
                        }}
                      />
                      {showError(`${variant.id}:price`) && errors.price && (
                        <small
                          id={`variant-price-error-${variant.id}`}
                          className="choice-field-error"
                        >
                          {errors.price}
                        </small>
                      )}
                    </label>
                    <button
                      type="button"
                      className="builder-remove-button"
                      aria-label={text(
                        `Remove size or type ${index + 1}`,
                        `حذف الحجم أو النوع ${index + 1}`,
                      )}
                      onClick={() =>
                        setDraft((current) => current.filter((item) => item.id !== variant.id))
                      }
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                  <div className="variant-composer-quick-actions">
                    <button
                      type="button"
                      className="builder-text-button"
                      disabled={draft.length >= 100}
                      onClick={() => duplicateVariant(variant)}
                    >
                      <Icon name="plus" />
                      {text('Duplicate size', 'تكرار الحجم')}
                    </button>
                    <button
                      type="button"
                      className="builder-text-button"
                      disabled={draft.length < 2 || !validPrice(variant.price)}
                      onClick={() => copyPrice(variant)}
                    >
                      {text('Copy price to all sizes', 'نسخ السعر لكل الأحجام')}
                    </button>
                  </div>
                  <details
                    className="variant-composer-details"
                    open={attempted && Boolean(errors.details) ? true : undefined}
                  >
                    <summary>
                      {text('Codes, availability and attributes', 'الأكواد والتوفر والخصائص')}
                      <span>{text('Optional', 'اختياري')}</span>
                      <Icon name="chevron" />
                    </summary>
                    <div className="variant-composer-advanced-grid">
                      <label className="builder-field">
                        <span>SKU</span>
                        <input
                          dir="ltr"
                          maxLength={80}
                          value={variant.sku}
                          ref={(element) => {
                            if (element) detailInputs.current.set(`${variant.id}:sku`, element);
                            else detailInputs.current.delete(`${variant.id}:sku`);
                          }}
                          onBlur={() => markTouched(`${variant.id}:sku`)}
                          aria-invalid={showError(`${variant.id}:sku`) && Boolean(errors.sku)}
                          aria-describedby={
                            showError(`${variant.id}:sku`) && errors.sku
                              ? `variant-sku-error-${variant.id}`
                              : undefined
                          }
                          onChange={(event) => update(variant.id, { sku: event.target.value })}
                        />
                        {showError(`${variant.id}:sku`) && errors.sku && (
                          <small
                            id={`variant-sku-error-${variant.id}`}
                            className="choice-field-error"
                          >
                            {errors.sku}
                          </small>
                        )}
                      </label>
                      <label className="builder-field">
                        <span>{text('Barcode', 'الباركود')}</span>
                        <input
                          dir="ltr"
                          maxLength={80}
                          value={variant.barcode}
                          ref={(element) => {
                            if (element) detailInputs.current.set(`${variant.id}:barcode`, element);
                            else detailInputs.current.delete(`${variant.id}:barcode`);
                          }}
                          onBlur={() => markTouched(`${variant.id}:barcode`)}
                          aria-invalid={
                            showError(`${variant.id}:barcode`) && Boolean(errors.barcode)
                          }
                          aria-describedby={
                            showError(`${variant.id}:barcode`) && errors.barcode
                              ? `variant-barcode-error-${variant.id}`
                              : undefined
                          }
                          onChange={(event) => update(variant.id, { barcode: event.target.value })}
                        />
                        {showError(`${variant.id}:barcode`) && errors.barcode && (
                          <small
                            id={`variant-barcode-error-${variant.id}`}
                            className="choice-field-error"
                          >
                            {errors.barcode}
                          </small>
                        )}
                      </label>
                      <label className="builder-field">
                        <span>{text('Stock quantity', 'كمية المخزون')}</span>
                        <input
                          inputMode="numeric"
                          dir="ltr"
                          value={variant.stockQuantity}
                          ref={(element) => {
                            if (element) detailInputs.current.set(`${variant.id}:stock`, element);
                            else detailInputs.current.delete(`${variant.id}:stock`);
                          }}
                          onBlur={() => markTouched(`${variant.id}:stock`)}
                          aria-invalid={
                            showError(`${variant.id}:stock`) && Boolean(errors.stockQuantity)
                          }
                          aria-describedby={
                            showError(`${variant.id}:stock`) && errors.stockQuantity
                              ? `variant-stock-error-${variant.id}`
                              : undefined
                          }
                          placeholder={text('Blank = not tracked', 'فارغ = بدون تتبع')}
                          onChange={(event) =>
                            update(variant.id, { stockQuantity: event.target.value })
                          }
                        />
                        {showError(`${variant.id}:stock`) && errors.stockQuantity && (
                          <small
                            id={`variant-stock-error-${variant.id}`}
                            className="choice-field-error"
                          >
                            {errors.stockQuantity}
                          </small>
                        )}
                      </label>
                      <label className="builder-field">
                        <span>{text('Availability', 'التوفر')}</span>
                        <select
                          value={variant.availability}
                          onChange={(event) =>
                            update(variant.id, {
                              availability: event.target.value as VariantDraft['availability'],
                            })
                          }
                        >
                          <option value="available">{text('Available', 'متاح')}</option>
                          <option value="unavailable">{text('Unavailable', 'غير متاح')}</option>
                        </select>
                      </label>
                    </div>
                    {variant.attributes.map((attribute, attributeIndex) => (
                      <div className="variant-composer-attribute" key={attributeIndex}>
                        <label className="builder-field">
                          <span>{text('Attribute', 'الخاصية')}</span>
                          <input
                            maxLength={120}
                            placeholder={text('e.g. Color', 'مثال: اللون')}
                            value={attribute.name}
                            ref={(element) => {
                              const key = `${variant.id}:attribute:${attributeIndex}:name`;
                              if (element) detailInputs.current.set(key, element);
                              else detailInputs.current.delete(key);
                            }}
                            onBlur={() =>
                              markTouched(`${variant.id}:attribute:${attributeIndex}:name`)
                            }
                            aria-invalid={
                              showError(`${variant.id}:attribute:${attributeIndex}:name`) &&
                              (!attribute.name.trim() ||
                                variant.attributes.filter(
                                  (entry) =>
                                    entry.name.trim().toLowerCase() ===
                                    attribute.name.trim().toLowerCase(),
                                ).length > 1)
                            }
                            onChange={(event) =>
                              update(variant.id, {
                                attributes: variant.attributes.map((entry, position) =>
                                  position === attributeIndex
                                    ? { ...entry, name: event.target.value }
                                    : entry,
                                ),
                              })
                            }
                          />
                          {showError(`${variant.id}:attribute:${attributeIndex}:name`) &&
                            (!attribute.name.trim() ||
                              variant.attributes.filter(
                                (entry) =>
                                  entry.name.trim().toLowerCase() ===
                                  attribute.name.trim().toLowerCase(),
                              ).length > 1) && (
                              <small className="choice-field-error">
                                {text(
                                  'Enter a unique attribute name.',
                                  'أدخل اسمًا غير مكرر للخاصية.',
                                )}
                              </small>
                            )}
                        </label>
                        <label className="builder-field">
                          <span>{text('Value', 'القيمة')}</span>
                          <input
                            maxLength={120}
                            placeholder={text('e.g. Red', 'مثال: أحمر')}
                            value={attribute.value}
                            ref={(element) => {
                              const key = `${variant.id}:attribute:${attributeIndex}:value`;
                              if (element) detailInputs.current.set(key, element);
                              else detailInputs.current.delete(key);
                            }}
                            onBlur={() =>
                              markTouched(`${variant.id}:attribute:${attributeIndex}:value`)
                            }
                            aria-invalid={
                              showError(`${variant.id}:attribute:${attributeIndex}:value`) &&
                              !attribute.value.trim()
                            }
                            onChange={(event) =>
                              update(variant.id, {
                                attributes: variant.attributes.map((entry, position) =>
                                  position === attributeIndex
                                    ? { ...entry, value: event.target.value }
                                    : entry,
                                ),
                              })
                            }
                          />
                          {showError(`${variant.id}:attribute:${attributeIndex}:value`) &&
                            !attribute.value.trim() && (
                              <small className="choice-field-error">
                                {text('Enter an attribute value.', 'أدخل قيمة الخاصية.')}
                              </small>
                            )}
                        </label>
                        <button
                          type="button"
                          className="builder-remove-button"
                          aria-label={text(
                            `Remove attribute ${attributeIndex + 1}`,
                            `حذف الخاصية ${attributeIndex + 1}`,
                          )}
                          onClick={() =>
                            update(variant.id, {
                              attributes: variant.attributes.filter(
                                (_, position) => position !== attributeIndex,
                              ),
                            })
                          }
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                    ))}
                    <div className="variant-composer-detail-actions">
                      <button
                        type="button"
                        className="builder-text-button"
                        onClick={() =>
                          update(variant.id, {
                            attributes: [...variant.attributes, { name: '', value: '' }],
                          })
                        }
                      >
                        <Icon name="plus" />
                        {text('Add attribute', 'إضافة خاصية')}
                      </button>
                      <div className="builder-order-buttons">
                        <button
                          type="button"
                          aria-label={text('Move size up', 'تحريك الحجم لأعلى')}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <Icon name="arrow-up" />
                        </button>
                        <button
                          type="button"
                          aria-label={text('Move size down', 'تحريك الحجم لأسفل')}
                          disabled={index === draft.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <Icon name="arrow-down" />
                        </button>
                      </div>
                    </div>
                  </details>
                </section>
              );
            })}
            {!draft.length && (
              <p className="composer-empty-notice" role="status">
                {text(
                  'All sizes have been removed from this draft. Apply to sell at one product price, or add a new size below.',
                  'تم حذف الأحجام من المسودة. طبّق لاستخدام سعر واحد للمنتج، أو أضف حجمًا جديدًا أدناه.',
                )}
              </p>
            )}
            <button
              type="button"
              className="builder-button composer-add-row"
              onClick={addRow}
              disabled={draft.length >= 100}
            >
              <Icon name="plus" />
              {text('Add size or type', 'إضافة حجم أو نوع')}
            </button>
          </div>
        </div>
        <aside
          className="choice-composer-preview"
          aria-label={text('Customer preview', 'معاينة العميل')}
        >
          <h3>
            <Icon name="eye" />
            {text('Customer preview', 'معاينة العميل')}
          </h3>
          <div className="composer-base-price">
            <span>{text('Product price', 'سعر المنتج')}</span>
            <strong>
              {formatNumber(Number(basePrice) || 0, { maximumFractionDigits: 2 })}{' '}
              {text('EGP', 'ج.م')}
            </strong>
          </div>
          <CustomerChoicesPreview
            groups={[]}
            variants={draft.map((variant) => ({
              ...variant,
              price: validPrice(variant.price) ? variant.price : '0',
            }))}
            basePrice={basePrice}
            text={text}
          />
        </aside>
      </div>
      <footer className="choice-composer-footer">
        <button type="button" className="builder-button primary" onClick={apply}>
          <Icon name="check" />
          {draft.length
            ? text('Apply sizes and prices', 'تطبيق الأحجام والأسعار')
            : text('Use one product price', 'استخدام سعر واحد للمنتج')}
        </button>
        <button type="button" className="builder-button" onClick={() => onClose()}>
          {text('Cancel', 'إلغاء')}
        </button>
        <small className="choice-composer-footer-note">
          {draft.length
            ? text(`${draft.length} sizes or types`, `${draft.length} أحجام أو أنواع`)
            : text('One product price', 'سعر واحد للمنتج')}
        </small>
        <p className="composer-draft-hint">
          {text(
            'Close with × to keep a draft while editing this product. Cancel discards these edits.',
            'الإغلاق بعلامة × يحتفظ بالمسودة أثناء تعديل هذا المنتج. إلغاء يتجاهل هذه التعديلات.',
          )}
        </p>
      </footer>
    </Dialog>
  );
}
