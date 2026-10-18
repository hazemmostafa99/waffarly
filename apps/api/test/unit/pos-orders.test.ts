import { ForbiddenException } from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PosOrdersService } from '../../src/modules/orders/pos-orders.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';
const secondProductId = '55555555-5555-4555-8555-555555555555';
const lineId = '66666666-6666-4666-8666-666666666666';
const secondLineId = '77777777-7777-4777-8777-777777777777';

const employee: PosEmployeeSession = {
  id: employeeId,
  merchantId,
  username: 'cashier1',
  displayName: 'Cashier One',
  role: 'cashier',
  permissions: ['sell'],
  branches: [{ id: branchId, name: 'Main', archivedAt: null }],
};

function quote(product: string, price: string) {
  return {
    productId: product,
    productRevision: 3,
    variantId: null,
    variantName: null,
    variantAttributes: [],
    currency: 'EGP' as const,
    basePrice: price,
    modifierTotal: '0.00',
    totalPrice: price,
    selections: [],
  };
}

describe('POS sales', () => {
  it('requires the assigned sell permission before quoting', async () => {
    const pricing = { quoteForMerchant: async () => quote(productId, '2.25') };
    const service = new PosOrdersService(
      {} as never,
      pricing as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await assert.rejects(
      service.quote(
        { ...employee, permissions: ['accept_recipe_orders'] },
        {
          items: [{ lineId, productId, selections: [], quantity: 1 }],
        },
      ),
      ForbiddenException,
    );
  });

  it('uses merchant scoped server quotes and totals multiple cart lines in integer cents', async () => {
    const calls: unknown[][] = [];
    const pricing = {
      quoteForMerchant: async (...args: unknown[]) => {
        calls.push(args);
        const [, scopedProduct] = args as [string, string];
        return quote(scopedProduct, scopedProduct === productId ? '2.25' : '4.10');
      },
    };
    const service = new PosOrdersService(
      {} as never,
      pricing as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.quote(employee, {
      items: [
        { lineId, productId, selections: [], quantity: 3 },
        { lineId: secondLineId, productId: secondProductId, selections: [], quantity: 2 },
      ],
    });

    assert.equal(result.subtotal, '14.95');
    assert.equal(result.total, '14.95');
    assert.deepEqual(
      result.items.map((item) => item.lineTotal),
      ['6.75', '8.20'],
    );
    assert.deepEqual(calls, [
      [merchantId, productId, [], undefined, 3, undefined],
      [merchantId, secondProductId, [], undefined, 2, undefined],
    ]);
  });

  it('rejects malformed sale commands before opening a transaction', async () => {
    let transactionOpened = false;
    const prisma = {
      $transaction: async () => {
        transactionOpened = true;
        throw new Error('Transaction must not start');
      },
    };
    const service = new PosOrdersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await assert.rejects(
      service.create(employee, {
        requestId: '88888888-8888-4888-8888-888888888888',
        registerId: '99999999-9999-4999-8999-999999999999',
        fulfillmentType: 'delivery',
        items: [{ lineId, productId, selections: [], quantity: 1, expectedProductRevision: 3 }],
      }),
    );
    assert.equal(transactionOpened, false);
  });
});
