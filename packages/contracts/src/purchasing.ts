import type { CursorPage } from './pagination.js';
import type { StockBaseUnit, StockCondition, StockMovementBatchResult } from './inventory.js';

export const PURCHASE_INVOICE_STATUSES = ['draft', 'confirmed'] as const;
export type PurchaseInvoiceStatus = (typeof PURCHASE_INVOICE_STATUSES)[number];

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
}

export interface PurchaseInvoiceLine extends PurchaseInvoiceLineFields {
  id: string;
  stockItemName: string;
  baseUnit: StockBaseUnit;
  unitName: string;
  position: number;
}

export interface PurchaseInvoiceFields {
  supplierId: string;
  supplierInvoiceNumber?: string | undefined;
  warehouseId: string;
  lines: PurchaseInvoiceLineFields[];
}

export interface PurchaseInvoice extends Omit<
  PurchaseInvoiceFields,
  'supplierInvoiceNumber' | 'lines'
> {
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
