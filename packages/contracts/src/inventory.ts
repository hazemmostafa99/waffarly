export const STOCK_BASE_UNITS = ['piece', 'g', 'kg', 'ml', 'l'] as const;
export type StockBaseUnit = (typeof STOCK_BASE_UNITS)[number];

export interface StockItemUnitFields {
  code: string;
  name: string;
  /** Positive decimal string: one of this unit equals this many base units. */
  baseQuantity: string;
}

export interface StockItemUnit extends StockItemUnitFields {
  id: string;
}

export interface StockItem {
  id: string;
  name: string;
  description: string | null;
  baseUnit: StockBaseUnit;
  units: StockItemUnit[];
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockItemRequest {
  requestId: string;
  name: string;
  description?: string | undefined;
  baseUnit: StockBaseUnit;
  units?: StockItemUnitFields[] | undefined;
}

export interface UpdateStockItemRequest {
  revision: number;
  name: string;
  description?: string | undefined;
  /** Existing units are immutable. Only new pack units may be appended. */
  additionalUnits?: StockItemUnitFields[] | undefined;
}

export interface StockItemRevisionRequest {
  revision: number;
}

export interface StockItemConversionRequest {
  quantity: string;
  unitCode: string;
}

export interface StockItemConversion {
  itemId: string;
  quantity: string;
  unitCode: string;
  baseUnit: StockBaseUnit;
  baseQuantity: string;
}

export const STOCK_CONDITIONS = ['available', 'non_sellable'] as const;
export type StockCondition = (typeof STOCK_CONDITIONS)[number];
export type NegativeStockPolicy = 'allow' | 'prevent';

export interface InventoryWarehouse {
  id: string;
  branchId: string;
  name: string;
  isDefaultConsumption: boolean;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBranch {
  id: string;
  name: string;
  address: string | null;
  archivedAt: string | null;
  revision: number;
  defaultConsumptionWarehouseId: string | null;
  warehouses: InventoryWarehouse[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryBranchRequest {
  name: string;
  address?: string | undefined;
  defaultWarehouseName?: string | undefined;
}

export interface UpdateInventoryBranchRequest {
  revision: number;
  name: string;
  address?: string | undefined;
}

export interface CreateInventoryWarehouseRequest {
  revision: number;
  name: string;
}

export interface UpdateInventoryWarehouseRequest {
  revision: number;
  name: string;
}

export interface SetDefaultConsumptionWarehouseRequest {
  revision: number;
  warehouseId: string;
}

export interface InventoryPolicy {
  negativeStockPolicy: NegativeStockPolicy;
  revision: number;
  updatedAt: string | null;
}

export interface UpdateInventoryPolicyRequest {
  revision: number;
  negativeStockPolicy: NegativeStockPolicy;
}

export interface StockBalance {
  id: string;
  warehouseId: string;
  warehouseName: string;
  branchId: string;
  branchName: string;
  stockItemId: string;
  stockItemName: string;
  baseUnit: StockBaseUnit;
  condition: StockCondition;
  quantity: string;
  updatedAt: string;
}

export interface StockOpeningLineRequest {
  warehouseId: string;
  stockItemId: string;
  condition: StockCondition;
  quantity: string;
  unitCode: string;
}

export interface CreateStockOpeningRequest {
  requestId: string;
  reason: string;
  lines: StockOpeningLineRequest[];
}

export interface StockMovement {
  id: string;
  batchId: string;
  kind: string;
  sourceType: string;
  sourceId: string;
  reason: string;
  warehouseId: string;
  warehouseName: string;
  branchId: string;
  branchName: string;
  stockItemId: string;
  stockItemName: string;
  baseUnit: StockBaseUnit;
  condition: StockCondition;
  unitCode: string;
  enteredQuantity: string;
  baseDelta: string;
  actor: string;
  createdAt: string;
}

export interface StockMovementBatchResult {
  id: string;
  kind: string;
  reason: string;
  createdAt: string;
  replayed: boolean;
  movements: StockMovement[];
}
