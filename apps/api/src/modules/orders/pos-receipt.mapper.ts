import type { PosReceipt, PosReceiptPayment, PosReceiptSplitMethod } from '@waffarly/contracts';
import { formatCents, requireEgpCurrency, toCents } from '../../common/money/money.js';

export interface PosReceiptLineSource {
  name: string;
  variantName: string | null;
  selections: string[];
  quantity: number;
  unitPrice: string;
  total: string;
}

export type PosReceiptPaymentSource = PosReceiptPayment;

export interface PosReceiptSnapshotInput {
  id: string;
  receiptNumber: string;
  issuedAt: Date;
  merchantName: string;
  branchName: string | null;
  orderId: string;
  orderCreatedAt: Date;
  fulfillmentType: PosReceipt['fulfillmentType'];
  tableCode: string | null;
  cashierName: string;
  registerName: string | null;
  currency: string;
  checkNumber: number;
  splitMethod: PosReceiptSplitMethod;
  amount: string;
  items: PosReceiptLineSource[];
  payments: PosReceiptPaymentSource[];
}

export function buildPosReceiptSnapshot(input: PosReceiptSnapshotInput): PosReceipt {
  const paidCents = input.payments.reduce((sum, payment) => sum + toCents(payment.amount), 0n);
  const cashReceivedCents = input.payments.reduce(
    (sum, payment) => sum + (payment.method === 'cash' ? toCents(payment.receivedAmount) : 0n),
    0n,
  );
  const changeCents = input.payments.reduce(
    (sum, payment) => sum + toCents(payment.changeAmount),
    0n,
  );
  return {
    version: 1,
    id: input.id,
    receiptNumber: input.receiptNumber,
    issuedAt: input.issuedAt.toISOString(),
    merchantName: input.merchantName,
    branchName: input.branchName,
    orderId: input.orderId,
    orderReference: `ORD-${input.orderId.slice(0, 8).toUpperCase()}`,
    orderCreatedAt: input.orderCreatedAt.toISOString(),
    fulfillmentType: input.fulfillmentType,
    tableCode: input.tableCode,
    cashierName: input.cashierName,
    registerName: input.registerName,
    currency: requireEgpCurrency(input.currency),
    checkNumber: input.checkNumber,
    splitMethod: input.splitMethod,
    amount: formatCents(toCents(input.amount)),
    items: input.items.map((item) => ({
      ...item,
      unitPrice: formatCents(toCents(item.unitPrice)),
      total: formatCents(toCents(item.total)),
    })),
    payments: input.payments.map((payment) => ({
      ...payment,
      amount: formatCents(toCents(payment.amount)),
      receivedAmount: formatCents(toCents(payment.receivedAmount)),
      changeAmount: formatCents(toCents(payment.changeAmount)),
    })),
    paidAmount: formatCents(paidCents),
    cashReceivedAmount: formatCents(cashReceivedCents),
    changeAmount: formatCents(changeCents),
  };
}
