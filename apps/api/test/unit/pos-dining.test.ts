import { BadRequestException, ConflictException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCheckValues } from '../../src/modules/orders/dining/pos-dining.service.js';

const lines = [
  { id: 'line-a', quantity: 2, unitPrice: { toString: () => '1.25' } },
  { id: 'line-b', quantity: 1, unitPrice: { toString: () => '2.00' } },
];

describe('POS dining check allocation', () => {
  it('distributes equal checks in integer cents with a deterministic remainder', () => {
    const result = buildCheckValues(lines, '4.50', {
      requestId: '11111111-1111-4111-8111-111111111111',
      revision: 1,
      method: 'equal',
      checkCount: 4,
    });
    assert.deepEqual(
      result.map((check) => check.amountCents),
      [113n, 113n, 112n, 112n],
    );
    assert.equal(
      result.reduce((sum, check) => sum + check.amountCents, 0n),
      450n,
    );
  });

  it('accepts custom amounts only when positive and exactly conserved', () => {
    const request = {
      requestId: '11111111-1111-4111-8111-111111111111',
      revision: 1,
      method: 'custom' as const,
      amounts: ['1.50', '3.00'],
    };
    assert.deepEqual(
      buildCheckValues(lines, '4.50', request).map((check) => check.amountCents),
      [150n, 300n],
    );
    assert.throws(
      () => buildCheckValues(lines, '4.50', { ...request, amounts: ['1.50', '2.99'] }),
      BadRequestException,
    );
    assert.throws(
      () => buildCheckValues(lines, '4.50', { ...request, amounts: ['0', '4.50'] }),
      BadRequestException,
    );
  });

  it('allocates whole item quantities and conserves each line and order total', () => {
    const result = buildCheckValues(lines, '4.50', {
      requestId: '11111111-1111-4111-8111-111111111111',
      revision: 1,
      method: 'items',
      checks: [
        { lines: [{ orderLineId: 'line-a', quantity: 1 }] },
        {
          lines: [
            { orderLineId: 'line-a', quantity: 1 },
            { orderLineId: 'line-b', quantity: 1 },
          ],
        },
      ],
    });
    assert.deepEqual(
      result.map((check) => check.amountCents),
      [125n, 325n],
    );
    assert.equal(
      result
        .flatMap((check) => check.allocations)
        .filter((line) => line.orderLineId === 'line-a')
        .reduce((n, line) => n + line.quantity, 0),
      2,
    );
    assert.equal(
      result.reduce((sum, check) => sum + check.amountCents, 0n),
      450n,
    );
  });

  it('rejects omitted, duplicated, fractional, or foreign line quantities', () => {
    const base = {
      requestId: '11111111-1111-4111-8111-111111111111',
      revision: 1,
      method: 'items' as const,
    };
    assert.throws(
      () =>
        buildCheckValues(lines, '4.50', {
          ...base,
          checks: [
            { lines: [{ orderLineId: 'line-a', quantity: 1 }] },
            { lines: [{ orderLineId: 'line-b', quantity: 1 }] },
          ],
        }),
      BadRequestException,
    );
    assert.throws(
      () =>
        buildCheckValues(lines, '4.50', {
          ...base,
          checks: [
            { lines: [{ orderLineId: 'line-a', quantity: 2 }] },
            {
              lines: [
                { orderLineId: 'line-a', quantity: 1 },
                { orderLineId: 'line-b', quantity: 1 },
              ],
            },
          ],
        }),
      BadRequestException,
    );
    assert.throws(
      () =>
        buildCheckValues(lines, '4.50', {
          ...base,
          checks: [
            { lines: [{ orderLineId: 'line-a', quantity: 2 }] },
            {
              lines: [
                { orderLineId: 'foreign-line', quantity: 1 },
                { orderLineId: 'line-b', quantity: 1 },
              ],
            },
          ],
        }),
      BadRequestException,
    );
  });

  it('rejects a stored order whose line snapshots do not sum to its total', () => {
    assert.throws(
      () =>
        buildCheckValues(lines, '4.51', {
          requestId: '11111111-1111-4111-8111-111111111111',
          revision: 1,
          method: 'items',
          checks: [
            { lines: [{ orderLineId: 'line-a', quantity: 1 }] },
            {
              lines: [
                { orderLineId: 'line-a', quantity: 1 },
                { orderLineId: 'line-b', quantity: 1 },
              ],
            },
          ],
        }),
      ConflictException,
    );
  });
});
