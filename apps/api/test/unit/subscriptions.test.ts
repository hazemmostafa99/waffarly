import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addSubscriptionMonths,
  unusedSubscriptionCredit,
  isSubscriptionRecoveryRequest,
} from '../../src/modules/subscriptions/subscription.rules.js';

describe('subscription periods and pricing', () => {
  it('clamps calendar months and leap years in Cairo while preserving local time', () => {
    assert.equal(
      addSubscriptionMonths(new Date('2026-01-31T10:15:00.123Z'), 1).toISOString(),
      '2026-02-28T10:15:00.123Z',
    );
    assert.equal(
      addSubscriptionMonths(new Date('2024-02-29T10:00:00Z'), 12).toISOString(),
      '2025-02-28T10:00:00.000Z',
    );
    assert.equal(
      addSubscriptionMonths(new Date('2026-01-10T10:00:00Z'), 6).toISOString(),
      '2026-07-10T09:00:00.000Z',
    );
    assert.equal(
      addSubscriptionMonths(new Date('2026-10-28T10:00:00Z'), 24).toISOString(),
      '2028-10-28T11:00:00.000Z',
    );
  });
  it('moves nonexistent Cairo wall times forward across the DST transition', () => {
    assert.equal(
      addSubscriptionMonths(new Date('2026-03-23T22:00:00Z'), 1).toISOString(),
      '2026-04-23T22:00:00.000Z',
    );
  });
  it('calculates unused credit with integer cents, rounded down and capped by coverage', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-04T00:00:00Z');
    assert.equal(
      unusedSubscriptionCredit('100.00', start, end, new Date('2026-01-03T00:00:00Z')),
      '33.33',
    );
    assert.equal(
      unusedSubscriptionCredit('100.00', start, end, new Date('2025-12-01T00:00:00Z')),
      '100.00',
    );
    assert.equal(unusedSubscriptionCredit('100.00', start, end, end), '0.00');
  });
  it('permits reading and settlement while preventing new sales, shifts, and configuration', () => {
    for (const path of [
      '/pos/orders',
      '/pos/orders/quote',
      '/pos/orders/id/kitchen-amendments',
      '/pos/shifts/open',
      '/owner/products',
      '/owner/pos/cash/safes',
    ])
      assert.equal(isSubscriptionRecoveryRequest('POST', path), false, path);
    for (const path of [
      '/pos/orders/id/checks/check/payments',
      '/pos/orders/id/handover',
      '/pos/shifts/id/close',
      '/owner/orders/id/start-preparation',
      '/pos/cash/transfers/id/receive',
    ])
      assert.equal(isSubscriptionRecoveryRequest('POST', path), true, path);
    assert.equal(isSubscriptionRecoveryRequest('GET', '/owner/products'), true);
    assert.equal(isSubscriptionRecoveryRequest('DELETE', '/owner/products/id'), false);
  });
});
