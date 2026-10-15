import { StockItemPicker } from '../../inventory/components/InventoryPickers.js';
import { stockUnitOptions } from '../../inventory/stock-unit-options.js';
import type { ProductInventoryMode, StockItem } from '@waffarly/contracts';

export interface ProductInventoryComponentDraft {
  stockItemId: string;
  unitCode: string;
  quantity: string;
}

export interface ProductInventoryTargetDraft {
  variantId: string | null;
  components: ProductInventoryComponentDraft[];
}

export function ProductInventoryTab({
  enabled,
  onEnabledChange,
  mode,
  onModeChange,
  defaultMode,
  required,
  availability,
  stockItems,
  targets,
  variants,
  onTargetChange,
  onStockItemLoaded,
  text,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  mode: ProductInventoryMode;
  onModeChange: (mode: ProductInventoryMode) => void;
  defaultMode: ProductInventoryMode;
  required: boolean;
  availability: 'available' | 'unavailable';
  stockItems: StockItem[];
  targets: ProductInventoryTargetDraft[];
  variants: Array<{ id: string; name: string }>;
  onTargetChange: (variantId: string | null, components: ProductInventoryComponentDraft[]) => void;
  onStockItemLoaded: (item: StockItem) => void;
  text: (english: string, arabic: string) => string;
}) {
  const variantNames = new Map(variants.map((variant) => [variant.id, variant.name]));
  return (
    <div className="builder-fields">
      <div className="builder-section-heading">
        <span>04</span>
        <div>
          <h2>{text('Inventory setup', 'إعداد المخزون')}</h2>
          <p>
            {text(
              `This product defaults to ${defaultMode === 'RECIPE' ? 'recipe ingredients' : 'direct item mapping'}. Variant targets are configured independently.`,
              `الإعداد الافتراضي لهذا النشاط هو ${defaultMode === 'RECIPE' ? 'مكونات الوصفة' : 'ربط مباشر بالصنف'}. يُعد كل متغير بشكل مستقل.`,
            )}
          </p>
        </div>
      </div>

      {availability === 'available' && required && !enabled && (
        <p className="builder-hint" role="status">
          {text(
            'Complete inventory setup before making this new product available. Existing products without a setup remain unchanged.',
            'أكمل إعداد المخزون قبل إتاحة المنتج الجديد. تظل المنتجات الحالية التي لم تُعدّ كما هي.',
          )}
        </p>
      )}

      <label className="builder-inventory-enable">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
        <span>
          <strong>{text('Configure inventory for this product', 'إعداد مخزون هذا المنتج')}</strong>
          <small>
            {text(
              'You can save a new product as unavailable and complete this later.',
              'يمكنك حفظ المنتج الجديد كغير متاح وإكمال الإعداد لاحقًا.',
            )}
          </small>
        </span>
      </label>

      {enabled && (
        <>
          <fieldset className="builder-inventory-mode">
            <legend>{text('Inventory mode', 'طريقة احتساب المخزون')}</legend>
            <label>
              <input
                type="radio"
                name="product-inventory-mode"
                checked={mode === 'DIRECT'}
                onChange={() => onModeChange('DIRECT')}
              />
              <span>
                <strong>{text('Direct item', 'صنف مباشر')}</strong>
                <small>
                  {text(
                    'One Stock Item is used for each sale.',
                    'يُستهلك صنف مخزون واحد مع كل عملية بيع.',
                  )}
                </small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="product-inventory-mode"
                checked={mode === 'RECIPE'}
                onChange={() => onModeChange('RECIPE')}
              />
              <span>
                <strong>{text('Recipe', 'وصفة')}</strong>
                <small>
                  {text(
                    'Combine ingredients for each sale.',
                    'اجمع المكونات المطلوبة لكل عملية بيع.',
                  )}
                </small>
              </span>
            </label>
          </fieldset>

          <div className="builder-inventory-targets">
            {targets.map((target, targetIndex) => {
              const label = target.variantId
                ? (variantNames.get(target.variantId) ?? text('Product variant', 'متغير المنتج'))
                : text('Product', 'المنتج');
              return (
                <section className="builder-inventory-target" key={target.variantId ?? 'product'}>
                  <div className="builder-inventory-target-heading">
                    <span>
                      {text(`Sellable ${targetIndex + 1}`, `وحدة البيع ${targetIndex + 1}`)}
                    </span>
                    <h3>{label}</h3>
                  </div>
                  {target.components.map((component, componentIndex) => {
                    const item = stockItems.find(
                      (candidate) => candidate.id === component.stockItemId,
                    );
                    const codes = item ? stockUnitOptions(item) : [];
                    return (
                      <div
                        className="builder-inventory-component"
                        key={`${target.variantId ?? 'product'}-${componentIndex}`}
                      >
                        <div className="builder-field">
                          <span>
                            {text(
                              mode === 'RECIPE' ? 'Ingredient' : 'Stock Item',
                              mode === 'RECIPE' ? 'المكوّن' : 'صنف المخزون',
                            )}
                          </span>
                          <StockItemPicker
                            value={component.stockItemId}
                            label={text('Stock Item', 'صنف المخزون')}
                            onResolve={onStockItemLoaded}
                            onSelect={(selected) => {
                              if (selected) onStockItemLoaded(selected);
                              updateComponent(
                                target,
                                componentIndex,
                                {
                                  stockItemId: selected?.id ?? '',
                                  unitCode: selected?.baseUnit ?? '',
                                },
                                onTargetChange,
                              );
                            }}
                          />
                        </div>
                        <label className="builder-field">
                          <span>{text('Unit', 'الوحدة')}</span>
                          <select
                            value={component.unitCode}
                            disabled={!item}
                            onChange={(event) =>
                              updateComponent(
                                target,
                                componentIndex,
                                { unitCode: event.target.value },
                                onTargetChange,
                              )
                            }
                          >
                            <option value="">{text('Choose a unit', 'اختر وحدة')}</option>
                            {codes.map((unit) => (
                              <option value={unit.code} key={unit.code}>
                                {unit.name} · {unit.code}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="builder-field">
                          <span>{text('Quantity per sale', 'الكمية لكل عملية بيع')}</span>
                          <input
                            inputMode="decimal"
                            value={component.quantity}
                            onChange={(event) =>
                              updateComponent(
                                target,
                                componentIndex,
                                { quantity: event.target.value },
                                onTargetChange,
                              )
                            }
                            placeholder="1"
                          />
                        </label>
                        {mode === 'RECIPE' && target.components.length > 1 && (
                          <button
                            type="button"
                            className="builder-remove-button"
                            aria-label={text(
                              `Remove ingredient ${componentIndex + 1}`,
                              `حذف المكوّن ${componentIndex + 1}`,
                            )}
                            onClick={() =>
                              onTargetChange(
                                target.variantId,
                                target.components.filter((_, index) => index !== componentIndex),
                              )
                            }
                          >
                            {text('Remove', 'حذف')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {mode === 'RECIPE' && (
                    <button
                      type="button"
                      className="builder-button ghost"
                      onClick={() =>
                        onTargetChange(target.variantId, [
                          ...target.components,
                          { stockItemId: '', unitCode: '', quantity: '1' },
                        ])
                      }
                    >
                      {text('Add ingredient', 'إضافة مكوّن')}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function updateComponent(
  target: ProductInventoryTargetDraft,
  index: number,
  update: Partial<ProductInventoryComponentDraft>,
  onTargetChange: (variantId: string | null, components: ProductInventoryComponentDraft[]) => void,
) {
  onTargetChange(
    target.variantId,
    target.components.map((component, componentIndex) =>
      componentIndex === index ? { ...component, ...update } : component,
    ),
  );
}
