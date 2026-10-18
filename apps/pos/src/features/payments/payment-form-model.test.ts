import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMoneyCents, parseMoneyCents, previewPosTenders } from './payment-form-model.js';

test('parses and formats money as exact integer cents', () => {
  assert.equal(parseMoneyCents('34.8'), 3480n);
  assert.equal(parseMoneyCents('34.86'), 3486n);
  assert.equal(parseMoneyCents('1.009'), null);
  assert.equal(parseMoneyCents('-2.00'), null);
  assert.equal(formatMoneyCents(5n), '0.05');
});

test('previews a split cash and terminal tender with exact remaining and change', () => {
  const result = previewPosTenders(
    [
      { id: 'cash', method: 'cash', amount: '10.00', receivedAmount: '20.00' },
      { id: 'terminal', method: 'terminal', amount: '12.50', receivedAmount: '' },
    ],
    '34.86',
  );
  assert.equal(result.error, null);
  assert.deepEqual(result.preview?.tenders, [
    { method: 'cash', amount: '10.00', receivedAmount: '20.00' },
    { method: 'terminal', amount: '12.50' },
  ]);
  assert.equal(result.preview?.appliedCents, 2250n);
  assert.equal(result.preview?.changeCents, 1000n);
  assert.equal(result.preview?.balanceAfterCents, 1236n);
});

test('rejects invalid cash and overpayment before sending the financial command', () => {
  assert.equal(
    previewPosTenders(
      [{ id: 'cash', method: 'cash', amount: '5.00', receivedAmount: '4.00' }],
      '5.00',
    ).error,
    'Cash received must cover the payment amount.',
  );
  assert.equal(
    previewPosTenders(
      [{ id: 'terminal', method: 'terminal', amount: '5.01', receivedAmount: '' }],
      '5.00',
    ).error,
    'Payment cannot exceed the remaining balance.',
  );
});
