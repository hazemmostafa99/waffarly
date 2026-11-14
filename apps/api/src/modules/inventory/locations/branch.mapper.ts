/** Describes the saved branch and warehouse details shown to the owner. */
import type { InventoryBranch, InventoryWarehouse } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

export const branchInclude = {
  warehouses: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.BranchInclude;

export const MAX_WAREHOUSES_PER_BRANCH = 100;

export type BranchRecord = Prisma.BranchGetPayload<{ include: typeof branchInclude }>;

export function toBranch(record: BranchRecord): InventoryBranch {
  const warehouses: InventoryWarehouse[] = record.warehouses.map((warehouse) => ({
    id: warehouse.id,
    branchId: warehouse.branchId,
    name: warehouse.name,
    isDefaultConsumption: warehouse.isDefaultConsumption && !warehouse.archivedAt,
    archivedAt: warehouse.archivedAt?.toISOString() ?? null,
    revision: warehouse.revision,
    createdAt: warehouse.createdAt.toISOString(),
    updatedAt: warehouse.updatedAt.toISOString(),
  }));
  return {
    id: record.id,
    name: record.name,
    address: record.address,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    revision: record.revision,
    defaultConsumptionWarehouseId:
      warehouses.find((warehouse) => warehouse.isDefaultConsumption)?.id ?? null,
    warehouses,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
