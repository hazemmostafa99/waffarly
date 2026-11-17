import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { decodeDeliveryRecovery } from './delivery-recovery.js';

test('delivery recovery accepts new courier IDs and preserves older saved name commands', () => {
  const orderId = randomUUID();
  const branchId = randomUUID();
  const requestId = randomUUID();
  const newCommand = {
    kind: 'action',
    orderId,
    branchId,
    request: { action: 'dispatch', requestId, revision: 1, courierId: randomUUID() },
  };
  const oldCommand = {
    ...newCommand,
    request: {
      action: 'dispatch',
      requestId: randomUUID(),
      revision: 1,
      courierName: 'Courier Ali',
    },
  };
  assert.deepEqual(decodeDeliveryRecovery(newCommand), newCommand);
  assert.deepEqual(decodeDeliveryRecovery(oldCommand), oldCommand);
  assert.throws(() =>
    decodeDeliveryRecovery({
      ...newCommand,
      request: { ...newCommand.request, courierName: 'unexpected extra field' },
    }),
  );
});

test('delivery recovery preserves partial cash receipt and rejects credentials and altered payment shapes', () => {
  const saved = {
    kind: 'action',
    orderId: randomUUID(),
    branchId: randomUUID(),
    request: {
      action: 'remit',
      requestId: randomUUID(),
      revision: 3,
      paymentId: randomUUID(),
      receivingShiftId: randomUUID(),
      amount: '75.00',
    },
  };
  assert.deepEqual(decodeDeliveryRecovery(JSON.parse(JSON.stringify(saved))), saved);
  assert.throws(() => decodeDeliveryRecovery({ ...saved, password: 'secret' }));
  assert.throws(() =>
    decodeDeliveryRecovery({
      ...saved,
      request: { ...saved.request, approval: { password: 'secret' } },
    }),
  );
  assert.throws(() =>
    decodeDeliveryRecovery({ ...saved, request: { ...saved.request, amount: '0' } }),
  );
  const payment = {
    kind: 'payment',
    orderId: saved.orderId,
    branchId: saved.branchId,
    checkId: randomUUID(),
    request: {
      requestId: randomUUID(),
      revision: 1,
      cashCustody: 'courier',
      tenders: [{ method: 'cash', amount: '75.00', receivedAmount: '75.00' }],
    },
  };
  assert.deepEqual(decodeDeliveryRecovery(payment), payment);
  assert.throws(() =>
    decodeDeliveryRecovery({
      ...payment,
      request: { ...payment.request, receivingShiftId: randomUUID() },
    }),
  );
});
