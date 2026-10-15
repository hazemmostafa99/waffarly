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

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;

it(
  'posts opening stock idempotently, preserves snapshots, scopes locations, and enforces policy',
  { skip: !databaseUrl },
  async () => {
    assert.ok(
      databaseUrl,
      'Configure DATABASE_URL and apply the inventory ledger migration first.',
    );
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback inventory ledger verification fixtures');
    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const token = randomUUID().replaceAll('-', '');
          const merchant = await transaction.merchant.create({
            data: {
              name: `Inventory ledger ${token}`,
              storefrontSlug: `inventory-ledger-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Inventory ledger test',
              ownerMobile: '01100000000',
            },
          });
          const otherMerchant = await transaction.merchant.create({
            data: {
              name: `Other inventory ledger ${token}`,
              storefrontSlug: `other-inventory-ledger-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Other inventory ledger test',
              ownerMobile: '01100000000',
            },
          });
          const txClient = transactionPrisma(transaction);
          const inventory = new InventoryService(txClient);
          const locations = new InventoryLocationsService(txClient);
          const ledger = new InventoryLedgerService(txClient);
          const branch = await locations.createBranch(merchant.id, 'inventory-ledger-test', {
            name: 'Downtown',
            defaultWarehouseName: 'Main',
          });
          const mainWarehouse = branch.warehouses[0]!;
          let currentBranch = await locations.createWarehouse(
            merchant.id,
            'inventory-ledger-test',
            branch.id,
            { revision: branch.revision, name: 'Prep' },
          );
          const prep = currentBranch.warehouses.find((warehouse) => warehouse.name === 'Prep')!;
          currentBranch = await locations.setDefaultConsumptionWarehouse(
            merchant.id,
            'inventory-ledger-test',
            branch.id,
            { revision: currentBranch.revision, warehouseId: prep.id },
          );
          assert.equal(currentBranch.defaultConsumptionWarehouseId, prep.id);

          const milk = await inventory.create(merchant.id, 'inventory-ledger-test', {
            requestId: randomUUID(),
            name: 'Whole milk',
            baseUnit: 'g',
            units: [{ code: 'bag-10', name: 'Small bag', baseQuantity: '10' }],
          });
          const otherBranch = await locations.createBranch(otherMerchant.id, 'other-ledger-test', {
            name: 'Other branch',
          });
          const otherWarehouse = otherBranch.warehouses[0]!;
          const otherItem = await inventory.create(otherMerchant.id, 'other-ledger-test', {
            requestId: randomUUID(),
            name: 'Other item',
            baseUnit: 'g',
          });

          const opening = {
            requestId: randomUUID(),
            reason: 'Opening count after stocktake',
            lines: [
              {
                warehouseId: mainWarehouse.id,
                stockItemId: milk.id,
                condition: 'available' as const,
                quantity: '1.5',
                unitCode: 'kg',
              },
              {
                warehouseId: mainWarehouse.id,
                stockItemId: milk.id,
                condition: 'non_sellable' as const,
                quantity: '200',
                unitCode: 'bag-10',
              },
            ],
          };
          const posted = await ledger.createOpening(merchant.id, 'inventory-ledger-test', opening);
          assert.equal(posted.replayed, false);
          assert.equal(posted.movements[0]?.baseDelta, '1500');
          assert.equal(posted.movements[0]?.sourceType, 'opening_balance');
          assert.equal(posted.movements[1]?.baseDelta, '2000');
          const replay = await ledger.createOpening(merchant.id, 'inventory-ledger-test', opening);
          assert.equal(replay.replayed, true);
          assert.equal(replay.id, posted.id);
          await assert.rejects(
            ledger.createOpening(merchant.id, 'inventory-ledger-test', {
              ...opening,
              reason: 'Different opening details',
            }),
            /already used/i,
          );
          await assert.rejects(
            ledger.postMovementBatch(transaction, merchant.id, 'inventory-ledger-test', {
              requestId: randomUUID(),
              sourceType: 'verification_recipe',
              sourceId: randomUUID(),
              kind: 'recipe_consumption',
              reason: 'Non-Sellable cannot supply a recipe',
              movements: [
                {
                  warehouseId: mainWarehouse.id,
                  stockItemId: milk.id,
                  condition: 'non_sellable',
                  unitCode: 'g',
                  enteredQuantity: '1',
                  baseDelta: '-1',
                },
              ],
            }),
            /Bad Request Exception/i,
          );

          await assert.rejects(
            ledger.createOpening(merchant.id, 'inventory-ledger-test', {
              requestId: randomUUID(),
              reason: 'Foreign warehouse',
              lines: [
                {
                  warehouseId: otherWarehouse.id,
                  stockItemId: milk.id,
                  condition: 'available',
                  quantity: '1',
                  unitCode: 'g',
                },
              ],
            }),
            /warehouse was not found/i,
          );
          await assert.rejects(
            ledger.createOpening(merchant.id, 'inventory-ledger-test', {
              requestId: randomUUID(),
              reason: 'Foreign stock item',
              lines: [
                {
                  warehouseId: mainWarehouse.id,
                  stockItemId: otherItem.id,
                  condition: 'available',
                  quantity: '1',
                  unitCode: 'g',
                },
              ],
            }),
            /stock item was not found/i,
          );

          const defaultPolicy = await locations.getPolicy(merchant.id);
          assert.equal(defaultPolicy.negativeStockPolicy, 'allow');
          await ledger.postMovementBatch(transaction, merchant.id, 'inventory-ledger-test', {
            requestId: randomUUID(),
            sourceType: 'verification_allow_debit',
            sourceId: randomUUID(),
            kind: 'adjustment' as const,
            reason: 'Verify default negative stock policy',
            movements: [
              {
                warehouseId: mainWarehouse.id,
                stockItemId: milk.id,
                condition: 'available',
                unitCode: 'g',
                enteredQuantity: '2000',
                baseDelta: '-2000',
              },
            ],
          });

          const adjustment = {
            requestId: randomUUID(),
            sourceType: 'verification_adjustment',
            sourceId: randomUUID(),
            kind: 'adjustment' as const,
            reason: 'Count correction',
            movements: [
              {
                warehouseId: mainWarehouse.id,
                stockItemId: milk.id,
                condition: 'available' as const,
                unitCode: 'g',
                enteredQuantity: '2010',
                baseDelta: '2010',
              },
            ],
          };
          const adjusted = await ledger.postMovementBatch(
            transaction,
            merchant.id,
            'inventory-ledger-test',
            adjustment,
          );
          const adjustedReplay = await ledger.postMovementBatch(
            transaction,
            merchant.id,
            'inventory-ledger-test',
            adjustment,
          );
          assert.equal(adjustedReplay.replayed, true);
          assert.equal(adjustedReplay.id, adjusted.id);
          await assert.rejects(
            ledger.postMovementBatch(transaction, merchant.id, 'inventory-ledger-test', {
              ...adjustment,
              requestId: randomUUID(),
              movements: [
                { ...adjustment.movements[0]!, enteredQuantity: '2011', baseDelta: '2011' },
              ],
            }),
            /already used/i,
          );

          await locations.updateBranch(merchant.id, 'inventory-ledger-test', branch.id, {
            revision: currentBranch.revision,
            name: 'Downtown renamed',
          });
          currentBranch = await locations.updateWarehouse(
            merchant.id,
            'inventory-ledger-test',
            branch.id,
            mainWarehouse.id,
            {
              revision: currentBranch.warehouses.find(
                (warehouse) => warehouse.id === mainWarehouse.id,
              )!.revision,
              name: 'Pantry',
            },
          );
          const renamedMilk = await inventory.update(
            merchant.id,
            'inventory-ledger-test',
            milk.id,
            {
              revision: milk.revision,
              name: 'Fresh milk',
            },
          );
          const balancePage = await ledger.listBalances(merchant.id, { limit: 10, search: '' });
          assert.equal(balancePage.items.length, 2);
          const availableBalance = balancePage.items.find(
            (balance) => balance.condition === 'available',
          )!;
          const nonSellableBalance = balancePage.items.find(
            (balance) => balance.condition === 'non_sellable',
          )!;
          assert.equal(availableBalance.quantity, '1510');
          assert.equal(availableBalance.warehouseName, 'Pantry');
          assert.equal(nonSellableBalance.quantity, '2000');
          await assert.rejects(
            ledger.listBalances(otherMerchant.id, {
              limit: 10,
              search: '',
              cursor: availableBalance.id,
            }),
            /cursor is invalid/i,
          );
          const movementPage = await ledger.listMovements(merchant.id, { limit: 10 });
          assert.equal(movementPage.items.length, 4);
          const openingHistory = movementPage.items.find(
            (movement) => movement.batchId === posted.id,
          )!;
          assert.equal(openingHistory.warehouseName, 'Main');
          assert.equal(openingHistory.branchName, 'Downtown');
          assert.equal(openingHistory.stockItemName, 'Whole milk');

          await assert.rejects(
            inventory.setArchived(merchant.id, 'inventory-ledger-test', renamedMilk.id, true, {
              revision: renamedMilk.revision,
            }),
            /non-zero stock cannot be archived/i,
          );
          await assert.rejects(
            locations.setWarehouseArchived(
              merchant.id,
              'inventory-ledger-test',
              branch.id,
              mainWarehouse.id,
              true,
              { revision: 1 },
            ),
            /non-zero stock cannot be archived/i,
          );
          await assert.rejects(
            locations.setWarehouseArchived(
              merchant.id,
              'inventory-ledger-test',
              branch.id,
              prep.id,
              true,
              { revision: prep.revision },
            ),
            /default consumption warehouse/i,
          );
          await assert.rejects(
            locations.setBranchArchived(merchant.id, 'inventory-ledger-test', branch.id, true, {
              revision: currentBranch.revision,
            }),
            /non-zero stock cannot be archived/i,
          );

          await locations.updatePolicy(merchant.id, 'inventory-ledger-test', {
            revision: defaultPolicy.revision,
            negativeStockPolicy: 'prevent',
          });
          await assert.rejects(
            ledger.postMovementBatch(transaction, merchant.id, 'inventory-ledger-test', {
              requestId: randomUUID(),
              sourceType: 'verification_debit',
              sourceId: randomUUID(),
              kind: 'adjustment',
              reason: 'Insufficient stock check',
              movements: [
                {
                  warehouseId: mainWarehouse.id,
                  stockItemId: milk.id,
                  condition: 'available',
                  unitCode: 'g',
                  enteredQuantity: '2000',
                  baseDelta: '-2000',
                },
              ],
            }),
            /insufficient Available stock/i,
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

it(
  'allows independent postings while preserving balance increments and archive safety',
  { skip: !databaseUrl },
  async () => {
    assert.ok(
      databaseUrl,
      'Configure DATABASE_URL and apply the inventory ledger migration first.',
    );
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    let merchantId: string | undefined;
    try {
      const token = randomUUID().replaceAll('-', '');
      const merchant = await client.merchant.create({
        data: {
          name: `Inventory concurrency ${token}`,
          storefrontSlug: `inventory-concurrency-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'Inventory concurrency test',
          ownerMobile: '01100000000',
        },
      });
      merchantId = merchant.id;
      const inventory = new InventoryService(client as unknown as PrismaService);
      const locations = new InventoryLocationsService(client as unknown as PrismaService);
      const ledger = new InventoryLedgerService(client as unknown as PrismaService);
      const branch = await locations.createBranch(merchant.id, 'inventory-concurrency-test', {
        name: 'Concurrent branch',
      });
      const item = await inventory.create(merchant.id, 'inventory-concurrency-test', {
        requestId: randomUUID(),
        name: 'Concurrent flour',
        baseUnit: 'g',
      });
      const warehouse = branch.warehouses[0]!;
      const post = (quantity: string) =>
        ledger.createOpening(merchant.id, 'inventory-concurrency-test', {
          requestId: randomUUID(),
          reason: `Concurrent opening ${quantity}`,
          lines: [
            {
              warehouseId: warehouse.id,
              stockItemId: item.id,
              condition: 'available',
              quantity,
              unitCode: 'g',
            },
          ],
        });
      await Promise.all([post('1.25'), post('2.5')]);
      const balances = await ledger.listBalances(merchant.id, { limit: 10, search: '' });
      assert.equal(balances.items.length, 1);
      assert.equal(balances.items[0]?.quantity, '3.75');
      const secondItem = await inventory.create(merchant.id, 'inventory-concurrency-test', {
        requestId: randomUUID(),
        name: 'Independent item',
        baseUnit: 'piece',
      });
      let release!: () => void;
      let ready!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const posted = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const holding = client.$transaction(
        async (transaction) => {
          await ledger.postMovementBatch(transaction, merchant.id, 'inventory-concurrency-test', {
            requestId: randomUUID(),
            sourceType: 'concurrency_test',
            sourceId: randomUUID(),
            kind: 'adjustment',
            reason: 'Hold first balance',
            movements: [
              {
                warehouseId: warehouse.id,
                stockItemId: item.id,
                condition: 'available',
                unitCode: 'g',
                enteredQuantity: '1',
                baseDelta: '1',
              },
            ],
          });
          ready();
          await gate;
        },
        { timeout: 10000 },
      );
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([posted, holding]);
        // Same branch and warehouse, but a different balance: this must not wait
        // for the first posting to commit.
        await Promise.race([
          ledger.createOpening(merchant.id, 'inventory-concurrency-test', {
            requestId: randomUUID(),
            reason: 'Independent opening',
            lines: [
              {
                warehouseId: warehouse.id,
                stockItemId: secondItem.id,
                condition: 'available',
                unitCode: 'piece',
                quantity: '1',
              },
            ],
          }),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Independent posting was blocked by parent locks.')),
              2000,
            );
          }),
        ]);
        await assert.rejects(
          client.$transaction(async (transaction) => {
            await transaction.$executeRaw`SET LOCAL lock_timeout = '100ms'`;
            await new InventoryService(transactionPrisma(transaction)).setArchived(
              merchant.id,
              'inventory-concurrency-test',
              item.id,
              true,
              { revision: item.revision },
            );
          }),
          /lock timeout/i,
        );
      } finally {
        if (timeout) clearTimeout(timeout);
        release();
        await holding;
      }
      await assert.rejects(
        inventory.setArchived(merchant.id, 'inventory-concurrency-test', item.id, true, {
          revision: item.revision,
        }),
        /non-zero stock/i,
      );
    } finally {
      if (merchantId) {
        await client.stockMovement.deleteMany({ where: { merchantId } });
        await client.stockMovementBatch.deleteMany({ where: { merchantId } });
        await client.stockBalance.deleteMany({ where: { merchantId } });
        await client.warehouse.deleteMany({ where: { merchantId } });
        await client.branch.deleteMany({ where: { merchantId } });
        await client.stockItemUnit.deleteMany({ where: { merchantId } });
        await client.stockItem.deleteMany({ where: { merchantId } });
        await client.merchant.delete({ where: { id: merchantId } });
      }
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
