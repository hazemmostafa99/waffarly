import {
  POS_LEGACY_EMPLOYEE_PERMISSIONS,
  resolvePosEmployeePermissions,
  hasPosEmployeePermission,
  posEmployeeHome,
  POS_EMPLOYEE_ROLES,
} from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createPosEmployeeSchema,
  updatePosEmployeeSchema,
} from '../../src/modules/auth/pos-employee.schemas.js';

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
      'approve_shift_close',
      'approve_voids',
      'manage_cash_movements',
      'open_register_shift',
      'sell',
      'start_preparation',
    ]);
  });

  it('ignores permission values not supported by the current server', () => {
    assert.deepEqual(resolvePosEmployeePermissions(null, ['manage_everything']), []);
  });

  it('removes previous operational grants when assigning a new preset', () => {
    const oldGrants = ['sell', 'approve_refunds', ...POS_LEGACY_EMPLOYEE_PERMISSIONS];
    assert.deepEqual(resolvePosEmployeePermissions('accountant', oldGrants), ['view_receipts']);
    assert.deepEqual(resolvePosEmployeePermissions('inventory_officer', oldGrants), [
      'view_inventory',
    ]);
    assert.deepEqual(resolvePosEmployeePermissions('customer_service', oldGrants), ['view_orders']);
    assert.deepEqual(resolvePosEmployeePermissions('kitchen', oldGrants), [
      'accept_recipe_orders',
      'start_preparation',
      'view_orders',
    ]);
    assert.equal(
      resolvePosEmployeePermissions('branch_manager', oldGrants).includes('approve_refunds'),
      false,
    );
    assert.equal(
      resolvePosEmployeePermissions('branch_manager', oldGrants).includes('approve_shift_close'),
      true,
    );
    assert.equal(
      resolvePosEmployeePermissions('branch_manager', oldGrants).includes('manage_cash_movements'),
      true,
    );
  });

  it('preserves historical read access and chooses a usable role landing page', () => {
    const legacy = {
      permissions: resolvePosEmployeePermissions(null, POS_LEGACY_EMPLOYEE_PERMISSIONS),
    };
    assert.equal(hasPosEmployeePermission(legacy, 'view_orders'), true);
    assert.equal(hasPosEmployeePermission(legacy, 'view_receipts'), false);
    assert.equal(posEmployeeHome(legacy), '/');
    assert.equal(posEmployeeHome({ permissions: ['view_inventory'] }), '/inventory');
    assert.equal(posEmployeeHome({ permissions: ['view_receipts'] }), '/receipts');
    assert.equal(posEmployeeHome({ permissions: [] }), '/access');
    assert.equal(hasPosEmployeePermission({ permissions: ['sell'] }, 'view_receipts'), true);
  });

  it('accepts each employee preset while rejecting ownership and submitted grants', () => {
    const input = {
      username: 'employee1',
      displayName: 'Employee One',
      password: 'a-long-password',
      branchIds: ['33333333-3333-4333-8333-333333333333'],
    };
    for (const role of POS_EMPLOYEE_ROLES) {
      assert.equal(createPosEmployeeSchema.safeParse({ ...input, role }).success, true);
      assert.equal(
        updatePosEmployeeSchema.safeParse({
          displayName: input.displayName,
          active: true,
          revision: 1,
          branchIds: input.branchIds,
          role,
        }).success,
        true,
      );
    }
    for (const role of ['owner', 'account_owner', 'admin']) {
      assert.equal(createPosEmployeeSchema.safeParse({ ...input, role }).success, false);
      assert.equal(
        updatePosEmployeeSchema.safeParse({
          displayName: input.displayName,
          active: true,
          revision: 1,
          branchIds: input.branchIds,
          role,
        }).success,
        false,
      );
    }
    assert.equal(
      createPosEmployeeSchema.safeParse({ ...input, role: 'accountant', permissions: ['sell'] })
        .success,
      false,
    );
  });
});
