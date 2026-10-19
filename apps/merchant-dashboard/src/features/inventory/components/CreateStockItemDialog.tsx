import { useRef, useState } from 'react';
import {
  STOCK_BASE_UNITS,
  type CreateStockItemRequest,
  type StockBaseUnit,
  type StockItem,
} from '@waffarly/contracts';
import { Dialog, useLocale } from '@waffarly/ui';
import { Icon } from '../../../Icons.js';
import { apiRequest } from '../../../lib/api-client.js';
import { stockUnitLabel } from '../stock-unit-options.js';

export function CreateStockItemDialog({
  initialName,
  defaultUnit,
  onCreated,
  onClose,
}: {
  initialName: string;
  defaultUnit: StockBaseUnit;
  onCreated: (item: StockItem) => void;
  onClose: () => void;
}) {
  const { locale, errorText } = useLocale();
  const text = (english: string, arabic: string) => (locale === 'ar' ? arabic : english);
  const [name, setName] = useState(initialName);
  const [baseUnit, setBaseUnit] = useState<StockBaseUnit>(defaultUnit);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  const request = useRef<CreateStockItemRequest | null>(null);
  const saving = useRef(false);
  async function create() {
    if (saving.current) return;
    setAttempted(true);
    if (!name.trim()) {
      nameInput.current?.focus();
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    if (
      !request.current ||
      request.current.name !== name.trim() ||
      request.current.baseUnit !== baseUnit
    ) {
      request.current = { requestId: crypto.randomUUID(), name: name.trim(), baseUnit, units: [] };
    }
    try {
      const item = await apiRequest<StockItem>('/owner/inventory/items', {
        method: 'POST',
        body: JSON.stringify(request.current),
      });
      onCreated(item);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not create this stock item.', 'تعذر إنشاء صنف المخزون.'),
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={text('Create a stock item', 'إنشاء صنف مخزون')}
      description={text(
        'Create it here and continue configuring the product.',
        'أنشئ الصنف هنا وأكمل إعداد المنتج مباشرة.',
      )}
      closeLabel={text('Close', 'إغلاق')}
      className="choice-composer-dialog stock-item-quick-dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <div className="stock-item-quick-fields" aria-busy={busy}>
          <label className="builder-field">
            <span>{text('Stock item name', 'اسم صنف المخزون')}</span>
            <input
              autoFocus
              ref={nameInput}
              maxLength={160}
              value={name}
              disabled={busy}
              aria-invalid={attempted && !name.trim()}
              onChange={(event) => setName(event.target.value)}
              placeholder={text('e.g. Burger patty', 'مثال: لحم برجر')}
            />
            {attempted && !name.trim() && (
              <small className="choice-field-error">
                {text('Enter a name for this item.', 'اكتب اسم الصنف.')}
              </small>
            )}
          </label>
          <label className="builder-field">
            <span>{text('Base unit', 'وحدة القياس الأساسية')}</span>
            <div className="inventory-unit-select">
              <select
                value={baseUnit}
                disabled={busy}
                onChange={(event) => setBaseUnit(event.target.value as StockBaseUnit)}
              >
                {STOCK_BASE_UNITS.map((unit) => (
                  <option value={unit} key={unit}>
                    {stockUnitLabel(unit, locale)} ({unit})
                  </option>
                ))}
              </select>
              <Icon name="chevron" />
            </div>
            <small>
              {text(
                'Choose the unit you use to measure this item. Its base unit cannot be changed later.',
                'اختر الوحدة التي تقيس بها الصنف. لا يمكن تغيير الوحدة الأساسية لاحقًا.',
              )}
            </small>
          </label>
          <p className="inventory-setup-note">
            {text(
              'Creating an item does not add stock. Add starting stock or a purchase from Inventory when ready.',
              'إنشاء الصنف لا يضيف كميات للمخزون. يمكنك إضافة رصيد أولي أو مشتريات من صفحة المخزون.',
            )}
          </p>
          {error && (
            <p className="choice-field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="choice-composer-footer">
          <button type="submit" className="builder-button primary" disabled={busy}>
            <Icon name="plus" />
            {busy
              ? text('Creating…', 'جارٍ الإنشاء…')
              : text('Create and select', 'إنشاء واختيار الصنف')}
          </button>
          <button type="button" className="builder-button" disabled={busy} onClick={onClose}>
            {text('Cancel', 'إلغاء')}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
