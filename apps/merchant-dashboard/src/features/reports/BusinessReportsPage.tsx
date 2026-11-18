/** Guides owners from a monthly overview to the result calculation and current cash custody. */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, useLocale } from '@waffarly/ui';
import type { OwnerBusinessReport } from '@waffarly/contracts';
import { apiRequestSingle } from '../../lib/api-client.js';
import { ReportNotice } from './ReportComponents.js';
import { BusinessReportOverview } from './BusinessReportOverview.js';
import { BusinessReportResult } from './BusinessReportResult.js';
import { BusinessReportCash } from './BusinessReportCash.js';
import { exportBusinessReport } from './business-report-export.js';
import { cairoMonth, reportLink, validReportMonth } from './report-helpers.js';
import './business-reports.css';

type ReportView = 'overview' | 'result' | 'cash';

export function BusinessReportsPage() {
  const { locale, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [params, setParams] = useSearchParams();
  const month = validReportMonth(params.get('month'));
  const branchId = params.get('branchId') ?? '';
  const viewParam = params.get('view');
  const view: ReportView = viewParam === 'result' || viewParam === 'cash' ? viewParam : 'overview';
  const [loadedReport, setLoadedReport] = useState<OwnerBusinessReport | null>(null);
  // Never show or export a previously loaded scope under newly selected filters.
  const report =
    loadedReport?.current.month === month && (loadedReport.branchId ?? '') === branchId
      ? loadedReport
      : null;
  const [branches, setBranches] = useState<OwnerBusinessReport['branches']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setLoadedReport(null);
    const query = new URLSearchParams({ month });
    if (branchId) query.set('branchId', branchId);
    void apiRequestSingle<OwnerBusinessReport>(`/owner/reports/business?${query}`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setLoadedReport(value);
          setBranches(value.branches);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Could not load report.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, branchId, refresh]);

  const current = report?.current;
  const previous = report?.previous;
  const balances = report?.balances;
  const profitLink = report
    ? reportLink('/profitability', {
        from: report.current.from,
        to: report.current.to,
        branchId,
      })
    : '/profitability';
  const expensesLink = reportLink('/staff/expenses', { month, branchId });
  const payrollLink = reportLink('/staff/payroll', { month });
  const viewProps = report ? { report, locale, profitLink, expensesLink, payrollLink } : null;

  return (
    <div className="business-reports" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="report-page-heading">
        <div>
          <h1>{text('Business reports', 'التقارير')}</h1>
        </div>
      </header>

      <div className="report-toolbar">
        <div className="report-filter-fields">
          <label>
            {text('Reporting month', 'شهر التقرير')}
            <input
              type="month"
              min="2000-01"
              max="2099-12"
              value={month}
              onChange={(event) => {
                if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(event.target.value))
                  updateFilter('month', event.target.value);
              }}
            />
          </label>
          <label>
            {text('Branch', 'الفرع')}
            <select
              value={branchId}
              onChange={(event) => updateFilter('branchId', event.target.value)}
            >
              <option value="">{text('All branches', 'كل الفروع')}</option>
              {branchId && !branches.some((branch) => branch.id === branchId) && (
                <option value={branchId}>{text('Selected branch', 'الفرع المختار')}</option>
              )}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.archived ? text(' (archived)', ' (مؤرشف)') : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="report-page-actions">
          <Button
            variant="outline"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
          >
            {text('Refresh', 'تحديث')}
          </Button>
          <Button
            onClick={() => {
              if (report) exportBusinessReport(report, locale);
            }}
            disabled={loading || !report}
          >
            {text('Export CSV', 'تصدير CSV')}
          </Button>
        </div>
        <span className="report-period-status">
          {month === cairoMonth()
            ? text('Month in progress · figures may change', 'الشهر الحالي')
            : text('Monthly view · recorded data', 'بيانات الشهر المختار')}
        </span>
      </div>

      <nav className="report-view-nav" aria-label={text('Report views', 'أقسام التقرير')}>
        {(
          [
            ['overview', text('Overview', 'نظرة عامة'), '01'],
            ['result', text('Result & costs', 'النتيجة والتكاليف'), '02'],
            ['cash', text('Cash & obligations', 'النقدية والمستحقات'), '03'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => updateFilter('view', id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading && (
        <div className="report-loading" role="status">
          <span className="report-loading-mark" />
          {text('Preparing your business picture…', 'بنجهز صورة البيزنس…')}
        </div>
      )}
      {error && (
        <div className="report-error" role="alert">
          <strong>{text('Could not load the report', 'تعذر تحميل التقرير')}</strong>
          <p>{errorText(error)}</p>
          <Button variant="outline" onClick={() => setRefresh((value) => value + 1)}>
            {text('Try again', 'حاول تاني')}
          </Button>
        </div>
      )}

      {!loading && report && current && previous && balances && viewProps && (
        <>
          {view !== 'cash' &&
            (current.unknownCostLines > 0 ||
              !current.payrollComplete ||
              current.unknownWasteMovements > 0) && (
              <details className="report-quality-summary">
                <summary>
                  {text(
                    'Profit incomplete · review missing data',
                    'الربح غير مكتمل · راجع البيانات الناقصة',
                  )}
                </summary>
                <ul>
                  {current.unknownCostLines > 0 && (
                    <li>
                      <a href={profitLink}>
                        {text('Missing sale costs', 'تكلفة غير متاحة')} ({current.unknownCostLines})
                      </a>
                    </li>
                  )}
                  {!current.payrollComplete && (
                    <li>
                      <a href={payrollLink}>
                        {text('Payroll awaiting approval', 'المرتبات في انتظار الاعتماد')}
                      </a>
                    </li>
                  )}
                  {current.unknownWasteMovements > 0 && (
                    <li>
                      {text('Missing waste costs', 'تكلفة الهالك غير متاحة')} (
                      {current.unknownWasteMovements})
                    </li>
                  )}
                </ul>
              </details>
            )}
          {view !== 'cash' && current.operatingResult?.startsWith('-') && (
            <ReportNotice
              title={text('Negative operating result', 'نتيجة التشغيل سالبة')}
              to={reportLink('/reports', { month, branchId, view: 'result' })}
            >
              {text('Review the cost breakdown.', 'راجع تفاصيل التكاليف.')}
            </ReportNotice>
          )}

          {view === 'overview' && <BusinessReportOverview {...viewProps} />}

          {view === 'result' && <BusinessReportResult {...viewProps} />}

          {view === 'cash' && <BusinessReportCash {...viewProps} />}

          <details className="report-basis">
            <summary>{text('Calculation details', 'تفاصيل الحساب')}</summary>
            <p>
              {text(
                'Management view of recorded product operations using the existing latest-purchase cost policy. Excludes delivery income, commissions, taxes, depreciation and unrecorded costs; this is not complete net profit. Payroll deductions follow the current manual payroll rules.',
                'عرض إداري لعمليات المنتجات المسجلة على أساس تكلفة آخر شراء المعتمد عندنا. بدون إيراد التوصيل والعمولات والضرائب والإهلاك والتكاليف غير المسجلة؛ مش صافي ربح كامل. خصومات المرتبات حسب القواعد اليدوية الحالية.',
              )}
            </p>
            <p>
              {text(
                'Cancelled revenue is excluded by current status; historical results can change after cancellation. Consumed cost remains when stock was not restored. Revenue and cost follow their own event dates. Refunds do not restore stock cost automatically.',
                'إيراد البيع الملغى بيتستبعد حسب الحالة الحالية؛ نتيجة فترة قديمة ممكن تتغير بعد الإلغاء. تكلفة الاستهلاك بتفضل موجودة لو المخزون مارجعش. الإيراد والتكلفة كل واحد بتاريخ حدثه. الاسترداد مابيرجعش تكلفة المخزون تلقائيًا.',
              )}
            </p>
            <span>
              {text('Updated', 'آخر تحديث')}:{' '}
              <bdi>
                {new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Africa/Cairo',
                }).format(new Date(report.generatedAt))}
              </bdi>{' '}
              · {text('Cairo time', 'بتوقيت القاهرة')}
            </span>
          </details>
        </>
      )}
    </div>
  );
}
