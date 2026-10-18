import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateStockItemRequest,
  CursorPage,
  StockItem,
  StockItemConversion,
  StockItemConversionRequest,
  StockItemRevisionRequest,
  UpdateStockItemRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  convertStockItemSchema,
  createStockItemSchema,
  listStockItemsSchema,
  stockItemRevisionSchema,
  updateStockItemSchema,
  type StockItemListQuery,
} from './inventory.schemas.js';
import { convertToBaseQuantity, normalizeStockQuantity } from './stock-quantity.js';

const includeUnits = { units: { orderBy: { code: 'asc' as const } } };
type ItemRecord = Prisma.StockItemGetPayload<{ include: { units: true } }>;

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(merchantId: string, input: StockItemListQuery): Promise<CursorPage<StockItem>> {
    const query = parseRequest(listStockItemsSchema, input);
    const where: Prisma.StockItemWhereInput = {
      merchantId,
      ...(query.status === 'all'
        ? {}
        : { archivedAt: query.status === 'active' ? null : { not: null } }),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.stockItem.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const rows = await this.prisma.stockItem.findMany({
      where,
      include: includeUnits,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map(toItem);
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }

  async get(merchantId: string, id: string): Promise<StockItem> {
    const item = await this.prisma.stockItem.findFirst({
      where: { id, merchantId },
      include: includeUnits,
    });
    if (!item) throw new NotFoundException('Stock item was not found.');
    return toItem(item);
  }

  async create(
    merchantId: string,
    actor: string,
    input: CreateStockItemRequest,
  ): Promise<StockItem> {
    const parsed = parseRequest(createStockItemSchema, input);
    const units = [...(parsed.units ?? [])].sort((a, b) => a.code.localeCompare(b.code));
    const settings = {
      name: parsed.name,
      description: parsed.description || null,
      baseUnit: parsed.baseUnit,
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ ...settings, units }))
      .digest('hex');
    const existing = await this.prisma.stockItem.findUnique({
      where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
      include: includeUnits,
    });
    if (existing) return replayCreation(existing, fingerprint);
    try {
      return toItem(
        await this.prisma.stockItem.create({
          data: {
            merchantId,
            ...settings,
            creationRequest: parsed.requestId,
            creationFingerprint: fingerprint,
            createdBy: actor,
            updatedBy: actor,
            units: { create: units.map((unit) => ({ ...unit, createdBy: actor })) },
          },
          include: includeUnits,
        }),
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const replay = await this.prisma.stockItem.findUnique({
        where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
        include: includeUnits,
      });
      if (replay) return replayCreation(replay, fingerprint);
      throw new ConflictException(
        'Stock item could not be created because a unit code is already used.',
      );
    }
  }

  async update(
    merchantId: string,
    actor: string,
    id: string,
    input: UpdateStockItemRequest,
  ): Promise<StockItem> {
    const parsed = parseRequest(updateStockItemSchema, input);
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.stockItem.updateMany({
        where: { id, merchantId, revision: parsed.revision, archivedAt: null },
        data: {
          name: parsed.name,
          description: parsed.description || null,
          updatedBy: actor,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1) await assertMutableItem(transaction, merchantId, id);
      const current = await transaction.stockItem.findFirstOrThrow({
        where: { id, merchantId },
        include: includeUnits,
      });
      const additionalUnits = parsed.additionalUnits ?? [];
      const codes = new Set(current.units.map((unit) => unit.code));
      if (current.units.length + additionalUnits.length > 20) {
        throw new ConflictException('A stock item can have at most 20 pack units.');
      }
      if (additionalUnits.some((unit) => codes.has(unit.code))) {
        throw new ConflictException(
          'Pack unit code is already used. Existing conversions cannot be replaced.',
        );
      }
      if (additionalUnits.length) {
        await transaction.stockItemUnit.createMany({
          data: additionalUnits.map((unit) => ({
            ...unit,
            merchantId,
            stockItemId: id,
            createdBy: actor,
          })),
        });
      }
      return toItem(
        await transaction.stockItem.findFirstOrThrow({
          where: { id, merchantId },
          include: includeUnits,
        }),
      );
    });
  }

  async setArchived(
    merchantId: string,
    actor: string,
    id: string,
    archived: boolean,
    input: StockItemRevisionRequest,
  ): Promise<StockItem> {
    const { revision } = parseRequest(stockItemRevisionSchema, input);
    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "stock_items"
        WHERE "id" = ${id}::uuid AND "merchantId" = ${merchantId}::uuid
        FOR UPDATE`;
      if (locked.length !== 1) throw new NotFoundException('Stock item was not found.');
      if (archived) {
        const pendingSnapshot = await transaction.storefrontOrderLineStockRequirement.findFirst({
          where: {
            merchantId,
            stockItemId: id,
            orderLine: {
              is: {
                stockHandling: 'recipe_acceptance',
                order: { is: { status: 'pending' } },
              },
            },
          },
          select: { id: true },
        });
        if (pendingSnapshot)
          throw new ConflictException('A stock item required by a pending recipe order cannot be archived.');
        const cancellable = await transaction.stockMovement.findFirst({
          where: {
            merchantId,
            stockItemId: id,
            batch: { orderLinks: { some: { role: 'consumption', order: { status: 'accepted' } } } },
          },
          select: { id: true },
        });
        if (cancellable)
          throw new ConflictException(
            'Stock used by an order awaiting preparation cannot be archived.',
          );
        const productUse = await transaction.productInventoryComponent.findFirst({
          where: { merchantId, stockItemId: id },
          select: { id: true },
        });
        const modifierUse = await transaction.productModifierEffect.findFirst({
          where: { merchantId, stockItemId: id },
          select: { id: true },
        });
        if (productUse || modifierUse) {
          throw new ConflictException(
            'A stock item used by a product or recipe cannot be archived.',
          );
        }
        const balance = await transaction.stockBalance.findFirst({
          where: { merchantId, stockItemId: id, quantity: { not: 0 } },
          select: { id: true },
        });
        if (balance) {
          throw new ConflictException('A stock item with non-zero stock cannot be archived.');
        }
      }
      const changed = await transaction.stockItem.updateMany({
        where: { id, merchantId, revision, archivedAt: archived ? null : { not: null } },
        data: {
          archivedAt: archived ? new Date() : null,
          updatedBy: actor,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1) await assertMutableItem(transaction, merchantId, id);
      return toItem(
        await transaction.stockItem.findFirstOrThrow({
          where: { id, merchantId },
          include: includeUnits,
        }),
      );
    });
  }

  async convert(
    merchantId: string,
    id: string,
    input: StockItemConversionRequest,
  ): Promise<StockItemConversion> {
    const parsed = parseRequest(convertStockItemSchema, input);
    const item = await this.get(merchantId, id);
    if (item.archivedAt)
      throw new ConflictException('Archived stock items cannot be used for conversion.');
    return {
      itemId: item.id,
      unitCode: parsed.unitCode,
      quantity: normalizeStockQuantity(parsed.quantity),
      baseUnit: item.baseUnit,
      baseQuantity: convertToBaseQuantity(
        parsed.quantity,
        parsed.unitCode,
        item.baseUnit,
        item.units,
      ),
    };
  }
}

async function assertMutableItem(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  id: string,
): Promise<never> {
  const item = await transaction.stockItem.findFirst({
    where: { id, merchantId },
    select: { id: true },
  });
  if (!item) throw new NotFoundException('Stock item was not found.');
  throw new ConflictException(
    'Stock item changed or has an incompatible status. Reload it before trying again.',
  );
}

function replayCreation(record: ItemRecord, fingerprint: string): StockItem {
  if (record.creationFingerprint !== fingerprint) {
    throw new ConflictException(
      'This creation request was already used with different item details.',
    );
  }
  return toItem(record);
}

function toItem(record: ItemRecord): StockItem {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    baseUnit: record.baseUnit as StockItem['baseUnit'],
    revision: record.revision,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    units: record.units.map((unit) => ({
      id: unit.id,
      code: unit.code,
      name: unit.name,
      baseQuantity: normalizeStockQuantity(unit.baseQuantity.toFixed(6)),
    })),
  };
}
