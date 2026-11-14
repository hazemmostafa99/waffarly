import { ForbiddenException } from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PosOrdersService } from '../../src/modules/orders/pos-sales/pos-orders.service.js';

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
  it('retries serialization conflicts without changing the sale request', async () => {
    let attempts = 0;
    const tx = { storefrontOrderAction: { findUnique: async () => null } };
    const prisma = {
      ...tx,
      $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    };
    const shifts = {
      lockOpenShiftForSale: async () => {
        attempts++;
        if (attempts < 3) throw { code: 'P2034' };
        throw new Error('reached third attempt');
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
    await assert.rejects(
      service.create(employee, {
        requestId: '88888888-8888-4888-8888-888888888888',
        registerId: '99999999-9999-4999-8999-999999999999',
        fulfillmentType: 'takeaway',
        items: [{ lineId, productId, selections: [], quantity: 1, expectedProductRevision: 3 }],
      }),
      /reached third attempt/,
    );
    assert.equal(attempts, 3);
  });

  it('scopes the paginated sales recovery list to an assigned active branch and sell permission', async () => {
    const queries: Array<{
      where: {
        merchantId: string;
        branchId: string;
        source: string;
        OR: Array<{ checks?: { some: { settledAt: null } } }>;
        AND: Array<{ OR: Array<{ orderReference: { contains: string } }> }>;
      };
      take: number;
    }> = [];
    const prisma = {
      storefrontOrder: {
        findMany: async (input: unknown) => {
          queries.push(input as (typeof queries)[number]);
          return [];
        },
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
      service.listActiveSales(
        { ...employee, permissions: [] },
        { branchId, mode: 'active', limit: 25 },
      ),
      ForbiddenException,
    );
    await assert.rejects(
      service.listActiveSales(
        { ...employee, branches: [] },
        { branchId, mode: 'active', limit: 25 },
      ),
      ForbiddenException,
    );
    assert.deepEqual(
      await service.listActiveSales(employee, {
        branchId,
        mode: 'active',
        search: '42',
        limit: 25,
      }),
      { items: [], nextCursor: null },
    );
    const query = queries[0]!;
    assert.equal(query.where.merchantId, merchantId);
    assert.equal(query.where.branchId, branchId);
    assert.equal(query.where.source, 'pos');
    assert.equal(query.take, 26);
    assert.ok(query.where.OR.some((item) => item.checks?.some?.settledAt === null));
    assert.equal(query.where.AND[0]?.OR[0]?.orderReference.contains, '42');
  });

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

  it('adds quoted items to one unpaid pending kitchen order exactly once', async () => {
    const savedActions = new Map<
      string,
      { action: string; fingerprint: string; createdBy: string; result: unknown }
    >();
    const check = {
      id: 'check-1',
      amount: { toString: () => '10.00' },
      splitMethod: 'whole',
      settledAt: null,
    };
    const order = {
      id: 'order-1',
      status: 'pending',
      source: 'pos',
      merchantId,
      branchId,
      posShiftId: 'shift-1',
      fulfillmentType: 'takeaway',
      customerName: null,
      customerPhone: null,
      deliveryAddress: null,
      total: { toString: () => '10.00' },
      revision: 4,
      currency: 'EGP',
      createdAt: new Date('2026-10-19T09:00:00.000Z'),
      kitchenTicket: {
        id: 'ticket-1',
        dispatchMode: 'automatic',
        dispatchedAt: new Date('2026-10-19T09:01:00.000Z'),
        station: { id: 'station-1', name: 'Kitchen' },
      },
      diningSession: null,
      checks: [check],
      lines: [
        {
          id: 'existing-line',
          position: 0,
          productName: 'Existing item',
          variantName: null,
          basePrice: { toString: () => '10.00' },
          modifierTotal: { toString: () => '0.00' },
          quantity: 1,
          unitPrice: { toString: () => '10.00' },
          lineTotal: { toString: () => '10.00' },
          variantAttributes: [],
          selections: [],
        },
      ],
    };
    let createdLines = 0;
    let shiftLocks = 0;
    const tx = {
      $queryRaw: async () => [{ id: 'order-1' }],
      storefrontOrderAction: {
        findUnique: async ({ where }: { where: { merchantId_requestId: { requestId: string } } }) =>
          savedActions.get(where.merchantId_requestId.requestId) ?? null,
        create: async ({
          data,
        }: {
          data: { requestId: string } & (typeof savedActions extends Map<string, infer V>
            ? V
            : never);
        }) => {
          savedActions.set(data.requestId, data);
          return data;
        },
      },
      storefrontOrder: {
        findFirst: async ({ include }: { include?: unknown }) =>
          include ? order : { branchId, posShiftId: 'shift-1' },
        findFirstOrThrow: async () => order,
        updateMany: async ({
          data,
        }: {
          data: { total: string; revision: { increment: number } };
        }) => {
          order.total = { toString: () => data.total };
          order.revision += data.revision.increment;
          return { count: 1 };
        },
      },
      storefrontOrderLine: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdLines += 1;
          const amount = data.lineTotal as string;
          const basePrice = data.basePrice as string;
          const modifierTotal = data.modifierTotal as string;
          const variantAttributes = (data.variantAttributes as { create: unknown[] }).create;
          const selections = (data.selections as { create: unknown[] }).create;
          order.lines.push({
            id: 'new-line',
            position: data.position as number,
            productName: data.productName as string,
            variantName: data.variantName as null,
            basePrice: { toString: () => basePrice },
            modifierTotal: { toString: () => modifierTotal },
            quantity: data.quantity as number,
            unitPrice: { toString: () => data.unitPrice as string },
            lineTotal: { toString: () => amount },
            variantAttributes: variantAttributes as never,
            selections: selections as never,
          });
          return { id: 'new-line' };
        },
      },
      product: {
        findFirst: async () => ({
          id: productId,
          name: 'Added item',
          availability: 'available',
          revision: 3,
          inventoryConfiguration: null,
          variants: [],
          modifierGroups: [],
        }),
      },
      posOrderPayment: { count: async () => 0 },
      posOrderCheckLine: { count: async () => 0 },
      posOrderCheck: {
        update: async ({ data }: { data: { amount: string } }) => {
          check.amount = { toString: () => data.amount };
          return check;
        },
      },
    };
    const prisma = {
      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
      storefrontOrderAction: { findUnique: async () => null },
    };
    const pricing = { quoteForMerchant: async () => quote(productId, '5.00') };
    const shifts = {
      lockOpenShiftForPayment: async () => {
        shiftLocks += 1;
      },
    };
    const service = new PosOrdersService(
      prisma as never,
      pricing as never,
      {} as never,
      {} as never,
      shifts as never,
      {} as never,
      {} as never,
    );
    const request = {
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      revision: 4,
      items: [
        {
          lineId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          productId,
          selections: [],
          quantity: 1,
          expectedProductRevision: 3,
        },
      ],
    };

    const first = await service.addKitchenItems(employee, 'order-1', request);
    const replay = await service.addKitchenItems(employee, 'order-1', request);

    assert.equal(first.total, '15.00');
    assert.equal(check.amount.toString(), '15.00');
    assert.equal(first.lines.length, 2);
    assert.deepEqual(replay, first);
    assert.equal(createdLines, 1);
    assert.equal(shiftLocks, 1);
    assert.equal(savedActions.size, 1);
  });

  it('rejects kitchen additions after acceptance before evaluating product quotes', async () => {
    let quoteCalls = 0;
    const order = {
      id: 'order-1',
      status: 'accepted',
      source: 'pos',
      branchId,
      posShiftId: 'shift-1',
      revision: 4,
      kitchenTicket: { id: 'ticket-1' },
      checks: [
        {
          id: 'check-1',
          amount: { toString: () => '10.00' },
          splitMethod: 'whole',
          settledAt: null,
        },
      ],
      lines: [],
    };
    const tx = {
      $queryRaw: async () => [{ id: 'order-1' }],
      storefrontOrderAction: { findUnique: async () => null },
      storefrontOrder: {
        findFirst: async ({ include }: { include?: unknown }) =>
          include ? order : { branchId, posShiftId: 'shift-1' },
      },
      posOrderPayment: { count: async () => 0 },
      posOrderCheckLine: { count: async () => 0 },
    };
    const service = new PosOrdersService(
      {
        $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      } as never,
      {
        quoteForMerchant: async () => {
          quoteCalls += 1;
          return quote(productId, '5.00');
        },
      } as never,
      {} as never,
      {} as never,
      { lockOpenShiftForPayment: async () => {} } as never,
      {} as never,
      {} as never,
    );

    await assert.rejects(
      service.addKitchenItems(employee, 'order-1', {
        requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        revision: 4,
        items: [
          {
            lineId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            productId,
            selections: [],
            quantity: 1,
            expectedProductRevision: 3,
          },
        ],
      }),
      /before the kitchen accepts/,
    );
    assert.equal(quoteCalls, 0);
  });

  it('blocks kitchen additions to paid, split, or settled checks before quoting', async () => {
    const cases = [
      {
        name: 'a check that has started payment',
        payments: 1,
        allocations: 0,
        settledAt: null,
        splitMethod: 'whole',
        message: /after payment begins/,
      },
      {
        name: 'a check with item allocations',
        payments: 0,
        allocations: 1,
        settledAt: null,
        splitMethod: 'whole',
        message: /after the check is split/,
      },
      {
        name: 'a divided check',
        payments: 0,
        allocations: 0,
        settledAt: null,
        splitMethod: 'equal',
        message: /one unsplit check/,
      },
      {
        name: 'a settled check',
        payments: 0,
        allocations: 0,
        settledAt: new Date(),
        splitMethod: 'whole',
        message: /after a check is settled/,
      },
    ];

    for (const [index, scenario] of cases.entries()) {
      let quoteCalls = 0;
      const order = {
        id: 'order-1',
        status: 'pending',
        source: 'pos',
        branchId,
        posShiftId: 'shift-1',
        revision: 4,
        kitchenTicket: { id: 'ticket-1' },
        checks: [
          {
            id: 'check-1',
            amount: { toString: () => '10.00' },
            splitMethod: scenario.splitMethod,
            settledAt: scenario.settledAt,
          },
        ],
        lines: [],
      };
      const tx = {
        $queryRaw: async () => [{ id: 'order-1' }],
        storefrontOrderAction: { findUnique: async () => null },
        storefrontOrder: {
          findFirst: async ({ include }: { include?: unknown }) =>
            include ? order : { branchId, posShiftId: 'shift-1' },
        },
        posOrderPayment: { count: async () => scenario.payments },
        posOrderCheckLine: { count: async () => scenario.allocations },
      };
      const service = new PosOrdersService(
        {
          $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) =>
            callback(tx),
        } as never,
        {
          quoteForMerchant: async () => {
            quoteCalls += 1;
            return quote(productId, '5.00');
          },
        } as never,
        {} as never,
        {} as never,
        { lockOpenShiftForPayment: async () => {} } as never,
        {} as never,
        {} as never,
      );

      await assert.rejects(
        service.addKitchenItems(employee, 'order-1', {
          requestId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
          revision: 4,
          items: [
            {
              lineId: `dddddddd-dddd-4ddd-8ddd-ddddddddddd${index}`,
              productId,
              selections: [],
              quantity: 1,
              expectedProductRevision: 3,
            },
          ],
        }),
        scenario.message,
        scenario.name,
      );
      assert.equal(quoteCalls, 0, `${scenario.name} must be rejected before repricing`);
    }
  });
});
