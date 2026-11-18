import { recordedProfitValues } from './recorded-report-values.js';
/** CSV uses the exact loaded report scope; paginated ledgers explicitly export the current page. */
import type { ReferenceReportData, ReferenceReportView } from './use-reference-report.js';
import type { ProfitGroup } from './ReferenceProfitability.js';
import { downloadReportCsv } from './report-helpers.js';
import { exportBusinessReport } from './business-report-export.js';
export function exportReferenceReport(
  data: ReferenceReportData,
  view: ReferenceReportView,
  scope: { month: string; branchId: string; period: string; cursor: string },
  group: ProfitGroup,
  locale: string,
) {
  if (data.business) {
    exportBusinessReport(data.business, locale);
    return;
  }
  const rows: Array<Array<string | number | null>> = [
    ['Report', view],
    ['Data source', 'Recorded API data / بيانات فعلية'],
    ['Month', scope.month],
    ['Branch', scope.branchId || 'All branches'],
    ['POS period', scope.period],
  ];
  if (data.profit) {
    const raw = data.profit;
    const p = { ...raw, totals: { ...raw.totals, ...recordedProfitValues(raw.totals) } };
    rows.push(
      ['From', p.from],
      ['To', p.to],
      ['Generated at', p.generatedAt],
      ['Grouping', group],
      ['Totals cover all records; rows may be truncated', p.truncated ? 'Yes' : 'No'],
      ['Revenue', p.totals.revenue],
      ['Refunds', p.totals.refundRevenue],
      ['Recorded cost', p.totals.cost],
      ['Current gross profit', p.totals.grossProfit],
      [],
      [
        'Name',
        'Sold',
        'Refunded quantity',
        'Revenue',
        'Refunds',
        'Cost',
        'Gross profit',
        'Margin %',
        'Unknown cost lines',
      ],
    );
    const list =
      group === 'product'
        ? p.products.map((row) => ({ ...row, ...recordedProfitValues(row), name: row.productName }))
        : (group === 'category' ? p.menuSections : p.branches).map((row) => ({
            ...row,
            ...recordedProfitValues(row),
            name: row.dimensionName,
          }));
    for (const row of list)
      rows.push([
        row.name,
        row.quantitySold,
        row.quantityRefunded,
        row.revenue,
        row.refundRevenue,
        row.cost,
        row.grossProfit,
        row.marginPercent,
        row.unknownCostLines,
      ]);
  }
  if (data.pos) {
    const p = data.pos;
    rows.push(
      ['From (inclusive)', p.from],
      ['To (exclusive)', p.to],
      ['Orders created', p.orders.placedCount],
      ['Completed', p.orders.completedCount],
      ['Order value', p.orders.value],
      ['Net collected', p.netCollected],
      ['Cash collected', p.collections.cash],
      ['Terminal collected', p.collections.terminal],
      ['Refunds', p.refunds.total],
      ['Outstanding', p.orders.outstanding],
      ['Preparation start seconds', p.preparation.acceptedToStartSeconds],
      ['Preparation to ready seconds', p.preparation.startToReadySeconds],
      [],
      ['Cashier', 'Orders', 'Completed', 'Collections', 'Refunds'],
    );
    for (const row of p.cashierActivity)
      rows.push([
        row.employeeName ?? 'Unattributed',
        row.ordersOpened,
        row.completedOrders ?? null,
        row.collections.total,
        row.refunds.total,
      ]);
  }
  if (data.shifts) {
    const p = data.shifts;
    rows.push(
      ['Export scope', 'CURRENT PAGE ONLY / الصفحة الحالية فقط'],
      ['Cursor', scope.cursor],
      ['Closed shifts across entire period', p.summary.closedCount],
      ['Matched across entire period', p.summary.matchedCount],
      ['Variance across entire period', p.summary.netVariance],
      [],
      ['Shift', 'Branch', 'Closed at', 'Cashier', 'Expected', 'Counted', 'Variance'],
    );
    for (const row of p.items)
      rows.push([
        row.shiftId,
        row.branchName,
        row.closedAt,
        row.operatorName,
        row.expectedCash,
        row.countedCash,
        row.variance,
      ]);
  }
  if (data.returns) {
    rows.push(
      ['Export scope', 'CURRENT PAGE ONLY / الصفحة الحالية فقط'],
      ['Cursor', scope.cursor],
      [
        'Return',
        'Date',
        'Branch',
        'Product',
        'Quantity',
        'Reason',
        'Approved by',
        'Reference value (not refund)',
      ],
    );
    for (const row of data.returns.items)
      for (const line of row.lines)
        rows.push([
          row.returnNumber,
          row.issuedAt,
          row.branchName,
          line.productName,
          line.quantity,
          row.reason,
          row.approvedBy,
          line.referenceValue,
        ]);
  }
  downloadReportCsv(`waffarly-${view}-${scope.month}.csv`, rows);
}
