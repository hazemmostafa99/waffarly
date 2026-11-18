/** Presents one focused business-report view using the shared report components. */
import { Link } from 'react-router-dom';
import type { BusinessReportViewProps } from './business-report-presenter.js';
import { ReportBars, ReportMetric, ReportPanel, ReportTrendChart } from './ReportComponents.js';
import { reportLink } from './report-helpers.js';
import { reportSourceLabel } from './business-report-presenter.js';

export function BusinessReportOverview({
  report,
  locale,
  profitLink,
  expensesLink,
}: BusinessReportViewProps) {
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const current = report.current;
  const previous = report.previous;
  return (
    <>
      <div className="report-metrics">
        <ReportMetric
          label={text('Net product sales', 'صافي المبيعات')}
          value={current.netSales}
          previous={previous.netSales}
          locale={locale}
          description={text('After discounts and refunds', 'بعد الخصومات والاستردادات')}
          to={profitLink}
        />
        <ReportMetric
          label={text('Product gross profit', 'مجمل ربح المنتجات')}
          value={current.grossProfit}
          previous={previous.grossProfit}
          locale={locale}
          description={text('Before operating expenses', 'قبل مصروفات التشغيل')}
          to={profitLink}
          accent="blue"
        />
        <ReportMetric
          label={text('Operating expenses', 'مصروفات التشغيل')}
          value={current.expenses}
          previous={previous.expenses}
          locale={locale}
          description={text(
            'By incurred date, regardless of payment',
            'بتاريخ المصروف، سواء اتدفع أو لأ',
          )}
          to={expensesLink}
          accent="amber"
        />
        <ReportMetric
          label={text('Recorded operating result', 'نتيجة التشغيل')}
          value={current.operatingResult}
          previous={previous.operatingResult}
          locale={locale}
          description={text(
            'After recorded expenses, staff and waste',
            'بعد المصروفات والموظفين والهالك المسجل',
          )}
          to={reportLink('/reports', {
            month: current.month,
            branchId: report.branchId,
            view: 'result',
          })}
          accent="violet"
        />
      </div>

      <ReportPanel
        title={text('How the month is moving', 'المبيعات والتكاليف اليومية')}
        description={text(
          'Daily net product sales, consumed cost and expenses · EGP. This is not daily net profit.',
          'صافي المبيعات والتكلفة المستهلكة والمصروفات يوم بيوم · بالجنيه. الرسم مش صافي ربح يومي.',
        )}
      >
        <ReportTrendChart
          title={text('Daily sales, costs and expenses', 'المبيعات والتكلفة والمصروفات اليومية')}
          locale={locale}
          points={report.daily.map((day) => ({
            label: day.date,
            values: [day.netSales, day.consumedCost, day.expenses],
          }))}
          series={[
            { key: 'sales', label: text('Net sales', 'صافي المبيعات'), color: '#21745d' },
            { key: 'cost', label: text('Consumed cost', 'التكلفة المستهلكة'), color: '#5478cc' },
            { key: 'expenses', label: text('Expenses', 'المصروفات'), color: '#c38931' },
          ]}
          emptyText={text('No recorded activity in this month.', 'مفيش حركة مسجلة في الشهر ده.')}
        />
      </ReportPanel>
      <div className="report-two-columns">
        <ReportPanel
          title={text('Where sales come from', 'قنوات البيع')}
          description={text(
            'Net product revenue by sales channel',
            'صافي إيراد المنتجات حسب قناة البيع',
          )}
        >
          <ReportBars
            locale={locale}
            rows={report.sources.map((row) => ({
              ...row,
              label: reportSourceLabel(row.id, locale),
            }))}
            emptyText={text('No recorded product sales.', 'مفيش مبيعات منتجات مسجلة.')}
            color="blue"
          />
        </ReportPanel>
        <ReportPanel
          title={text('Where expenses go', 'توزيع المصروفات')}
          action={<Link to={expensesLink}>{text('Manage expenses', 'إدارة المصروفات')}</Link>}
        >
          <ReportBars
            locale={locale}
            rows={report.expenseCategories.map((row) => ({
              ...row,
              label:
                row.id === 'remaining_categories'
                  ? text('Remaining categories', 'باقي التصنيفات')
                  : row.label,
              to: expensesLink,
            }))}
            emptyText={text('No recorded operating expenses.', 'مفيش مصروفات تشغيل مسجلة.')}
            color="amber"
          />
        </ReportPanel>
      </div>
    </>
  );
}
