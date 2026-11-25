/** Maps report values into the ordered explanation shown to the owner. */
import type { OwnerBusinessReport } from '@waffarly/contracts';
import { reportLink } from './report-helpers.js';
import type { ReportBar } from './ReportComponents.js';

export interface BusinessReportViewProps {
  report: OwnerBusinessReport;
  locale: string;
  profitLink: string;
  expensesLink: string;
  payrollLink: string;
}

export function reportSourceLabel(source: string, locale: string): string {
  const names: Record<string, [string, string]> = {
    pos: ['Point of sale', 'نقاط البيع'],
    storefront: ['Your storefront', 'متجرك الإلكتروني'],
    waffarly: ['Wfarly', 'وفرلي'],
  };
  return names[source]?.[locale === 'ar' ? 1 : 0] ?? source;
}

export function businessResultRows(report: OwnerBusinessReport, locale: string): ReportBar[] {
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const current = report.current;
  const profitLink = reportLink('/profitability', {
    from: current.from,
    to: current.to,
    branchId: report.branchId,
  });
  return [
    {
      id: 'sales',
      label: text('Net product sales', 'صافي المبيعات'),
      amount: current.netSales,
      to: profitLink,
    },
    {
      id: 'cost',
      label: text('Consumed stock cost', 'تكلفة الخامات المستهلكة'),
      amount: current.consumedCost,
      to: profitLink,
    },
    {
      id: 'gross',
      label: text('Product gross profit', 'مجمل ربح المنتجات'),
      amount: current.grossProfit,
      to: profitLink,
    },
    {
      id: 'expenses',
      label: text('Operating expenses', 'مصروفات التشغيل'),
      amount: current.expenses,
      to: reportLink('/staff/expenses', { month: current.month, branchId: report.branchId }),
    },
    {
      id: 'payroll',
      label: text('Staff cost before advance repayments', 'تكلفة الموظفين'),
      amount: current.payrollCost,
      to: reportLink('/staff/payroll', { month: current.month }),
    },
    {
      id: 'waste',
      label: text('Separate stock waste', 'هالك المخزون'),
      amount: current.wasteCost,
      to: '/inventory/history',
    },
    {
      id: 'result',
      label: text('Recorded operating result', 'نتيجة التشغيل'),
      amount: current.operatingResult,
    },
  ];
}
