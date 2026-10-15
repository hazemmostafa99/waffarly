import { NotFoundException } from '@nestjs/common';
import type { CreatePurchaseInvoiceRequest } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { convertToBaseQuantity, normalizeStockQuantity } from '../../inventory/index.js';
import type { InvoiceRecord } from '../purchase-invoice.mapper.js';

export async function resolveInvoiceReferences(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  input: Pick<
    CreatePurchaseInvoiceRequest,
    'supplierId' | 'supplierInvoiceNumber' | 'warehouseId' | 'lines'
  >,
) {
  await lockSupplier(transaction, merchantId, input.supplierId);
  const supplier = await transaction.purchaseSupplier.findFirst({
    where: { id: input.supplierId, merchantId, archivedAt: null },
  });
  if (!supplier) throw new NotFoundException('Active supplier was not found.');

  const location = await transaction.warehouse.findFirst({
    where: { id: input.warehouseId, merchantId },
    select: { branchId: true },
  });
  if (!location) throw new NotFoundException('Warehouse was not found.');
  await lockBranch(transaction, merchantId, location.branchId);
  await lockWarehouse(transaction, merchantId, input.warehouseId);
  const warehouse = await transaction.warehouse.findFirst({
    where: {
      id: input.warehouseId,
      merchantId,
      archivedAt: null,
      branch: { archivedAt: null },
    },
    include: { branch: true },
  });
  if (!warehouse) throw new NotFoundException('Active warehouse was not found.');

  const itemIds = [...new Set(input.lines.map((line) => line.stockItemId))].sort();
  const items = await transaction.stockItem.findMany({
    where: { merchantId, id: { in: itemIds }, archivedAt: null },
    include: { units: true },
  });
  if (items.length !== itemIds.length)
    throw new NotFoundException('Active stock item was not found.');
  const itemById = new Map(items.map((item) => [item.id, item]));
  const lines = input.lines.map((line, position) => {
    const item = itemById.get(line.stockItemId)!;
    const quantity = normalizeStockQuantity(line.quantity);
    convertToBaseQuantity(
      quantity,
      line.unitCode,
      item.baseUnit as Parameters<typeof convertToBaseQuantity>[2],
      item.units.map((unit) => ({
        code: unit.code,
        name: unit.name,
        baseQuantity: unit.baseQuantity.toFixed(6),
      })),
    );
    const pack = item.units.find((unit) => unit.code === line.unitCode);
    return {
      stockItemId: item.id,
      stockItemName: item.name,
      baseUnit: item.baseUnit,
      unitCode: line.unitCode,
      unitName: pack?.name ?? line.unitCode,
      condition: line.condition,
      quantity,
      position,
    };
  });
  const supplierInvoiceNumber = input.supplierInvoiceNumber?.trim() || null;
  return {
    supplier,
    warehouse,
    supplierInvoiceNumber,
    supplierInvoiceNumberKey: supplierInvoiceNumber
      ? supplierInvoiceNumber.toLocaleLowerCase('en-US')
      : null,
    lines,
  };
}

export async function resolveReceiptReferences(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  invoice: InvoiceRecord,
) {
  const itemIds = [...new Set(invoice.lines.map((line) => line.stockItemId))].sort();
  const items = await transaction.stockItem.findMany({
    where: {
      merchantId,
      id: { in: itemIds },
      ...(invoice.status === 'draft' ? { archivedAt: null } : {}),
    },
    include: { units: true },
  });
  if (items.length !== itemIds.length) throw new NotFoundException('Stock item was not found.');
  const itemById = new Map(items.map((item) => [item.id, item]));
  const baseDeltas = new Map<string, string>();
  for (const line of invoice.lines) {
    const item = itemById.get(line.stockItemId)!;
    baseDeltas.set(
      line.id,
      convertToBaseQuantity(
        normalizeStockQuantity(line.quantity.toFixed(6)),
        line.unitCode,
        item.baseUnit as Parameters<typeof convertToBaseQuantity>[2],
        item.units.map((unit) => ({
          code: unit.code,
          name: unit.name,
          baseQuantity: unit.baseQuantity.toFixed(6),
        })),
      ),
    );
  }

  if (invoice.status === 'confirmed') {
    return {
      items: itemById,
      baseDeltas,
      supplierName: invoice.supplierName,
      warehouseName: invoice.warehouseName,
      branchName: invoice.branchName,
    };
  }

  const supplier = await transaction.purchaseSupplier.findFirst({
    where: { id: invoice.supplierId, merchantId, archivedAt: null },
    select: { name: true },
  });
  if (!supplier) throw new NotFoundException('Active supplier was not found.');
  const warehouse = await transaction.warehouse.findFirst({
    where: {
      id: invoice.warehouseId,
      merchantId,
      archivedAt: null,
      branch: { archivedAt: null },
    },
    include: { branch: { select: { name: true } } },
  });
  if (!warehouse) throw new NotFoundException('Active warehouse was not found.');
  return {
    items: itemById,
    baseDeltas,
    supplierName: supplier.name,
    warehouseName: warehouse.name,
    branchName: warehouse.branch.name,
  };
}

export async function lockInvoice(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  id: string,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "purchase_invoices"
    WHERE "id" = ${id}::uuid AND "merchantId" = ${merchantId}::uuid
    FOR UPDATE`;
  if (rows.length !== 1) throw new NotFoundException('Purchase invoice was not found.');
}

async function lockSupplier(transaction: Prisma.TransactionClient, merchantId: string, id: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "purchase_suppliers"
    WHERE "id" = ${id}::uuid AND "merchantId" = ${merchantId}::uuid
    FOR SHARE`;
  if (rows.length !== 1) throw new NotFoundException('Supplier was not found.');
}

async function lockBranch(transaction: Prisma.TransactionClient, merchantId: string, id: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "branches"
    WHERE "id" = ${id}::uuid AND "merchantId" = ${merchantId}::uuid
    FOR SHARE`;
  if (rows.length !== 1) throw new NotFoundException('Branch was not found.');
}

async function lockWarehouse(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  id: string,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "warehouses"
    WHERE "id" = ${id}::uuid AND "merchantId" = ${merchantId}::uuid
    FOR SHARE`;
  if (rows.length !== 1) throw new NotFoundException('Warehouse was not found.');
}
