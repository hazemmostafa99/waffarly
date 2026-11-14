import {
  calculatePurchaseInvoiceAmounts,
  resolvePurchaseInvoiceDiscount,
  isNonNegativePurchaseAmount,
  isPositivePurchaseUnitCost,
  isPositiveStockQuantity,
  STOCK_CONDITIONS,
} from '@waffarly/contracts';
import { z } from 'zod';

const uuid = z.string().uuid();
const revision = z.number().int().positive().max(2_147_483_646);
const name = z.string().trim().min(1).max(160);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const unitCode = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_-]{0,31}$/);
const quantity = z
  .string()
  .refine(
    isPositiveStockQuantity,
    'Quantity must be positive with up to 12 integer and 6 fractional digits.',
  );
const unitCost = z
  .string()
  .trim()
  .refine(
    isPositivePurchaseUnitCost,
    'Unit cost must be a positive EGP amount with up to two decimals.',
  );
const invoiceAmount = z
  .string()
  .trim()
  .refine(
    isNonNegativePurchaseAmount,
    'Amount must be a non-negative EGP amount with up to two decimals.',
  )
  .default('0.00');

const supplierFields = {
  name,
  contactName: optionalText(160),
  phone: optionalText(32),
  email: optionalText(254).refine(
    (value) => value === undefined || value === '' || z.email().safeParse(value).success,
    'Email address is invalid.',
  ),
  address: optionalText(500),
};

export const listPurchaseSuppliersSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).default(''),
    status: z.enum(['active', 'archived', 'all']).default('active'),
  })
  .strict();
export type PurchaseSupplierListQuery = z.infer<typeof listPurchaseSuppliersSchema>;

export const createPurchaseSupplierSchema = z
  .object({ requestId: uuid, ...supplierFields })
  .strict();
export const updatePurchaseSupplierSchema = z.object({ revision, ...supplierFields }).strict();
export const purchaseSupplierRevisionSchema = z.object({ revision }).strict();

const invoiceLine = z
  .object({
    stockItemId: uuid,
    condition: z.enum(STOCK_CONDITIONS),
    quantity,
    unitCode,
    unitCost,
  })
  .strict();

const invoiceFields = {
  supplierId: uuid,
  invoiceDate: z.iso.date().optional(),
  notes: optionalText(2000),
  discountType: z.enum(['amount', 'percentage']).optional(),
  discountValue: z.string().trim().refine(isNonNegativePurchaseAmount).optional(),
  supplierInvoiceNumber: z.string().trim().max(100).optional(),
  warehouseId: uuid,
  discountAmount: invoiceAmount,
  shippingAmount: invoiceAmount,
  lines: z
    .array(invoiceLine)
    .min(1)
    .max(100)
    .refine(
      (lines) =>
        new Set(lines.map((line) => `${line.stockItemId}:${line.condition}`)).size === lines.length,
      'An item and condition may only appear once on an invoice.',
    ),
};

export const listPurchaseInvoicesSchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    search: z.string().trim().max(160).default(''),
    status: z.enum(['draft', 'confirmed', 'all']).default('all'),
  })
  .strict();
export type PurchaseInvoiceListQuery = z.infer<typeof listPurchaseInvoicesSchema>;

export const createPurchaseInvoiceSchema = z
  .object({ requestId: uuid, ...invoiceFields })
  .strict()
  .refine(
    (invoice) =>
      calculatePurchaseInvoiceAmounts(
        invoice.lines,
        resolvePurchaseInvoiceDiscount(
          invoice.lines,
          invoice.discountType ?? 'amount',
          invoice.discountValue ?? invoice.discountAmount,
        ) ?? 'invalid',
        invoice.shippingAmount,
      ) !== null,
    {
      message: 'Invoice discount, shipping, or total is outside the supported EGP range.',
      path: ['lines'],
    },
  );
export const updatePurchaseInvoiceSchema = z
  .object({ revision, ...invoiceFields })
  .strict()
  .refine(
    (invoice) =>
      calculatePurchaseInvoiceAmounts(
        invoice.lines,
        resolvePurchaseInvoiceDiscount(
          invoice.lines,
          invoice.discountType ?? 'amount',
          invoice.discountValue ?? invoice.discountAmount,
        ) ?? 'invalid',
        invoice.shippingAmount,
      ) !== null,
    {
      message: 'Invoice discount, shipping, or total is outside the supported EGP range.',
      path: ['lines'],
    },
  );
export const confirmPurchaseInvoiceSchema = z.object({ requestId: uuid, revision }).strict();

export const listPurchaseCashMovementsSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    branchId: uuid.optional(),
  })
  .strict();

export const createPurchaseSupplierPaymentSchema = z
  .object({
    requestId: uuid,
    amount: z.string().trim().refine(isPositivePurchaseUnitCost),
    reason: z.string().trim().min(1).max(500),
    source: z.discriminatedUnion('sourceType', [
      z.object({ sourceType: z.literal('safe'), movementId: uuid }).strict(),
      z.object({ sourceType: z.literal('drawer'), movementId: uuid, shiftId: uuid }).strict(),
    ]),
  })
  .strict();

export const createPurchaseSupplierCreditNoteSchema = z
  .object({
    requestId: uuid,
    reason: z.string().trim().min(1).max(500),
    amount: z.string().trim().refine(isPositivePurchaseUnitCost),
    lines: z.array(z.object({
      invoiceLineId: uuid,
      quantity,
      creditAmount: z.string().trim().refine(isNonNegativePurchaseAmount),
    }).strict()).min(1).max(100),
  })
  .strict()
  .refine((request) => new Set(request.lines.map((line) => line.invoiceLineId)).size === request.lines.length, {
    message: 'Each original invoice line may only be returned once per credit note.',
    path: ['lines'],
  });

export const createPurchaseInvoiceCorrectionSchema = z
  .object({
    requestId: uuid,
    reason: z.string().trim().min(1).max(500),
    lines: z.array(z.object({
      invoiceLineId: uuid,
      unitCost,
    }).strict()).min(1).max(100),
  })
  .strict()
  .refine((request) => new Set(request.lines.map((line) => line.invoiceLineId)).size === request.lines.length, {
    message: 'Each original invoice line may only be corrected once per correction.',
    path: ['lines'],
  });
