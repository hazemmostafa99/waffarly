import { useRef, useState } from 'react';
import {
  STOCK_BASE_UNITS,
  type CreateStockItemRequest,
  type ProductInventoryMode,
  type StockBaseUnit,
  type StockItem,
} from '@waffarly/contracts';
import { Dialog, useLocale } from '@waffarly/ui';
import { StockItemPicker } from '../../inventory/components/InventoryPickers.js';
import { stockUnitLabel } from '../../inventory/stock-unit-options.js';
import { Icon } from '../../../Icons.js';
import { apiRequest } from '../../../lib/api-client.js';
import { InventoryQuantityField } from './InventoryQuantityField.js';
import { InventoryConsumptionPreview } from './InventoryConsumptionPreview.js';
import { CopyInventoryDialog } from './CopyInventoryDialog.js';
import { emptyInventoryComponent, inventoryTargetComplete } from './product-inventory.js';

export interface ProductInventoryComponentDraft {
  stockItemId: string;
  unitCode: string;
  quantity: string;
}
export interface ProductInventoryTargetDraft {
  variantId: string | null;
  components: ProductInventoryComponentDraft[];
}
type InventoryDrafts = Partial<Record<ProductInventoryMode, ProductInventoryTargetDraft[]>>;

export function ProductInventoryTab({
  enabled,
  onEnabledChange,
  mode,
  defaultMode,
  savedModes,
  required,
  availability,
  stockItems,
  targets,
  variants,
  productName,
  onInventorySave,
  onStockItemLoaded,
  text,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  mode: ProductInventoryMode;
  defaultMode: ProductInventoryMode;
  savedModes: InventoryDrafts;
  required: boolean;
  availability: 'available' | 'unavailable';
  stockItems: StockItem[];
  targets: ProductInventoryTargetDraft[];
  variants: Array<{ id: string; name: string }>;
  productName: string;
  onInventorySave: (mode: ProductInventoryMode, targets: ProductInventoryTargetDraft[]) => void;
  onStockItemLoaded: (item: StockItem) => void;
  text: (english: string, arabic: string) => string;
}) {
  const { locale } = useLocale();
  const t = (en: string, ar: string) => text(en, ar);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(targets[0]?.variantId ?? null);
  const [draftMode, setDraftMode] = useState(mode);
  const [draftTargets, setDraftTargets] = useState<ProductInventoryTargetDraft[]>([]);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [copyTo, setCopyTo] = useState<string | null>(null);
  const [creating, setCreating] = useState<{
    variantId: string | null;
    index: number;
    name: string;
  } | null>(null);
  const [createUnit, setCreateUnit] = useState<StockBaseUnit>('piece');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const createRequest = useRef<CreateStockItemRequest | null>(null);
  const createLock = useRef(false);
  const cache = useRef<InventoryDrafts>({});
  const snapshots = useRef('');
  const [attemptedClose, setAttemptedClose] = useState(false);

  const labelFor = (id: string | null) =>
    id
      ? variants.find((variant) => variant.id === id)?.name || t('Unnamed size', 'حجم بدون اسم')
      : productName || t('Product', 'المنتج');
  const completeCount = targets.filter((target) =>
    inventoryTargetComplete(target, mode, stockItems),
  ).length;
  const configured = enabled && completeCount === targets.length && targets.length > 0;
  const componentSummary = (target: ProductInventoryTargetDraft) => {
    const names = target.components
      .map((component) => stockItems.find((item) => item.id === component.stockItemId)?.name)
      .filter(Boolean);
    return names.length
      ? names.join('، ')
      : t('No stock items added yet', 'لم تتم إضافة أصناف مخزون بعد');
  };

  function openEditor(id: string | null) {
    const current = structuredClone(targets);
    cache.current = { ...structuredClone(savedModes), [mode]: current };
    snapshots.current = JSON.stringify({ mode, targets: current });
    setDraftMode(mode);
    setDraftTargets(current);
    setSelectedId(id);
    setDiscardPrompt(false);
    setAttemptedClose(false);
    setCopyTo(null);
    setCreating(null);
    setDialogOpen(true);
  }
  function askToClose() {
    const changed =
      JSON.stringify({ mode: draftMode, targets: draftTargets }) !== snapshots.current;
    if (changed) {
      setAttemptedClose(true);
      setDiscardPrompt(true);
    } else setDialogOpen(false);
  }
  function discard() {
    setDialogOpen(false);
    setDiscardPrompt(false);
    setAttemptedClose(false);
  }
  function updateTarget(id: string | null, components: ProductInventoryComponentDraft[]) {
    setDraftTargets((current) => {
      const index = current.findIndex((target) => target.variantId === id);
      if (index < 0) return [...current, { variantId: id, components }];
      return current.map((target, position) =>
        position === index ? { ...target, components } : target,
      );
    });
  }
  function switchMode(next: ProductInventoryMode) {
    if (next === draftMode) return;
    cache.current[draftMode] = structuredClone(draftTargets);
    const restore =
      cache.current[next] ??
      targets.map((target) => ({
        variantId: target.variantId,
        components: [emptyInventoryComponent(next)],
      }));
    cache.current[next] = structuredClone(restore);
    setDraftTargets(structuredClone(restore));
    setDraftMode(next);
  }
  function save() {
    onInventorySave(draftMode, structuredClone(draftTargets));
    setDialogOpen(false);
  }
  async function createInlineStockItem() {
    if (!creating || createLock.current || !creating.name.trim()) return;
    createLock.current = true;
    setCreateBusy(true);
    setCreateError('');
    if (
      !createRequest.current ||
      createRequest.current.name !== creating.name.trim() ||
      createRequest.current.baseUnit !== createUnit
    ) {
      createRequest.current = {
        requestId: crypto.randomUUID(),
        name: creating.name.trim(),
        baseUnit: createUnit,
        units: [],
      };
    }
    try {
      const item = await apiRequest<StockItem>('/owner/inventory/items', {
        method: 'POST',
        body: JSON.stringify(createRequest.current),
      });
      onStockItemLoaded(item);
      const current = draftTargets.find((target) => target.variantId === creating.variantId);
      const components = current?.components ?? [];
      const component = components[creating.index];
      if (component)
        updateTarget(
          creating.variantId,
          components.map((entry, index) =>
            index === creating!.index
              ? { ...entry, stockItemId: item.id, unitCode: item.baseUnit }
              : entry,
          ),
        );
      setCreating(null);
      createRequest.current = null;
    } catch (cause) {
      setCreateError(
        cause instanceof Error
          ? cause.message
          : t('Could not create this stock item.', 'تعذر إنشاء صنف المخزون.'),
      );
    } finally {
      createLock.current = false;
      setCreateBusy(false);
    }
  }

  const currentTarget =
    draftTargets.find((target) => target.variantId === selectedId) ?? draftTargets[0];
  const currentName = currentTarget ? labelFor(currentTarget.variantId) : labelFor(selectedId);
  const sources = draftTargets.filter(
    (target) =>
      target.variantId !== copyTo &&
      inventoryTargetComplete(target, draftMode, stockItems) &&
      target.components.every((component) =>
        stockItems.some((item) => item.id === component.stockItemId && !item.archivedAt),
      ),
  );
  const destination = draftTargets.find((target) => target.variantId === copyTo);
  const ready = draftTargets.filter((target) =>
    inventoryTargetComplete(target, draftMode, stockItems),
  ).length;

  return (
    <div className="builder-fields inventory-smart-setup">
      <div className="builder-section-heading">
        <span>04</span>
        <div>
          <h2>{t('Inventory per sale', 'المخزون لكل عملية بيع')}</h2>
          <p>
            {t(
              'Choose what the product uses from stock each time it sells.',
              'حدد ما يستهلكه المنتج من المخزون مع كل عملية بيع.',
            )}
          </p>
        </div>
      </div>
      <label className="builder-inventory-enable">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
        <span>
          <strong>{t('Link this product to inventory', 'ربط المنتج بالمخزون')}</strong>
          <small>
            {t(
              'Track the stock used for each sale.',
              'تتبّع الكميات المستخدمة من المخزون مع كل عملية بيع.',
            )}
          </small>
        </span>
      </label>
      {enabled ? (
        <>
          <div className="inventory-summary-toolbar">
            <div>
              <strong>{t('Setup progress', 'تقدم الإعداد')}</strong>
              <span>
                {t(
                  completeCount + ' of ' + targets.length + ' ready',
                  completeCount + ' من ' + targets.length + ' جاهز',
                )}
              </span>
            </div>
            <span className={'inventory-status' + (configured ? ' is-ready' : '')}>
              {configured
                ? t('Ready to save', 'جاهز للحفظ')
                : required && availability === 'available'
                  ? t('Complete before publishing', 'أكمل الإعداد قبل النشر')
                  : t('Setup in progress', 'الإعداد قيد التقدم')}
            </span>
          </div>
          <div className="inventory-target-cards">
            {targets.map((target) => {
              const readyTarget = inventoryTargetComplete(target, mode, stockItems);
              const hasSetup = target.components.some((component) => component.stockItemId);
              return (
                <article className="inventory-target-card" key={target.variantId ?? 'product'}>
                  <div className="inventory-target-card-copy">
                    <strong>{labelFor(target.variantId)}</strong>
                    <span>{componentSummary(target)}</span>
                  </div>
                  <span className={'inventory-status' + (readyTarget ? ' is-ready' : '')}>
                    {readyTarget
                      ? t('Ready', 'جاهز')
                      : hasSetup
                        ? t('Incomplete', 'غير مكتمل')
                        : t('Not set up', 'لم يتم الإعداد')}
                  </span>
                  <button
                    type="button"
                    className="builder-button"
                    onClick={() => openEditor(target.variantId)}
                  >
                    {hasSetup
                      ? t('Edit setup', 'تعديل الإعداد')
                      : t('Set up inventory', 'إعداد المخزون')}
                  </button>
                </article>
              );
            })}
          </div>
          {required && availability === 'available' && !configured && (
            <p className="inventory-setup-note">
              {t(
                'Complete every product size before publishing, or save this product as unavailable and finish later.',
                'أكمل إعداد كل حجم قبل النشر، أو احفظ المنتج كغير متاح وأكمل لاحقًا.',
              )}
            </p>
          )}
        </>
      ) : (
        <p className="inventory-setup-note">
          {required && availability === 'available'
            ? t(
                'Set up inventory to publish this new product, or save it as unavailable and finish later.',
                'أكمل إعداد المخزون لنشر المنتج الجديد، أو احفظه كغير متاح وأكمل لاحقًا.',
              )
            : t(
                'You can link this product to inventory later.',
                'يمكنك ربط المنتج بالمخزون لاحقًا.',
              )}
        </p>
      )}
      {dialogOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !createBusy) askToClose();
          }}
          title={t('Set up inventory', 'إعداد المخزون')}
          description={t(
            'Choose what to deduct for one sale, then save your changes.',
            'حدد ما يُخصم مع عملية بيع واحدة، ثم احفظ التغييرات.',
          )}
          closeLabel={t('Close inventory setup', 'إغلاق إعداد المخزون')}
          className="choice-composer-dialog inventory-configuration-dialog"
        >
          <div className="inventory-dialog-layout">
            <div className="inventory-dialog-main">
              <div className="inventory-dialog-target-switcher">
                {draftTargets.map((target) => (
                  <button
                    type="button"
                    key={target.variantId ?? 'product'}
                    aria-pressed={target.variantId === selectedId}
                    disabled={createBusy}
                    onClick={() => {
                      setSelectedId(target.variantId);
                      setCreating(null);
                    }}
                  >
                    {labelFor(target.variantId)}
                    <span
                      className={
                        'inventory-status' +
                        (inventoryTargetComplete(target, draftMode, stockItems) ? ' is-ready' : '')
                      }
                    >
                      {inventoryTargetComplete(target, draftMode, stockItems)
                        ? t('Ready', 'جاهز')
                        : t('Needs setup', 'يحتاج إعداد')}
                    </span>
                  </button>
                ))}
              </div>
              <fieldset className="builder-inventory-mode">
                <legend>{t('How do you sell it?', 'كيف تبيع المنتج؟')}</legend>
                {(['DIRECT', 'RECIPE'] as const).map((value) => (
                  <label key={value} className={draftMode === value ? 'is-selected' : undefined}>
                    <input
                      type="radio"
                      name="inventory-dialog-mode"
                      checked={draftMode === value}
                      disabled={createBusy}
                      onChange={() => switchMode(value)}
                    />
                    <span>
                      <strong>
                        {value === 'DIRECT'
                          ? t('I sell a ready-made item', 'أبيع قطعة جاهزة')
                          : t('I prepare it from ingredients', 'أحضّره من مكونات')}
                      </strong>
                      <small>
                        {value === 'DIRECT'
                          ? t(
                              'One item, such as a bottle, per sale.',
                              'صنف واحد، مثل زجاجة، لكل عملية بيع.',
                            )
                          : t(
                              'Several ingredients, such as a burger recipe.',
                              'عدة مكونات، مثل وصفة البرجر.',
                            )}
                      </small>
                      {defaultMode === value && (
                        <em>{t('Suggested for your business', 'مقترح لنشاطك')}</em>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
              {currentTarget && (
                <section className="builder-inventory-target inventory-dialog-editor">
                  <div className="inventory-target-heading">
                    <div>
                      <span>{t('Ingredients for one sale', 'مكونات عملية بيع واحدة')}</span>
                      <h3>{currentName}</h3>
                    </div>
                    <div className="inventory-target-actions">
                      <span
                        className={
                          'inventory-status' +
                          (inventoryTargetComplete(currentTarget, draftMode, stockItems)
                            ? ' is-ready'
                            : '')
                        }
                      >
                        {inventoryTargetComplete(currentTarget, draftMode, stockItems)
                          ? t('Ready', 'جاهز')
                          : t('Needs setup', 'يحتاج إعداد')}
                      </span>
                      {variants.length > 1 && sources.length > 0 && (
                        <button
                          className="builder-button"
                          type="button"
                          onClick={() => setCopyTo(currentTarget.variantId)}
                        >
                          {t('Copy from another size', 'نسخ من حجم آخر')}
                        </button>
                      )}
                    </div>
                  </div>
                  {currentTarget.components.length > 0 && (
                    <div className="inventory-smart-row-labels">
                      <span>
                        {draftMode === 'RECIPE'
                          ? t('Ingredient', 'المكوّن')
                          : t('Stock item', 'صنف المخزون')}
                      </span>
                      <span>{t('Quantity used per sale', 'الكمية لكل عملية بيع')}</span>
                      {draftMode === 'RECIPE' && currentTarget.components.length > 1 && (
                        <span className="inventory-smart-row-action-spacer" aria-hidden="true" />
                      )}
                    </div>
                  )}
                  {currentTarget.components.map((component, index) => {
                    const item = stockItems.find((entry) => entry.id === component.stockItemId);
                    const fieldLabel =
                      draftMode === 'RECIPE'
                        ? t('Ingredient', 'المكوّن')
                        : t('Stock item', 'صنف المخزون');
                    const isCreating =
                      creating?.variantId === currentTarget.variantId && creating.index === index;
                    return (
                      <div className="builder-inventory-component inventory-smart-row" key={index}>
                        <div className="builder-field inventory-stock-field">
                          <span>{fieldLabel}</span>
                          <StockItemPicker
                            value={component.stockItemId}
                            label={fieldLabel}
                            allowCreate
                            disabled={createBusy}
                            onRequestCreate={(search) => {
                              setCreating({
                                variantId: currentTarget.variantId,
                                index,
                                name: search,
                              });
                              setCreateUnit(draftMode === 'RECIPE' ? 'g' : 'piece');
                              setCreateError('');
                              createRequest.current = null;
                            }}
                            onResolve={(resolved) => onStockItemLoaded(resolved)}
                            onSelect={(selected) => {
                              if (selected) onStockItemLoaded(selected);
                              updateTarget(
                                currentTarget.variantId,
                                currentTarget.components.map((entry, position) =>
                                  position === index
                                    ? {
                                        stockItemId: selected?.id ?? '',
                                        unitCode: selected?.baseUnit ?? '',
                                        quantity:
                                          selected?.id === component.stockItemId
                                            ? entry.quantity
                                            : draftMode === 'DIRECT'
                                              ? '1'
                                              : '',
                                      }
                                    : entry,
                                ),
                              );
                              setCreating(null);
                            }}
                          />
                        </div>
                        <InventoryQuantityField
                          item={item}
                          quantity={component.quantity}
                          unitCode={component.unitCode}
                          label={
                            t('Quantity per sale', 'الكمية لكل عملية بيع') +
                            ': ' +
                            currentName +
                            ', ' +
                            (item?.name ?? fieldLabel)
                          }
                          onQuantityChange={(quantity) =>
                            updateTarget(
                              currentTarget.variantId,
                              currentTarget.components.map((entry, position) =>
                                position === index ? { ...entry, quantity } : entry,
                              ),
                            )
                          }
                          onUnitChange={(unitCode) =>
                            updateTarget(
                              currentTarget.variantId,
                              currentTarget.components.map((entry, position) =>
                                position === index ? { ...entry, unitCode } : entry,
                              ),
                            )
                          }
                        />
                        {draftMode === 'RECIPE' && currentTarget.components.length > 1 && (
                          <button
                            type="button"
                            className="builder-remove-button inventory-remove"
                            disabled={createBusy}
                            aria-label={t(
                              'Remove ingredient ' + (index + 1),
                              'حذف المكوّن ' + (index + 1),
                            )}
                            onClick={() =>
                              updateTarget(
                                currentTarget.variantId,
                                currentTarget.components.filter(
                                  (_, position) => position !== index,
                                ),
                              )
                            }
                          >
                            <Icon name="close" />
                          </button>
                        )}
                        {isCreating && (
                          <div className="inventory-inline-create">
                            <strong>{t('Create stock item', 'إنشاء صنف مخزون')}</strong>
                            <label className="builder-field">
                              <span>{t('Name', 'الاسم')}</span>
                              <input
                                autoFocus
                                disabled={createBusy}
                                maxLength={80}
                                value={creating.name}
                                onChange={(event) => {
                                  setCreating({ ...creating, name: event.target.value });
                                  createRequest.current = null;
                                }}
                                placeholder={t('e.g. Burger patty', 'مثال: لحم برجر')}
                              />
                            </label>
                            <label className="builder-field">
                              <span>{t('Base unit', 'وحدة القياس الأساسية')}</span>
                              <div className="inventory-unit-select">
                                <select
                                  value={createUnit}
                                  disabled={createBusy}
                                  onChange={(event) => {
                                    setCreateUnit(event.target.value as StockBaseUnit);
                                    createRequest.current = null;
                                  }}
                                >
                                  {STOCK_BASE_UNITS.map((unit) => (
                                    <option key={unit} value={unit}>
                                      {stockUnitLabel(unit, locale)} ({unit})
                                    </option>
                                  ))}
                                </select>
                                <Icon name="chevron" />
                              </div>
                            </label>
                            <small>
                              {t(
                                'Creating an item does not add stock. You can record its balance in Inventory.',
                                'إنشاء الصنف لا يضيف كمية للمخزون. يمكنك إضافة رصيد له من صفحة المخزون.',
                              )}
                            </small>
                            {createError && (
                              <p className="choice-field-error" role="alert">
                                {createError}
                              </p>
                            )}
                            <div>
                              <button
                                type="button"
                                className="builder-button primary"
                                disabled={createBusy || !creating.name.trim()}
                                onClick={() => void createInlineStockItem()}
                              >
                                <Icon name="plus" />
                                {createBusy
                                  ? t('Creating…', 'جارٍ الإنشاء…')
                                  : t('Create and select', 'إنشاء واختيار')}
                              </button>{' '}
                              <button
                                type="button"
                                className="builder-button"
                                disabled={createBusy}
                                onClick={() => setCreating(null)}
                              >
                                {t('Cancel', 'إلغاء')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {draftMode === 'RECIPE' && (
                    <button
                      type="button"
                      className="builder-button ghost"
                      disabled={createBusy || currentTarget.components.length >= 100}
                      onClick={() =>
                        updateTarget(currentTarget.variantId, [
                          ...currentTarget.components,
                          emptyInventoryComponent(draftMode),
                        ])
                      }
                    >
                      <Icon name="plus" />
                      {t('Add ingredient', 'إضافة مكوّن')}
                    </button>
                  )}
                </section>
              )}
              <div className="inventory-progress">
                <strong>{t('Setup progress', 'تقدم الإعداد')}</strong>
                <span>
                  {t(
                    ready + ' of ' + draftTargets.length + ' ready',
                    ready + ' من ' + draftTargets.length + ' جاهز',
                  )}
                </span>
              </div>
            </div>
            <InventoryConsumptionPreview
              name={productName}
              enabled={enabled}
              mode={draftMode}
              targets={draftTargets}
              stockItems={stockItems}
              variants={variants}
              selectedId={selectedId}
              onSelect={setSelectedId}
              text={t}
            />
          </div>
          {discardPrompt && (
            <div
              className="inventory-discard-confirm"
              role="alertdialog"
              aria-label={t('Discard changes?', 'تجاهل التغييرات؟')}
            >
              <p>
                {t(
                  'You have unsaved inventory changes. Discard them?',
                  'لديك تغييرات مخزون غير محفوظة. هل تريد تجاهلها؟',
                )}
              </p>
              <button
                type="button"
                className="builder-button"
                onClick={() => setDiscardPrompt(false)}
              >
                {t('Keep editing', 'متابعة التعديل')}
              </button>
              <button
                type="button"
                className="builder-button danger"
                disabled={createBusy}
                onClick={discard}
              >
                {t('Discard changes', 'تجاهل التغييرات')}
              </button>
            </div>
          )}
          {!discardPrompt && (
            <footer className="choice-composer-footer">
              <span className="inventory-dialog-save-hint">
                {attemptedClose
                  ? t('Save to keep your changes.', 'احفظ للاحتفاظ بالتغييرات.')
                  : t('Changes apply when you save.', 'تُطبّق التغييرات عند الحفظ.')}
              </span>
              <button
                type="button"
                className="builder-button"
                disabled={createBusy}
                onClick={askToClose}
              >
                {t('Cancel', 'إلغاء')}
              </button>
              <button
                type="button"
                className="builder-button primary"
                disabled={createBusy}
                onClick={save}
              >
                <Icon name="check" />
                {t('Save inventory setup', 'حفظ إعداد المخزون')}
              </button>
            </footer>
          )}
          {copyTo !== null && destination && sources.length > 0 && (
            <CopyInventoryDialog
              destination={destination}
              sources={sources}
              variants={variants}
              stockItems={stockItems}
              mode={draftMode}
              text={t}
              onClose={() => setCopyTo(null)}
              onApply={(components) => {
                updateTarget(destination.variantId, components);
                setSelectedId(destination.variantId);
              }}
            />
          )}
        </Dialog>
      )}
    </div>
  );
}
