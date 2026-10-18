import {
  POS_LEGACY_EMPLOYEE_PERMISSIONS,
  resolvePosEmployeePermissions,
} from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('POS employee role permissions', () => {
  it('preserves the legacy order grants without adding sales or shift access', () => {
    const permissions = resolvePosEmployeePermissions(null, POS_LEGACY_EMPLOYEE_PERMISSIONS);
    assert.deepEqual(permissions, ['accept_recipe_orders', 'start_preparation']);
  });

  it('adds only cashier sales and register opening to explicitly assigned staff', () => {
    const permissions = resolvePosEmployeePermissions('cashier', [
      ...POS_LEGACY_EMPLOYEE_PERMISSIONS,
    ]);
    assert.deepEqual(permissions, [
      'accept_recipe_orders',
      'open_register_shift',
      'sell',
      'start_preparation',
    ]);
  });

  it('adds supervisor approval grants without applying numeric limits', () => {
    const permissions = resolvePosEmployeePermissions('supervisor', [
      ...POS_LEGACY_EMPLOYEE_PERMISSIONS,
    ]);
    assert.deepEqual(permissions, [
      'accept_recipe_orders',
      'approve_discounts',
      'approve_refunds',
      'approve_voids',
      'open_register_shift',
      'sell',
      'start_preparation',
    ]);
  });

  it('ignores permission values not supported by the current server', () => {
    assert.deepEqual(resolvePosEmployeePermissions(null, ['manage_everything']), []);
  });
});
