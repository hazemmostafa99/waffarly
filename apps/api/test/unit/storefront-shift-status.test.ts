import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { OrderLifecycleService } from '../../src/modules/orders/fulfillment/order-lifecycle.service.js';

const merchant = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const requestId = '44444444-4444-4444-8444-444444444444';
function fixture() {
  let writes = 0;
  const order = { id: orderId, source: 'storefront', branchId, lines: [] };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) =>
      strings.join('').includes('FROM "pos_shifts"') ? [] : [{ id: orderId }],
    storefrontOrder: {
      findFirst: async () => order,
      findFirstOrThrow: async () => order,
      update: async () => {
        writes++;
        throw new Error('Status must not be changed');
      },
    },
    branch: { findFirst: async () => ({ id: branchId }) },
    storefrontOrderAction: { findUnique: async () => null },
  };
  const prisma = { $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx) };
  return {
    service: new OrderLifecycleService(prisma as never, {} as never, {} as never),
    writes: () => writes,
  };
}

test('web order acceptance requires an open branch shift before any status or stock write', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.accept(merchant, 'owner', orderId, { requestId, branchId }),
    ConflictException,
  );
  assert.equal(f.writes(), 0);
});
test('web order preparation requires an open branch shift', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.startPreparation(merchant, 'owner', orderId, { requestId }),
    ConflictException,
  );
  assert.equal(f.writes(), 0);
});
test('POS cannot mark a web order ready without an open branch shift', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.markReadyFromPos(merchant, 'pos:cashier', orderId, { requestId }, [branchId]),
    ConflictException,
  );
  assert.equal(f.writes(), 0);
});
test('POS cannot hand over a web order without an open branch shift', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.handoverFromPos(merchant, 'pos:cashier', orderId, { requestId }, [branchId]),
    ConflictException,
  );
  assert.equal(f.writes(), 0);
});
