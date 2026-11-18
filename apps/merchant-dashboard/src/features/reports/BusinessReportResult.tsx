/** Presents one focused business-report view using the shared report components. */
import { Link } from 'react-router-dom';
import type { BusinessReportViewProps } from './business-report-presenter.js';
import { ReportBars, ReportNotice, ReportPanel } from './ReportComponents.js';
import { businessResultRows } from './business-report-presenter.js';
import { reportMoney } from './report-helpers.js';

export function BusinessReportResult({ report, locale, profitLink }: BusinessReportViewProps) {
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const current = report.current;
  const money = (value: string | null) =>
    value === null ? text('Unavailable', 'غير متاح') : reportMoney(value, locale);
  const resultRows = businessResultRows(report, locale);
  return (
    <>
      <div className="report-result-layout">
        <ReportPanel
          title={text('From sales to the result', 'حساب النتيجة')}
          description={text(
            'Follow each step. Costs are deducted once.',
            'امشي مع الحساب خطوة خطوة. كل تكلفة بتتخصم مرة واحدة.',
          )}
        >
          <ol className="report-result-steps">
            {resultRows.map((row, index) => (
              <li
                key={row.id}
                className={row.id === 'gross' || row.id === 'result' ? 'is-subtotal' : ''}
              >
                <span className="report-step-number">{index + 1}</span>
                <span>{row.to ? <Link to={row.to}>{row.label}</Link> : row.label}</span>
                <strong>
                  <bdi>{money(row.amount)}</bdi>
                </strong>
              </li>
            ))}
          </ol>
        </ReportPanel>
        <details className="report-explainer">
          <summary>{text('Calculation details', 'تفاصيل الحساب')}</summary>
          <p>
            {text(
              'Net product sales − consumed stock cost = product gross profit.',
              'صافي مبيعات المنتجات − تكلفة الخامات المستهلكة = مجمل ربح المنتجات.',
            )}
          </p>
          <p>
            {text(
              'Gross profit − operating expenses − staff cost − separate stock waste = recorded operating result.',
              'مجمل الربح − مصروفات التشغيل − تكلفة الموظفين − هالك المخزون المستقل = نتيجة التشغيل المسجلة.',
            )}
          </p>
          <p>
            {text(
              'Staff cost uses approved base pay + additions − recorded deductions, before advance repayments. It is not the cash salary paid.',
              'تكلفة الموظفين من المرتبات المعتمدة: الأساسي + الإضافات − الخصومات المسجلة، قبل أقساط السلف. مش المبلغ اللي اتصرف نقدًا.',
            )}
          </p>
          <p>
            {text(
              'Customer item returns already consumed in a sale are not charged again as separate stock waste.',
              'مرتجع العميل اللي خاماته اتحسبت في البيع مابيتخصمش مرة تانية كهالك مخزون مستقل.',
            )}
          </p>
        </details>
      </div>
      {current.unallocatedRefunds !== '0.00' && (
        <ReportNotice
          title={text(
            'Some refunds are not allocated to products',
            'في استردادات مش منسوبة لمنتجات',
          )}
        >
          {text(
            'They reduce the overall result, so product rows may not add up to the total.',
            'بتتخصم من الإجمالي؛ عشان كده مجموع أرباح المنتجات ممكن يختلف عنه.',
          )}{' '}
          <bdi>{money(current.unallocatedRefunds)}</bdi>
        </ReportNotice>
      )}
      <div className="report-two-columns">
        <ReportPanel title={text('Cost breakdown', 'تفصيل التكاليف')}>
          <ReportBars
            variant="list"
            rows={resultRows.filter((row) =>
              ['cost', 'expenses', 'payroll', 'waste'].includes(row.id),
            )}
            locale={locale}
            emptyText={text('No recorded costs.', 'مفيش تكاليف مسجلة.')}
            color="amber"
          />
        </ReportPanel>
        <ReportPanel
          title={text('Products by gross profit', 'المنتجات حسب مجمل الربح')}
          description={text(
            'Complete-cost products first. This is before shared operating expenses.',
            'المنتجات المعروفة التكلفة أولًا. الربح هنا قبل مصروفات التشغيل المشتركة.',
          )}
          action={<Link to={profitLink}>{text('Full report', 'التقرير التفصيلي')}</Link>}
        >
          <ReportBars
            variant="list"
            rows={report.products.slice(0, 8).map((row) => ({
              id: row.id,
              label: row.name,
              amount: row.grossProfit,
              to: profitLink,
            }))}
            locale={locale}
            emptyText={text('No product activity.', 'مفيش حركة منتجات.')}
          />
          {(report.products.length > 8 || report.productsTruncated) && (
            <p className="report-footnote">
              {text(
                'Showing a ranked subset. The overall totals include all products.',
                'المعروض جزء من ترتيب المنتجات. الإجماليات بتشمل كل المنتجات.',
              )}
            </p>
          )}
        </ReportPanel>
      </div>
    </>
  );
}
