import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConfirmPurchaseInvoiceRequest,
  ConfirmPurchaseInvoiceResult,
  CreatePurchaseInvoiceRequest,
  CursorPage,
  PurchaseInvoice,
  UpdatePurchaseInvoiceRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  convertToBaseQuantity,
  InventoryLedgerService,
  normalizeStockQuantity,
} from '../inventory/index.js';
import {
  confirmPurchaseInvoiceSchema,
  createPurchaseInvoiceSchema,
  listPurchaseInvoicesSchema,
  updatePurchaseInvoiceSchema,
  type PurchaseInvoiceListQuery,
} from './purchasing.schemas.js';

const invoiceInclude = {
  lines: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.PurchaseInvoiceInclude;
type InvoiceRecord = Prisma.PurchaseInvoiceGetPayload<{ include: typeof invoiceInclude }>;

@Injectable()
export class PurchasingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService,
  ) {}

  async listInvoices(
    merchantId: string,
    input: PurchaseInvoiceListQuery,
  ): Promise<CursorPage<PurchaseInvoice>> {
    const query = parseRequest(listPurchaseInvoicesSchema, input);
    const where: Prisma.PurchaseInvoiceWhereInput = {
      merchantId,
      ...(query.status === 'all' ? {} : { status: query.status }),
      ...(query.search
        ? {
            OR: [
              { supplierName: { contains: query.search, mode: 'insensitive' } },
              { supplierInvoiceNumber: { contains: query.search, mode: 'insensitive' } },
              { warehouseName: { contains: query.search, mode: 'insensitive' } },
              { branchName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.purchaseInvoice.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const rows = await this.prisma.purchaseInvoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map(toInvoice);
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }

  async getInvoice(merchantId: string, id: string): Promise<PurchaseInvoice> {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { merchantId, id },
      include: invoiceInclude,
    });
    if (!invoice) throw new NotFoundException('Purchase invoice was not found.');
    return toInvoice(invoice);
  }

  async createInvoice(
    merchantId: string,
    actor: string,
    input: CreatePurchaseInvoiceRequest,
  ): Promise<PurchaseInvoice> {
    const parsed = parseRequest(createPurchaseInvoiceSchema, input);
    const fingerprint = invoiceFingerprint(parsed);
    const existing = await this.prisma.purchaseInvoice.findUnique({
      where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
      include: invoiceInclude,
    });
    if (existing) return replayInvoice(existing, fingerprint);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const refs = await resolveInvoiceReferences(transaction, merchantId, parsed);
        return toInvoice(
          await transaction.purchaseInvoice.create({
            data: {
              merchantId,
              supplierId: refs.supplier.id,
              supplierName: refs.supplier.name,
              supplierInvoiceNumber: refs.supplierInvoiceNumber,
              supplierInvoiceNumberKey: refs.supplierInvoiceNumberKey,
              warehouseId: refs.warehouse.id,
              warehouseName: refs.warehouse.name,
              branchName: refs.warehouse.branch.name,
              creationRequest: parsed.requestId,
              creationFingerprint: fingerprint,
              createdBy: actor,
              updatedBy: actor,
              lines: { create: refs.lines },
            },
            include: invoiceInclude,
          }),
        );
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const replay = await this.prisma.purchaseInvoice.findUnique({
        where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
        include: invoiceInclude,
      });
      if (replay) return replayInvoice(replay, fingerprint);
      throw new ConflictException(
        'This supplier already has a purchase invoice with that supplier invoice number.',
      );
    }
  }

  async updateInvoice(
    merchantId: string,
    actor: string,
    id: string,
    input: UpdatePurchaseInvoiceRequest,
  ): Promise<PurchaseInvoice> {
    const parsed = parseRequest(updatePurchaseInvoiceSchema, input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockInvoice(transaction, merchantId, id);
        const current = await transaction.purchaseInvoice.findFirst({
          where: { merchantId, id },
          include: invoiceInclude,
        });
        if (!current) throw new NotFoundException('Purchase invoice was not found.');
        assertDraftRevision(current, parsed.revision);
        const refs = await resolveInvoiceReferences(transaction, merchantId, parsed);
        await transaction.purchaseInvoice.update({
          where: { id },
          data: {
            supplierId: refs.supplier.id,
            supplierName: refs.supplier.name,
            supplierInvoiceNumber: refs.supplierInvoiceNumber,
            supplierInvoiceNumberKey: refs.supplierInvoiceNumberKey,
            warehouseId: refs.warehouse.id,
            warehouseName: refs.warehouse.name,
            branchName: refs.warehouse.branch.name,
            updatedBy: actor,
            revision: { increment: 1 },
            lines: {
              deleteMany: {},
              create: refs.lines,
            },
          },
        });
        return toInvoice(
          await transaction.purchaseInvoice.findFirstOrThrow({
            where: { merchantId, id },
            include: invoiceInclude,
          }),
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'This supplier already has a purchase invoice with that supplier invoice number.',
        );
      }
      throw error;
    }
  }

  async confirmInvoice(
    merchantId: string,
    actor: string,
    id: string,
    input: ConfirmPurchaseInvoiceRequest,
  ): Promise<ConfirmPurchaseInvoiceResult> {
    const parsed = parseRequest(confirmPurchaseInvoiceSchema, input);
    return this.prisma.$transaction(async (transaction) => {
      await lockInvoice(transaction, merchantId, id);
      const current = await transaction.purchaseInvoice.findFirst({
        where: { merchantId, id },
        include: invoiceInclude,
      });
      if (!current) throw new NotFoundException('Purchase invoice was not found.');
      if (current.status === 'draft') assertDraftRevision(current, parsed.revision);

      const refs = await resolveReceiptReferences(transaction, merchantId, current);
      const reason = purchaseReceiptReason(current.supplierName, current.supplierInvoiceNumber, id);
      const receipt = await this.ledger.postMovementBatch(transaction, merchantId, actor, {
        requestId: parsed.requestId,
        sourceType: 'purchase_invoice',
        sourceId: current.id,
        kind: 'purchase_receipt',
        reason,
        movements: current.lines.map((line) => ({
          warehouseId: current.warehouseId,
          stockItemId: line.stockItemId,
          condition: line.condition as 'available' | 'non_sellable',
          unitCode: line.unitCode,
          enteredQuantity: decimalText(line.quantity.toFixed(6)),
          baseDelta: refs.baseDeltas.get(line.id)!,
        })),
      });

      if (current.status === 'confirmed') {
        return { invoice: toInvoice(current), receipt };
      }

      for (const line of current.lines) {
        const item = refs.items.get(line.stockItemId)!;
        await transaction.purchaseInvoiceLine.update({
          where: { id: line.id },
          data: {
            stockItemName: item.name,
            baseUnit: item.baseUnit,
          },
        });
      }
      const confirmed = await transaction.purchaseInvoice.update({
        where: { id: current.id },
        data: {
          supplierName: refs.supplierName,
          warehouseName: refs.warehouseName,
          branchName: refs.branchName,
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: actor,
          updatedBy: actor,
          revision: { increment: 1 },
        },
        include: invoiceInclude,
      });
      return { invoice: toInvoice(confirmed), receipt };
    });
  }
}

async function resolveInvoiceReferences(
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

async function resolveReceiptReferences(
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
        decimalText(line.quantity.toFixed(6)),
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

async function lockInvoice(transaction: Prisma.TransactionClient, merchantId: string, id: string) {
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

function assertDraftRevision(
  invoice: Pick<InvoiceRecord, 'status' | 'revision'>,
  revision: number,
) {
  if (invoice.status !== 'draft') {
    throw new ConflictException('Confirmed purchase invoices cannot be changed.');
  }
  if (invoice.revision !== revision) {
    throw new ConflictException('Purchase invoice was changed by another request.');
  }
}

function invoiceFingerprint(input: CreatePurchaseInvoiceRequest): string {
  const invoiceNumber = input.supplierInvoiceNumber?.trim().toLocaleLowerCase('en-US') || null;
  return createHash('sha256')
    .update(
      JSON.stringify({
        supplierId: input.supplierId,
        supplierInvoiceNumber: invoiceNumber,
        warehouseId: input.warehouseId,
        lines: input.lines.map((line) => ({
          stockItemId: line.stockItemId,
          condition: line.condition,
          quantity: normalizeStockQuantity(line.quantity),
          unitCode: line.unitCode,
        })),
      }),
    )
    .digest('hex');
}

function replayInvoice(invoice: InvoiceRecord, fingerprint: string): PurchaseInvoice {
  if (invoice.creationFingerprint !== fingerprint) {
    throw new ConflictException(
      'This purchase invoice request ID was used with different details.',
    );
  }
  return toInvoice(invoice);
}

function purchaseReceiptReason(supplierName: string, number: string | null, id: string): string {
  return `Purchase invoice ${number ?? id} from ${supplierName}`.slice(0, 500);
}

function toInvoice(record: InvoiceRecord): PurchaseInvoice {
  return {
    id: record.id,
    supplierId: record.supplierId,
    supplierName: record.supplierName,
    supplierInvoiceNumber: record.supplierInvoiceNumber,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouseName,
    branchName: record.branchName,
    status: record.status as PurchaseInvoice['status'],
    revision: record.revision,
    lines: record.lines.map((line) => ({
      id: line.id,
      stockItemId: line.stockItemId,
      stockItemName: line.stockItemName,
      baseUnit: line.baseUnit as PurchaseInvoice['lines'][number]['baseUnit'],
      unitCode: line.unitCode,
      unitName: line.unitName,
      condition: line.condition as PurchaseInvoice['lines'][number]['condition'],
      quantity: decimalText(line.quantity.toFixed(6)),
      position: line.position,
    })),
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    confirmedBy: record.confirmedBy,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function decimalText(value: string): string {
  const trimmed = value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return trimmed === '-0' ? '0' : trimmed;
}
