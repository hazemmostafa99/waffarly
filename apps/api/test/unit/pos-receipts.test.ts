import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPosReceiptSnapshot } from '../../src/modules/orders/receipts/pos-receipt.mapper.js';

describe('POS receipt snapshots', () => {
  it('freezes check lines and exact split-tender totals for printing and reprints', () => {
    const receipt = buildPosReceiptSnapshot({
      id: 'receipt-id',
      receiptNumber: 'POS-AB12CD34EF56AB78',
      issuedAt: new Date('2026-10-18T10:00:00.000Z'),
      merchantName: 'Waffarly Cafe',
      branchName: 'Main branch',
      orderId: '12345678-1234-4234-8234-123456789012',
      orderReference: 'B1-20261018-0042',
      orderCreatedAt: new Date('2026-10-18T09:50:00.000Z'),
      fulfillmentType: 'dine_in',
      tableCode: '#04',
      cashierName: 'Cashier One',
      registerName: 'Front counter',
      currency: 'EGP',
      checkNumber: 2,
      splitMethod: 'items',
      amount: '17.50',
      items: [
        {
          name: 'Butter chicken',
          variantName: null,
          selections: ['Spice: Medium'],
          quantity: 1,
          unitPrice: '17.50',
          total: '17.50',
        },
      ],
      payments: [
        {
          method: 'cash',
          amount: '7.50',
          receivedAmount: '10.00',
          changeAmount: '2.50',
        },
        {
          method: 'terminal',
          amount: '10.00',
          receivedAmount: '10.00',
          changeAmount: '0.00',
        },
      ],
    });

    assert.equal(receipt.paidAmount, '17.50');
    assert.equal(receipt.cashReceivedAmount, '10.00');
    assert.equal(receipt.changeAmount, '2.50');
    assert.equal(receipt.items[0]?.total, '17.50');
    assert.equal(receipt.receiptNumber, 'POS-AB12CD34EF56AB78');
    assert.equal(receipt.orderReference, 'B1-20261018-0042');
    assert.equal(receipt.fulfillmentType, 'dine_in');
  });

  it('keeps equal/custom split receipts as a single share without duplicating whole-order items', () => {
    const receipt = buildPosReceiptSnapshot({
      id: 'receipt-id',
      receiptNumber: 'POS-AB12CD34EF56AB78',
      issuedAt: new Date('2026-10-18T10:00:00.000Z'),
      merchantName: 'Waffarly Cafe',
      branchName: null,
      orderId: '12345678-1234-4234-8234-123456789012',
      orderCreatedAt: new Date('2026-10-18T09:50:00.000Z'),
      fulfillmentType: 'takeaway',
      tableCode: null,
      cashierName: 'Cashier One',
      registerName: null,
      currency: 'EGP',
      checkNumber: 1,
      splitMethod: 'equal',
      amount: '5.00',
      items: [],
      payments: [
        {
          method: 'terminal',
          amount: '5.00',
          receivedAmount: '5.00',
          changeAmount: '0.00',
        },
      ],
    });

    assert.deepEqual(receipt.items, []);
    assert.equal(receipt.amount, '5.00');
    assert.equal(receipt.paidAmount, '5.00');
    assert.equal(receipt.cashReceivedAmount, '0.00');
  });
});
