export interface OwnerProductProfitabilityRow {
  productId: string;
  productName: string;
  quantitySold: number;
  quantityRefunded: number;
  revenue: string;
  refundRevenue: string;
  /** Known recorded costs only; unknown-cost lines are excluded from this subtotal. */
  recordedCost?: string;
  recordedGrossProfit?: string;
  recordedMarginPercent?: number | null;
  cost: string | null;
  grossProfit: string | null;
  marginPercent: number | null;
  salesLines: number;
  unknownCostLines: number;
}

export interface OwnerProductProfitabilityReport {
  from: string;
  to: string;
  timezone: 'Africa/Cairo';
  branchId: string | null;
  generatedAt: string;
  totals: {
    quantitySold: number;
    quantityRefunded: number;
    revenue: string;
    refundRevenue: string;
    /** Known recorded costs across the entire scope, independent of row limits. */
    recordedCost?: string;
    recordedGrossProfit?: string;
    recordedMarginPercent?: number | null;
    cost: string | null;
    grossProfit: string | null;
    marginPercent: number | null;
    salesLines: number;
    unknownCostLines: number;
    unallocatedRefundAmount: string;
    unallocatedRefundCount: number;
  };
  products: OwnerProductProfitabilityRow[];
  menuSections: OwnerProfitabilityDimensionRow[];
  branches: OwnerProfitabilityDimensionRow[];
  truncated: boolean;
}

export interface OwnerProfitabilityDimensionRow extends Omit<
  OwnerProductProfitabilityRow,
  'productId' | 'productName'
> {
  dimensionId: string;
  dimensionName: string;
}
