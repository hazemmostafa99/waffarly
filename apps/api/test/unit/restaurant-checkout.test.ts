import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { CreateStorefrontOrderRequest } from '@waffarly/contracts';
import { StorefrontOrdersService } from '../../src/modules/orders/storefront-orders.service.js';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import type { ProductPricingService } from '../../src/modules/catalog/index.js';
import type { SubscriptionService } from '../../src/modules/subscriptions/index.js';
import type { RestaurantOrderPolicyService } from '../../src/modules/storefront/index.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const input: CreateStorefrontOrderRequest = {
  customerName: 'Checkout customer',
  customerPhone: '01000000000',
  fulfillmentType: 'delivery',
  deliveryAddress: 'Checkout address',
  items: [{ productId: '22222222-2222-4222-8222-222222222222', quantity: 2, selections: [] }],
};

function fixture(allowed: boolean) {
  let pricingCalls = 0;
  let eligibilityCalls = 0;
  const transaction = {
    branch: { findMany: async () => [{ id: '33333333-3333-4333-8333-333333333333', name: 'Main branch' }] },
    restaurantProfile: { findUnique: async () => ({ referenceData: { origin: 'local-mock' } }) },
  };
  const prisma = {
    merchant: { findUnique: async ({ where }: { where: { storefrontSlug: string } }) => {
      assert.equal(where.storefrontSlug, 'reference-restaurant-1');
      return { id: merchantId };
    } },
    $transaction: async (run: (db: typeof transaction) => Promise<unknown>) => run(transaction),
  } as unknown as PrismaService;
  const pricing = {
    quoteForMerchant: async (tenant: string, _product: string, _selections: unknown, _variant: unknown, _quantity: number, db: unknown) => {
      assert.equal(tenant, merchantId);
      assert.equal(db, transaction);
      pricingCalls++;
      return { totalPrice: '100.25' };
    },
  } as unknown as ProductPricingService;
  const subscriptions = {
    requireActive: async (tenant: string, db: unknown) => {
      assert.equal(tenant, merchantId);
      assert.equal(db, transaction);
      eligibilityCalls++;
      if (!allowed) throw new ForbiddenException('Subscription is not active.');
    },
  } as unknown as SubscriptionService;
  const policy = {
    assess: async (db: unknown, tenant: string, fulfillment: string, subtotal: bigint) => {
      assert.equal(db, transaction);
      assert.equal(tenant, merchantId);
      assert.equal(fulfillment, 'delivery');
      assert.equal(subtotal, 20050n);
      return { fee: 2500n, snapshot: { revision: 3 } };
    },
  } as unknown as RestaurantOrderPolicyService;
  return {
    service: new StorefrontOrdersService(prisma, pricing, undefined, undefined, subscriptions, policy),
    counts: () => ({ pricingCalls, eligibilityCalls }),
  };
}

test('persisted reference restaurants receive real checkout quotes with authoritative fees', async () => {
  const { service, counts } = fixture(true);
  assert.deepEqual(await service.quoteCheckout('reference-restaurant-1', input), {
    unitPrices: ['100.25'], subtotal: '200.50', deliveryFee: '25.00',
    total: '225.50', currency: 'EGP', restaurantSettingsRevision: 3, demo: false,
  });
  assert.deepEqual(counts(), { pricingCalls: 1, eligibilityCalls: 1 });
});

test('inactive restaurant subscription rejects checkout review before pricing', async () => {
  const { service, counts } = fixture(false);
  await assert.rejects(service.quoteCheckout('reference-restaurant-1', input), ForbiddenException);
  assert.deepEqual(counts(), { pricingCalls: 0, eligibilityCalls: 1 });
});
