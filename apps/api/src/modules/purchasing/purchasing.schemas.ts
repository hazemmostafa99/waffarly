import { STOCK_CONDITIONS } from '@waffarly/contracts';
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
  .regex(/^(0|[1-9]\d{0,11})(?:\.\d{1,6})?$/)
  .refine((value) => !/^0(?:\.0+)?$/.test(value), 'Quantity must be greater than zero.');

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
  })
  .strict();

const invoiceFields = {
  supplierId: uuid,
  supplierInvoiceNumber: z.string().trim().max(100).optional(),
  warehouseId: uuid,
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

export const createPurchaseInvoiceSchema = z.object({ requestId: uuid, ...invoiceFields }).strict();
export const updatePurchaseInvoiceSchema = z.object({ revision, ...invoiceFields }).strict();
export const confirmPurchaseInvoiceSchema = z.object({ requestId: uuid, revision }).strict();
