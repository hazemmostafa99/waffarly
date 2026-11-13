export type PosReceiptSplitMethod = 'whole' | 'items' | 'equal' | 'custom';

export interface PosReceiptSummary {
  id: string;
  receiptNumber: string;
  issuedAt: string;
}

export interface PosReceiptHistoryItem extends PosReceiptSummary {
  orderId: string;
  checkId: string;
  orderReference: string;
  checkNumber: number;
  amount: string;
  currency: 'EGP';
}

export interface PosReceiptHistoryPage {
  items: PosReceiptHistoryItem[];
  nextCursor: string | null;
}

export interface PosReceiptLine {
  name: string;
  variantName: string | null;
  selections: string[];
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface PosReceiptPayment {
  method: 'cash' | 'terminal';
  amount: string;
  receivedAmount: string;
  changeAmount: string;
  cashCustody?: 'courier';
}

/** Frozen customer-facing facts for one fully settled POS check. */
export interface PosReceipt {
  version: 1;
  id: string;
  receiptNumber: string;
  issuedAt: string;
  merchantName: string;
  branchName: string | null;
  orderId: string;
  orderReference: string;
  orderCreatedAt: string;
  fulfillmentType: 'takeaway' | 'delivery' | 'dine_in' | 'pickup';
  tableCode: string | null;
  cashierName: string;
  registerName: string | null;
  currency: 'EGP';
  checkNumber: number;
  splitMethod: PosReceiptSplitMethod;
  amount: string;
  items: PosReceiptLine[];
  payments: PosReceiptPayment[];
  paidAmount: string;
  cashReceivedAmount: string;
  changeAmount: string;
}
