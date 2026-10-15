import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateStockOpeningRequest,
  CursorPage,
  StockBalance,
  StockMovement,
  StockMovementBatchResult,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  createStockOpeningSchema,
  type StockBalanceListQuery,
  type StockMovementListQuery,
} from './inventory.schemas.js';
import { convertToBaseQuantity, normalizeStockQuantity } from './stock-quantity.js';
import { movementInclude, toBatchResult } from './ledger/ledger.mapper.js';
import { findExistingBatch, replayBatch } from './ledger/ledger.persistence.js';
import { postPreparedMovementBatch } from './ledger/ledger.posting.js';
import { listBalances, listMovements } from './ledger/ledger.queries.js';
import {
  fingerprintCommand,
  fingerprintOpening,
  postingSchema,
  type InventoryMovementBatchCommand,
} from './ledger/ledger.rules.js';
export type { InventoryMovementBatchCommand } from './ledger/ledger.rules.js';

@Injectable()
export class InventoryLedgerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createOpening(
    merchantId: string,
    actor: string,
    input: CreateStockOpeningRequest,
  ): Promise<StockMovementBatchResult> {
    const parsed = parseRequest(createStockOpeningSchema, input);
    const fingerprint = fingerprintOpening(parsed);
    const commandBase = {
      requestId: parsed.requestId,
      sourceType: 'opening_balance',
      sourceId: parsed.requestId,
      kind: 'opening_balance' as const,
      reason: parsed.reason,
    };

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const previous = await findExistingBatch(
          transaction,
          merchantId,
          commandBase.requestId,
          commandBase.sourceType,
          commandBase.sourceId,
        );
        if (previous) return replayBatch(previous, fingerprint);

        const itemIds = [...new Set(parsed.lines.map((line) => line.stockItemId))];
        const items = await transaction.stockItem.findMany({
          where: { merchantId, id: { in: itemIds }, archivedAt: null },
          include: { units: true },
        });
        if (items.length !== itemIds.length)
          throw new NotFoundException('Active stock item was not found.');
        const itemById = new Map(items.map((item) => [item.id, item]));
        const movements = parsed.lines.map((line) => {
          const item = itemById.get(line.stockItemId)!;
          return {
            warehouseId: line.warehouseId,
            stockItemId: item.id,
            condition: line.condition,
            unitCode: line.unitCode,
            enteredQuantity: normalizeStockQuantity(line.quantity),
            baseDelta: convertToBaseQuantity(
              line.quantity,
              line.unitCode,
              item.baseUnit as Parameters<typeof convertToBaseQuantity>[2],
              item.units.map((unit) => ({
                code: unit.code,
                name: unit.name,
                baseQuantity: unit.baseQuantity.toFixed(6),
              })),
            ),
          };
        });

        return postPreparedMovementBatch(
          transaction,
          merchantId,
          actor,
          { ...commandBase, movements },
          fingerprint,
        );
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const previous = await findExistingBatch(
        this.prisma,
        merchantId,
        commandBase.requestId,
        commandBase.sourceType,
        commandBase.sourceId,
      );
      if (previous) return replayBatch(previous, fingerprint);
      throw new ConflictException('This opening-stock command conflicts with an existing source.');
    }
  }

  /** Apply movements on the caller's transaction; this method never opens a transaction. */
  async postMovementBatch(
    transaction: Prisma.TransactionClient,
    merchantId: string,
    actor: string,
    input: InventoryMovementBatchCommand,
  ): Promise<StockMovementBatchResult> {
    const command = parseRequest(postingSchema, input) as InventoryMovementBatchCommand;
    const fingerprint = fingerprintCommand(command);
    return postPreparedMovementBatch(transaction, merchantId, actor, command, fingerprint);
  }

  async findSourceBatch(
    transaction: Prisma.TransactionClient,
    merchantId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<StockMovementBatchResult | null> {
    const batch = await transaction.stockMovementBatch.findFirst({
      where: { merchantId, sourceType, sourceId },
      include: { movements: { include: movementInclude, orderBy: { position: 'asc' } } },
    });
    return batch ? toBatchResult(batch, true) : null;
  }

  listBalances(
    merchantId: string,
    input: StockBalanceListQuery,
  ): Promise<CursorPage<StockBalance>> {
    return listBalances(this.prisma, merchantId, input);
  }

  listMovements(
    merchantId: string,
    input: StockMovementListQuery,
  ): Promise<CursorPage<StockMovement>> {
    return listMovements(this.prisma, merchantId, input);
  }
}
