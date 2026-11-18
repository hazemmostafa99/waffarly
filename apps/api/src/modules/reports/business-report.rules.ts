/** Defines calendar periods and management results without floating-point money. */
import type { BusinessReportPeriod, OwnerProductProfitabilityReport } from '@waffarly/contracts';
import { formatCents, toSignedCents } from '../../common/money/money.js';

export function reportMonth(month: string, offset = 0) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  const from = date.toISOString().slice(0, 10);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const until = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() - 1);
  return { month: from.slice(0, 7), from, to: date.toISOString().slice(0, 10), until };
}

export interface PeriodCosts {
  expenses: string;
  payrollCost: string;
  payrollComplete: boolean;
  wasteCost: string;
  unknownWasteMovements: number;
}

export function buildBusinessPeriod(
  period: ReturnType<typeof reportMonth>,
  profit: OwnerProductProfitabilityReport['totals'],
  costs: PeriodCosts,
): BusinessReportPeriod {
  const payrollCost = costs.payrollComplete ? costs.payrollCost : null;
  const wasteCost = costs.unknownWasteMovements ? null : costs.wasteCost;
  const operatingResult =
    profit.grossProfit === null || payrollCost === null || wasteCost === null
      ? null
      : formatCents(
          toSignedCents(profit.grossProfit) -
            toSignedCents(costs.expenses) -
            toSignedCents(payrollCost) -
            toSignedCents(wasteCost),
        );
  const knownCost = profit.recordedCost ?? profit.cost;
  const recordedGrossProfit =
    knownCost === null || knownCost === undefined
      ? null
      : (profit.grossProfit ??
        profit.recordedGrossProfit ??
        formatCents(
          toSignedCents(profit.revenue) -
            toSignedCents(profit.refundRevenue) -
            toSignedCents(knownCost),
        ));
  const recorded =
    recordedGrossProfit === null
      ? undefined
      : {
          consumedCost: knownCost!,
          grossProfit: recordedGrossProfit,
          payrollCost: costs.payrollCost,
          wasteCost: costs.wasteCost,
          operatingResult: formatCents(
            toSignedCents(recordedGrossProfit) -
              toSignedCents(costs.expenses) -
              toSignedCents(costs.payrollCost) -
              toSignedCents(costs.wasteCost),
          ),
        };
  return {
    month: period.month,
    from: period.from,
    to: period.to,
    netSales: formatCents(toSignedCents(profit.revenue) - toSignedCents(profit.refundRevenue)),
    refunds: profit.refundRevenue,
    consumedCost: profit.cost,
    grossProfit: profit.grossProfit,
    expenses: costs.expenses,
    payrollCost,
    wasteCost,
    operatingResult,
    ...(recorded ? { recorded } : {}),
    unknownCostLines: profit.unknownCostLines,
    unknownWasteMovements: costs.unknownWasteMovements,
    payrollComplete: costs.payrollComplete,
    unallocatedRefunds: profit.unallocatedRefundAmount,
  };
}
