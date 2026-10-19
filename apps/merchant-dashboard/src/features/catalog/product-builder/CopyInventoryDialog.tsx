import { useRef, useState } from 'react';
import { Dialog, useLocale } from '@waffarly/ui';
import type { ProductInventoryMode, StockItem } from '@waffarly/contracts';
import { Icon } from '../../../Icons.js';
import type {
  ProductInventoryComponentDraft,
  ProductInventoryTargetDraft,
} from './ProductInventoryTab.js';
import { InventoryQuantityField } from './InventoryQuantityField.js';
import { inventoryTargetComplete } from './product-inventory.js';

export function CopyInventoryDialog({
  destination,
  sources,
  variants,
  stockItems,
  mode,
  onApply,
  onClose,
  text,
}: {
  destination: ProductInventoryTargetDraft;
  sources: ProductInventoryTargetDraft[];
  variants: Array<{ id: string; name: string }>;
  stockItems: StockItem[];
  mode: ProductInventoryMode;
  onApply: (components: ProductInventoryComponentDraft[]) => void;
  onClose: () => void;
  text: (english: string, arabic: string) => string;
}) {
  const { formatDigits } = useLocale();
  const [sourceId, setSourceId] = useState(sources[0]?.variantId ?? '');
  const [components, setComponents] = useState(() => structuredClone(sources[0]?.components ?? []));
  const [attempted, setAttempted] = useState(false);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const name = (id: string | null) =>
    variants.find((variant) => variant.id === id)?.name || text('Unnamed size', 'حجم بدون اسم');
  const replace = destination.components.some((component) => component.stockItemId);
  function apply() {
    setAttempted(true);
    const invalid = components.findIndex(
      (component) =>
        !inventoryTargetComplete(
          { variantId: destination.variantId, components: [component] },
          mode,
          stockItems,
        ),
    );
    if (!components.length || invalid >= 0) {
      inputs.current.get(Math.max(0, invalid))?.focus();
      return;
    }
    onApply(structuredClone(components));
    onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={text('Copy from another size', 'نسخ من حجم آخر')}
      description={text(
        `Review the quantities before applying them to ${name(destination.variantId)}.`,
        `راجع الكميات قبل تطبيقها على ${name(destination.variantId)}.`,
      )}
      closeLabel={text('Close', 'إغلاق')}
      className="choice-composer-dialog inventory-copy-dialog"
    >
      <div className="inventory-copy-content">
        <fieldset className="inventory-copy-sources">
          <legend>{text('Copy from', 'انسخ من')}</legend>
          {sources.map((source) => (
            <label
              className={sourceId === source.variantId ? 'is-selected' : ''}
              key={source.variantId}
            >
              <input
                type="radio"
                name="inventory-copy-source"
                checked={sourceId === source.variantId}
                onChange={() => {
                  setSourceId(source.variantId ?? '');
                  setComponents(structuredClone(source.components));
                  setAttempted(false);
                }}
              />
              <span>{name(source.variantId)}</span>
              <small>
                {formatDigits(String(source.components.length))} {text('items', 'أصناف')}
              </small>
            </label>
          ))}
        </fieldset>
        <p className="inventory-setup-note">
          {text(
            'Quantities are copied as entered. Adjust them to suit this size.',
            'تُنسخ الكميات كما هي. عدّلها لتناسب هذا الحجم.',
          )}
        </p>
        <div className="inventory-copy-rows">
          {components.map((component, index) => {
            const item = stockItems.find((entry) => entry.id === component.stockItemId);
            return (
              <div className="inventory-copy-row" key={`${sourceId}-${index}`}>
                <strong>{item?.name ?? text('Loading item…', 'جارٍ تحميل الصنف…')}</strong>
                <InventoryQuantityField
                  item={item}
                  quantity={component.quantity}
                  unitCode={component.unitCode}
                  label={`${text('Quantity', 'الكمية')}: ${item?.name ?? index + 1}`}
                  showErrors={attempted}
                  inputRef={(element) => {
                    if (element) inputs.current.set(index, element);
                    else inputs.current.delete(index);
                  }}
                  onQuantityChange={(quantity) =>
                    setComponents((current) =>
                      current.map((entry, position) =>
                        position === index ? { ...entry, quantity } : entry,
                      ),
                    )
                  }
                  onUnitChange={(unitCode) =>
                    setComponents((current) =>
                      current.map((entry, position) =>
                        position === index ? { ...entry, unitCode } : entry,
                      ),
                    )
                  }
                />
              </div>
            );
          })}
        </div>
        {replace && (
          <p className="inventory-setup-note">
            {text(
              'Applying will replace the current ingredients for this size.',
              'التطبيق سيستبدل المكونات الحالية لهذا الحجم.',
            )}
          </p>
        )}
      </div>
      <footer className="choice-composer-footer">
        <button type="button" className="builder-button primary" onClick={apply}>
          <Icon name="check" />
          {replace
            ? text('Copy and replace ingredients', 'نسخ واستبدال المكونات')
            : text('Apply ingredients', 'تطبيق المكونات')}
        </button>
        <button type="button" className="builder-button" onClick={onClose}>
          {text('Cancel', 'إلغاء')}
        </button>
      </footer>
    </Dialog>
  );
}
