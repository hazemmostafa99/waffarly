/** Verifies that online orders choose a serving branch and review changes in routing. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RestaurantSettingsInput } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { RestaurantOrderPolicyService } from '../../src/modules/storefront/restaurant-order-policy.service.js';
import { restaurantSettingsSchema } from '../../src/modules/storefront/restaurant.schemas.js';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const area = 'cairo-nasr-first';
const merchantId = '33333333-3333-4333-8333-333333333333';

function settings() {
  return {
    description: '', cuisines: [], logoImage: null, coverImage: null,
    published: true, displayOrder: 0, timezone: 'Africa/Cairo', alwaysOpen: true,
    openingHours: [], scheduleExceptions: [], ordersPaused: false, pauseReason: null,
    deliveryEnabled: true, pickupEnabled: true, deliveryFee: '50.00',
    minimumDeliveryOrder: '150.00', deliveryTimeMinMinutes: 30, deliveryTimeMaxMinutes: 60,
    revision: 5, deliveryAreas: [],
    branchFulfillment: [first, second].map((branchId, index) => ({
      branchId, locationId: area, paused: false, pickup: true, delivery: true, dailyHours: null,
      areas: [{ locationId: area, fee: '20.00', minimum: '100.00', etaMinutes: 30, priority: index + 1 }],
    })),
  } satisfies RestaurantSettingsInput & { revision: number };
}

function db(input: ReturnType<typeof settings>, active = [first, second]) {
  return {
    restaurantProfile: { findUnique: async () => ({
      ...input,
      deliveryFee: { toFixed: () => input.deliveryFee },
      minimumDeliveryOrder: { toFixed: () => input.minimumDeliveryOrder },
    }) },
    branch: {
      findMany: async ({ where }: { where: { merchantId: string; archivedAt: null } }) => {
        assert.equal(where.merchantId, merchantId);
        assert.equal(where.archivedAt, null);
        return active.map((id) => ({ id, name: id === first ? 'Main' : 'Backup', address: null }));
      },
    },
  } as unknown as Prisma.TransactionClient;
}

test('delivery reselects an open covering branch and changes the review key even with identical fees', async () => {
  const policy = new RestaurantOrderPolicyService();
  const input = settings();
  const primary = await policy.assess(db(input), merchantId, 'delivery', 12000n, area);
  input.branchFulfillment[0]!.paused = true;
  const backup = await policy.assess(db(input), merchantId, 'delivery', 12000n, area);
  assert.equal(primary?.receivingBranch?.id, first);
  assert.equal(backup?.receivingBranch?.id, second);
  assert.equal(primary?.fee, backup?.fee);
  assert.notEqual(primary?.quoteKey, backup?.quoteKey);
  await assert.rejects(policy.assess(db(input, [first]), merchantId, 'delivery', 12000n, area));
});

test('delivery rejects uncovered regions and pickup requires its selected branch', async () => {
  const policy = new RestaurantOrderPolicyService();
  const input = settings();
  await assert.rejects(policy.assess(db(input), merchantId, 'delivery', 12000n, 'dakahlia-mansoura-toreil'));
  await assert.rejects(policy.assess(db(input), merchantId, 'delivery', 9999n, area));
  await assert.rejects(policy.assess(db(input), merchantId, 'pickup', 12000n));
  assert.equal((await policy.assess(db(input), merchantId, 'pickup', 12000n, undefined, undefined, second))?.receivingBranch?.id, second);
});

test('owner settings accept configured cities outside the branch governorate and reject unknown destinations', () => {
  const input = settings();
  const [destination] = input.branchFulfillment[0]!.areas;
  destination!.locationId = 'city-dakahlia-mansoura';
  assert.equal(restaurantSettingsSchema.safeParse(input).success, true);
  destination!.locationId = 'unknown-destination';
  assert.equal(restaurantSettingsSchema.safeParse(input).success, false);
});

test('city coverage supplies a default rate and an exact area uses its own rate', async () => {
  const policy = new RestaurantOrderPolicyService();
  const input = settings();
  input.branchFulfillment[0]!.areas.push({
    locationId: 'city-cairo-nasr', fee: '30.00', minimum: '100.00', etaMinutes: 40, priority: 1,
  });
  const exact = await policy.assess(db(input, [first]), merchantId, 'delivery', 12000n, area);
  const fallback = await policy.assess(db(input, [first]), merchantId, 'delivery', 12000n, 'cairo-nasr-seventh');
  assert.equal(exact?.fee, 2000n);
  assert.equal(fallback?.fee, 3000n);
  assert.equal(fallback?.snapshot.areaId, 'cairo-nasr-seventh');
});
