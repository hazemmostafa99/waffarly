/** Creates and updates stock identities and their units without adding stock balances. */
import { ConflictException } from '@nestjs/common';
import type {
  CreateStockItemRequest,
  StockItem,
  UpdateStockItemRequest,
} from '@waffarly/contracts';

import { createHash } from 'node:crypto';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { createStockItemSchema, updateStockItemSchema } from '../inventory.schemas.js';

import { includeUnits, replayCreation, toItem } from './stock-item.mapper.js';
import { assertMutableItem } from './stock-item-access.js';

export async function createStockItem(
  prisma: PrismaService,
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
  const existing = await prisma.stockItem.findUnique({
    where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
    include: includeUnits,
  });
  if (existing) return replayCreation(existing, fingerprint);
  try {
    return toItem(
      await prisma.stockItem.create({
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
    const replay = await prisma.stockItem.findUnique({
      where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
      include: includeUnits,
    });
    if (replay) return replayCreation(replay, fingerprint);
    throw new ConflictException(
      'Stock item could not be created because a unit code is already used.',
    );
  }
}

export async function updateStockItem(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  id: string,
  input: UpdateStockItemRequest,
): Promise<StockItem> {
  const parsed = parseRequest(updateStockItemSchema, input);
  return prisma.$transaction(async (transaction) => {
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
