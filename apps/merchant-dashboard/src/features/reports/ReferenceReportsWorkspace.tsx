/** Report content from the supplied HTML, rendered inside the existing merchant dashboard. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { ReportIcon } from './reference-report-icons.js';
import { ReferenceDrawer, reportText, type ShowReportDetail } from './reference-report-ui.js';
import { ReferenceBusinessOverview } from './ReferenceBusinessOverview.js';
import { ReferenceProfitability, type ProfitGroup } from './ReferenceProfitability.js';
import { ReferencePosOperations } from './ReferencePosOperations.js';
import {
  ReferenceItemReturns,
  ReferenceShiftReports,
  ReferencePagination,
} from './ReferenceRecordReports.js';
import { useReferenceReport, type ReferenceReportView } from './use-reference-report.js';
import { reportMonth, reportMonthLabel } from './reference-report-dates.js';
import { exportReferenceReport } from './reference-report-export.js';
import './reference-reports.css';

export const referenceReportRoutes = [
  {
    path: '/reports',
    id: 'overview',
    ar: 'مركز التقارير',
    en: 'Report center',
    icon: 'grid',
    subtitleAr: 'الصورة المالية لنشاطك، من المبيعات حتى نتيجة التشغيل',
    subtitleEn: 'Your financial picture, from sales to operating result',
  },
  {
    path: '/profitability',
    id: 'profit',
    ar: 'ربحية المنتجات',
    en: 'Product profitability',
    icon: 'chart',
    subtitleAr: 'تحليل الإيراد والتكلفة والهامش لكل منتج أو مجموعة',
    subtitleEn: 'Revenue, cost and margin for each product or group',
  },
  {
    path: '/pos-operations',
    id: 'pos',
    ar: 'تشغيل POS',
    en: 'POS operations',
    icon: 'shop',
    subtitleAr: 'تشغيل الطلبات، التحصيلات، والاستردادات داخل نقطة البيع',
    subtitleEn: 'Orders, collections and refunds at the point of sale',
  },
  {
    path: '/pos-shift-reports',
    id: 'shifts',
    ar: 'تقارير الورديات',
    en: 'Shift reports',
    icon: 'calendar',
    subtitleAr: 'مراجعة النقدية المتوقعة والمعدودة وفروق الإقفال',
    subtitleEn: 'Review expected cash, counted cash and closing differences',
  },
  {
    path: '/pos-item-returns',
    id: 'returns',
    ar: 'المرتجعات والهالك',
    en: 'Returns & waste',
    icon: 'return',
    subtitleAr: 'مراجعة المرتجعات الفعلية وأسبابها واعتماداتها',
    subtitleEn: 'Review physical returns, reasons and approvals',
  },
] as const;
export default function ReferenceReportsWorkspace() {
  const { locale, errorText } = useLocale(),
    ar = locale === 'ar',
    t = (en: string, arabic: string) => reportText(locale, en, arabic);
  const location = useLocation(),
    [params, setParams] = useSearchParams();
  const route =
    referenceReportRoutes.find((item) => item.path === location.pathname) ??
    referenceReportRoutes[0];
  const view: ReferenceReportView = route.id,
    month = reportMonth(params.get('month') ?? params.get('from')?.slice(0, 7) ?? null),
    branchId = params.get('branchId') ?? '',
    cursor = params.get('cursor') ?? '';
  const period = ['today', 'yesterday', 'last7', 'month'].includes(params.get('period') ?? '')
    ? params.get('period')!
    : 'last7';
  const group: ProfitGroup =
    params.get('group') === 'branch'
      ? 'branch'
      : params.get('group') === 'category'
        ? 'category'
        : 'product';
  const [refresh, setRefresh] = useState(0),
    [drawer, setDrawer] = useState<{ title: string; content: ReactNode } | null>(null),
    [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    setDrawer(null);
  }, [location.pathname]);
  const [pagination, setPagination] = useState<{ scope: string; history: string[] }>({
    scope: '',
    history: [],
  });
  const pageScope = JSON.stringify([view, month, branchId, period]);
  const history = pagination.scope === pageScope ? pagination.history : [];
  const live = useReferenceReport({ view, month, branchId, period, cursor, refresh });
  const data = live.data;
  const { loading, error } = live;
  const hasData = Boolean(data.business || data.profit || data.pos || data.shifts || data.returns);
  const months = Array.from({ length: 36 }, (_, index) => {
    const date = new Date(`${reportMonth(null)}-15T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - index);
    return date.toISOString().slice(0, 7);
  });
  if (!months.includes(month)) months.push(month);
  months.sort((left, right) => right.localeCompare(left));
  const branch = live.branches.find((item) => item.id === branchId);
  const showDetail: ShowReportDetail = (title, content) => setDrawer({ title, content });
  useEffect(() => {
    document.title = `${ar ? route.ar : route.en} | Wfarly`;
  }, [ar, route]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.delete('view');
    next.delete('cursor');
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setPagination({ scope: '', history: [] });
    setParams(next);
  }
  const nextCursor = data.shifts?.nextCursor ?? data.returns?.nextCursor ?? null;
  const paging = (
    <ReferencePagination
      locale={locale}
      count={data.shifts?.items.length ?? data.returns?.items.length ?? 0}
      next={Boolean(nextCursor)}
      previous={Boolean(cursor)}
      onNext={() => {
        if (!nextCursor) return;
        setPagination({ scope: pageScope, history: [...history, cursor] });
        const next = new URLSearchParams(params);
        next.set('cursor', nextCursor);
        setParams(next);
      }}
      onPrevious={() => {
        const next = new URLSearchParams(params),
          previous = history.at(-1);
        if (previous) next.set('cursor', previous);
        else next.delete('cursor');
        setPagination({ scope: pageScope, history: history.slice(0, -1) });
        setParams(next);
      }}
    />
  );
  return (
    <section
      className="reports-v2 reports-embedded"
      dir={ar ? 'rtl' : 'ltr'}
      aria-label={ar ? route.ar : route.en}
    >
      <div className="container">
        <div className="filters report-toolbar-inline">
          <div className="report-filter-controls">
            {view !== 'pos' && (
              <div className="control">
                <label htmlFor="reference-report-month">
                  {t('Financial period', 'الفترة المالية')}
                </label>
                <select
                  id="reference-report-month"
                  value={month}
                  onChange={(event) => update({ month: event.target.value })}
                >
                  {months.map((value) => (
                    <option key={value} value={value}>
                      {reportMonthLabel(value, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="control">
              <label htmlFor="reference-report-branch">{t('Branch', 'الفرع')}</label>
              <select
                id="reference-report-branch"
                value={branchId}
                onChange={(event) => update({ branchId: event.target.value })}
              >
                <option value="">{t('All branches', 'كل الفروع')}</option>
                {branchId && !branch && (
                  <option value={branchId}>{t('Selected branch', 'الفرع المختار')}</option>
                )}
                {live.branches.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                    {item.archivedAt ? t(' (archived)', ' (مؤرشف)') : ''}
                  </option>
                ))}
              </select>
            </div>
            {view === 'pos' && (
              <div className="quick">
                {(
                  [
                    ['today', t('Today', 'اليوم')],
                    ['yesterday', t('Yesterday', 'أمس')],
                    ['last7', t('Last 7 days', 'آخر 7 أيام')],
                    ['month', t('Current month', 'الشهر الحالي')],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={period === id ? 'on' : ''}
                    onClick={() =>
                      update({
                        period: id,
                        ...(id === 'month' ? { month: reportMonth(null) } : {}),
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="head-actions">
            <button
              type="button"
              className="button"
              disabled={loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              <ReportIcon name="refresh" />
              {t('Refresh', 'تحديث')}
            </button>
            <button
              type="button"
              className="button primary"
              disabled={loading || Boolean(error) || !hasData}
              onClick={() => {
                exportReferenceReport(
                  data,
                  view,
                  { month, branchId, period, cursor },
                  group,
                  locale,
                );
                notify(
                  view === 'shifts' || view === 'returns'
                    ? t('Current page exported.', 'تم تصدير الصفحة الحالية.')
                    : t('Report exported.', 'تم تصدير التقرير.'),
                );
              }}
            >
              <ReportIcon name="download" />
              {t('Export CSV', 'تصدير CSV')}
            </button>
          </div>
        </div>
        {live.branchError && (
          <div className="info-strip" role="status">
            {t(
              'Could not load branch choices. Refresh to retry.',
              'تعذر تحميل قائمة الفروع. اضغط تحديث لإعادة المحاولة.',
            )}
          </div>
        )}
        {loading ? (
          <>
            <div className="overview-grid">
              {[0, 1, 2, 3].map((id) => (
                <div className="card skel" key={id}>
                  <div className="shimmer" />
                  <div className="shimmer" />
                  <div className="shimmer" style={{ width: '35%' }} />
                </div>
              ))}
            </div>
            <div
              className="shimmer reference-loading-chart"
              role="status"
              aria-label={t('Loading report', 'جارٍ تحميل التقرير')}
            />
          </>
        ) : error ? (
          <div className="card state-empty" role="alert">
            <div className="empty-symbol">
              <ReportIcon name="alert" />
            </div>
            <h3>{t('Could not load report', 'تعذر تحميل التقرير')}</h3>
            <p>{errorText(error)}</p>
            <button
              type="button"
              className="button primary"
              onClick={() => setRefresh((value) => value + 1)}
            >
              <ReportIcon name="refresh" />
              {t('Retry', 'إعادة المحاولة')}
            </button>
          </div>
        ) : (
          <>
            {data.business && (
              <ReferenceBusinessOverview
                report={data.business}
                locale={locale}
                showDetail={showDetail}
              />
            )}{' '}
            {data.profit && (
              <ReferenceProfitability
                report={data.profit}
                locale={locale}
                showDetail={showDetail}
                group={group}
                onGroup={(value) => update({ group: value })}
              />
            )}{' '}
            {data.pos && (
              <ReferencePosOperations report={data.pos} locale={locale} showDetail={showDetail} />
            )}{' '}
            {data.shifts && (
              <ReferenceShiftReports
                report={data.shifts}
                locale={locale}
                showDetail={showDetail}
                pagination={paging}
              />
            )}{' '}
            {data.returns && (
              <ReferenceItemReturns
                report={data.returns}
                locale={locale}
                showDetail={showDetail}
                pagination={paging}
              />
            )}
          </>
        )}
      </div>
      {drawer && (
        <ReferenceDrawer title={drawer.title} locale={locale} onClose={() => setDrawer(null)}>
          {drawer.content}
        </ReferenceDrawer>
      )}
      {toast && (
        <div className="toast show" role="status">
          {toast}
        </div>
      )}
    </section>
  );
}
