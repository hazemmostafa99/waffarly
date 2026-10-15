import type { InventoryWarehouseSummary, StockItem } from '@waffarly/contracts';
import { PagedEntitySelect } from '../../../components/PagedEntitySelect.js';

export function StockItemPicker({
  value,
  label,
  onSelect,
  onResolve,
  disabled = false,
}: {
  value: string;
  label: string;
  onSelect: (item: StockItem | null) => void;
  onResolve?: (item: StockItem) => void;
  disabled?: boolean;
}) {
  return (
    <PagedEntitySelect<StockItem>
      path="/owner/inventory/items"
      value={value}
      label={label}
      onSelect={onSelect}
      onResolve={onResolve}
      disabled={disabled}
      optionLabel={(item) => `${item.name} (${item.baseUnit})`}
    />
  );
}

export function WarehousePicker({
  value,
  label,
  onSelect,
  onResolve,
  disabled = false,
}: {
  value: string;
  label: string;
  onSelect: (warehouse: InventoryWarehouseSummary | null) => void;
  onResolve?: (warehouse: InventoryWarehouseSummary) => void;
  disabled?: boolean;
}) {
  return (
    <PagedEntitySelect<InventoryWarehouseSummary>
      path="/owner/inventory/warehouses"
      value={value}
      label={label}
      onSelect={onSelect}
      onResolve={onResolve}
      disabled={disabled}
      optionLabel={(warehouse) => `${warehouse.branchName} · ${warehouse.name}`}
    />
  );
}
