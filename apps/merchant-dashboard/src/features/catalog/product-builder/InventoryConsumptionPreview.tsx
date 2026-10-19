import { useLocale } from '@waffarly/ui';
import type { ProductInventoryMode, StockItem } from '@waffarly/contracts';
import type { ProductInventoryTargetDraft } from './ProductInventoryTab.js';
import { inventoryTargetComplete } from './product-inventory.js';
import { stockUnitLabel, stockUnitOptions } from '../../inventory/stock-unit-options.js';

export function InventoryConsumptionPreview({
  name,
  enabled,
  mode,
  targets,
  stockItems,
  variants,
  selectedId,
  onSelect,
  text,
}: {
  name: string;
  enabled: boolean;
  mode: ProductInventoryMode;
  targets: ProductInventoryTargetDraft[];
  stockItems: StockItem[];
  variants: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  text: (english: string, arabic: string) => string;
}) {
  const { locale, formatDigits } = useLocale();
  const target = targets.find((entry) => entry.variantId === selectedId) ?? targets[0];
  const selectedName =
    variants.find((variant) => variant.id === target?.variantId)?.name ||
    name ||
    text('This product', 'هذا المنتج');
  const components = target?.components.filter((component) => component.stockItemId) ?? [];
  const ready = target && inventoryTargetComplete(target, mode, stockItems);
  return (
    <aside
      className="product-preview-card inventory-consumption-preview"
      aria-label={text('Stock consumption summary', 'ملخص استهلاك المخزون')}
    >
      <span className="inventory-summary-eyebrow">
        {text('Stock consumption', 'استهلاك المخزون')}
      </span>
      <h3>{name || text('This product', 'هذا المنتج')}</h3>
      {!enabled ? (
        <p className="inventory-setup-note">
          {text(
            'Enable inventory linking to choose what is deducted for each sale.',
            'فعّل ربط المخزون لتحديد ما يُخصم مع كل عملية بيع.',
          )}
        </p>
      ) : (
        <>
          {variants.length > 1 && (
            <div
              className="inventory-preview-tabs"
              aria-label={text('Preview size', 'معاينة الحجم')}
            >
              {variants.map((variant) => (
                <button
                  type="button"
                  key={variant.id}
                  aria-pressed={target?.variantId === variant.id}
                  onClick={() => onSelect(variant.id)}
                >
                  {variant.name || text('Unnamed size', 'حجم بدون اسم')}
                </button>
              ))}
            </div>
          )}
          <p>
            {text(
              `For one sale of ${selectedName}, deduct:`,
              `عند بيع وحدة واحدة من ${selectedName}، يُخصم:`,
            )}
          </p>
          {components.length ? (
            <ul className="inventory-consumption-list">
              {components.map((component, index) => {
                const item = stockItems.find((entry) => entry.id === component.stockItemId);
                return (
                  <li key={index}>
                    <span>{item?.name ?? text('Loading item…', 'جارٍ تحميل الصنف…')}</span>
                    <strong dir="auto">
                      {component.quantity && component.unitCode ? (
                        <>
                          {formatDigits(component.quantity)}{' '}
                          {stockUnitLabel(
                            component.unitCode,
                            locale,
                            stockUnitOptions(item).find((unit) => unit.code === component.unitCode)
                              ?.name,
                          )}
                        </>
                      ) : (
                        text('Enter quantity', 'أدخل الكمية')
                      )}
                    </strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="inventory-summary-empty">
              {text(
                'Choose your first stock item to see consumption here.',
                'اختر أول صنف مخزون ليظهر استهلاكه هنا.',
              )}
            </div>
          )}
          <span className={`inventory-status${ready ? ' is-ready' : ''}`}>
            {ready
              ? text('This setup is ready', 'الإعداد جاهز')
              : text('Complete the items and quantities', 'أكمل الأصناف والكميات')}
          </span>
          <p className="inventory-setup-note">
            {text(
              'Base ingredient quantities for one sale.',
              'كميات المكونات الأساسية لعملية بيع واحدة.',
            )}
          </p>
        </>
      )}
    </aside>
  );
}
