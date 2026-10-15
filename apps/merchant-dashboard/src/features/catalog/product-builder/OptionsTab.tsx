import { ModifierDetailsEditor } from './ModifierDetailsEditor.js';
import { useState } from 'react';
import type { CatalogModifierGroupSummary } from '@waffarly/contracts';
import { Icon } from '../../../Icons.js';
import type { OptionDraft, GroupDraft, VariantDraft } from './product-builder.types.js';

export function OptionsTab({
  groups,
  recipe,
  productMode,
  onProductModeChange,
  modifierLibrary,
  libraryLoading,
  selectedLibraryGroupId,
  onSelectedLibraryGroupChange,
  newGroupName,
  onNewGroupNameChange,
  newGroupOptions,
  onNewGroupOptionsChange,
  onAddGroupFromLibrary,
  onCreateAndAddGroup,
  creatingGroup,
  onGroupsChange,
  onGroupChange,
  onOptionChange,
  onMoveGroup,
  variants,
  onVariantChange,
  onVariantAttributeChange,
  onAddVariantAttribute,
  onRemoveVariantAttribute,
  onAddVariant,
  onRemoveVariant,
  onMoveVariant,
  text,
}: {
  groups: GroupDraft[];
  recipe: boolean;
  productMode: 'simple' | 'variants';
  onProductModeChange: (mode: 'simple' | 'variants') => void;
  modifierLibrary: CatalogModifierGroupSummary[];
  libraryLoading: boolean;
  selectedLibraryGroupId: string;
  onSelectedLibraryGroupChange: (id: string) => void;
  newGroupName: string;
  onNewGroupNameChange: (value: string) => void;
  newGroupOptions: string;
  onNewGroupOptionsChange: (value: string) => void;
  onAddGroupFromLibrary: () => void;
  onCreateAndAddGroup: () => void;
  creatingGroup: boolean;
  onGroupsChange: (groups: GroupDraft[]) => void;
  onGroupChange: (id: string, update: Partial<GroupDraft>) => void;
  onOptionChange: (groupId: string, optionId: string, update: Partial<OptionDraft>) => void;
  onMoveGroup: (index: number, direction: -1 | 1) => void;
  variants: VariantDraft[];
  onVariantChange: (id: string, update: Partial<VariantDraft>) => void;
  onVariantAttributeChange: (
    id: string,
    index: number,
    update: Partial<VariantDraft['attributes'][number]>,
  ) => void;
  onAddVariantAttribute: (id: string) => void;
  onRemoveVariantAttribute: (id: string, index: number) => void;
  onAddVariant: () => void;
  onRemoveVariant: (id: string) => void;
  onMoveVariant: (index: number, direction: -1 | 1) => void;
  text: (english: string, arabic: string) => string;
}) {
  const availableLibraryGroups = modifierLibrary.filter(
    (group) => !groups.some((assigned) => assigned.modifierGroupId === group.id),
  );
  const [groupEntryMode, setGroupEntryMode] = useState<'library' | 'create'>(
    availableLibraryGroups.length ? 'library' : 'create',
  );
  const newGroupOptionCount = newGroupOptions
    .split(/\r?\n/)
    .filter((option) => option.trim()).length;
  const [confirmSimpleMode, setConfirmSimpleMode] = useState(false);
  return (
    <div className="builder-fields">
      <div className="builder-section-heading builder-heading-action">
        <span>{text('03', '03')}</span>
        <div>
          <h2>{text('Options', 'الخيارات')}</h2>
          <p>
            {text(
              'Choose how you sell this product, then add any customer choices.',
              'اختر طريقة بيع المنتج، ثم أضف الخيارات التي يحتاجها العميل.',
            )}
          </p>
        </div>
        <div className="builder-heading-buttons">
          <button
            type="button"
            className="builder-button"
            onClick={onAddVariant}
            disabled={variants.length >= 100}
          >
            <Icon name="plus" />
            {text('Add variant', 'إضافة متغير')}
          </button>
        </div>
      </div>
      <details className="builder-advanced builder-options-help">
        <summary>
          {text('When should I use variants or add-ons?', 'متى أستخدم المتغيرات أو الإضافات؟')}
        </summary>
        <div className="builder-info-banner">
          <span>i</span>
          <p>
            {text(
              'Variants are separately priced versions of a product. Add-ons are customer choices. SKU, barcode, and stock tracking are optional.',
              'المتغيرات نسخ من المنتج بأسعار مستقلة، أما الإضافات فهي خيارات للعميل. تتبّع المخزون وحقولا SKU والباركود اختيارية.',
            )}
          </p>
        </div>
      </details>
      <fieldset className="builder-product-mode">
        <legend>{text('Product type', 'نوع المنتج')}</legend>
        <label className={productMode === 'simple' ? 'selected' : ''}>
          <input
            type="radio"
            name="product-mode"
            checked={productMode === 'simple'}
            onChange={() => {
              if (variants.length > 0) {
                setConfirmSimpleMode(true);
              } else onProductModeChange('simple');
            }}
          />
          <span>
            <strong>{text('Simple product', 'منتج بسيط')}</strong>
            <small>
              {text('One price, with no sellable variants.', 'سعر واحد بدون متغيرات قابلة للبيع.')}
            </small>
          </span>
        </label>
        <label className={productMode === 'variants' ? 'selected' : ''}>
          <input
            type="radio"
            name="product-mode"
            checked={productMode === 'variants'}
            onChange={() => onProductModeChange('variants')}
          />
          <span>
            <strong>{text('Product with variants', 'منتج بمتغيرات')}</strong>
            <small>
              {text(
                'Each variant has its own price and optional SKU, barcode, and stock.',
                'لكل متغير سعره الخاص ورمز SKU وباركود ومخزون اختياري.',
              )}
            </small>
          </span>
        </label>
      </fieldset>
      {confirmSimpleMode && (
        <div className="builder-mode-confirmation" role="alert">
          <p>
            {text(
              'Switching to a simple product removes the variants you entered. Keep them or use one product price?',
              'التحويل إلى منتج بسيط يزيل المتغيرات التي أدخلتها. هل تريد الاحتفاظ بها أم استخدام سعر واحد للمنتج؟',
            )}
          </p>
          <div>
            <button
              type="button"
              className="builder-button"
              onClick={() => setConfirmSimpleMode(false)}
            >
              {text('Keep variants', 'الاحتفاظ بالمتغيرات')}
            </button>
            <button
              type="button"
              className="builder-button"
              onClick={() => {
                onProductModeChange('simple');
                setConfirmSimpleMode(false);
              }}
            >
              {text('Use one price', 'استخدام سعر واحد')}
            </button>
          </div>
        </div>
      )}
      {!!variants.length && (
        <div className="builder-variant-list">
          <h3>{text('Sellable variants', 'المتغيرات القابلة للبيع')}</h3>
          {variants.map((variant, index) => (
            <section className="builder-group-card builder-variant-card" key={variant.id}>
              <header className="builder-group-header">
                <div className="builder-order-buttons">
                  <button
                    type="button"
                    aria-label={text('Move variant up', 'تحريك المتغير لأعلى')}
                    disabled={index === 0}
                    onClick={() => onMoveVariant(index, -1)}
                  >
                    <Icon name="arrow-up" />
                  </button>
                  <button
                    type="button"
                    aria-label={text('Move variant down', 'تحريك المتغير لأسفل')}
                    disabled={index === variants.length - 1}
                    onClick={() => onMoveVariant(index, 1)}
                  >
                    <Icon name="arrow-down" />
                  </button>
                </div>
                <span className="builder-group-index">{index + 1}</span>
                <div>
                  <strong>{variant.name || text('New variant', 'متغير جديد')}</strong>
                  <small>
                    {variant.availability === 'available'
                      ? text('Available', 'متاح')
                      : text('Unavailable', 'غير متاح')}
                  </small>
                </div>
                <button
                  type="button"
                  className="builder-remove-button"
                  aria-label={`${text('Remove variant', 'حذف المتغير')} ${variant.name}`}
                  onClick={() => onRemoveVariant(variant.id)}
                >
                  <Icon name="close" />
                </button>
              </header>
              <div className="builder-variant-grid">
                <label className="builder-field">
                  <span>
                    {text('Variant name', 'اسم المتغير')} <i>*</i>
                  </span>
                  <input
                    maxLength={160}
                    value={variant.name}
                    onChange={(event) => onVariantChange(variant.id, { name: event.target.value })}
                    placeholder={text('e.g. 500 ml', 'مثال: 500 مل')}
                  />
                </label>
                <label className="builder-field">
                  <span>
                    {text('Variant price (EGP)', 'سعر المتغير (جنيه)')} <i>*</i>
                  </span>
                  <input
                    type="number"
                    lang="en"
                    dir="ltr"
                    min="0.01"
                    step="0.01"
                    value={variant.price}
                    onChange={(event) => onVariantChange(variant.id, { price: event.target.value })}
                  />
                </label>
                <details className="builder-advanced builder-variant-extras">
                  <summary>
                    {text(
                      'Optional codes, stock & availability',
                      'الأكواد والمخزون وحالة التوفر — اختياري',
                    )}
                  </summary>
                  <div className="builder-variant-grid">
                    <label className="builder-field">
                      <span>{text('SKU (optional)', 'رمز SKU (اختياري)')}</span>
                      <input
                        maxLength={80}
                        value={variant.sku}
                        onChange={(event) =>
                          onVariantChange(variant.id, { sku: event.target.value })
                        }
                        placeholder={text('Unique merchant code', 'رمز فريد للمتجر')}
                        dir="ltr"
                      />
                    </label>
                    <label className="builder-field">
                      <span>{text('Barcode (optional)', 'الباركود (اختياري)')}</span>
                      <input
                        maxLength={80}
                        value={variant.barcode}
                        onChange={(event) =>
                          onVariantChange(variant.id, { barcode: event.target.value })
                        }
                        placeholder={text('Enter a barcode', 'أدخل الباركود')}
                        dir="ltr"
                      />
                    </label>
                    <label className="builder-field">
                      <span>{text('Stock quantity', 'كمية المخزون')}</span>
                      <input
                        type="number"
                        lang="en"
                        dir="ltr"
                        min="0"
                        step="1"
                        value={variant.stockQuantity}
                        onChange={(event) =>
                          onVariantChange(variant.id, { stockQuantity: event.target.value })
                        }
                        placeholder={text('Blank = not tracked', 'فارغ = بدون تتبع')}
                      />
                    </label>
                    <label className="builder-field">
                      <span>{text('Variant availability', 'حالة المتغير')}</span>
                      <select
                        value={variant.availability}
                        onChange={(event) =>
                          onVariantChange(variant.id, {
                            availability: event.target.value as VariantDraft['availability'],
                          })
                        }
                      >
                        <option value="available">{text('Available', 'متاح')}</option>
                        <option value="unavailable">{text('Unavailable', 'غير متاح')}</option>
                      </select>
                    </label>
                  </div>
                </details>
              </div>
              <div className="builder-attributes">
                <div className="builder-attributes-heading">
                  <div>
                    <strong>{text('Variant attributes', 'خصائص المتغير')}</strong>
                    <small>
                      {text(
                        'Add any dimensions, such as Size, Color, or Material.',
                        'أضف أي خصائص مثل المقاس أو اللون أو الخامة.',
                      )}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="builder-button"
                    onClick={() => onAddVariantAttribute(variant.id)}
                  >
                    <Icon name="plus" />
                    {text('Add attribute', 'إضافة خاصية')}
                  </button>
                </div>
                {variant.attributes.map((attribute, attributeIndex) => (
                  <div className="builder-attribute-row" key={`${variant.id}-${attributeIndex}`}>
                    <label className="builder-field">
                      <span>{text('Attribute', 'الخاصية')}</span>
                      <input
                        maxLength={120}
                        value={attribute.name}
                        onChange={(event) =>
                          onVariantAttributeChange(variant.id, attributeIndex, {
                            name: event.target.value,
                          })
                        }
                        placeholder={text('e.g. Size', 'مثال: المقاس')}
                      />
                    </label>
                    <label className="builder-field">
                      <span>{text('Value', 'القيمة')}</span>
                      <input
                        maxLength={120}
                        value={attribute.value}
                        onChange={(event) =>
                          onVariantAttributeChange(variant.id, attributeIndex, {
                            value: event.target.value,
                          })
                        }
                        placeholder={text('e.g. Large', 'مثال: كبير')}
                      />
                    </label>
                    <button
                      type="button"
                      className="builder-remove-button"
                      aria-label={text('Remove attribute', 'حذف الخاصية')}
                      onClick={() => onRemoveVariantAttribute(variant.id, attributeIndex)}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <section className="builder-group-card builder-group-entry">
        <div className="builder-entry-heading">
          <div>
            <h3>{text('Add customer choices', 'إضافة خيارات للعميل')}</h3>
            <p>
              {text(
                'Reuse a saved group or create one. Pricing and selection rules stay specific to this product.',
                'استخدم مجموعة محفوظة أو أنشئ مجموعة جديدة. يظل السعر وقواعد الاختيار خاصة بهذا المنتج.',
              )}
            </p>
          </div>
        </div>
        <div
          className="builder-entry-tabs"
          role="group"
          aria-label={text('Choose how to add options', 'اختر طريقة إضافة الخيارات')}
        >
          <button
            type="button"
            className={groupEntryMode === 'library' ? 'active' : ''}
            aria-pressed={groupEntryMode === 'library'}
            onClick={() => setGroupEntryMode('library')}
          >
            {text('Use saved group', 'استخدام مجموعة محفوظة')}
            <span>
              {text(String(availableLibraryGroups.length), String(availableLibraryGroups.length))}
            </span>
          </button>
          <button
            type="button"
            className={groupEntryMode === 'create' ? 'active' : ''}
            aria-pressed={groupEntryMode === 'create'}
            onClick={() => setGroupEntryMode('create')}
          >
            {text('Create new group', 'إنشاء مجموعة جديدة')}
          </button>
        </div>
        {groupEntryMode === 'library' ? (
          <div className="builder-group-entry-content">
            {availableLibraryGroups.length > 0 ? (
              <>
                <label className="builder-field">
                  <span>{text('Reusable group', 'مجموعة محفوظة')}</span>
                  <select
                    value={selectedLibraryGroupId}
                    onChange={(event) => onSelectedLibraryGroupChange(event.target.value)}
                    disabled={libraryLoading || groups.length >= 30}
                  >
                    <option value="">{text('Choose a group', 'اختر مجموعة')}</option>
                    {availableLibraryGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} · {group.assignedProductCount} {text('products', 'منتجات')}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="builder-button primary"
                  onClick={onAddGroupFromLibrary}
                  disabled={!selectedLibraryGroupId || groups.length >= 30 || libraryLoading}
                >
                  <Icon name="plus" />
                  {text('Add to this product', 'إضافة إلى هذا المنتج')}
                </button>
              </>
            ) : (
              <p className="builder-entry-empty" role="status">
                {libraryLoading
                  ? text('Loading saved groups…', 'جارٍ تحميل المجموعات المحفوظة…')
                  : modifierLibrary.length > 0
                    ? text(
                        'All saved groups are already added to this product.',
                        'تمت إضافة كل المجموعات المحفوظة إلى هذا المنتج بالفعل.',
                      )
                    : text(
                        'No saved groups yet. Create one to reuse it across products.',
                        'لا توجد مجموعات محفوظة بعد. أنشئ مجموعة لإعادة استخدامها مع منتجات أخرى.',
                      )}
              </p>
            )}
          </div>
        ) : (
          <div className="builder-group-entry-content builder-create-fields">
            <label className="builder-field">
              <span>{text('Group name', 'اسم المجموعة')}</span>
              <input
                maxLength={160}
                value={newGroupName}
                onChange={(event) => onNewGroupNameChange(event.target.value)}
                placeholder={text('e.g. Toppings', 'مثال: الإضافات')}
              />
            </label>
            <div className="builder-field builder-new-choices">
              <span>{text('Customer choices', 'خيارات العميل')}</span>
              {newGroupOptions.split(/\r?\n/).map((choice, index, choices) => (
                <div className="builder-new-choice-row" key={index}>
                  <input
                    aria-label={text(`Choice ${index + 1}`, `الخيار ${index + 1}`)}
                    maxLength={160}
                    value={choice}
                    placeholder={text('e.g. Extra cheese', 'مثال: جبنة إضافية')}
                    onChange={(event) =>
                      onNewGroupOptionsChange(
                        choices
                          .map((value, choiceIndex) =>
                            choiceIndex === index ? event.target.value : value,
                          )
                          .join('\n'),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="builder-remove-button"
                    aria-label={text(`Remove choice ${index + 1}`, `إزالة الخيار ${index + 1}`)}
                    disabled={choices.length === 1}
                    onClick={() =>
                      onNewGroupOptionsChange(
                        choices.filter((_, choiceIndex) => choiceIndex !== index).join('\n'),
                      )
                    }
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="builder-button"
                disabled={newGroupOptions.split(/\r?\n/).length >= 100 || creatingGroup}
                onClick={() => onNewGroupOptionsChange(`${newGroupOptions}\n`)}
              >
                <Icon name="plus" />
                {text('Add another choice', 'إضافة خيار آخر')}
              </button>
            </div>
            <div className="builder-create-actions">
              <small>
                {text(`${newGroupOptionCount} choices`, `${newGroupOptionCount} خيارات`)}
              </small>
              <button
                type="button"
                className="builder-button primary"
                disabled={
                  creatingGroup ||
                  !newGroupName.trim() ||
                  newGroupOptionCount === 0 ||
                  groups.length >= 30
                }
                onClick={onCreateAndAddGroup}
              >
                <Icon name="plus" />
                {creatingGroup
                  ? text('Creating…', 'جارٍ الإنشاء…')
                  : text('Create and add to product', 'إنشاء وإضافة إلى المنتج')}
              </button>
            </div>
          </div>
        )}
      </section>
      <div className="builder-subsection-heading">
        <div>
          <h3>{text('Choices on this product', 'الخيارات على هذا المنتج')}</h3>
          <p>
            {text(
              'Adjust selection limits and prices for this product.',
              'عدّل حدود الاختيار والأسعار لهذا المنتج.',
            )}
          </p>
        </div>
        <span className="builder-count-badge">
          {text(String(groups.length), String(groups.length))}
        </span>
      </div>
      {!groups.length && (
        <div className="builder-empty-state builder-empty-options">
          <strong>{text('No customer choices added yet', 'لم تتم إضافة خيارات للعميل بعد')}</strong>
          <p>
            {text(
              'You can continue without add-ons. Add a group only if customers need extra choices.',
              'يمكنك المتابعة بدون إضافات. أضف مجموعة فقط إذا احتاج العميل إلى خيارات إضافية.',
            )}
          </p>
        </div>
      )}
      <div className="builder-groups-list">
        {groups.map((group, groupIndex) => (
          <section className="builder-group-card" key={group.id}>
            <header className="builder-group-header">
              <div className="builder-order-buttons">
                <button
                  type="button"
                  aria-label={text('Move group up', 'تحريك المجموعة لأعلى')}
                  disabled={groupIndex === 0}
                  onClick={() => onMoveGroup(groupIndex, -1)}
                >
                  <Icon name="arrow-up" />
                </button>
                <button
                  type="button"
                  aria-label={text('Move group down', 'تحريك المجموعة لأسفل')}
                  disabled={groupIndex === groups.length - 1}
                  onClick={() => onMoveGroup(groupIndex, 1)}
                >
                  <Icon name="arrow-down" />
                </button>
              </div>
              <span className="builder-group-index">{groupIndex + 1}</span>
              <div>
                <strong>{group.name || text('New option group', 'مجموعة خيارات جديدة')}</strong>
                <small>
                  {group.minSelections === 0
                    ? text('Optional', 'اختيارية')
                    : text('Required', 'مطلوبة')}
                </small>
              </div>
              <button
                type="button"
                className="builder-remove-button"
                aria-label={text('Remove group', 'حذف المجموعة')}
                onClick={() => onGroupsChange(groups.filter((item) => item.id !== group.id))}
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="builder-group-fields">
              {group.description && (
                <p className="builder-group-description">{group.description}</p>
              )}
              <label className="builder-required-choice">
                <input
                  type="checkbox"
                  checked={group.minSelections > 0}
                  onChange={(event) =>
                    onGroupChange(group.id, { minSelections: event.target.checked ? 1 : 0 })
                  }
                />
                <span>
                  <strong>{text('Customer must choose', 'يجب على العميل الاختيار')}</strong>
                  <small>
                    {text(
                      'Turn off to make this group optional.',
                      'أوقف هذا الخيار لجعل المجموعة اختيارية.',
                    )}
                  </small>
                </span>
              </label>
              <label className="builder-field">
                <span>{text('Choice type', 'نوع الاختيار')}</span>
                <select
                  value={group.selectionMode}
                  onChange={(event) => {
                    const selectionMode = event.target.value as GroupDraft['selectionMode'];
                    onGroupChange(group.id, {
                      selectionMode,
                      minSelections:
                        selectionMode === 'single'
                          ? Math.min(group.minSelections, 1)
                          : group.minSelections,
                      maxSelections:
                        selectionMode === 'single'
                          ? 1
                          : Math.min(group.options.length, Math.max(2, group.maxSelections)),
                    });
                  }}
                >
                  <option value="single">{text('Single choice', 'اختيار واحد')}</option>
                  <option value="multiple">{text('Multiple choice', 'اختيارات متعددة')}</option>
                </select>
              </label>
              <details className="builder-advanced builder-limits-details">
                <summary>
                  {text('Selection limits', 'حدود الاختيار')}
                  <span>
                    {text(String(group.minSelections), String(group.minSelections))}–
                    {text(String(group.maxSelections), String(group.maxSelections))}
                  </span>
                </summary>
                <div className="builder-selection-limits">
                  <label className="builder-field">
                    <span>{text('Minimum selections', 'أقل عدد للاختيارات')}</span>
                    <input
                      type="number"
                      lang="en"
                      dir="ltr"
                      min="0"
                      max={group.options.length}
                      value={group.minSelections}
                      onChange={(event) =>
                        onGroupChange(group.id, { minSelections: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="builder-field">
                    <span>{text('Maximum selections', 'أكبر عدد للاختيارات')}</span>
                    <input
                      type="number"
                      lang="en"
                      dir="ltr"
                      min="1"
                      max={group.options.length}
                      disabled={group.selectionMode === 'single'}
                      value={group.maxSelections}
                      onChange={(event) =>
                        onGroupChange(group.id, { maxSelections: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
              </details>
            </div>
            <div className="builder-options-heading">
              <strong>{text('Choices', 'الاختيارات')}</strong>
              <span>{text('EGP price adjustment', 'فرق السعر بالجنيه')}</span>
              <span>{text('Default', 'افتراضي')}</span>
            </div>
            <div className="builder-option-list">
              {group.options.map((option, optionIndex) => (
                <div className="builder-option-row" key={option.id}>
                  <span className="builder-option-position" aria-hidden="true">
                    {optionIndex + 1}
                  </span>
                  <span className="builder-option-name">{option.name}</span>
                  <div className="builder-currency-field">
                    <input
                      aria-label={text('Price adjustment in EGP', 'فرق السعر بالجنيه')}
                      type="number"
                      lang="en"
                      dir="ltr"
                      min="0"
                      step="0.01"
                      value={option.priceAdjustment}
                      onChange={(event) =>
                        onOptionChange(group.id, option.id, { priceAdjustment: event.target.value })
                      }
                    />
                    <b>EGP</b>
                  </div>
                  <label className="builder-default-choice">
                    <input
                      type={group.selectionMode === 'single' ? 'radio' : 'checkbox'}
                      name={`default-${group.id}`}
                      checked={option.defaultSelected}
                      onChange={(event) => {
                        if (group.selectionMode === 'single') {
                          onGroupChange(group.id, {
                            options: group.options.map((item) => ({
                              ...item,
                              defaultSelected: item.id === option.id,
                            })),
                          });
                        } else
                          onOptionChange(group.id, option.id, {
                            defaultSelected: event.target.checked,
                          });
                      }}
                    />
                    <span>{option.defaultSelected ? text('Yes', 'نعم') : text('No', 'لا')}</span>
                  </label>
                </div>
              ))}
            </div>
            <ModifierDetailsEditor
              group={group}
              variants={variants}
              recipe={recipe}
              onGroupChange={onGroupChange}
              onOptionChange={onOptionChange}
              text={text}
            />
            {group.options.some((option) => option.defaultSelected) && (
              <button
                type="button"
                className="builder-text-button"
                onClick={() =>
                  onGroupChange(group.id, {
                    options: group.options.map((option) => ({ ...option, defaultSelected: false })),
                  })
                }
              >
                {text('Clear default choices', 'إلغاء الاختيارات الافتراضية')}
              </button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
