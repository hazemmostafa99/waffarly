import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { posDeliveryCommandSchema } from '../../src/modules/orders/delivery/pos-delivery.schemas.js';
import { parseRecordPosCheckPaymentRequest } from '../../src/modules/payments/payments.schemas.js';
import {
  closePosShiftSchema,
  withoutShiftCloseApproval,
} from '../../src/modules/shifts/shifts.schemas.js';

test('delivery commands validate exact amounts, identities, reasons and reject injected tenants or credentials', () => {
  const remit = {
    action: 'remit',
    requestId: randomUUID(),
    revision: 1,
    receivingShiftId: randomUUID(),
    paymentId: randomUUID(),
    amount: '12.50',
  };
  assert.equal(posDeliveryCommandSchema.safeParse(remit).success, true);
  for (const amount of ['0', '-1.00', '1.001', 'NaN'])
    assert.equal(posDeliveryCommandSchema.safeParse({ ...remit, amount }).success, false);
  assert.equal(
    posDeliveryCommandSchema.safeParse({ ...remit, merchantId: randomUUID() }).success,
    false,
  );
  assert.equal(
    posDeliveryCommandSchema.safeParse({ ...remit, approval: { password: 'secret' } }).success,
    false,
  );
  assert.equal(
    posDeliveryCommandSchema.safeParse({
      action: 'failed',
      requestId: randomUUID(),
      revision: 1,
      reason: ' ',
    }).success,
    false,
  );
});

test('courier custody is cash only and cannot claim a receiving drawer simultaneously', () => {
  const request = {
    requestId: randomUUID(),
    revision: 1,
    cashCustody: 'courier',
    tenders: [{ method: 'cash', amount: '10.00', receivedAmount: '10.00' }],
  };
  assert.equal(parseRecordPosCheckPaymentRequest(request).cashCustody, 'courier');
  assert.throws(() =>
    parseRecordPosCheckPaymentRequest({ ...request, receivingShiftId: randomUUID() }),
  );
  assert.throws(() =>
    parseRecordPosCheckPaymentRequest({
      ...request,
      tenders: [{ method: 'terminal', amount: '10.00' }],
    }),
  );
});

test('shift handover retains its named recipient in recovery but never approval credentials', () => {
  const parsed = closePosShiftSchema.parse({
    requestId: randomUUID(),
    countedCash: '50.00',
    deliveryHandover: { recipientUsername: 'mona' },
    approval: { username: 'supervisor', password: 'secret' },
  });
  const saved = withoutShiftCloseApproval(parsed);
  assert.deepEqual(saved.deliveryHandover, { recipientUsername: 'mona' });
  assert.equal(JSON.stringify(saved).includes('secret'), false);
  assert.equal(
    closePosShiftSchema.safeParse({
      ...parsed,
      deliveryHandover: { recipientUsername: 'mona', password: 'secret' },
    }).success,
    false,
  );
});
