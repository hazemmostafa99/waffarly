import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeOpeningFloat } from '../../src/modules/shifts/shifts.rules.js';
import {
  closePosShiftSchema,
  ownerPosShiftCloseReportsSchema,
  posShiftClosePreviewSchema,
  recordPosShiftCashMovementSchema,
  withoutShiftCashMovementApproval,
  withoutShiftCloseApproval,
} from '../../src/modules/shifts/shifts.schemas.js';

test('opening float normalization uses exact cents and stable two-decimal output', () => {
  assert.equal(normalizeOpeningFloat('0'), '0.00');
  assert.equal(normalizeOpeningFloat('125.5'), '125.50');
  assert.equal(normalizeOpeningFloat('9999999999.99'), '9999999999.99');
});

test('opening float normalization rejects precision and range that cannot be represented in cents', () => {
  assert.throws(() => normalizeOpeningFloat('1.001'));
  assert.throws(() => normalizeOpeningFloat('-0.01'));
});

test('cash movement input requires a positive amount and a reason', () => {
  const requestId = '00000000-0000-4000-8000-000000000001';
  const valid = {
    requestId,
    kind: 'cash_in' as const,
    amount: '25.50',
    reason: 'Change float replenishment',
    approval: { username: 'supervisor', password: 'secret' },
  };
  assert.equal(recordPosShiftCashMovementSchema.safeParse(valid).success, true);
  assert.deepEqual(withoutShiftCashMovementApproval(valid), {
    requestId,
    kind: 'cash_in',
    amount: '25.50',
    reason: 'Change float replenishment',
  });
  for (const amount of ['0', '0.00', '-1.00', '1.001']) {
    assert.equal(recordPosShiftCashMovementSchema.safeParse({ ...valid, amount }).success, false);
  }
  assert.equal(
    recordPosShiftCashMovementSchema.safeParse({ ...valid, reason: ' ' }).success,
    false,
  );
});

test('cash-drop adjustments require and preserve a safe-bag reference', () => {
  const request = {
    requestId: '00000000-0000-4000-8000-000000000003',
    kind: 'cash_drop' as const,
    amount: '250.00',
    reason: 'Evening safe drop',
    dropReference: 'SAFE-BAG-1042',
    approval: { username: 'supervisor', password: 'secret' },
  };
  assert.deepEqual(recordPosShiftCashMovementSchema.parse(request), request);
  assert.deepEqual(withoutShiftCashMovementApproval(request), {
    requestId: request.requestId,
    kind: request.kind,
    amount: request.amount,
    reason: request.reason,
    dropReference: request.dropReference,
  });
  assert.equal(
    recordPosShiftCashMovementSchema.safeParse({ ...request, dropReference: ' ' }).success,
    false,
  );
  const missingReference = {
    requestId: request.requestId,
    kind: request.kind,
    amount: request.amount,
    reason: request.reason,
    approval: request.approval,
  };
  assert.equal(recordPosShiftCashMovementSchema.safeParse(missingReference).success, false);
  assert.equal(
    recordPosShiftCashMovementSchema.safeParse({ ...request, kind: 'cash_out' }).success,
    false,
  );
});

test('shift close accepts counted cash and strips supervisor credentials from its persisted command', () => {
  const requestId = '00000000-0000-4000-8000-000000000002';
  const valid = {
    requestId,
    countedCash: '150.00',
    reason: 'Till count variance',
    approval: { username: 'supervisor', password: 'secret' },
  };
  assert.equal(closePosShiftSchema.safeParse(valid).success, true);
  assert.deepEqual(withoutShiftCloseApproval(valid), {
    requestId,
    countedCash: '150.00',
    reason: 'Till count variance',
  });
  assert.equal(closePosShiftSchema.safeParse({ ...valid, countedCash: '-0.01' }).success, false);
  assert.equal(closePosShiftSchema.safeParse({ ...valid, countedCash: '1.001' }).success, false);
});

test('blind close preview accepts only a physical count and optional reason', () => {
  assert.deepEqual(posShiftClosePreviewSchema.parse({ countedCash: '125.50' }), {
    countedCash: '125.50',
  });
  assert.equal(
    posShiftClosePreviewSchema.safeParse({ countedCash: '125.50', approval: {} }).success,
    false,
  );
  assert.equal(posShiftClosePreviewSchema.safeParse({ countedCash: '-1.00' }).success, false);
});

test('owner close-report filters require a bounded, increasing timestamp range and page size', () => {
  const valid = {
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-10-20T00:00:00.000Z',
    limit: '50',
  };
  assert.deepEqual(ownerPosShiftCloseReportsSchema.parse(valid), {
    ...valid,
    limit: 50,
  });
  assert.equal(
    ownerPosShiftCloseReportsSchema.safeParse({
      from: valid.to,
      to: valid.from,
    }).success,
    false,
  );
  assert.equal(
    ownerPosShiftCloseReportsSchema.safeParse({
      from: '2026-01-01T00:00:00.000Z',
      to: valid.to,
    }).success,
    false,
  );
  assert.equal(
    ownerPosShiftCloseReportsSchema.safeParse({ ...valid, limit: '101' }).success,
    false,
  );
});
