import { BadRequestException, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { posEmployeeHome, resolveActivityFeatures } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ActivitiesService } from '../../src/modules/activities/activities.service.js';
import {
  ActivityFeatureGuard,
  RequireActivityFeature,
} from '../../src/modules/auth/activity-feature.guard.js';
import { PosEmployeeService } from '../../src/modules/employees/pos-employee.service.js';

const shop = { kitchen: false, diningTables: false, delivery: true };

/** A request context for one decorated controller, signed in as `actor`. */
function contextFor(feature: 'kitchen' | 'diningTables' | 'delivery', actor: object) {
  @RequireActivityFeature(feature)
  class DecoratedController {
    handle() {}
  }
  return {
    getHandler: () => DecoratedController.prototype.handle,
    getClass: () => DecoratedController,
    switchToHttp: () => ({ getRequest: () => actor }),
  } as unknown as ExecutionContext;
}

describe('activity features', () => {
  it('turns every available feature on by default and never enables an unavailable one', () => {
    assert.deepEqual(resolveActivityFeatures('restaurant', null), {
      kitchen: true,
      diningTables: true,
      delivery: true,
    });
    assert.deepEqual(resolveActivityFeatures('clothing', null), shop);
    assert.deepEqual(
      resolveActivityFeatures('clothing', { kitchen: true, diningTables: true, delivery: false }),
      { kitchen: false, diningTables: false, delivery: false },
    );
    assert.deepEqual(resolveActivityFeatures('unknown-key', null), shop);
  });

  it('lets a request through only when the actor activity has the feature on', () => {
    const guard = new ActivityFeatureGuard(new Reflector());
    const restaurantCashier = {
      posEmployee: {
        activity: 'restaurant',
        activityFeatures: resolveActivityFeatures('restaurant', null),
      },
    };
    const clothingCashier = { posEmployee: { activity: 'clothing', activityFeatures: shop } };
    const clothingOwner = { owner: { activity: 'clothing', activityFeatures: shop } };

    assert.equal(guard.canActivate(contextFor('kitchen', restaurantCashier)), true);
    assert.throws(
      () => guard.canActivate(contextFor('kitchen', clothingCashier)),
      ForbiddenException,
    );
    assert.throws(
      () => guard.canActivate(contextFor('diningTables', clothingOwner)),
      ForbiddenException,
    );
    assert.equal(guard.canActivate(contextFor('delivery', clothingOwner)), true);
    assert.throws(() => guard.canActivate(contextFor('delivery', {})), ForbiddenException);
  });

  it('refuses Super Admin settings that switch on a feature the activity cannot have', async () => {
    const service = new ActivitiesService({} as never);
    await assert.rejects(
      service.update(
        'clothing',
        {
          name: 'Clothing stores',
          description: '',
          features: { kitchen: true, diningTables: false, delivery: true },
          revision: 0,
        },
        'admin',
      ),
      BadRequestException,
    );
  });

  it('refuses the kitchen role when the activity kitchen is off', async () => {
    const service = new PosEmployeeService({} as never);
    await assert.rejects(
      service.create(
        '11111111-1111-4111-8111-111111111111',
        'owner',
        {
          username: 'kitchen.one',
          displayName: 'Kitchen one',
          password: 'secret12',
          role: 'kitchen',
          branchId: '22222222-2222-4222-8222-222222222222',
        },
        shop,
      ),
      BadRequestException,
    );
  });

  it('sends shop cashiers to the sale screen and restaurant cashiers to the kitchen', () => {
    assert.equal(
      posEmployeeHome({ permissions: ['view_orders', 'sell'], activityFeatures: shop }),
      '/catalog',
    );
    assert.equal(
      posEmployeeHome({
        permissions: ['view_orders', 'sell'],
        activityFeatures: resolveActivityFeatures('restaurant', null),
      }),
      '/kitchen',
    );
  });
});
