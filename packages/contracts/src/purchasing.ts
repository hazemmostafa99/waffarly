import type { CursorPage } from './pagination.js';
import type { StockBaseUnit, StockCondition, StockMovementBatchResult } from './inventory.js';

export const PURCHASE_INVOICE_STATUSES = ['draft', 'confirmed'] as const;
export type PurchaseInvoiceStatus = (typeof PURCHASE_INVOICE_STATUSES)[number];

const PURCHASE_QUANTITY_SCALE = 1_000_000n;
const MAX_PURCHASE_AMOUNT_CENTS = 999_999_999_999_999_999n;
const purchaseMoneyPattern = /^(?:0|[1-9]\d{0,15})(?:\.(\d{1,2}))?$/;

/** A purchase unit cost is a positive EGP amount with at most two decimals. */
export function normalizePurchaseUnitCost(value: string): string | null {
  const normalized = normalizePurchaseAmount(value);
  if (normalized === null || normalized === '0.00') return null;
  return normalized;
}

export function isPositivePurchaseUnitCost(value: string): boolean {
  return normalizePurchaseUnitCost(value) !== null;
}

export function normalizePurchaseAmount(value: string): string | null {
  const match = purchaseMoneyPattern.exec(value);
  if (!match) return null;
  const [whole, fractional = ''] = match[0].split('.');
  const cents = BigInt(whole!) * 100n + BigInt(fractional.padEnd(2, '0'));
  return cents <= MAX_PURCHASE_AMOUNT_CENTS ? formatPurchaseCents(cents) : null;
}

export function isNonNegativePurchaseAmount(value: string): boolean {
  return normalizePurchaseAmount(value) !== null;
}

/** Calculate a purchase line total with EGP cent precision and half-up rounding. */
export function calculatePurchaseInvoiceLineTotal(
  quantity: string,
  unitCost: string,
): string | null {
  const quantityMatch = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec(quantity);
  const normalizedCost = normalizePurchaseUnitCost(unitCost);
  if (!quantityMatch || normalizedCost === null) return null;

  const quantityMicros =
    BigInt(quantityMatch[1]!) * PURCHASE_QUANTITY_SCALE +
    BigInt((quantityMatch[2] ?? '').padEnd(6, '0'));
  const [wholeCost, fractionalCost = ''] = normalizedCost.split('.');
  const unitCostCents = BigInt(wholeCost!) * 100n + BigInt(fractionalCost.padEnd(2, '0'));
  if (quantityMicros <= 0n) return null;

  const lineTotalCents =
    (quantityMicros * unitCostCents + PURCHASE_QUANTITY_SCALE / 2n) /
    PURCHASE_QUANTITY_SCALE;
  if (lineTotalCents > MAX_PURCHASE_AMOUNT_CENTS) return null;
  return formatPurchaseCents(lineTotalCents);
}

/** Sum already rounded line totals so previews and saved invoice totals agree. */
export function calculatePurchaseInvoiceTotal(
  lines: readonly { quantity: string; unitCost: string }[],
): string | null {
  return calculatePurchaseInvoiceAmounts(lines)?.totalAmount ?? null;
}

export interface PurchaseInvoiceAmounts {
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  totalAmount: string;
  lines: Array<{
    lineSubtotal: string;
    discountAllocation: string;
    shippingAllocation: string;
    lineTotal: string;
  }>;
}

/** Allocate invoice-level discount and shipping by each line's pre-adjustment value. */
export function calculatePurchaseInvoiceAmounts(
  lines: readonly { quantity: string; unitCost: string }[],
  discountAmount = '0.00',
  shippingAmount = '0.00',
): PurchaseInvoiceAmounts | null {
  const normalizedDiscount = normalizePurchaseAmount(discountAmount);
  const normalizedShipping = normalizePurchaseAmount(shippingAmount);
  if (normalizedDiscount === null || normalizedShipping === null) return null;

  const lineSubtotalCents: bigint[] = [];
  for (const line of lines) {
    const lineTotal = calculatePurchaseInvoiceLineTotal(line.quantity, line.unitCost);
    if (lineTotal === null) return null;
    const [whole, fractional = '00'] = lineTotal.split('.');
    lineSubtotalCents.push(BigInt(whole!) * 100n + BigInt(fractional.padEnd(2, '0')));
  }

  const subtotalCents = lineSubtotalCents.reduce((total, line) => total + line, 0n);
  const discountCents = amountToCents(normalizedDiscount);
  const shippingCents = amountToCents(normalizedShipping);
  if (
    subtotalCents > MAX_PURCHASE_AMOUNT_CENTS ||
    discountCents > subtotalCents ||
    (shippingCents > 0n && subtotalCents === 0n)
  ) {
    return null;
  }
  const totalCents = subtotalCents - discountCents + shippingCents;
  if (totalCents > MAX_PURCHASE_AMOUNT_CENTS) return null;

  const discountAllocations = allocatePurchaseAmount(discountCents, lineSubtotalCents);
  const shippingAllocations = allocatePurchaseAmount(shippingCents, lineSubtotalCents);
  if (!discountAllocations || !shippingAllocations) return null;

  return {
    subtotalAmount: formatPurchaseCents(subtotalCents),
    discountAmount: normalizedDiscount,
    shippingAmount: normalizedShipping,
    totalAmount: formatPurchaseCents(totalCents),
    lines: lineSubtotalCents.map((lineSubtotal, index) => {
      const discount = discountAllocations[index]!;
      const shipping = shippingAllocations[index]!;
      return {
        lineSubtotal: formatPurchaseCents(lineSubtotal),
        discountAllocation: formatPurchaseCents(discount),
        shippingAllocation: formatPurchaseCents(shipping),
        lineTotal: formatPurchaseCents(lineSubtotal - discount + shipping),
      };
    }),
  };
}

function amountToCents(value: string): bigint {
  const [whole, fractional = '00'] = value.split('.');
  return BigInt(whole!) * 100n + BigInt(fractional.padEnd(2, '0'));
}

function allocatePurchaseAmount(amountCents: bigint, weights: readonly bigint[]): bigint[] | null {
  if (amountCents === 0n) return weights.map(() => 0n);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0n);
  if (totalWeight === 0n) return null;

  const shares = weights.map((weight, index) => {
    const numerator = amountCents * weight;
    return { index, cents: numerator / totalWeight, remainder: numerator % totalWeight };
  });
  const allocated = shares.reduce((total, share) => total + share.cents, 0n);
  const leftoverCents = Number(amountCents - allocated);
  shares.sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (let index = 0; index < leftoverCents; index += 1) shares[index]!.cents += 1n;
  shares.sort((left, right) => left.index - right.index);
  return shares.map((share) => share.cents);
}

function formatPurchaseCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

export interface PurchaseSupplierFields {
  name: string;
  contactName?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
}

export interface PurchaseSupplier extends Omit<
  PurchaseSupplierFields,
  'contactName' | 'phone' | 'email' | 'address'
> {
  id: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseSupplierRequest extends PurchaseSupplierFields {
  requestId: string;
}

export interface UpdatePurchaseSupplierRequest extends PurchaseSupplierFields {
  revision: number;
}

export interface PurchaseSupplierRevisionRequest {
  revision: number;
}

export interface PurchaseInvoiceLineFields {
  stockItemId: string;
  condition: StockCondition;
  quantity: string;
  unitCode: string;
  /** EGP per selected purchase unit. */
  unitCost: string;
}

export interface PurchaseInvoiceLine extends Omit<PurchaseInvoiceLineFields, 'unitCost'> {
  id: string;
  stockItemName: string;
  baseUnit: StockBaseUnit;
  unitName: string;
  position: number;
  /** Historical receipts created before purchase costing may not have a value. */
  unitCost: string | null;
  lineSubtotal: string | null;
  discountAllocation: string | null;
  shippingAllocation: string | null;
  lineTotal: string | null;
}

export interface PurchaseInvoiceFields {
  supplierId: string;
  supplierInvoiceNumber?: string | undefined;
  warehouseId: string;
  lines: PurchaseInvoiceLineFields[];
  discountAmount?: string | undefined;
  shippingAmount?: string | undefined;
}

export interface PurchaseInvoice extends Omit<
  PurchaseInvoiceFields,
  'supplierInvoiceNumber' | 'lines' | 'discountAmount' | 'shippingAmount'
> {
  /** Null only for historical invoices created before monetary fields existed. */
  subtotalAmount: string | null;
  discountAmount: string | null;
  shippingAmount: string | null;
  totalAmount: string | null;
  id: string;
  supplierName: string;
  supplierInvoiceNumber: string | null;
  warehouseName: string;
  branchName: string;
  status: PurchaseInvoiceStatus;
  revision: number;
  lines: PurchaseInvoiceLine[];
  confirmedAt: string | null;
  confirmedBy: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseInvoiceRequest extends PurchaseInvoiceFields {
  requestId: string;
}

export interface UpdatePurchaseInvoiceRequest extends PurchaseInvoiceFields {
  revision: number;
}

export interface ConfirmPurchaseInvoiceRequest {
  requestId: string;
  revision: number;
}

export interface ConfirmPurchaseInvoiceResult {
  invoice: PurchaseInvoice;
  receipt: StockMovementBatchResult;
}

export type PurchaseSupplierPage = CursorPage<PurchaseSupplier>;
export type PurchaseInvoicePage = CursorPage<PurchaseInvoice>;
