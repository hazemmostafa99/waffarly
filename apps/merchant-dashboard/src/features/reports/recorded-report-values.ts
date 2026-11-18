/** Presentation selects known recorded subtotals while preserving API completeness metadata. */
import type { BusinessReportPeriod, OwnerProductProfitabilityRow } from '@waffarly/contracts';
export function recordedBusinessPeriod(period: BusinessReportPeriod): BusinessReportPeriod {
  const recorded = period.recorded;
  return {
    ...period,
    consumedCost: period.consumedCost ?? recorded?.consumedCost ?? null,
    grossProfit: period.grossProfit ?? recorded?.grossProfit ?? null,
    payrollCost: period.payrollCost ?? recorded?.payrollCost ?? null,
    wasteCost: period.wasteCost ?? recorded?.wasteCost ?? null,
    operatingResult: period.operatingResult ?? recorded?.operatingResult ?? null,
  };
}
type ProfitAmounts = Pick<
  OwnerProductProfitabilityRow,
  | 'cost'
  | 'grossProfit'
  | 'marginPercent'
  | 'recordedCost'
  | 'recordedGrossProfit'
  | 'recordedMarginPercent'
>;
export function recordedProfitValues(row: ProfitAmounts) {
  return {
    cost: row.cost ?? row.recordedCost ?? null,
    grossProfit: row.grossProfit ?? row.recordedGrossProfit ?? null,
    marginPercent: row.marginPercent ?? row.recordedMarginPercent ?? null,
  };
}
