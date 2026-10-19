import { useEffect, useRef, useState } from 'react';
import { Dialog, useLocale } from '@waffarly/ui';
import { Icon } from '../../../Icons.js';
import { CustomerChoicesPreview } from './CustomerChoicesPreview.js';
import { ModifierDetailsEditor } from './ModifierDetailsEditor.js';
import type {
  ChoiceGroupDraft,
  GroupDraft,
  OptionDraft,
  VariantDraft,
} from './product-builder.types.js';

export type ChoiceTemplate = 'extras' | 'preparation' | 'custom';
type ChoiceRow = OptionDraft;

export function ChoiceGroupComposer({
  template,
  basePrice,
  creating,
  onClose,
  onAdd,
  initialGroup,
  initialDraft,
  onSave,
  variants,
  recipe,
  text,
}: {
  template: ChoiceTemplate;
  basePrice: string;
  creating: boolean;
  onClose: (draft?: GroupDraft) => void;
  onAdd: (draft: ChoiceGroupDraft) => Promise<string | null>;
  initialGroup?: GroupDraft | undefined;
  initialDraft?: GroupDraft | undefined;
  onSave: (group: GroupDraft) => Promise<string | null>;
  variants: VariantDraft[];
  recipe: boolean;
  text: (english: string, arabic: string) => string;
}) {
  const { formatNumber } = useLocale();
  const [seed] = useState<GroupDraft>(() =>
    structuredClone(
      initialDraft ??
        initialGroup ?? {
          id: 'composer',
          modifierGroupId: 'composer',
          description: '',
          name:
            template === 'extras'
              ? text('Extras', 'الإضافات')
              : template === 'preparation'
                ? text('Preparation', 'طريقة التحضير')
                : '',
          options: (template === 'extras'
            ? [text('Extra cheese', 'جبنة إضافية'), text('Extra sauce', 'صوص إضافي')]
            : template === 'preparation'
              ? [text('Regular', 'عادي'), text('No salt', 'بدون ملح')]
              : ['']
          ).map((option) => ({
            id: crypto.randomUUID(),
            name: option,
            priceAdjustment: '',
            defaultSelected: false,
          })),
          selectionMode: template === 'extras' ? 'multiple' : 'single',
          minSelections: 0,
          maxSelections: template === 'extras' ? 2 : 1,
        },
    ),
  );
  const [name, setName] = useState(seed.name);
  const [rows, setRows] = useState<ChoiceRow[]>(seed.options);
  const [selectionMode, setSelectionMode] = useState<ChoiceGroupDraft['selectionMode']>(
    seed.selectionMode,
  );
  const [required, setRequired] = useState(seed.minSelections > 0);
  const [minSelections, setMinSelections] = useState(Math.max(1, seed.minSelections));
  const [maxSelections, setMaxSelections] = useState(seed.maxSelections);
  const [groupOverrides, setGroupOverrides] = useState(seed.variantOverrides);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [focusRow, setFocusRow] = useState('');
  const titleInput = useRef<HTMLInputElement>(null);
  const adding = useRef(false);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const priceInputs = useRef(new Map<string, HTMLInputElement>());
  const advancedSettings = useRef<HTMLDetailsElement>(null);
  const minimumInput = useRef<HTMLInputElement>(null);
  const maximumInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusRow) inputs.current.get(focusRow)?.focus();
  }, [focusRow]);
  const activeRows = rows.filter(
    (row) =>
      row.name.trim() ||
      row.priceAdjustment.trim() ||
      row.defaultSelected ||
      row.effects?.length ||
      row.variantOverrides?.length ||
      row.maxQuantity !== undefined,
  );
  const validPrice = (value: string) => !value || /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value);
  const names = activeRows.map((row) => row.name.trim().toLowerCase());
  const max =
    selectionMode === 'single'
      ? 1
      : Math.min(Math.max(1, maxSelections), Math.max(1, activeRows.length));
  const min = required ? Math.min(Math.max(1, minSelections), max) : 0;
  const markTouched = (field: string) => setTouched((current) => new Set(current).add(field));
  const showError = (field: string) => attempted || touched.has(field);
  const currentGroup: GroupDraft = {
    ...seed,
    name,
    options: rows,
    selectionMode,
    minSelections: min,
    maxSelections: max,
    variantOverrides: groupOverrides,
  };
  const baseline = useRef(JSON.stringify(currentGroup));
  function suspend() {
    onClose(
      initialDraft || JSON.stringify(currentGroup) !== baseline.current
        ? structuredClone({
            ...currentGroup,
            maxSelections,
            minSelections: required ? minSelections : 0,
          })
        : undefined,
    );
  }
  const nameError = (row: ChoiceRow) =>
    !row.name.trim()
      ? text('Enter a choice name.', 'اكتب اسم الخيار.')
      : names.filter((value) => value === row.name.trim().toLowerCase()).length > 1
        ? text('Use a different name for each choice.', 'استخدم اسمًا مختلفًا لكل خيار.')
        : '';
  const previewGroup: GroupDraft = {
    ...currentGroup,
    options: activeRows
      .filter((row) => row.name.trim())
      .map((row) => ({
        ...row,
        priceAdjustment: validPrice(row.priceAdjustment) ? row.priceAdjustment || '0' : '0',
      })),
  };
  function addRow() {
    if (rows.length >= 100 || creating) return;
    const emptyRow = rows.find((row) => !row.name.trim() && !row.priceAdjustment.trim());
    if (emptyRow) {
      inputs.current.get(emptyRow.id)?.focus();
      return;
    }
    const id = crypto.randomUUID();
    setRows((current) => [
      ...current,
      { id, name: '', priceAdjustment: '', defaultSelected: false },
    ]);
    if (maxSelections >= activeRows.length) setMaxSelections((current) => current + 1);
    setFocusRow(id);
  }
  function updateRow(id: string, update: Partial<ChoiceRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...update } : row)));
    setError('');
  }
  async function submit() {
    if (adding.current || creating) return;
    setAttempted(true);
    setError('');
    if (!name.trim()) {
      titleInput.current?.focus();
      return;
    }
    const invalidRow = activeRows.find((row) => nameError(row) || !validPrice(row.priceAdjustment));
    if (!activeRows.length || invalidRow) {
      (invalidRow && !nameError(invalidRow) ? priceInputs : inputs).current
        .get(invalidRow?.id ?? rows[0]!.id)
        ?.focus();
      return;
    }
    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      activeRows.filter((row) => row.defaultSelected).length > max
    ) {
      setError(
        text(
          'Use whole selection limits and keep default choices within the maximum.',
          'استخدم أعدادًا صحيحة لحدود الاختيار، ولا تتجاوز بالاختيارات الافتراضية الحد الأقصى.',
        ),
      );
      if (advancedSettings.current) advancedSettings.current.open = true;
      if (activeRows.filter((row) => row.defaultSelected).length > max)
        advancedSettings.current
          ?.querySelector<HTMLInputElement>('.composer-defaults input:checked')
          ?.focus();
      else (!Number.isInteger(min) ? minimumInput : maximumInput).current?.focus();
      return;
    }
    adding.current = true;
    try {
      const normalized: GroupDraft = {
        ...currentGroup,
        name: name.trim(),
        options: activeRows.map((row) => ({
          ...row,
          name: row.name.trim(),
          priceAdjustment: Number(row.priceAdjustment || 0).toFixed(2),
        })),
      };
      const result = initialGroup
        ? await onSave(normalized)
        : await onAdd({ ...normalized, required });
      if (result) setError(result);
      else onClose();
    } finally {
      adding.current = false;
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !creating) suspend();
      }}
      title={
        initialGroup
          ? text('Edit customer choices', 'تعديل خيارات العميل')
          : template === 'extras'
            ? text('Add extras', 'إضافة اختيارات إضافية')
            : template === 'preparation'
              ? text('Preparation preferences', 'تفضيلات التحضير')
              : text('Add customer choices', 'إضافة خيارات للعميل')
      }
      description={text(
        'Name the choices, set any extra charges, and choose how customers select them.',
        'اكتب الاختيارات، وحدّد أي سعر إضافي وطريقة اختيار العميل.',
      )}
      closeLabel={text('Close', 'إغلاق')}
      className="choice-composer-dialog"
    >
      <div className="choice-composer-layout">
        <div className="choice-composer-editor" aria-busy={creating}>
          <label className="builder-field">
            <span className="composer-section-title">
              <b>1</b>
              {text('Choice group name', 'اسم مجموعة الخيارات')}
            </span>
            <input
              autoFocus
              ref={titleInput}
              maxLength={160}
              value={name}
              disabled={creating}
              aria-invalid={showError('name') && !name.trim()}
              onBlur={() => markTouched('name')}
              aria-describedby={
                showError('name') && !name.trim() ? 'choice-title-error' : undefined
              }
              onChange={(event) => setName(event.target.value)}
              placeholder={text('e.g. Extras', 'مثال: الإضافات')}
            />
            {showError('name') && !name.trim() && (
              <small id="choice-title-error" className="choice-field-error">
                {text('Enter a title for these choices.', 'اكتب عنوانًا لهذه الاختيارات.')}
              </small>
            )}
          </label>
          <div className="choice-composer-rows">
            <div className="composer-section-heading">
              <h3 className="composer-section-title">
                <b>2</b>
                {text('Choices and prices', 'الاختيارات والأسعار')}
              </h3>
              <p>
                {text(
                  'Extra prices are added to the product price. Leave blank for free.',
                  'السعر الإضافي يُضاف لسعر المنتج. اتركه فارغًا للاختيارات المجانية.',
                )}
              </p>
            </div>
            <div className="choice-composer-table-head" aria-hidden="true">
              <span>{text('Choice name', 'اسم الاختيار')}</span>
              <span>{text('Extra price (EGP)', 'السعر الإضافي (ج.م)')}</span>
              <span />
            </div>
            {rows.map((row, index) => (
              <div className="choice-composer-row" key={row.id}>
                <label className="builder-field">
                  <span className="composer-mobile-label">
                    {text(`Choice ${index + 1}`, `الخيار ${index + 1}`)}
                  </span>
                  <input
                    ref={(element) => {
                      if (element) inputs.current.set(row.id, element);
                      else inputs.current.delete(row.id);
                    }}
                    maxLength={160}
                    value={row.name}
                    disabled={creating}
                    aria-invalid={showError(`name:${row.id}`) && Boolean(nameError(row))}
                    onBlur={() => markTouched(`name:${row.id}`)}
                    aria-describedby={
                      showError(`name:${row.id}`) && nameError(row)
                        ? `choice-name-error-${row.id}`
                        : undefined
                    }
                    onChange={(event) => updateRow(row.id, { name: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addRow();
                      }
                    }}
                    placeholder={text('Choice name', 'اسم الخيار')}
                  />
                  {showError(`name:${row.id}`) && nameError(row) && (
                    <small id={`choice-name-error-${row.id}`} className="choice-field-error">
                      {nameError(row)}
                    </small>
                  )}
                </label>
                <label className="builder-field">
                  <span className="composer-mobile-label">
                    {text(
                      `Extra price for choice ${index + 1} (EGP)`,
                      `السعر الإضافي للخيار ${index + 1} (ج.م)`,
                    )}
                  </span>
                  <input
                    ref={(element) => {
                      if (element) priceInputs.current.set(row.id, element);
                      else priceInputs.current.delete(row.id);
                    }}
                    type="text"
                    inputMode="decimal"
                    lang="en"
                    dir="ltr"
                    value={row.priceAdjustment}
                    disabled={creating}
                    placeholder="0.00"
                    aria-invalid={showError(`price:${row.id}`) && !validPrice(row.priceAdjustment)}
                    onBlur={() => markTouched(`price:${row.id}`)}
                    aria-describedby={
                      showError(`price:${row.id}`) && !validPrice(row.priceAdjustment)
                        ? `choice-price-error-${row.id}`
                        : undefined
                    }
                    onChange={(event) => updateRow(row.id, { priceAdjustment: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addRow();
                      }
                    }}
                  />
                  {showError(`price:${row.id}`) && !validPrice(row.priceAdjustment) && (
                    <small id={`choice-price-error-${row.id}`} className="choice-field-error">
                      {text(
                        'Enter a price of 0 or more, with up to 2 decimals.',
                        'أدخل سعرًا من صفر فأكثر، بمنزلتين عشريتين كحد أقصى.',
                      )}
                    </small>
                  )}
                </label>
                <button
                  type="button"
                  className="builder-remove-button"
                  disabled={rows.length === 1 || creating}
                  aria-label={text(`Remove choice ${index + 1}`, `حذف الخيار ${index + 1}`)}
                  onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
            {attempted && !activeRows.length && (
              <small className="choice-field-error" role="alert">
                {text('Add at least one choice.', 'أضف خيارًا واحدًا على الأقل.')}
              </small>
            )}
            <button
              type="button"
              className="builder-button"
              disabled={rows.length >= 100 || creating}
              onClick={addRow}
            >
              <Icon name="plus" />
              {text('Add another choice', 'إضافة خيار آخر')}
            </button>
          </div>
          <fieldset className="choice-composer-rules" disabled={creating}>
            <legend className="composer-section-title">
              <b>3</b>
              {text('Selection rules', 'قواعد الاختيار')}
            </legend>
            <div className="choice-segmented">
              {(['single', 'multiple'] as const).map((mode) => (
                <label key={mode} className={selectionMode === mode ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="composer-selection-mode"
                    checked={selectionMode === mode}
                    onChange={() => {
                      setSelectionMode(mode);
                      setMaxSelections(mode === 'single' ? 1 : Math.max(1, activeRows.length));
                      if (mode === 'single') {
                        setMinSelections(1);
                        setRows((current) => {
                          let found = false;
                          return current.map((row) => {
                            const defaultSelected = row.defaultSelected && !found;
                            if (defaultSelected) found = true;
                            return { ...row, defaultSelected };
                          });
                        });
                      }
                    }}
                  />
                  <span className="choice-policy-copy">
                    <strong>
                      {mode === 'single'
                        ? text('One choice', 'اختيار واحد')
                        : text('Several choices', 'أكثر من اختيار')}
                    </strong>
                    <small>
                      {mode === 'single'
                        ? text('Customer chooses one item.', 'يختار العميل أحد الخيارات.')
                        : text('Customer can combine choices.', 'يمكن للعميل الجمع بين الخيارات.')}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <label className="choice-required-toggle">
              <input
                type="checkbox"
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
              />
              <span className="choice-policy-copy">
                <strong>{text('Require a choice', 'الاختيار مطلوب')}</strong>
                <small>
                  {required
                    ? text(
                        'Customer must choose before continuing.',
                        'يجب أن يختار العميل قبل المتابعة.',
                      )
                    : text(
                        'Customer can continue without a choice.',
                        'يستطيع العميل المتابعة بدون اختيار.',
                      )}
                </small>
              </span>
              <span className="choice-policy-badge">
                {required ? text('Required', 'مطلوب') : text('Optional', 'اختياري')}
              </span>
            </label>
          </fieldset>
          <details className="composer-advanced-settings" ref={advancedSettings}>
            <summary>
              {text(
                'Selection limits, defaults and more',
                'حدود الاختيار والخيارات الافتراضية والمزيد',
              )}
              <Icon name="chevron" />
            </summary>
            <div className="builder-selection-limits">
              <label className="builder-field">
                <span>{text('Minimum selections', 'أقل عدد للاختيارات')}</span>
                <input
                  ref={minimumInput}
                  type="number"
                  min={required ? 1 : 0}
                  max={max}
                  value={min}
                  disabled={!required || creating}
                  onChange={(event) => setMinSelections(Number(event.target.value) || 1)}
                />
              </label>
              <label className="builder-field">
                <span>{text('Maximum selections', 'أكبر عدد للاختيارات')}</span>
                <input
                  ref={maximumInput}
                  type="number"
                  min="1"
                  max={Math.max(1, activeRows.length)}
                  value={max}
                  disabled={selectionMode === 'single' || creating}
                  onChange={(event) => setMaxSelections(Number(event.target.value) || 1)}
                />
              </label>
            </div>
            <fieldset className="composer-defaults" disabled={creating}>
              <legend>{text('Selected by default', 'محدد افتراضيًا')}</legend>
              {rows
                .filter((row) => row.name.trim())
                .map((row) => (
                  <label key={row.id}>
                    <input
                      type="checkbox"
                      checked={row.defaultSelected}
                      disabled={
                        selectionMode === 'multiple' &&
                        !row.defaultSelected &&
                        activeRows.filter((option) => option.defaultSelected).length >= max
                      }
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setRows((current) =>
                          current.map((option) =>
                            option.id === row.id
                              ? { ...option, defaultSelected: checked }
                              : selectionMode === 'single' && checked
                                ? { ...option, defaultSelected: false }
                                : option,
                          ),
                        );
                      }}
                    />
                    <span>{row.name}</span>
                  </label>
                ))}
            </fieldset>
            <ModifierDetailsEditor
              group={currentGroup}
              variants={variants}
              recipe={recipe}
              onGroupChange={(_, patch) => {
                if ('variantOverrides' in patch) setGroupOverrides(patch.variantOverrides);
              }}
              onOptionChange={(_, id, patch) => updateRow(id, patch)}
              text={text}
            />
          </details>
          {error && (
            <p className="choice-field-error" role="alert">
              {error}
            </p>
          )}
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
            groups={previewGroup.options.length ? [previewGroup] : []}
            basePrice={basePrice}
            text={text}
          />
        </aside>
      </div>
      <footer className="choice-composer-footer">
        <button
          type="button"
          className="builder-button primary"
          disabled={creating}
          onClick={() => void submit()}
        >
          <Icon name={initialGroup ? 'check' : 'plus'} />
          {creating
            ? text('Applying…', 'جارٍ التطبيق…')
            : initialGroup
              ? text('Apply changes', 'تطبيق التغييرات')
              : text('Add to product', 'إضافة للمنتج')}
        </button>
        <button
          type="button"
          className="builder-button"
          disabled={creating}
          onClick={() => onClose()}
        >
          {text('Cancel', 'إلغاء')}
        </button>
        <small
          className="choice-composer-footer-note"
          title={text(
            'Closing with × or Escape keeps your draft while editing this product.',
            'الإغلاق بعلامة × أو Escape يحتفظ بالمسودة أثناء تعديل هذا المنتج.',
          )}
        >
          {text(
            `${activeRows.length} choices · ${required ? 'Required' : 'Optional'}`,
            `${activeRows.length} خيارات · ${required ? 'مطلوب' : 'اختياري'}`,
          )}
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
