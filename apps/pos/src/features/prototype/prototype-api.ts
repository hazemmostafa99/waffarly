/** In-memory design-preview adapter. Never imports the live API client. Reload resets sample orders. */
import { products } from './prototype-data.js';
import {
  draftLine,
  draftUnitCents,
  orderTotal,
  validateTender,
  type DemoOrder,
  type DraftLine,
  type OrderContext,
} from './prototype-model.js';

function sampleOrder(number: number, table: number, productIds: string[]): DemoOrder {
  const lines = productIds.map((id, index) => {
    const line = { ...draftLine(id), id: `sample-${number}-${index}` };
    return { ...line, unitCents: draftUnitCents(line), stage: 'preparing' as const };
  });
  return {
    id: `sample-${number}`,
    number,
    table,
    fulfillment: 'dine-in',
    lines,
    bills: [
      {
        id: `bill-${number}`,
        amountCents: lines.reduce((sum, line) => sum + line.unitCents, 0),
        paidCents: 0,
      },
    ],
    payments: [],
    complete: false,
    createdAt: new Date().toISOString(),
  };
}
let orders = [
  sampleOrder(1048, 4, ['chocolate', 'latte']),
  sampleOrder(1046, 7, ['toast', 'cappuccino']),
  sampleOrder(1047, 9, ['berry', 'matcha']),
];
const results = new Map<string, { fingerprint: string; order: DemoOrder }>();
function find(id: string) {
  const order = orders.find((item) => item.id === id);
  if (!order) throw new Error('This sample order could not be found.');
  return order;
}
export async function readCatalog() {
  return structuredClone(products);
}
export async function readOrders() {
  return structuredClone(orders);
}
export async function createOrder(
  input: number | null | OrderContext,
  fulfillment: DemoOrder['fulfillment'] = 'takeaway',
) {
  const context: OrderContext =
    typeof input === 'object' && input !== null
      ? input
      : {
          fulfillment: input === null ? fulfillment : 'dine-in',
          table: input,
          customerName: '',
          customerPhone: '',
          deliveryAddress: '',
          reference: '',
          deliveryFeeCents: 0,
        };
  validateContext(context);
  const table = context.table;
  const occupied = orders.find(
    (order) => table !== null && order.table === table && !order.complete,
  );
  if (occupied) return structuredClone(occupied);
  const number = Math.max(...orders.map((order) => order.number)) + 1;
  const order: DemoOrder = {
    id: `sample-${number}`,
    number,
    ...context,
    lines: [],
    bills: [],
    payments: [],
    complete: false,
    createdAt: new Date().toISOString(),
  };
  orders = [...orders, order];
  return structuredClone(order);
}
export async function updateOrderContext(orderId: string, context: OrderContext) {
  validateContext(context);
  const order = find(orderId);
  if (order.complete || order.lines.length || order.payments.length)
    throw new Error('Order details are locked after items are sent or payment begins.');
  const occupied = orders.find(
    (candidate) =>
      candidate.id !== order.id &&
      !candidate.complete &&
      context.table !== null &&
      candidate.table === context.table,
  );
  if (occupied) throw new Error('That table already has an open session. Resume it instead.');
  Object.assign(order, context);
  return structuredClone(order);
}
function validateContext(context: OrderContext) {
  if (
    context.fulfillment === 'dine-in' &&
    (!context.table || context.table < 1 || context.table > 12)
  )
    throw new Error('Choose an available table for dine-in.');
  if (context.fulfillment !== 'dine-in' && context.table !== null)
    throw new Error('Tables are only assigned to dine-in orders.');
  if (context.fulfillment === 'delivery') {
    if (!context.customerName.trim()) throw new Error('Enter a customer name for delivery.');
    if (!context.customerPhone.trim()) throw new Error('Enter a phone number for delivery.');
    if (!context.deliveryAddress.trim()) throw new Error('Enter a delivery address.');
  }
  if (!Number.isSafeInteger(context.deliveryFeeCents) || context.deliveryFeeCents < 0)
    throw new Error('Delivery fee must be a valid non-negative amount.');
}
export async function confirmRound(orderId: string, lines: DraftLine[]) {
  const order = find(orderId);
  if (order.complete || !lines.length) throw new Error('Add an item before sending a round.');
  const newLines = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99)
      throw new Error('Choose a quantity between 1 and 99.');
    return { ...structuredClone(line), unitCents: draftUnitCents(line), stage: 'queued' as const };
  });
  const amount = newLines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
  order.lines.push(...newLines);
  if (order.bills.length === 1 && !order.payments.length) order.bills[0]!.amountCents += amount;
  else order.bills.push({ id: crypto.randomUUID(), amountCents: amount, paidCents: 0 });
  return structuredClone(order);
}
export async function splitOrder(orderId: string, amounts: number[]) {
  const order = find(orderId);
  if (
    order.payments.length ||
    amounts.length < 2 ||
    amounts.some((amount) => !Number.isSafeInteger(amount) || amount <= 0) ||
    amounts.reduce((sum, amount) => sum + amount, 0) !== orderTotal(order)
  )
    throw new Error('Split unpaid checks into positive amounts that match the total.');
  order.bills = amounts.map((amountCents) => ({
    id: crypto.randomUUID(),
    amountCents,
    paidCents: 0,
  }));
  return structuredClone(order);
}
export interface PaymentCommand {
  requestId: string;
  orderId: string;
  billId: string;
  method: 'cash' | 'terminal';
  cents: number;
  receivedCents: number;
}
export async function recordPayment(command: PaymentCommand, interrupted = false) {
  const fingerprint = JSON.stringify(command);
  const saved = results.get(command.requestId);
  if (saved) {
    if (saved.fingerprint !== fingerprint)
      throw new Error('This payment request has already been used.');
    return structuredClone(saved.order);
  }
  const order = find(command.orderId);
  const bill = order.bills.find((item) => item.id === command.billId);
  if (!bill) throw new Error('Choose a check before taking payment.');
  validateTender(bill, command.cents, command.receivedCents);
  bill.paidCents += command.cents;
  order.payments.push({
    id: command.requestId,
    billId: bill.id,
    method: command.method,
    cents: command.cents,
    receivedCents: command.receivedCents,
    changeCents: command.method === 'cash' ? command.receivedCents - command.cents : 0,
  });
  results.set(command.requestId, { fingerprint, order: structuredClone(order) });
  if (interrupted)
    throw new Error('The payment reply was interrupted. Check its result before continuing.');
  return structuredClone(order);
}
export async function recoverPayment(requestId: string) {
  const result = results.get(requestId);
  if (!result) throw new Error('This payment result is not available.');
  return structuredClone(result.order);
}
export async function advanceKitchen(orderId: string) {
  const order = find(orderId);
  order.lines = order.lines.map((line) => ({
    ...line,
    stage: line.stage === 'queued' ? 'preparing' : 'ready',
  }));
  return structuredClone(order);
}
export async function finishOrder(orderId: string) {
  const order = find(orderId);
  if (
    !order.lines.length ||
    order.lines.some((line) => line.stage !== 'ready') ||
    order.bills.some((bill) => bill.amountCents !== bill.paidCents)
  )
    throw new Error('Finish preparation and settle all checks before handover.');
  order.complete = true;
  return structuredClone(order);
}
