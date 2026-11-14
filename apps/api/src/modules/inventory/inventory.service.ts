/** Creates and maintains stock identities and units without adding stock balances. */
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
import { createHash } from 'node:crypto';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  createStockItemSchema,
  stockItemRevisionSchema,
  updateStockItemSchema,
  type StockItemListQuery,
} from './inventory.schemas.js';
import { assertMutableItem } from './items/stock-item-access.js';
import { includeUnits, replayCreation, toItem } from './items/stock-item.mapper.js';
import {
  convertStockItemQuantity,
  getStockItem,
  listStockItems,
} from './items/stock-item.queries.js';

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(merchantId: string, input: StockItemListQuery): Promise<CursorPage<StockItem>> {
    return listStockItems(this.prisma, merchantId, input);
  }

  async get(merchantId: string, id: string): Promise<StockItem> {
    return getStockItem(this.prisma, merchantId, id);
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
          throw new ConflictException(
            'A stock item required by a pending recipe order cannot be archived.',
          );
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
    return convertStockItemQuantity(this.prisma, merchantId, id, input);
  }
}
