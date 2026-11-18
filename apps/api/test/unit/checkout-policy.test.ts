import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { allocateCheckoutLineRevenue } from '../../src/modules/orders/checkout/checkout-policy.js';

describe('checkout revenue discount allocation', () => {
  it('allocates the saved coupon proportionally and settles remainder cents deterministically', () => {
    const result = allocateCheckoutLineRevenue(
      [
        { id: 'line-b', position: 1, lineTotal: '20.00' },
        { id: 'line-a', position: 0, lineTotal: '10.00' },
        { id: 'line-c', position: 2, lineTotal: '30.00' },
      ],
      '1.01',
    );

    assert.deepEqual(result, [
      { lineId: 'line-b', revenueAmount: '19.66' },
      { lineId: 'line-a', revenueAmount: '9.83' },
      { lineId: 'line-c', revenueAmount: '29.50' },
    ]);
    assert.equal(
      result.reduce((sum, line) => sum + BigInt(line.revenueAmount.replace('.', '')), 0n),
      5899n,
    );
  });

  it('keeps full line totals when there is no saved discount', () => {
    assert.deepEqual(
      allocateCheckoutLineRevenue([{ id: 'line-a', position: 0, lineTotal: '12.34' }]),
      [{ lineId: 'line-a', revenueAmount: '12.34' }],
    );
  });

  it('uses saved line position when fractional shares tie', () => {
    assert.deepEqual(
      allocateCheckoutLineRevenue(
        [
          { id: 'later', position: 1, lineTotal: '1.00' },
          { id: 'earlier', position: 0, lineTotal: '1.00' },
        ],
        '0.01',
      ),
      [
        { lineId: 'later', revenueAmount: '1.00' },
        { lineId: 'earlier', revenueAmount: '0.99' },
      ],
    );
  });

  it('rejects a saved discount larger than the item subtotal', () => {
    assert.throws(
      () => allocateCheckoutLineRevenue([{ id: 'line-a', position: 0, lineTotal: '1.00' }], '1.01'),
      ConflictException,
    );
  });
});
