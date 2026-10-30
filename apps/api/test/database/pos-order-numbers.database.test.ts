import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { allocatePosOrderReference } from '../../src/modules/orders/pos-order-number.persistence.js';

// Only run against an explicitly designated disposable, migrated database.
const databaseUrl = process.env.POS_NUMBER_TEST_DATABASE_URL;
it(
  'allocates distinct daily numbers concurrently and rolls back failed allocations',
  { skip: !databaseUrl },
  async () => {
    const db = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const token = randomUUID();
    const merchant = await db.merchant.create({
      data: {
        name: 'Order number test',
        storefrontSlug: `number-test-${token}`,
        activity: 'restaurant',
        contactPhone: '01000000000',
        ownerName: 'Test',
        ownerMobile: '01000000000',
      },
    });
    try {
      const branch = await db.branch.create({
        data: { merchantId: merchant.id, name: 'Test', createdBy: 'test', updatedBy: 'test' },
      });
      const other = await db.branch.create({
        data: { merchantId: merchant.id, name: 'Other', createdBy: 'test', updatedBy: 'test' },
      });
      const allocate = (branchId: string) =>
        db.$transaction((tx) => allocatePosOrderReference(tx, merchant.id, branchId));
      const [first, second] = await Promise.all([allocate(branch.id), allocate(branch.id)]);
      assert.notEqual(first, second);
      assert.deepEqual([first.slice(-4), second.slice(-4)].sort(), ['0001', '0002']);
      const elsewhere = await allocate(other.id);
      assert.ok(elsewhere.endsWith('-0001'));
      assert.notEqual(elsewhere.split('-')[0], first.split('-')[0]);
      await assert.rejects(
        db.$transaction(async (tx) => {
          await allocatePosOrderReference(tx, merchant.id, branch.id);
          throw new Error('rollback');
        }),
        /rollback/,
      );
      assert.ok((await allocate(branch.id)).endsWith('-0003'));
    } finally {
      await db.posOrderDailyCounter.deleteMany({ where: { merchantId: merchant.id } });
      await db.posOrderBranchCode.deleteMany({ where: { merchantId: merchant.id } });
      await db.branch.deleteMany({ where: { merchantId: merchant.id } });
      await db.merchant.delete({ where: { id: merchant.id } });
      await db.$disconnect();
    }
  },
);
