import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeOpeningFloat } from '../../src/modules/shifts/shifts.rules.js';

test('opening float normalization uses exact cents and stable two-decimal output', () => {
  assert.equal(normalizeOpeningFloat('0'), '0.00');
  assert.equal(normalizeOpeningFloat('125.5'), '125.50');
  assert.equal(normalizeOpeningFloat('9999999999.99'), '9999999999.99');
});

test('opening float normalization rejects precision and range that cannot be represented in cents', () => {
  assert.throws(() => normalizeOpeningFloat('1.001'));
  assert.throws(() => normalizeOpeningFloat('-0.01'));
});
