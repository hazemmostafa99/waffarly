import { extras, products } from './prototype-data.js';

export interface DraftLine {
  id: string;
  productId: string;
  quantity: number;
  size: 'regular' | 'large';
  extras: string[];
  note: string;
}
export interface OrderLine extends DraftLine {
  unitCents: number;
  stage: 'queued' | 'preparing' | 'ready';
}
export interface Bill {
  id: string;
  amountCents: number;
  paidCents: number;
}
export interface Tender {
  id: string;
  billId: string;
  method: 'cash' | 'terminal';
  cents: number;
  receivedCents: number;
  changeCents: number;
}
export interface OrderContext {
  fulfillment: 'dine-in' | 'takeaway' | 'delivery';
  table: number | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  reference: string;
  deliveryFeeCents: number;
}
export interface DemoOrder {
  id: string;
  number: number;
  table: number | null;
  fulfillment: 'dine-in' | 'takeaway' | 'delivery';
  lines: OrderLine[];
  bills: Bill[];
  payments: Tender[];
  complete: boolean;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  reference?: string;
  deliveryFeeCents?: number;
}
export function draftUnitCents(line: DraftLine): number {
  const product = products.find((item) => item.id === line.productId);
  if (!product || product.unavailable) throw new Error('This sample item is unavailable.');
  return (
    product.cents +
    (line.size === 'large' ? 3000 : 0) +
    extras
      .filter((extra) => line.extras.includes(extra.id))
      .reduce((sum, extra) => sum + extra.cents, 0)
  );
}
export function orderTotal(order: DemoOrder): number {
  return order.lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
}
export function orderDue(order: DemoOrder): number {
  return order.bills.reduce((sum, bill) => sum + bill.amountCents - bill.paidCents, 0);
}
export function splitEqual(total: number, shares: number): number[] {
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(shares) ||
    total < shares ||
    shares < 2 ||
    shares > 6
  )
    throw new Error('Choose between two and six checks.');
  return Array.from(
    { length: shares },
    (_, index) => Math.floor(total / shares) + (index < total % shares ? 1 : 0),
  );
}
export function parseAmount(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\u066b/g, '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = '0', fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function validateTender(bill: Bill, cents: number, received: number): void {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > bill.amountCents - bill.paidCents)
    throw new Error('Enter an amount within the remaining balance.');
  if (!Number.isSafeInteger(received) || received < cents)
    throw new Error('Cash received must cover the payment amount.');
}
export function draftLine(productId: string, quantity = 1): DraftLine {
  return { id: crypto.randomUUID(), productId, quantity, size: 'regular', extras: [], note: '' };
}
