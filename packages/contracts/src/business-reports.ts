/** Owner-only monthly management reporting; balances are current, not historical. */
export interface BusinessReportPeriod {
  month: string;
  from: string;
  to: string;
  netSales: string;
  refunds: string;
  consumedCost: string | null;
  grossProfit: string | null;
  expenses: string;
  payrollCost: string | null;
  wasteCost: string | null;
  operatingResult: string | null;
  unknownCostLines: number;
  unknownWasteMovements: number;
  payrollComplete: boolean;
  unallocatedRefunds: string;
}

export interface BusinessReportDay {
  date: string;
  netSales: string;
  consumedCost: string | null;
  expenses: string;
}

export interface BusinessReportAmountRow {
  id: string;
  label: string;
  amount: string | null;
}

export interface BusinessReportBalances {
  safeCash: string;
  drawerCash: string;
  pendingTransfers: string;
  courierCash: string;
  supplierDue: string;
  supplierCredit: string;
  unknownSupplierInvoices: number;
  expenseDue: string;
  payrollDue: string;
  staffAdvances: string;
  openCheckDue: string;
  unverifiedDrops: string;
  unresolvedTransferDifference: string;
}

export interface OwnerBusinessReport {
  generatedAt: string;
  timezone: 'Africa/Cairo';
  currency: 'EGP';
  branchId: string | null;
  branches: Array<{ id: string; name: string; archived: boolean }>;
  current: BusinessReportPeriod;
  previous: BusinessReportPeriod;
  daily: BusinessReportDay[];
  expenseCategories: BusinessReportAmountRow[];
  sources: BusinessReportAmountRow[];
  balances: BusinessReportBalances;
  products: Array<{ id: string; name: string; netSales: string; grossProfit: string | null }>;
  productsTruncated: boolean;
}
