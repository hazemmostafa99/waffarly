import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { Prisma } from '@waffarly/database';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { InventoryLedgerService } from '../../src/modules/inventory/inventory-ledger.service.js';
import { InventoryLocationsService } from '../../src/modules/inventory/inventory-locations.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
import { InventoryVisibilityService } from '../../src/modules/inventory/inventory-visibility.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;

it(
  'calculates tenant-scoped health from base-unit Available balances and revisioned thresholds',
  { skip: !databaseUrl },
  async () => {
    assert.ok(
      databaseUrl,
      'Configure DATABASE_URL and apply the inventory visibility migration first.',
    );
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback inventory visibility fixtures');
    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const token = randomUUID().replaceAll('-', '');
          const merchant = await transaction.merchant.create({
            data: {
              name: `Inventory visibility ${token}`,
              storefrontSlug: `inventory-visibility-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Inventory visibility test',
              ownerMobile: '01100000000',
            },
          });
          const otherMerchant = await transaction.merchant.create({
            data: {
              name: `Other inventory visibility ${token}`,
              storefrontSlug: `other-inventory-visibility-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Other inventory visibility test',
              ownerMobile: '01100000000',
            },
          });
          const scoped = transactionPrisma(transaction);
          const locations = new InventoryLocationsService(scoped);
          const inventory = new InventoryService(scoped);
          const ledger = new InventoryLedgerService(scoped);
          const visibility = new InventoryVisibilityService(scoped);
          const branch = await locations.createBranch(merchant.id, 'visibility-test', {
            name: 'Downtown',
          });
          const warehouse = branch.warehouses[0]!;
          const milk = await inventory.create(merchant.id, 'visibility-test', {
            requestId: randomUUID(),
            name: 'Whole milk',
            baseUnit: 'g',
          });
          const flour = await inventory.create(merchant.id, 'visibility-test', {
            requestId: randomUUID(),
            name: 'Flour',
            baseUnit: 'g',
          });
          const opening = await ledger.createOpening(merchant.id, 'visibility-test', {
            requestId: randomUUID(),
            reason: 'Visibility test opening',
            lines: [
              {
                warehouseId: warehouse.id,
                stockItemId: milk.id,
                condition: 'available',
                quantity: '1.5',
                unitCode: 'kg',
              },
            ],
          });
          await visibility.saveThreshold(merchant.id, 'visibility-test', warehouse.id, milk.id, {
            revision: null,
            minimumAvailableQuantity: '1400',
          });
          const flourThreshold = await visibility.saveThreshold(
            merchant.id,
            'visibility-test',
            warehouse.id,
            flour.id,
            { revision: null, minimumAvailableQuantity: '0' },
          );

          const page = await visibility.listHealth(merchant.id, { limit: 1, search: '' });
          assert.equal(page.items.length, 1);
          assert.ok(page.nextCursor);
          assert.deepEqual(page.summary, {
            configuredItemLocations: 2,
            lowStockItemLocations: 1,
            healthyItemLocations: 1,
          });
          const flourHealth = await visibility.listHealth(merchant.id, {
            limit: 10,
            search: '',
            stockItemId: flour.id,
          });
          assert.equal(flourHealth.items[0]?.availableQuantity, '0');
          assert.equal(flourHealth.items[0]?.state, 'low');

          const updatedFlour = await visibility.saveThreshold(
            merchant.id,
            'visibility-test',
            warehouse.id,
            flour.id,
            { revision: flourThreshold.revision, minimumAvailableQuantity: '2.5' },
          );
          assert.equal(updatedFlour.revision, flourThreshold.revision + 1);
          await assert.rejects(
            visibility.saveThreshold(merchant.id, 'visibility-test', warehouse.id, flour.id, {
              revision: flourThreshold.revision,
              minimumAvailableQuantity: '3',
            }),
            /changed/i,
          );
          await assert.rejects(
            visibility.deleteThreshold(merchant.id, warehouse.id, flour.id, {
              revision: flourThreshold.revision,
            }),
            /changed/i,
          );
          const cleared = await visibility.deleteThreshold(merchant.id, warehouse.id, flour.id, {
            revision: updatedFlour.revision,
          });
          assert.deepEqual(cleared, { cleared: true });
          assert.deepEqual(
            await visibility.deleteThreshold(merchant.id, warehouse.id, flour.id, {
              revision: updatedFlour.revision,
            }),
            { cleared: true },
          );
          const afterClear = await visibility.listHealth(merchant.id, {
            limit: 10,
            search: '',
          });
          assert.equal(afterClear.summary.configuredItemLocations, 1);
          assert.equal(
            afterClear.items.some((item) => item.stockItemId === flour.id),
            false,
          );
          assert.equal(
            (await visibility.getMovement(merchant.id, opening.movements[0]!.id)).id,
            opening.movements[0]!.id,
          );
          await assert.rejects(
            visibility.getMovement(otherMerchant.id, opening.movements[0]!.id),
            /was not found/i,
          );
          await assert.rejects(
            visibility.saveThreshold(
              otherMerchant.id,
              'other-visibility-test',
              warehouse.id,
              milk.id,
              { revision: null, minimumAvailableQuantity: '1' },
            ),
            /warehouse was not found/i,
          );
          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);

function transactionPrisma(transaction: Prisma.TransactionClient): PrismaService {
  return new Proxy(transaction, {
    get(target, property) {
      if (property === '$transaction')
        return async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          callback(target);
      return Reflect.get(target, property, target);
    },
  }) as unknown as PrismaService;
}
