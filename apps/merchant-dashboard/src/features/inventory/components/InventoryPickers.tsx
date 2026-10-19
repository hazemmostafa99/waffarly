import { useState } from 'react';
import type { InventoryWarehouseSummary, StockBaseUnit, StockItem } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { Link } from 'react-router-dom';
import { PagedEntitySelect } from '../../../components/PagedEntitySelect.js';
import { CreateStockItemDialog } from './CreateStockItemDialog.js';
import { stockUnitLabel } from '../stock-unit-options.js';

export function StockItemPicker({
  value,
  label,
  onSelect,
  onResolve,
  disabled = false,
  allowCreate = false,
  createBaseUnit = 'piece',
  onRequestCreate,
}: {
  value: string;
  label: string;
  onSelect: (item: StockItem | null) => void;
  onResolve?: (item: StockItem) => void;
  disabled?: boolean;
  allowCreate?: boolean;
  createBaseUnit?: StockBaseUnit;
  onRequestCreate?: ((search: string) => void) | undefined;
}) {
  const { locale } = useLocale();
  const [creatingName, setCreatingName] = useState<string | null>(null);
  return (
    <>
      <PagedEntitySelect<StockItem>
        path="/owner/inventory/items"
        value={value}
        label={label}
        searchMode="combobox"
        emptyLabel={locale === 'ar' ? 'اختر صنف المخزون' : 'Choose a stock item'}
        emptyState={
          <span>
            {locale === 'ar' ? 'لا توجد أصناف مخزون نشطة.' : 'No active stock items yet.'}{' '}
            {!allowCreate && (
              <Link className="entity-picker-empty-action" to="/inventory/items?new=1">
                {locale === 'ar' ? 'إضافة صنف مخزون' : 'Add a stock item'}
              </Link>
            )}
          </span>
        }
        onSelect={onSelect}
        onResolve={onResolve}
        disabled={disabled}
        optionLabel={(item) => `${item.name} (${stockUnitLabel(item.baseUnit, locale)})`}
        onCreate={allowCreate ? (onRequestCreate ?? setCreatingName) : undefined}
        createLabel={locale === 'ar' ? 'إنشاء صنف مخزون جديد' : 'Create a new stock item'}
      />
      {!onRequestCreate && creatingName !== null && (
        <CreateStockItemDialog
          initialName={creatingName}
          defaultUnit={createBaseUnit}
          onCreated={(item) => {
            onResolve?.(item);
            onSelect(item);
          }}
          onClose={() => setCreatingName(null)}
        />
      )}
    </>
  );
}

export function WarehousePicker({
  value,
  label,
  onSelect,
  onResolve,
  disabled = false,
  required = true,
  emptyLabel,
}: {
  value: string;
  label: string;
  onSelect: (warehouse: InventoryWarehouseSummary | null) => void;
  onResolve?: (warehouse: InventoryWarehouseSummary) => void;
  disabled?: boolean;
  required?: boolean;
  emptyLabel?: string;
}) {
  return (
    <PagedEntitySelect<InventoryWarehouseSummary>
      path="/owner/inventory/warehouses"
      value={value}
      label={label}
      onSelect={onSelect}
      onResolve={onResolve}
      disabled={disabled}
      required={required}
      emptyLabel={emptyLabel}
      optionLabel={(warehouse) => `${warehouse.branchName} · ${warehouse.name}`}
    />
  );
}
