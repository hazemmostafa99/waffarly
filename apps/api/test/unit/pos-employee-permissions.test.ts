import {
  POS_LEGACY_EMPLOYEE_PERMISSIONS,
  defaultPosEmployeePermissions,
  normalizePosEmployeePermissions,
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
} from '../../src/modules/employees/pos-employee.schemas.js';

describe('POS employee role permissions', () => {
  it('gives cashiers, supervisors and no-role staff the original kitchen grants by default', () => {
    assert.deepEqual(defaultPosEmployeePermissions(null), [
      'accept_recipe_orders',
      'start_preparation',
    ]);
    assert.deepEqual(defaultPosEmployeePermissions('cashier'), [
      'accept_recipe_orders',
      'open_register_shift',
      'sell',
      'start_preparation',
    ]);
    assert.deepEqual(defaultPosEmployeePermissions('supervisor'), [
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

  it('uses only the preset for the newer roles', () => {
    assert.deepEqual(defaultPosEmployeePermissions('accountant'), ['view_receipts']);
    assert.deepEqual(defaultPosEmployeePermissions('inventory_officer'), ['view_inventory']);
    assert.deepEqual(defaultPosEmployeePermissions('customer_service'), ['view_orders']);
    assert.deepEqual(defaultPosEmployeePermissions('kitchen'), [
      'accept_recipe_orders',
      'start_preparation',
      'view_orders',
    ]);
    const manager = defaultPosEmployeePermissions('branch_manager');
    assert.equal(manager.includes('approve_refunds'), true);
    assert.equal(manager.includes('approve_discounts'), true);
    assert.equal(manager.includes('approve_voids'), false);
    assert.equal(manager.includes('approve_shift_close'), true);
    assert.equal(manager.includes('manage_cash_movements'), true);
  });

  it('treats saved permissions as exact, whatever the role', () => {
    // The owner removed selling from a cashier and added inventory to an accountant.
    assert.deepEqual(resolvePosEmployeePermissions('cashier', ['open_register_shift']), [
      'open_register_shift',
    ]);
    assert.deepEqual(
      resolvePosEmployeePermissions('accountant', ['view_receipts', 'view_inventory']),
      ['view_inventory', 'view_receipts'],
    );
    assert.deepEqual(resolvePosEmployeePermissions('branch_manager', []), []);
  });

  it('ignores permission values not supported by the current server', () => {
    assert.deepEqual(resolvePosEmployeePermissions(null, ['manage_everything']), []);
    assert.deepEqual(normalizePosEmployeePermissions(['sell', 'sell', 'manage_everything']), [
      'sell',
    ]);
  });

  it('preserves historical read access and chooses a usable role landing page', () => {
    const legacy = {
      permissions: resolvePosEmployeePermissions(null, POS_LEGACY_EMPLOYEE_PERMISSIONS),
    };
    assert.equal(hasPosEmployeePermission(legacy, 'view_orders'), true);
    assert.equal(hasPosEmployeePermission(legacy, 'view_receipts'), false);
    assert.equal(posEmployeeHome(legacy), '/kitchen');
    assert.equal(posEmployeeHome({ permissions: ['view_inventory'] }), '/inventory');
    assert.equal(posEmployeeHome({ permissions: ['view_receipts'] }), '/orders');
    assert.equal(posEmployeeHome({ permissions: [] }), '/access');
    assert.equal(hasPosEmployeePermission({ permissions: ['sell'] }, 'view_receipts'), true);
  });

  it('accepts each employee preset and known permissions while rejecting ownership', () => {
    const input = {
      username: 'employee1',
      displayName: 'Employee One',
      password: 'a-long-password',
      branchId: '33333333-3333-4333-8333-333333333333',
    };
    for (const role of POS_EMPLOYEE_ROLES) {
      assert.equal(createPosEmployeeSchema.safeParse({ ...input, role }).success, true);
      assert.equal(
        updatePosEmployeeSchema.safeParse({
          displayName: input.displayName,
          active: true,
          revision: 1,
          branchId: input.branchId,
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
          branchId: input.branchId,
          role,
        }).success,
        false,
      );
    }
    assert.equal(
      createPosEmployeeSchema.safeParse({ ...input, role: 'accountant', permissions: ['sell'] })
        .success,
      true,
    );
    assert.equal(
      createPosEmployeeSchema.safeParse({ ...input, permissions: ['manage_everything'] }).success,
      false,
    );
  });
});
