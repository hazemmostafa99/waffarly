/** Records merchant-wide stock costs and their auditable source history. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CursorPage,
  SetStockItemOpeningCostRequest,
  StockBaseUnit,
  StockItemCostEvent,
  StockItemCostSnapshot,
  StockItemCostSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { convertToBaseQuantity, parseStockQuantity } from './stock-quantity.js';
import {
  listStockItemCostEventsSchema,
  setStockItemOpeningCostSchema,
  type StockItemCostEventsQuery,
} from './inventory.schemas.js';

const COST_SCALE = 1_000_000_000_000n;
const PURCHASE_CENT_SCALE = 10_000_000_000_000_000n;
const MAX_CENTS = 999_999_999_999_999_999n;

export interface PurchaseCostLine {
  stockItemId: string;
  condition: string;
  quantity: string;
  baseQuantity: string;
  unitCode: string;
  unitName: string;
  unitCost: string;
  discountAllocation: string;
  shippingAllocation: string;
  lineTotal: string;
  position: number;
}

export interface PurchaseCostConfirmation {
  requestId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  lines: readonly PurchaseCostLine[];
}

type CostWrite = {
  stockItemId: string;
  baseUnitCost: string;
  enteredUnitCode: string;
  enteredUnitName: string;
  enteredUnitCost: string;
  sourceInvoiceId: string | null;
  sourceInvoiceNumber: string | null;
  supplierName: string | null;
  sourceWarehouseId: string | null;
  sourceWarehouseName: string | null;
  reason: string | null;
};

@Injectable()
export class InventoryCostService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCostSummary(
    merchantId: string,
    stockItemId: string,
    input: StockItemCostEventsQuery,
  ): Promise<StockItemCostSummary> {
    const query = parseRequest(listStockItemCostEventsSchema, input);
    const item = await this.prisma.stockItem.findFirst({
      where: { id: stockItemId, merchantId },
      select: { id: true, name: true, baseUnit: true },
    });
    if (!item) throw new NotFoundException('Stock item was not found.');

    const where: Prisma.StockItemCostEventWhereInput = { merchantId, stockItemId };
    if (query.cursor) {
      const anchor = await this.prisma.stockItemCostEvent.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const [current, rows] = await Promise.all([
      this.prisma.stockItemCostCurrent.findUnique({
        where: { merchantId_stockItemId: { merchantId, stockItemId } },
      }),
      this.prisma.stockItemCostEvent.findMany({
        where,
        orderBy: [{ revision: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
    ]);
    const historyItems = rows.slice(0, query.limit).map((row) => mapCostEvent(row, item.baseUnit));
    const history: CursorPage<StockItemCostEvent> = {
      items: historyItems,
      nextCursor: rows.length > query.limit ? historyItems.at(-1)!.id : null,
    };
    return {
      stockItemId,
      itemName: item.name,
      baseUnit: item.baseUnit as StockBaseUnit,
      current: current ? mapCostSnapshot(current, item.baseUnit) : null,
      history,
    };
  }

  async setOpeningCost(
    merchantId: string,
    actor: string,
    stockItemId: string,
    input: SetStockItemOpeningCostRequest,
  ): Promise<StockItemCostSummary> {
    const parsed = parseRequest(setStockItemOpeningCostSchema, input);
    await this.prisma.$transaction(async (transaction) => {
      await lockCostItems(transaction, merchantId, [stockItemId]);
      const item = await transaction.stockItem.findFirst({
        where: { id: stockItemId, merchantId, archivedAt: null },
        include: { units: true },
      });
      if (!item) throw new NotFoundException('Active stock item was not found.');

      const unit = item.units.find((candidate) => candidate.code === parsed.unitCode);
      const unitName = unit?.name ?? parsed.unitCode;
      const inputCost = formatCents(parsePositiveCents(parsed.unitCost));
      const baseQuantity = convertToBaseQuantity(
        '1',
        parsed.unitCode,
        item.baseUnit as StockBaseUnit,
        item.units.map((candidate) => ({
          code: candidate.code,
          name: candidate.name,
          baseQuantity: candidate.baseQuantity.toFixed(6),
        })),
      );
      const baseUnitCost = formatCostCentsPerBaseUnit(
        parsePositiveCents(inputCost),
        parseStockQuantity(baseQuantity),
      );
      const fingerprint = hashFingerprint({
        kind: 'opening',
        stockItemId,
        unitCode: parsed.unitCode,
        unitCost: inputCost,
        reason: parsed.reason,
      });
      const priorRequest = await transaction.stockItemCostEvent.findUnique({
        where: {
          merchantId_stockItemId_requestId: {
            merchantId,
            stockItemId,
            requestId: parsed.requestId,
          },
        },
      });
      if (priorRequest) {
        assertMatchingCostRequest(priorRequest.requestFingerprint, fingerprint);
        return;
      }

      const current = await transaction.stockItemCostCurrent.findUnique({
        where: { merchantId_stockItemId: { merchantId, stockItemId } },
      });
      if (current && current.sourceType !== 'opening') {
        throw new ConflictException(
          'An opening cost can only be recorded before the first confirmed purchase for this item.',
        );
      }
      const write: CostWrite = {
        stockItemId,
        baseUnitCost,
        enteredUnitCode: parsed.unitCode,
        enteredUnitName: unitName,
        enteredUnitCost: inputCost,
        sourceInvoiceId: null,
        sourceInvoiceNumber: null,
        supplierName: null,
        sourceWarehouseId: null,
        sourceWarehouseName: null,
        reason: parsed.reason,
      };
      await this.writeCostEvent(
        transaction,
        merchantId,
        actor,
        parsed.requestId,
        fingerprint,
        write,
        current?.revision ?? 0,
        'opening',
      );
    });
    return this.getCostSummary(merchantId, stockItemId, { limit: 25 });
  }

  async recordPurchaseConfirmation(
    transaction: Prisma.TransactionClient,
    merchantId: string,
    actor: string,
    source: PurchaseCostConfirmation,
  ): Promise<void> {
    const orderedLines = [...source.lines].sort((left, right) => {
      if (left.stockItemId !== right.stockItemId) {
        return left.stockItemId < right.stockItemId ? -1 : 1;
      }
      return left.position - right.position;
    });
    const grouped = new Map<string, Array<{ line: PurchaseCostLine; cost: string }>>();
    for (const line of orderedLines) {
      parsePositiveCents(line.unitCost);
      if (!line.lineTotal) {
        throw new ConflictException('Add a valid final line cost before confirming this invoice.');
      }
      const cost = costPerBaseUnitFromFinalLine(line.lineTotal, line.baseQuantity);
      const group = grouped.get(line.stockItemId) ?? [];
      group.push({ line, cost });
      grouped.set(line.stockItemId, group);
    }

    const writes: CostWrite[] = [];
    for (const [stockItemId, group] of grouped) {
      const expectedCost = group[0]!.cost;
      if (group.some((candidate) => candidate.cost !== expectedCost)) {
        throw new ConflictException(
          'The same stock item has different effective costs across stock conditions. Make the line costs match before confirming.',
        );
      }
      const first = group[0]!.line;
      writes.push({
        stockItemId,
        baseUnitCost: expectedCost,
        enteredUnitCode: first.unitCode,
        enteredUnitName: first.unitName,
        enteredUnitCost: formatCents(parsePositiveCents(first.unitCost)),
        sourceInvoiceId: source.invoiceId,
        sourceInvoiceNumber: source.invoiceNumber,
        supplierName: source.supplierName,
        sourceWarehouseId: source.warehouseId,
        sourceWarehouseName: source.warehouseName,
        reason: null,
      });
    }

    const stockItemIds = writes.map((write) => write.stockItemId).sort();
    await lockCostItems(transaction, merchantId, stockItemIds);
    const existingEvents = await transaction.stockItemCostEvent.findMany({
      where: { merchantId, requestId: source.requestId, stockItemId: { in: stockItemIds } },
    });
    const fingerprintByItem = new Map(
      writes.map((write) => [write.stockItemId, purchaseFingerprint(source, write)]),
    );
    if (existingEvents.length) {
      if (existingEvents.length !== writes.length) {
        throw new ConflictException('This purchase cost request was only partially recorded.');
      }
      for (const event of existingEvents) {
        assertMatchingCostRequest(
          event.requestFingerprint,
          fingerprintByItem.get(event.stockItemId)!,
        );
      }
      return;
    }

    const currentCosts = await transaction.stockItemCostCurrent.findMany({
      where: { merchantId, stockItemId: { in: stockItemIds } },
    });
    const currentByItem = new Map(currentCosts.map((current) => [current.stockItemId, current]));
    for (const write of writes) {
      const current = currentByItem.get(write.stockItemId);
      await this.writeCostEvent(
        transaction,
        merchantId,
        actor,
        source.requestId,
        fingerprintByItem.get(write.stockItemId)!,
        write,
        current?.revision ?? 0,
        'purchase',
      );
    }
  }

  async recordPurchaseInvoiceCorrection(
    transaction: Prisma.TransactionClient,
    merchantId: string,
    actor: string,
    requestId: string,
    source: Pick<PurchaseCostConfirmation, 'invoiceId' | 'invoiceNumber' | 'supplierName' | 'warehouseId' | 'warehouseName'>,
    lines: readonly PurchaseCostLine[],
  ): Promise<void> {
    const grouped = new Map<string, Array<{ line: PurchaseCostLine; cost: string }>>();
    for (const line of lines) {
      const cost = costPerBaseUnitFromFinalLine(line.lineTotal, line.baseQuantity);
      const group = grouped.get(line.stockItemId) ?? [];
      group.push({ line, cost });
      grouped.set(line.stockItemId, group);
    }
    const writes: CostWrite[] = [];
    for (const [stockItemId, group] of grouped) {
      const cost = group[0]!.cost;
      if (group.some((candidate) => candidate.cost !== cost))
        throw new ConflictException('The corrected invoice produces different costs for the same item conditions.');
      const first = group[0]!.line;
      writes.push({
        stockItemId,
        baseUnitCost: cost,
        enteredUnitCode: first.unitCode,
        enteredUnitName: first.unitName,
        enteredUnitCost: formatCents(parsePositiveCents(first.unitCost)),
        sourceInvoiceId: source.invoiceId,
        sourceInvoiceNumber: source.invoiceNumber,
        supplierName: source.supplierName,
        sourceWarehouseId: source.warehouseId,
        sourceWarehouseName: source.warehouseName,
        reason: `Corrected purchase invoice ${source.invoiceNumber ?? source.invoiceId}`,
      });
    }
    const stockItemIds = writes.map((write) => write.stockItemId).sort();
    await lockCostItems(transaction, merchantId, stockItemIds);
    const currentCosts = await transaction.stockItemCostCurrent.findMany({
      where: { merchantId, stockItemId: { in: stockItemIds } },
    });
    const currentByItem = new Map(currentCosts.map((current) => [current.stockItemId, current]));
    for (const write of writes) {
      const current = currentByItem.get(write.stockItemId);
      if (
        !current ||
        current.sourceInvoiceId !== source.invoiceId ||
        !['purchase', 'purchase_correction'].includes(current.sourceType)
      ) continue;
      const fingerprint = hashFingerprint({
        kind: 'purchase_correction',
        requestId,
        sourceInvoiceId: source.invoiceId,
        stockItemId: write.stockItemId,
        baseUnitCost: write.baseUnitCost,
      });
      const previousEvent = await transaction.stockItemCostEvent.findFirst({
        where: { merchantId, stockItemId: write.stockItemId, requestId },
      });
      if (previousEvent) {
        assertMatchingCostRequest(previousEvent.requestFingerprint, fingerprint);
        continue;
      }
      await this.writeCostEvent(
        transaction, merchantId, actor, requestId, fingerprint, write,
        current.revision, 'purchase_correction',
      );
    }
  }

  private async writeCostEvent(
    transaction: Prisma.TransactionClient,
    merchantId: string,
    actor: string,
    requestId: string,
    requestFingerprint: string,
    write: CostWrite,
    previousRevision: number,
    sourceType: 'opening' | 'purchase' | 'purchase_correction',
  ): Promise<void> {
    const revision = previousRevision + 1;
    const recordedAt = new Date();
    const costFields = {
      baseUnitCost: write.baseUnitCost,
      sourceType,
      sourceInvoiceId: write.sourceInvoiceId,
      sourceInvoiceNumber: write.sourceInvoiceNumber,
      supplierName: write.supplierName,
      sourceWarehouseId: write.sourceWarehouseId,
      sourceWarehouseName: write.sourceWarehouseName,
      enteredUnitCode: write.enteredUnitCode,
      enteredUnitName: write.enteredUnitName,
      enteredUnitCost: write.enteredUnitCost,
    };
    await transaction.stockItemCostEvent.create({
      data: {
        merchantId,
        stockItemId: write.stockItemId,
        revision,
        requestId,
        requestFingerprint,
        ...costFields,
        reason: write.reason,
        actor,
        createdAt: recordedAt,
      },
    });
    await transaction.stockItemCostCurrent.upsert({
      where: { merchantId_stockItemId: { merchantId, stockItemId: write.stockItemId } },
      create: {
        merchantId,
        stockItemId: write.stockItemId,
        ...costFields,
        updatedBy: actor,
        updatedAt: recordedAt,
        revision,
      },
      update: {
        ...costFields,
        updatedBy: actor,
        updatedAt: recordedAt,
        revision,
      },
    });
  }
}

async function lockCostItems(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  stockItemIds: readonly string[],
) {
  for (const stockItemId of [...new Set(stockItemIds)].sort()) {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "stock_items"
      WHERE "id" = ${stockItemId}::uuid AND "merchantId" = ${merchantId}::uuid
      FOR UPDATE`;
    if (rows.length !== 1) throw new NotFoundException('Stock item was not found.');
  }
}

function mapCostSnapshot(
  record: {
    revision: number;
    baseUnitCost: { toFixed(digits: number): string };
    sourceType: string;
    sourceInvoiceId: string | null;
    sourceInvoiceNumber: string | null;
    supplierName: string | null;
    sourceWarehouseId: string | null;
    sourceWarehouseName: string | null;
    enteredUnitCode: string;
    enteredUnitName: string;
    enteredUnitCost: { toFixed(digits: number): string };
    updatedBy: string;
    updatedAt: Date;
  },
  baseUnit: string,
): StockItemCostSnapshot {
  return {
    revision: record.revision,
    baseUnitCost: record.baseUnitCost.toFixed(12),
    baseUnit: baseUnit as StockBaseUnit,
    sourceType: record.sourceType as StockItemCostSnapshot['sourceType'],
    sourceInvoiceId: record.sourceInvoiceId,
    sourceInvoiceNumber: record.sourceInvoiceNumber,
    supplierName: record.supplierName,
    sourceWarehouseId: record.sourceWarehouseId,
    sourceWarehouseName: record.sourceWarehouseName,
    enteredUnitCode: record.enteredUnitCode,
    enteredUnitName: record.enteredUnitName,
    enteredUnitCost: record.enteredUnitCost.toFixed(2),
    updatedBy: record.updatedBy,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapCostEvent(
  record: {
    id: string;
    revision: number;
    baseUnitCost: { toFixed(digits: number): string };
    sourceType: string;
    sourceInvoiceId: string | null;
    sourceInvoiceNumber: string | null;
    supplierName: string | null;
    sourceWarehouseId: string | null;
    sourceWarehouseName: string | null;
    enteredUnitCode: string;
    enteredUnitName: string;
    enteredUnitCost: { toFixed(digits: number): string };
    reason: string | null;
    actor: string;
    createdAt: Date;
  },
  baseUnit: string,
): StockItemCostEvent {
  return {
    id: record.id,
    revision: record.revision,
    baseUnitCost: record.baseUnitCost.toFixed(12),
    baseUnit: baseUnit as StockBaseUnit,
    sourceType: record.sourceType as StockItemCostEvent['sourceType'],
    sourceInvoiceId: record.sourceInvoiceId,
    sourceInvoiceNumber: record.sourceInvoiceNumber,
    supplierName: record.supplierName,
    sourceWarehouseId: record.sourceWarehouseId,
    sourceWarehouseName: record.sourceWarehouseName,
    enteredUnitCode: record.enteredUnitCode,
    enteredUnitName: record.enteredUnitName,
    enteredUnitCost: record.enteredUnitCost.toFixed(2),
    reason: record.reason,
    actor: record.actor,
    createdAt: record.createdAt.toISOString(),
  };
}

function costPerBaseUnitFromFinalLine(lineTotal: string, baseQuantity: string): string {
  const cents = parseMoneyCents(lineTotal);
  const quantityScaled = parseStockQuantity(baseQuantity);
  const costScaled = divideHalfUp(cents * PURCHASE_CENT_SCALE, quantityScaled);
  if (costScaled <= 0n) {
    throw new ConflictException(
      'The final line amount is too small to create a positive stock item cost.',
    );
  }
  return formatScaledCost(costScaled);
}

function formatCostCentsPerBaseUnit(cents: bigint, baseQuantityScaled: bigint): string {
  const costScaled = divideHalfUp(cents * PURCHASE_CENT_SCALE, baseQuantityScaled);
  if (costScaled <= 0n) throw new ConflictException('Opening cost must be greater than zero.');
  return formatScaledCost(costScaled);
}

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function formatScaledCost(value: bigint): string {
  const whole = value / COST_SCALE;
  const fraction = (value % COST_SCALE).toString().padStart(12, '0');
  return `${whole}.${fraction}`;
}

function parsePositiveCents(value: string): bigint {
  const cents = parseMoneyCents(value);
  if (cents <= 0n || cents > MAX_CENTS) {
    throw new ConflictException('Unit cost must be a positive amount with up to two decimals.');
  }
  return cents;
}

function parseMoneyCents(value: string): bigint {
  const match = /^(?:0|[1-9]\d{0,15})(?:\.(\d{1,2}))?$/.exec(value);
  const whole = /^(?:0|[1-9]\d{0,15})/.exec(value)?.[0];
  if (!match || !whole) throw new ConflictException('Cost amount is invalid.');
  const fraction = value.split('.')[1] ?? '';
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function formatCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

function purchaseFingerprint(source: PurchaseCostConfirmation, write: CostWrite): string {
  return hashFingerprint({
    kind: 'purchase',
    invoiceId: source.invoiceId,
    invoiceNumber: source.invoiceNumber,
    supplierName: source.supplierName,
    warehouseId: source.warehouseId,
    warehouseName: source.warehouseName,
    write,
    lines: source.lines
      .filter((line) => line.stockItemId === write.stockItemId)
      .map((line) => ({
        condition: line.condition,
        quantity: line.quantity,
        baseQuantity: line.baseQuantity,
        unitCode: line.unitCode,
        unitName: line.unitName,
        unitCost: line.unitCost,
        discountAllocation: line.discountAllocation,
        shippingAllocation: line.shippingAllocation,
        lineTotal: line.lineTotal,
        position: line.position,
      })),
  });
}

function hashFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertMatchingCostRequest(existing: string, incoming: string) {
  if (existing !== incoming) {
    throw new ConflictException('This stock item cost request ID was used with different details.');
  }
}
