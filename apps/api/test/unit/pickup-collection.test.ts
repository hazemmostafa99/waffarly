import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { PosOrdersService } from '../../src/modules/orders/pos-sales/pos-orders.service.js';

function fixture(mode: 'new' | 'replay' | 'foreign' | 'other-shift') {
  const writes: string[] = [];
  const tx = {
    $queryRaw: async () => [],
    storefrontOrder: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        assert.equal(where.merchantId, 'merchant');
        assert.equal(where.branchId, 'branch');
        assert.equal(where.source, 'storefront');
        assert.equal(where.fulfillmentType, 'pickup');
        if (mode === 'foreign') return null;
        return {
          id: 'order',
          total: '125.00',
          status: 'ready',
          posShiftId: mode === 'new' ? null : mode === 'other-shift' ? 'other' : 'shift',
          checks: mode === 'new' ? [] : [{ id: 'check' }],
        };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        assert.equal(data.posShiftId, 'shift');
        assert.equal(data.source, undefined);
        writes.push('attach');
      },
    },
    posOrderCheck: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        assert.equal(data.amount, '125.00');
        assert.equal(data.splitMethod, 'whole');
        writes.push('check');
      },
    },
    storefrontOrderAction: {
      create: async () => {
        writes.push('audit');
      },
    },
  };
  const prisma = { $transaction: async (run: (db: typeof tx) => Promise<unknown>) => run(tx) };
  const shifts = {
    lockOpenShiftForSale: async (_db: unknown, _employee: unknown, register: string) => {
      assert.equal(register, 'register');
      return { id: 'shift', branchId: 'branch' };
    },
  };
  const service = new PosOrdersService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    shifts as never,
    {} as never,
    {} as never,
  );
  const employee = {
    id: 'cashier',
    merchantId: 'merchant',
    permissions: ['sell'],
  } as unknown as PosEmployeeSession;
  return { run: () => service.preparePickupCollection(employee, 'order', 'register'), writes };
}

test('pickup collection attaches one whole check at authoritative total without creating payment or changing source', async () => {
  const f = fixture('new');
  assert.deepEqual(await f.run(), { orderId: 'order' });
  assert.deepEqual(f.writes, ['attach', 'check', 'audit']);
});
test('same-shift preparation reuses the existing check without writes', async () => {
  const f = fixture('replay');
  await f.run();
  assert.deepEqual(f.writes, []);
});
test('another shift cannot claim an existing pickup collection', async () => {
  const f = fixture('other-shift');
  await assert.rejects(f.run(), ConflictException);
  assert.deepEqual(f.writes, []);
});
test('pickup collection cannot access an order outside the register branch and tenant', async () => {
  const f = fixture('foreign');
  await assert.rejects(f.run(), NotFoundException);
  assert.deepEqual(f.writes, []);
});
