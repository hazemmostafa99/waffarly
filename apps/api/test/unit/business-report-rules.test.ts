/** Protects calendar boundaries and missing-data propagation in monthly management results. */
import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { OwnerProductProfitabilityReport } from '@waffarly/contracts';
import {
  buildBusinessPeriod,
  reportMonth,
  type PeriodCosts,
} from '../../src/modules/reports/business-report.rules.js';
import { businessReportQuerySchema } from '../../src/modules/reports/business-report.schemas.js';

const profit: OwnerProductProfitabilityReport['totals'] = {
  quantitySold: 10,
  quantityRefunded: 1,
  revenue: '1000.00',
  refundRevenue: '100.00',
  cost: '400.00',
  grossProfit: '500.00',
  marginPercent: 55.55,
  salesLines: 10,
  unknownCostLines: 0,
  unallocatedRefundAmount: '25.00',
  unallocatedRefundCount: 1,
};
const costs: PeriodCosts = {
  expenses: '100.00',
  payrollCost: '200.00',
  payrollComplete: true,
  wasteCost: '20.00',
  unknownWasteMovements: 0,
};

it('compares January to December and includes leap day without local timezone arithmetic', () => {
  assert.deepEqual(reportMonth('2026-01', -1), {
    month: '2025-12',
    from: '2025-12-01',
    to: '2025-12-31',
    until: '2026-01-01',
  });
  assert.equal(reportMonth('2028-02').to, '2028-02-29');
  assert.equal(reportMonth('2026-02').to, '2026-02-28');
});

it('deducts recorded costs once from the existing gross profit definition', () => {
  const result = buildBusinessPeriod(reportMonth('2026-10'), profit, costs);
  assert.equal(result.netSales, '900.00');
  assert.equal(result.operatingResult, '180.00');
  assert.equal(result.unallocatedRefunds, '25.00');
});

it('retains an operating loss instead of clamping the result to zero', () => {
  const result = buildBusinessPeriod(
    reportMonth('2026-10'),
    { ...profit, grossProfit: '-50.00' },
    costs,
  );
  assert.equal(result.operatingResult, '-370.00');
});

it('does not substitute zero for missing payroll, unknown sale costs or unknown waste', () => {
  const period = reportMonth('2026-10');
  const missingPayroll = buildBusinessPeriod(period, profit, { ...costs, payrollComplete: false });
  assert.equal(missingPayroll.payrollCost, null);
  assert.equal(missingPayroll.operatingResult, null);
  assert.equal(
    buildBusinessPeriod(
      period,
      { ...profit, cost: null, grossProfit: null, unknownCostLines: 1 },
      costs,
    ).operatingResult,
    null,
  );
  const missingWaste = buildBusinessPeriod(period, profit, { ...costs, unknownWasteMovements: 1 });
  assert.equal(missingWaste.wasteCost, null);
  assert.equal(missingWaste.operatingResult, null);
});

it('rejects malformed scopes and a caller-supplied merchant identity', () => {
  assert.equal(businessReportQuerySchema.safeParse({ month: '2026-13' }).success, false);
  assert.equal(
    businessReportQuerySchema.safeParse({ month: '2026-11', branchId: 'invalid' }).success,
    false,
  );
  assert.equal(
    businessReportQuerySchema.safeParse({ month: '2026-11', merchantId: 'another-tenant' }).success,
    false,
  );
});
