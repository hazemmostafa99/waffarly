import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { STOCK_CONDITIONS } from '@waffarly/contracts';
import type {
  CreateStockOpeningRequest,
  CursorPage,
  StockBalance,
  StockMovement,
  StockMovementBatchResult,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  createStockOpeningSchema,
  listStockBalancesSchema,
  listStockMovementsSchema,
  type StockBalanceListQuery,
  type StockMovementListQuery,
} from './inventory.schemas.js';
import { convertToBaseQuantity, normalizeStockQuantity } from './stock-quantity.js';

const balanceInclude = {
  warehouse: { include: { branch: true } },
  stockItem: true,
} as const;
const movementInclude = {
  batch: true,
  warehouse: { include: { branch: true } },
  stockItem: true,
} as const;
type BalanceRecord = Prisma.StockBalanceGetPayload<{ include: typeof balanceInclude }>;
type MovementRecord = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>;
const decimal = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const signedDecimal = /^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const identifierCode = /^[a-z][a-z0-9_]{0,31}$/;
const unitCode = /^[a-z][a-z0-9_-]{0,31}$/;

const postingSchema = z
  .object({
    requestId: z.string().uuid(),
    sourceType: z.string().regex(identifierCode),
    sourceId: z.string().trim().min(1).max(80),
    kind: z.string().regex(identifierCode),
    reason: z.string().trim().min(1).max(500),
    movements: z
      .array(
        z
          .object({
            warehouseId: z.string().uuid(),
            stockItemId: z.string().uuid(),
            condition: z.enum(STOCK_CONDITIONS),
            unitCode: z.string().regex(unitCode),
            enteredQuantity: z.string().regex(decimal),
            baseDelta: z
              .string()
              .regex(signedDecimal)
              .refine((value) => !/^(-?0(?:\.0*)?)$/.test(value)),
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine(
        (rows) =>
          new Set(rows.map((row) => `${row.warehouseId}:${row.stockItemId}:${row.condition}`))
            .size === rows.length,
      ),
  })
  .strict()
  .superRefine((batch, context) => {
    batch.movements.forEach((movement, index) => {
      if (
        ['sale_consumption', 'recipe_consumption'].includes(batch.kind) &&
        movement.condition !== 'available'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['movements', index, 'condition'],
          message: 'Sale and recipe consumption can only debit Available stock.',
        });
      }
      if (batch.kind === 'opening_balance' && movement.baseDelta.startsWith('-')) {
        context.addIssue({
          code: 'custom',
          path: ['movements', index, 'baseDelta'],
          message: 'Opening balances can only add stock.',
        });
      }
    });
  });

export interface InventoryMovementBatchCommand {
  requestId: string;
  sourceType: string;
  sourceId: string;
  kind: string;
  reason: string;
  movements: Array<{
    warehouseId: string;
    stockItemId: string;
    condition: 'available' | 'non_sellable';
    unitCode: string;
    enteredQuantity: string;
    /** Signed quantity in the stock item's immutable base unit. */
    baseDelta: string;
  }>;
}

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
      kind: 'opening_balance',
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

        const movements: InventoryMovementBatchCommand['movements'] = [];
        for (const line of parsed.lines) {
          const [warehouse, item] = await Promise.all([
            transaction.warehouse.findFirst({
              where: {
                id: line.warehouseId,
                merchantId,
                archivedAt: null,
                branch: { archivedAt: null },
              },
              select: { id: true },
            }),
            transaction.stockItem.findFirst({
              where: { id: line.stockItemId, merchantId, archivedAt: null },
              include: { units: true },
            }),
          ]);
          if (!warehouse) throw new NotFoundException('Active warehouse was not found.');
          if (!item) throw new NotFoundException('Active stock item was not found.');
          const enteredQuantity = normalizeStockQuantity(line.quantity);
          const baseDelta = convertToBaseQuantity(
            line.quantity,
            line.unitCode,
            item.baseUnit as Parameters<typeof convertToBaseQuantity>[2],
            item.units.map((unit) => ({
              code: unit.code,
              name: unit.name,
              baseQuantity: unit.baseQuantity.toFixed(6),
            })),
          );
          movements.push({
            warehouseId: warehouse.id,
            stockItemId: item.id,
            condition: line.condition,
            unitCode: line.unitCode,
            enteredQuantity,
            baseDelta,
          });
        }

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

  async listBalances(
    merchantId: string,
    input: StockBalanceListQuery,
  ): Promise<CursorPage<StockBalance>> {
    const query = parseRequest(listStockBalancesSchema, input);
    const where: Prisma.StockBalanceWhereInput = {
      merchantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.branchId ? { warehouse: { branchId: query.branchId } } : {}),
      ...(query.search
        ? {
            OR: [
              { stockItem: { name: { contains: query.search, mode: 'insensitive' } } },
              { warehouse: { name: { contains: query.search, mode: 'insensitive' } } },
              {
                warehouse: {
                  branch: { name: { contains: query.search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.stockBalance.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const rows = await this.prisma.stockBalance.findMany({
      where,
      include: balanceInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map(toBalance);
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }

  async listMovements(
    merchantId: string,
    input: StockMovementListQuery,
  ): Promise<CursorPage<StockMovement>> {
    const query = parseRequest(listStockMovementsSchema, input);
    const where: Prisma.StockMovementWhereInput = {
      merchantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.branchId ? { warehouse: { branchId: query.branchId } } : {}),
      ...(query.kind ? { batch: { kind: query.kind } } : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.stockMovement.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const rows = await this.prisma.stockMovement.findMany({
      where,
      include: movementInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map(toMovement);
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }
}

async function postPreparedMovementBatch(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  actor: string,
  input: InventoryMovementBatchCommand,
  fingerprint: string,
): Promise<StockMovementBatchResult> {
  const command = parseRequest(postingSchema, input) as InventoryMovementBatchCommand;
  const duplicate = await findExistingBatch(
    transaction,
    merchantId,
    command.requestId,
    command.sourceType,
    command.sourceId,
  );
  if (duplicate) return replayBatch(duplicate, fingerprint);

  await lockPostingScope(transaction, merchantId, command.movements);
  const merchantLock = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "merchants" WHERE "id" = ${merchantId}::uuid FOR SHARE`;
  if (merchantLock.length !== 1) throw new NotFoundException('Merchant was not found.');
  const itemIds = [...new Set(command.movements.map((line) => line.stockItemId))].sort();
  const warehouseIds = [...new Set(command.movements.map((line) => line.warehouseId))].sort();
  const [items, warehouses, merchant] = await Promise.all([
    transaction.stockItem.findMany({
      where: { merchantId, id: { in: itemIds }, archivedAt: null },
      include: { units: true },
    }),
    transaction.warehouse.findMany({
      where: {
        merchantId,
        id: { in: warehouseIds },
        archivedAt: null,
        branch: { archivedAt: null },
      },
      select: { id: true, name: true, branch: { select: { id: true, name: true } } },
    }),
    transaction.merchant.findUnique({
      where: { id: merchantId },
      select: { negativeStockPolicy: true },
    }),
  ]);
  if (!merchant) throw new NotFoundException('Merchant was not found.');
  if (items.length !== itemIds.length)
    throw new NotFoundException('Active stock item was not found.');
  if (warehouses.length !== warehouseIds.length)
    throw new NotFoundException('Active warehouse was not found.');
  const itemById = new Map(items.map((item) => [item.id, item]));
  const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

  for (const line of command.movements) {
    const item = itemById.get(line.stockItemId)!;
    const converted = convertToBaseQuantity(
      line.enteredQuantity,
      line.unitCode,
      item.baseUnit as Parameters<typeof convertToBaseQuantity>[2],
      item.units.map((unit) => ({
        code: unit.code,
        name: unit.name,
        baseQuantity: unit.baseQuantity.toFixed(6),
      })),
    );
    if (absoluteDecimal(line.baseDelta) !== converted) {
      throw new BadRequestException('Movement quantity does not match its base-unit delta.');
    }
  }

  const created = await transaction.stockMovementBatch.createMany({
    data: [
      {
        id: randomUUID(),
        merchantId,
        requestId: command.requestId,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        fingerprint,
        kind: command.kind,
        reason: command.reason,
        createdBy: actor,
      },
    ],
    skipDuplicates: true,
  });
  if (created.count === 0) {
    const existing = await findExistingBatch(
      transaction,
      merchantId,
      command.requestId,
      command.sourceType,
      command.sourceId,
    );
    if (existing) return replayBatch(existing, fingerprint);
    throw new ConflictException('This movement command conflicts with an existing source.');
  }
  const batch = await transaction.stockMovementBatch.findUniqueOrThrow({
    where: { merchantId_requestId: { merchantId, requestId: command.requestId } },
    select: { id: true },
  });

  await transaction.stockMovement.createMany({
    data: command.movements.map((line, position) => ({
      merchantId,
      batchId: batch.id,
      warehouseId: line.warehouseId,
      stockItemId: line.stockItemId,
      warehouseName: warehouseById.get(line.warehouseId)!.name,
      branchName: warehouseById.get(line.warehouseId)!.branch.name,
      stockItemName: itemById.get(line.stockItemId)!.name,
      baseUnit: itemById.get(line.stockItemId)!.baseUnit,
      condition: line.condition,
      unitCode: line.unitCode,
      enteredQuantity: line.enteredQuantity,
      baseDelta: normalizeSignedDecimal(line.baseDelta),
      position,
      createdBy: actor,
    })),
  });

  const balancesInOrder = [...command.movements].sort((left, right) =>
    `${left.warehouseId}:${left.stockItemId}:${left.condition}`.localeCompare(
      `${right.warehouseId}:${right.stockItemId}:${right.condition}`,
    ),
  );
  for (const movement of balancesInOrder) {
    const delta = normalizeSignedDecimal(movement.baseDelta);
    const balanceKey = {
      merchantId,
      warehouseId: movement.warehouseId,
      stockItemId: movement.stockItemId,
      condition: movement.condition,
    };
    if (
      delta.startsWith('-') &&
      movement.condition === 'available' &&
      merchant.negativeStockPolicy === 'prevent'
    ) {
      const updated = await transaction.stockBalance.updateMany({
        where: { ...balanceKey, quantity: { gte: delta.slice(1) } },
        data: { quantity: { decrement: delta.slice(1) }, updatedBy: actor },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Insufficient Available stock for this movement.');
      }
    } else {
      await transaction.stockBalance.upsert({
        where: { merchantId_warehouseId_stockItemId_condition: balanceKey },
        create: { ...balanceKey, quantity: delta, updatedBy: actor },
        update: { quantity: { increment: delta }, updatedBy: actor },
      });
    }
  }

  const result = await transaction.stockMovementBatch.findUniqueOrThrow({
    where: { id: batch.id },
    include: { movements: { include: movementInclude, orderBy: { position: 'asc' } } },
  });
  return toBatchResult(result, false);
}

async function lockPostingScope(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  movements: InventoryMovementBatchCommand['movements'],
): Promise<void> {
  const warehouseIds = [...new Set(movements.map((line) => line.warehouseId))].sort();
  const itemIds = [...new Set(movements.map((line) => line.stockItemId))].sort();
  const locations = await transaction.warehouse.findMany({
    where: { merchantId, id: { in: warehouseIds } },
    select: { id: true, branchId: true },
  });
  if (locations.length !== warehouseIds.length)
    throw new NotFoundException('Warehouse was not found.');
  const branchIds = [...new Set(locations.map((location) => location.branchId))].sort();
  for (const branchId of branchIds) {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "branches"
      WHERE "id" = ${branchId}::uuid AND "merchantId" = ${merchantId}::uuid
        AND "archivedAt" IS NULL
      FOR UPDATE`;
    if (rows.length !== 1) throw new NotFoundException('Active branch was not found.');
  }
  for (const stockItemId of itemIds) {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "stock_items"
      WHERE "id" = ${stockItemId}::uuid AND "merchantId" = ${merchantId}::uuid
      FOR UPDATE`;
    if (rows.length !== 1) throw new NotFoundException('Stock item was not found.');
  }
  for (const warehouseId of warehouseIds) {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "warehouses"
      WHERE "id" = ${warehouseId}::uuid AND "merchantId" = ${merchantId}::uuid
        AND "archivedAt" IS NULL
      FOR UPDATE`;
    if (rows.length !== 1) throw new NotFoundException('Active warehouse was not found.');
  }
}

async function findExistingBatch(
  client: PrismaService | Prisma.TransactionClient,
  merchantId: string,
  requestId: string,
  sourceType: string,
  sourceId: string,
) {
  return client.stockMovementBatch.findFirst({
    where: {
      merchantId,
      OR: [{ requestId }, { sourceType, sourceId }],
    },
    include: { movements: { include: movementInclude, orderBy: { position: 'asc' } } },
  });
}

function replayBatch(
  batch: NonNullable<Awaited<ReturnType<typeof findExistingBatch>>>,
  fingerprint: string,
): StockMovementBatchResult {
  if (batch.fingerprint !== fingerprint) {
    throw new ConflictException(
      'This source or request ID was already used with different movement details.',
    );
  }
  return toBatchResult(batch, true);
}

function toBatchResult(
  batch: NonNullable<Awaited<ReturnType<typeof findExistingBatch>>>,
  replayed: boolean,
): StockMovementBatchResult {
  return {
    id: batch.id,
    kind: batch.kind,
    reason: batch.reason,
    createdAt: batch.createdAt.toISOString(),
    replayed,
    movements: batch.movements.map(toMovement),
  };
}

function toBalance(record: BalanceRecord): StockBalance {
  return {
    id: record.id,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse.name,
    branchId: record.warehouse.branchId,
    branchName: record.warehouse.branch.name,
    stockItemId: record.stockItemId,
    stockItemName: record.stockItem.name,
    baseUnit: record.stockItem.baseUnit as StockBalance['baseUnit'],
    condition: record.condition as StockBalance['condition'],
    quantity: decimalText(record.quantity.toFixed(6)),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toMovement(record: MovementRecord): StockMovement {
  return {
    id: record.id,
    batchId: record.batchId,
    kind: record.batch.kind,
    sourceType: record.batch.sourceType,
    sourceId: record.batch.sourceId,
    reason: record.batch.reason,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouseName,
    branchId: record.warehouse.branchId,
    branchName: record.branchName,
    stockItemId: record.stockItemId,
    stockItemName: record.stockItemName,
    baseUnit: record.baseUnit as StockMovement['baseUnit'],
    condition: record.condition as StockMovement['condition'],
    unitCode: record.unitCode,
    enteredQuantity: decimalText(record.enteredQuantity.toFixed(6)),
    baseDelta: decimalText(record.baseDelta.toFixed(6)),
    actor: record.createdBy,
    createdAt: record.createdAt.toISOString(),
  };
}

function fingerprintOpening(input: CreateStockOpeningRequest): string {
  const lines = input.lines
    .map((line) => ({
      warehouseId: line.warehouseId,
      stockItemId: line.stockItemId,
      condition: line.condition,
      unitCode: line.unitCode,
      quantity: normalizeStockQuantity(line.quantity),
    }))
    .sort((a, b) =>
      `${a.warehouseId}:${a.stockItemId}:${a.condition}`.localeCompare(
        `${b.warehouseId}:${b.stockItemId}:${b.condition}`,
      ),
    );
  return createHash('sha256')
    .update(JSON.stringify({ sourceType: 'opening_balance', reason: input.reason, lines }))
    .digest('hex');
}

function fingerprintCommand(command: InventoryMovementBatchCommand): string {
  const lines = command.movements
    .map((line) => ({
      warehouseId: line.warehouseId,
      stockItemId: line.stockItemId,
      condition: line.condition,
      unitCode: line.unitCode,
      enteredQuantity: normalizeStockQuantity(line.enteredQuantity),
      baseDelta: normalizeSignedDecimal(line.baseDelta),
    }))
    .sort((a, b) =>
      `${a.warehouseId}:${a.stockItemId}:${a.condition}`.localeCompare(
        `${b.warehouseId}:${b.stockItemId}:${b.condition}`,
      ),
    );
  return createHash('sha256')
    .update(
      JSON.stringify({
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        kind: command.kind,
        reason: command.reason,
        lines,
      }),
    )
    .digest('hex');
}

function normalizeSignedDecimal(value: string): string {
  const negative = value.startsWith('-');
  const amount = normalizeStockQuantity(negative ? value.slice(1) : value);
  return negative ? `-${amount}` : amount;
}

function absoluteDecimal(value: string): string {
  return normalizeStockQuantity(value.startsWith('-') ? value.slice(1) : value);
}

function decimalText(value: string): string {
  const trimmed = value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return trimmed === '-0' ? '0' : trimmed;
}
