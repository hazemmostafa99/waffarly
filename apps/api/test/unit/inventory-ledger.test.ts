import { BadRequestException, ConflictException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  InventoryLedgerService,
  type InventoryMovementBatchCommand,
} from '../../src/modules/inventory/inventory-ledger.service.js';
import { InventoryLocationsService } from '../../src/modules/inventory/inventory-locations.service.js';

describe('ledger command invariants', () => {
  const command: InventoryMovementBatchCommand = {
    requestId: randomUUID(),
    sourceType: 'order',
    sourceId: randomUUID(),
    kind: 'sale_consumption',
    reason: 'Sale',
    movements: [
      {
        warehouseId: randomUUID(),
        stockItemId: randomUUID(),
        condition: 'available',
        unitCode: 'piece',
        enteredQuantity: '1',
        baseDelta: '-1',
      },
    ],
  };

  for (const kind of ['sale_consumption', 'recipe_consumption'] as const) {
    it(`rejects a positive ${kind} before accessing persistence`, async () => {
      const ledger = new InventoryLedgerService({} as never);
      await assert.rejects(
        ledger.postMovementBatch({} as never, randomUUID(), 'test', {
          ...command,
          kind,
          movements: [{ ...command.movements[0]!, baseDelta: '1' }],
        }),
        BadRequestException,
      );
      await assert.rejects(
        ledger.postMovementBatch({} as never, randomUUID(), 'test', {
          ...command,
          kind,
          movements: [{ ...command.movements[0]!, condition: 'non_sellable' }],
        }),
        BadRequestException,
      );
    });
  }

  for (const kind of ['opening_balance', 'purchase_receipt', 'recipe_restoration'] as const) {
    it(`rejects a debit ${kind} before accessing persistence`, async () => {
      const ledger = new InventoryLedgerService({} as never);
      await assert.rejects(
        ledger.postMovementBatch({} as never, randomUUID(), 'test', { ...command, kind }),
        BadRequestException,
      );
    });
  }

  it('restricts recipe restoration to Available stock', async () => {
    const ledger = new InventoryLedgerService({} as never);
    await assert.rejects(
      ledger.postMovementBatch({} as never, randomUUID(), 'test', {
        ...command,
        kind: 'recipe_restoration',
        movements: [{ ...command.movements[0]!, condition: 'non_sellable', baseDelta: '1' }],
      }),
      BadRequestException,
    );
  });

  it('requires an explicit supported movement kind', async () => {
    const ledger = new InventoryLedgerService({} as never);
    await assert.rejects(
      ledger.postMovementBatch({} as never, randomUUID(), 'test', {
        ...command,
        kind: 'unknown' as InventoryMovementBatchCommand['kind'],
      }),
      BadRequestException,
    );
  });
});

it('turns a duplicate branch rename into a conflict response', async () => {
  const locations = new InventoryLocationsService({
    branch: {
      updateMany: async () => {
        throw Object.assign(new Error('Duplicate name'), { code: 'P2002' });
      },
    },
  } as never);
  await assert.rejects(
    locations.updateBranch(randomUUID(), 'test', randomUUID(), {
      name: 'Existing branch',
      revision: 1,
    }),
    ConflictException,
  );
});
