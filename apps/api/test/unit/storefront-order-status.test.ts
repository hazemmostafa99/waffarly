import assert from 'node:assert/strict';
import { it } from 'node:test';
import { StorefrontOrderStatusService } from '../../src/modules/orders/fulfillment/storefront-order-status.service.js';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import type { InventoryLedgerService } from '../../src/modules/inventory/index.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';

function decimal(value: string) {
  return { toString: () => value };
}

it('saves post-coupon line revenue and acceptance time on the legacy storefront acceptance path', async () => {
  const lines = [
    { id: '33333333-3333-4333-8333-333333333333', position: 0, lineTotal: decimal('10.00') },
    { id: '44444444-4444-4444-8444-444444444444', position: 1, lineTotal: decimal('20.00') },
  ];
  const target = {
    branchId: null,
    merchant: { restaurantProfile: null },
    discountRedemption: { amount: decimal('1.01') },
    lines,
  };
  const order = {
    id: orderId,
    status: 'pending',
    acceptedAt: null as Date | null,
    customerName: 'Test customer',
    customerPhone: null,
    fulfillmentType: 'delivery',
    deliveryAddress: 'Test address',
    total: decimal('28.99'),
    createdAt: new Date('2026-11-14T09:00:00.000Z'),
    lines: lines.map((line) => ({
      ...line,
      stockHandling: 'legacy',
      productName: `Product ${line.position + 1}`,
      variantName: null,
      basePrice: line.lineTotal,
      modifierTotal: decimal('0.00'),
      promotionDiscount: decimal('0.00'),
      quantity: 1,
      unitPrice: line.lineTotal,
      variantAttributes: [],
      selections: [],
    })),
  };
  let orderRead = 0;
  const lineWrites: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const transaction = {
    storefrontOrder: {
      findFirst: async () => (++orderRead === 1 ? target : order),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(order, data);
        return { count: 1 };
      },
    },
    storefrontOrderLine: {
      findFirst: async () => null,
      updateMany: async ({
        where,
        data,
      }: {
        where: unknown;
        data: Record<string, unknown>;
      }) => {
        lineWrites.push({ where, data });
        return { count: 1 };
      },
    },
  };
  const prisma = {
    $transaction: async (run: (tx: typeof transaction) => Promise<unknown>) => run(transaction),
  } as unknown as PrismaService;
  const service = new StorefrontOrderStatusService(
    prisma,
    {} as InventoryLedgerService,
  );

  const result = await service.updateStatus(merchantId, orderId, 'accepted');

  assert.equal(result.status, 'accepted');
  assert.ok(order.acceptedAt instanceof Date);
  assert.deepEqual(
    lineWrites.map((write) => write.data.recognizedRevenueAmount),
    ['9.66', '19.33'],
  );
  assert.ok(lineWrites.every((write) => write.data.revenueRecognizedAt === order.acceptedAt));
});
