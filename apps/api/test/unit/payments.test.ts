import { BadRequestException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeTenders } from '../../src/modules/payments/payment.rules.js';
import {
  parseRecordPosCheckPaymentRequest,
  parseRecordPosCheckRefundRequest,
} from '../../src/modules/payments/payments.schemas.js';

describe('POS check tenders', () => {
  it('normalizes cash change and a manually confirmed terminal split exactly in cents', () => {
    assert.deepEqual(
      normalizeTenders(
        [
          { method: 'cash', amount: '2.35', receivedAmount: '5.00' },
          { method: 'terminal', amount: '7.65', terminalReference: 'AUTH-1942' },
        ],
        '12.00',
      ),
      [
        {
          method: 'cash',
          amount: '2.35',
          receivedAmount: '5.00',
          changeAmount: '2.65',
          terminalReference: null,
        },
        {
          method: 'terminal',
          amount: '7.65',
          receivedAmount: '7.65',
          changeAmount: '0.00',
          terminalReference: 'AUTH-1942',
        },
      ],
    );
  });

  it('rejects insufficient cash and tender totals above the remaining check balance', () => {
    assert.throws(
      () => normalizeTenders([{ method: 'cash', amount: '5.00', receivedAmount: '4.99' }], '9.00'),
      BadRequestException,
    );
    assert.throws(
      () => normalizeTenders([{ method: 'terminal', amount: '9.01' }], '9.00'),
      BadRequestException,
    );
  });

  it('rejects malformed or zero tenders and card data fields at the API boundary', () => {
    const base = { requestId: '77777777-7777-4777-8777-777777777777', revision: 1 };
    assert.throws(() =>
      parseRecordPosCheckPaymentRequest({
        ...base,
        tenders: [{ method: 'cash', amount: '0', receivedAmount: '0' }],
      }),
    );
    assert.throws(() =>
      parseRecordPosCheckPaymentRequest({
        ...base,
        tenders: [
          {
            method: 'cash',
            amount: '5.00',
            receivedAmount: '5.00',
            cardNumber: '4111111111111111',
          },
        ],
      }),
    );
    assert.throws(() =>
      parseRecordPosCheckPaymentRequest({
        ...base,
        tenders: [{ method: 'terminal', amount: '5.00', cardholderName: 'Test' }],
      }),
    );
    assert.throws(() =>
      parseRecordPosCheckPaymentRequest({
        ...base,
        tenders: [{ method: 'terminal', amount: '5.00', terminalReference: '4111 1111 1111 1111' }],
      }),
    );
  });

  it('validates refund allocations and requires terminal refund references without persisting approval secrets', () => {
    const request = {
      requestId: '77777777-7777-4777-8777-777777777777',
      revision: 4,
      branchId: '33333333-3333-4333-8333-333333333333',
      refundShiftId: '44444444-4444-4444-8444-444444444444',
      reason: 'Customer returned an unopened item',
      allocations: [
        {
          paymentId: '55555555-5555-4555-8555-555555555555',
          amount: '15.25',
          terminalReference: 'REF-1942',
        },
      ],
      approval: { username: 'supervisor', password: 'not-for-persistence' },
    };
    assert.deepEqual(parseRecordPosCheckRefundRequest(request), request);
    assert.throws(
      () =>
        parseRecordPosCheckRefundRequest({
          ...request,
          allocations: [{ ...request.allocations[0], amount: '0.00' }],
        }),
      BadRequestException,
    );
    assert.throws(
      () =>
        parseRecordPosCheckRefundRequest({
          ...request,
          allocations: [request.allocations[0], request.allocations[0]],
        }),
      BadRequestException,
    );
    assert.throws(
      () => parseRecordPosCheckRefundRequest({ ...request, reason: '   ' }),
      BadRequestException,
    );
    assert.throws(
      () =>
        parseRecordPosCheckRefundRequest({
          ...request,
          approval: { username: 'supervisor', password: 'x'.repeat(257) },
        }),
      BadRequestException,
    );
  });
});
