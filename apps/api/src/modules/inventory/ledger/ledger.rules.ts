import {
  isPositiveStockQuantity,
  STOCK_CONDITIONS,
  type CreateStockOpeningRequest,
} from '@waffarly/contracts';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { normalizeStockQuantity } from '../stock-quantity.js';

export const INVENTORY_MOVEMENT_KINDS = [
  'opening_balance',
  'purchase_receipt',
  'sale_consumption',
  'sale_restoration',
  'recipe_consumption',
  'recipe_restoration',
  'adjustment',
] as const;
export type InventoryMovementKind = (typeof INVENTORY_MOVEMENT_KINDS)[number];

const identifierCode = /^[a-z][a-z0-9_]{0,31}$/;
const unitCode = /^[a-z][a-z0-9_-]{0,31}$/;

export const postingSchema = z
  .object({
    requestId: z.string().uuid(),
    sourceType: z.string().regex(identifierCode),
    sourceId: z.string().trim().min(1).max(80),
    kind: z.enum(INVENTORY_MOVEMENT_KINDS),
    reason: z.string().trim().min(1).max(500),
    movements: z
      .array(
        z
          .object({
            warehouseId: z.string().uuid(),
            stockItemId: z.string().uuid(),
            condition: z.enum(STOCK_CONDITIONS),
            unitCode: z.string().regex(unitCode),
            enteredQuantity: z.string().refine(isPositiveStockQuantity),
            baseDelta: z
              .string()
              .refine((value) =>
                isPositiveStockQuantity(value.startsWith('-') ? value.slice(1) : value),
              ),
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
        [
          'sale_consumption',
          'sale_restoration',
          'recipe_consumption',
          'recipe_restoration',
        ].includes(batch.kind) &&
        movement.condition !== 'available'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['movements', index, 'condition'],
          message: 'Sale and recipe consumption can only debit Available stock.',
        });
      }
      if (
        ['sale_consumption', 'recipe_consumption'].includes(batch.kind) &&
        !movement.baseDelta.startsWith('-')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['movements', index, 'baseDelta'],
          message: 'Consumption must debit stock.',
        });
      }
      if (
        ['opening_balance', 'purchase_receipt', 'recipe_restoration', 'sale_restoration'].includes(
          batch.kind,
        ) &&
        movement.baseDelta.startsWith('-')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['movements', index, 'baseDelta'],
          message: 'Opening balances, receipts and restorations can only add stock.',
        });
      }
    });
  });

export interface InventoryMovementBatchCommand {
  requestId: string;
  sourceType: string;
  sourceId: string;
  kind: InventoryMovementKind;
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

export function fingerprintOpening(input: CreateStockOpeningRequest): string {
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

export function fingerprintCommand(command: InventoryMovementBatchCommand): string {
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

export function normalizeSignedDecimal(value: string): string {
  const negative = value.startsWith('-');
  const amount = normalizeStockQuantity(negative ? value.slice(1) : value);
  return negative ? `-${amount}` : amount;
}

export function absoluteDecimal(value: string): string {
  return normalizeStockQuantity(value.startsWith('-') ? value.slice(1) : value);
}

export function decimalText(value: string): string {
  const trimmed = value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return trimmed === '-0' ? '0' : trimmed;
}
