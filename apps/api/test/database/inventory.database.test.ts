import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;

it(
  'persists tenant-scoped stock identities and immutable units without adding stock',
  { skip: !databaseUrl },
  async () => {
    assert.ok(
      databaseUrl,
      'Configure DATABASE_URL and apply the inventory registry migration first.',
    );
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback inventory verification fixtures');
    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const token = randomUUID().replaceAll('-', '');
          const merchant = await transaction.merchant.create({
            data: {
              name: `Inventory verification ${token}`,
              storefrontSlug: `inventory-verification-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Inventory verification',
              ownerMobile: '01100000000',
            },
          });
          const other = await transaction.merchant.create({
            data: {
              name: `Inventory other ${token}`,
              storefrontSlug: `inventory-other-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Inventory other',
              ownerMobile: '01100000000',
            },
          });
          const txClient = new Proxy(transaction, {
            get(target, property) {
              if (property === '$transaction')
                return async (callback: (tx: typeof transaction) => Promise<unknown>) =>
                  callback(target);
              return Reflect.get(target, property, target);
            },
          }) as unknown as PrismaService;
          const inventory = new InventoryService(txClient);
          const input = {
            requestId: randomUUID(),
            name: 'Whole milk',
            description: 'Fresh milk',
            baseUnit: 'ml' as const,
            units: [{ code: 'carton', name: 'Carton', baseQuantity: '1000' }],
          };
          const created = await inventory.create(merchant.id, 'inventory-test-owner', input);
          assert.equal(created.units.length, 1);
          const replay = await inventory.create(merchant.id, 'inventory-test-owner', input);
          assert.equal(replay.id, created.id);
          await assert.rejects(
            inventory.create(merchant.id, 'inventory-test-owner', {
              ...input,
              name: 'Different item',
            }),
            /already used/i,
          );
          assert.equal(
            (
              await inventory.convert(merchant.id, created.id, {
                quantity: '1.5',
                unitCode: 'carton',
              })
            ).baseQuantity,
            '1500',
          );
          assert.equal(
            (await inventory.convert(merchant.id, created.id, { quantity: '1', unitCode: 'l' }))
              .baseQuantity,
            '1000',
          );
          await assert.rejects(
            inventory.convert(merchant.id, created.id, { quantity: '1', unitCode: 'kg' }),
            /incompatible/i,
          );

          const updated = await inventory.update(merchant.id, 'inventory-test-owner', created.id, {
            name: created.name,
            description: created.description ?? '',
            revision: created.revision,
            additionalUnits: [{ code: 'bottle', name: 'Bottle', baseQuantity: '330' }],
          });
          assert.equal(updated.revision, created.revision + 1);
          assert.equal(updated.units.length, 2);
          await assert.rejects(
            inventory.update(merchant.id, 'inventory-test-owner', created.id, {
              name: 'Stale edit',
              revision: created.revision,
            }),
            /changed or has an incompatible status/i,
          );
          const archived = await inventory.setArchived(
            merchant.id,
            'inventory-test-owner',
            created.id,
            true,
            { revision: updated.revision },
          );
          await assert.rejects(
            inventory.convert(merchant.id, created.id, { quantity: '1', unitCode: 'ml' }),
            /archived/i,
          );
          const restored = await inventory.setArchived(
            merchant.id,
            'inventory-test-owner',
            created.id,
            false,
            { revision: archived.revision },
          );
          assert.equal(restored.archivedAt, null);

          await assert.rejects(inventory.get(other.id, created.id), /Stock item was not found/i);
          const page = await inventory.list(merchant.id, {
            limit: 1,
            search: '',
            status: 'active',
          });
          assert.equal(page.items.length, 1);
          assert.equal(page.items[0]?.id, created.id);
          await assert.rejects(
            inventory.list(other.id, { limit: 1, search: '', status: 'all', cursor: created.id }),
            /Pagination cursor is invalid/i,
          );

          const persistedItem = await transaction.stockItem.findUniqueOrThrow({
            where: { id: created.id },
          });
          assert.equal(persistedItem.merchantId, merchant.id);
          assert.equal(
            await transaction.stockItemUnit.count({ where: { stockItemId: created.id } }),
            2,
          );
          assert.equal(
            await transaction.stockItem.count({ where: { merchantId: merchant.id } }),
            1,
          );
          // Creating or editing an M1 stock identity still has no balance side effect.
          assert.equal(
            await transaction.stockBalance.count({ where: { merchantId: merchant.id } }),
            0,
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
