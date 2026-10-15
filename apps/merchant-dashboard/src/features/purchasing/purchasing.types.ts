import type { CreatePurchaseSupplierRequest, StockCondition } from '@waffarly/contracts';
export type InvoiceLineDraft = {
  key: string;
  stockItemId: string;
  condition: StockCondition;
  quantity: string;
  unitCode: string;
};
export type SupplierFields = Pick<
  CreatePurchaseSupplierRequest,
  'name' | 'contactName' | 'phone' | 'email' | 'address'
>;
