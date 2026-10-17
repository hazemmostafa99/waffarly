import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  confirmRound,
  createOrder,
  finishOrder,
  recordPayment,
  recoverPayment,
  splitOrder,
  advanceKitchen,
} from './prototype-api.js';
import {
  draftLine,
  orderTotal,
  parseAmount,
  splitEqual,
  validateTender,
} from './prototype-model.js';

test('equal splitting conserves every cent with deterministic remainders', () => {
  assert.deepEqual(splitEqual(10001, 3), [3334, 3334, 3333]);
  for (let shares = 2; shares <= 6; shares++) {
    const amounts = splitEqual(28765, shares);
    assert.equal(
      amounts.reduce((sum, amount) => sum + amount, 0),
      28765,
    );
    assert.ok(Math.max(...amounts) - Math.min(...amounts) <= 1);
  }
  assert.throws(() => splitEqual(100, 0));
});

test('currency entry is exact and rejects ambiguous, negative and fractional-cent amounts', () => {
  assert.equal(parseAmount('123.45'), 12345);
  assert.equal(parseAmount('0.1'), 10);
  assert.equal(parseAmount('500'), 50000);
  assert.equal(parseAmount('١٢٣٫٤٥'), 12345);
  assert.equal(parseAmount('۱۲۳.۴۵'), 12345);
  for (const value of ['-1', '1.001', '1e2', '1,000', '', 'NaN'])
    assert.equal(parseAmount(value), null);
});

test('tender checks cap allocation by remaining amount and cash received', () => {
  const bill = { id: 'bill', amountCents: 10000, paidCents: 6000 };
  assert.doesNotThrow(() => validateTender(bill, 4000, 5000));
  assert.throws(() => validateTender(bill, 4001, 5000));
  assert.throws(() => validateTender(bill, 4000, 3999));
  assert.throws(() => validateTender(bill, 0, 0));
});

test('interrupted payment recovery/replay does not collect twice; paid splits are immutable', async () => {
  const created = await createOrder(null);
  const order = await confirmRound(created.id, [draftLine('toast')]);
  const split = await splitOrder(order.id, splitEqual(orderTotal(order), 2));
  const bill = split.bills[0]!;
  const command = {
    requestId: crypto.randomUUID(),
    orderId: order.id,
    billId: bill.id,
    method: 'cash' as const,
    cents: bill.amountCents,
    receivedCents: bill.amountCents + 1000,
  };
  await assert.rejects(recordPayment(command, true), /reply was interrupted/);
  const recovered = await recoverPayment(command.requestId);
  const replayed = await recordPayment(command);
  assert.equal(recovered.payments.length, 1);
  assert.equal(replayed.payments.length, 1);
  assert.equal(replayed.payments[0]!.changeCents, 1000);
  await assert.rejects(recordPayment({ ...command, cents: 1 }), /already been used/);
  await assert.rejects(splitOrder(order.id, [5000, 6000]), /Split unpaid checks/);
});

test('a paid table is retained until preparation and handover; new rounds preserve settled checks', async () => {
  const created = await createOrder(12);
  const sent = await confirmRound(created.id, [draftLine('toast')]);
  const paid = await recordPayment({
    requestId: crypto.randomUUID(),
    orderId: sent.id,
    billId: sent.bills[0]!.id,
    method: 'terminal',
    cents: orderTotal(sent),
    receivedCents: orderTotal(sent),
  });
  await assert.rejects(finishOrder(paid.id), /Finish preparation/);
  const nextRound = await confirmRound(paid.id, [draftLine('latte')]);
  assert.equal(nextRound.bills[0]!.paidCents, paid.bills[0]!.amountCents);
  assert.equal(nextRound.bills.length, 2);
  const newBill = nextRound.bills[1]!;
  await recordPayment({
    requestId: crypto.randomUUID(),
    orderId: paid.id,
    billId: newBill.id,
    method: 'cash',
    cents: newBill.amountCents,
    receivedCents: newBill.amountCents,
  });
  await advanceKitchen(paid.id);
  await advanceKitchen(paid.id);
  assert.equal((await finishOrder(paid.id)).complete, true);
  assert.notEqual((await createOrder(12)).id, paid.id);
});
