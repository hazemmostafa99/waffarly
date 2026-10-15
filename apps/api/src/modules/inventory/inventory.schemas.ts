import { isPositiveStockQuantity, STOCK_BASE_UNITS, STOCK_CONDITIONS } from '@waffarly/contracts';
import { z } from 'zod';
import { normalizeStockQuantity } from './stock-quantity.js';

const quantity = z
  .string()
  .refine(
    isPositiveStockQuantity,
    'Quantity must be positive with up to 12 integer and 6 fractional digits.',
  );
const code = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_-]{0,31}$/);
const packSchema = z
  .object({
    code: code.refine(
      (value) => !(STOCK_BASE_UNITS as readonly string[]).includes(value),
      'Standard unit codes cannot be redefined.',
    ),
    name: z.string().trim().min(1).max(80),
    baseQuantity: quantity.transform(normalizeStockQuantity),
  })
  .strict();
const packs = z
  .array(packSchema)
  .max(20)
  .refine(
    (values) => new Set(values.map((value) => value.code)).size === values.length,
    'Pack unit codes must be unique within an item.',
  );
const itemFields = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
};
const revision = z.number().int().positive().max(2_147_483_646);

export const createStockItemSchema = z
  .object({
    requestId: z.string().uuid(),
    ...itemFields,
    baseUnit: z.enum(STOCK_BASE_UNITS),
    units: packs.optional(),
  })
  .strict();
export const updateStockItemSchema = z
  .object({
    revision,
    ...itemFields,
    additionalUnits: packs.optional(),
  })
  .strict();
export const stockItemRevisionSchema = z.object({ revision }).strict();
export const convertStockItemSchema = z.object({ quantity, unitCode: code }).strict();
export const listStockItemsSchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).default(''),
    status: z.enum(['active', 'archived', 'all']).default('active'),
  })
  .strict();
export type StockItemListQuery = z.infer<typeof listStockItemsSchema>;

const uuid = z.string().uuid();
const positiveRevision = z.number().int().positive().max(2_147_483_646);
const optionalAddress = z.string().trim().max(500).optional();
const locationName = z.string().trim().min(1).max(160);

export const listInventoryBranchesSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).default(''),
    status: z.enum(['active', 'archived', 'all']).default('active'),
  })
  .strict();
export type InventoryBranchListQuery = z.infer<typeof listInventoryBranchesSchema>;

export const createInventoryBranchSchema = z
  .object({
    name: locationName,
    address: optionalAddress,
    defaultWarehouseName: locationName.default('Main warehouse'),
  })
  .strict();
export const updateInventoryBranchSchema = z
  .object({ revision: positiveRevision, name: locationName, address: optionalAddress })
  .strict();
export const createInventoryWarehouseSchema = z
  .object({ revision: positiveRevision, name: locationName })
  .strict();
export const updateInventoryWarehouseSchema = z
  .object({ revision: positiveRevision, name: locationName })
  .strict();
export const setDefaultConsumptionWarehouseSchema = z
  .object({ revision: positiveRevision, warehouseId: uuid })
  .strict();
export const inventoryPolicyUpdateSchema = z
  .object({ revision: positiveRevision, negativeStockPolicy: z.enum(['allow', 'prevent']) })
  .strict();

export const listStockBalancesSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    branchId: uuid.optional(),
    warehouseId: uuid.optional(),
    stockItemId: uuid.optional(),
    condition: z.enum(STOCK_CONDITIONS).optional(),
    search: z.string().trim().max(160).default(''),
  })
  .strict();
export type StockBalanceListQuery = z.infer<typeof listStockBalancesSchema>;

export const listStockMovementsSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    branchId: uuid.optional(),
    warehouseId: uuid.optional(),
    stockItemId: uuid.optional(),
    condition: z.enum(STOCK_CONDITIONS).optional(),
    kind: z.string().trim().min(1).max(32).optional(),
  })
  .strict();
export type StockMovementListQuery = z.infer<typeof listStockMovementsSchema>;

export const createStockOpeningSchema = z
  .object({
    requestId: uuid,
    reason: z.string().trim().min(3).max(500),
    lines: z
      .array(
        z
          .object({
            warehouseId: uuid,
            stockItemId: uuid,
            condition: z.enum(STOCK_CONDITIONS),
            quantity,
            unitCode: code,
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine(
        (lines) =>
          new Set(lines.map((line) => `${line.warehouseId}:${line.stockItemId}:${line.condition}`))
            .size === lines.length,
        'Opening balance lines must not repeat the same item, warehouse, and condition.',
      ),
  })
  .strict();
export type StockOpeningRequest = z.infer<typeof createStockOpeningSchema>;
