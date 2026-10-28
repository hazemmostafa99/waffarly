import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InventoryBranch, OwnerPosOperationsReport } from '@waffarly/contracts';
import { Button, DashboardCard, useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { apiRequest } from '../../lib/api-client.js';
import { InventoryHeader } from '../inventory/InventoryHeader.js';
import './pos-operations-report.css';

const maxRangeMs = 93 * 24 * 60 * 60 * 1000;
type Period = 'today' | 'yesterday' | 'last7' | 'month' | 'custom';
type ReportTab = 'orders' | 'collections' | 'kitchen' | 'cashiers';

function localInputValue(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function localInputDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || localInputValue(date) !== value ? null : date;
}

function presetRange(period: Exclude<Period, 'custom'>) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const startDay =
    period === 'month' ? 1 : day - (period === 'last7' ? 6 : period === 'yesterday' ? 1 : 0);
  // Construct both midnights independently: daylight-saving changes can skip midnight.
  const from = new Date(year, month, startDay);
  const to = new Date(year, month, day + (period === 'yesterday' ? 0 : 1));
  return { from: localInputValue(from), to: localInputValue(to) };
}

export function PosOperationsReportPage() {
  const { locale, errorText, formatNumber } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [branchId, setBranchId] = useState('');
  const [period, setPeriod] = useState<Period>('today');
  const [range, setRange] = useState(() => presetRange('today'));
  const { from, to } = range;
  const [draftRange, setDraftRange] = useState(range);
  const [rangeError, setRangeError] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>('orders');
  const [report, setReport] = useState<OwnerPosOperationsReport | null>(null);
  const cashierActivity = report?.cashierActivity ?? [];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    const fromDate = localInputDate(from);
    const toDate = localInputDate(to);
    if (
      !fromDate ||
      !toDate ||
      toDate <= fromDate ||
      toDate.getTime() - fromDate.getTime() > maxRangeMs
    ) {
      setReport(null);
      setError(
        text('Choose a valid period of up to 93 days.', 'اختر فترة صحيحة لا تتجاوز 93 يومًا.'),
      );
      setLoading(false);
      return () => {
        current = false;
      };
    }

    setLoading(true);
    setReport(null);
    setError('');
    const query = new URLSearchParams({ from: fromDate.toISOString(), to: toDate.toISOString() });
    if (branchId) query.set('branchId', branchId);
    void apiRequest<OwnerPosOperationsReport>(`/owner/pos/reports/operations?${query.toString()}`)
      .then((result) => {
        if (current) setReport(result);
      })
      .catch((cause: unknown) => {
        if (current) {
          setReport(null);
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text(
                  'Could not load the POS operations report.',
                  'تعذر تحميل تقرير تشغيل نقطة البيع.',
                ),
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [branchId, errorText, from, locale, refresh, to]);

  const money = (amount: string) =>
    `${formatNumber(Number(amount), { maximumFractionDigits: 2 })} ${text('EGP', 'ج.م')}`;
  const number = (value: number) => formatNumber(value);
  const duration = (seconds: number | null) =>
    seconds === null
      ? text('No completed samples', 'لا توجد بيانات مكتملة')
      : seconds > 0 && seconds < 60
        ? text('Less than a minute', 'أقل من دقيقة')
        : text(`${number(Math.round(seconds / 60))} min`, `${number(Math.round(seconds / 60))} د`);
  const tabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'orders', label: text('Orders', 'الطلبات') },
    { id: 'collections', label: text('Collections', 'التحصيل') },
    { id: 'kitchen', label: text('Kitchen', 'المطبخ') },
    { id: 'cashiers', label: text('Cashiers', 'الكاشيرين') },
  ];
  const dateFormat = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(period === 'custom' ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  });
  const startLabel = dateFormat.format(new Date(from));
  const endLabel = dateFormat.format(
    new Date(new Date(to).getTime() - (period === 'custom' ? 0 : 1)),
  );
  const periodDescription = startLabel === endLabel ? startLabel : `${startLabel} — ${endLabel}`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function changePeriod(next: Period) {
    setPeriod(next);
    setRangeError(false);
    if (next === 'custom') {
      setDraftRange(range);
    } else {
      const nextRange = presetRange(next);
      setRange(nextRange);
      setDraftRange(nextRange);
    }
  }

  function applyCustomRange() {
    const start = localInputDate(draftRange.from);
    const end = localInputDate(draftRange.to);
    if (!start || !end || end <= start || end.getTime() - start.getTime() > maxRangeMs) {
      setRangeError(true);
      return;
    }
    setRangeError(false);
    setRange({ ...draftRange });
  }

  function downloadCsv() {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      [text('Report', 'التقرير'), text('POS operations', 'تشغيل نقطة البيع')],
      [text('From (UTC)', 'من (UTC)'), report.from],
      [text('Until, exclusive (UTC)', 'حتى، غير شامل (UTC)'), report.to],
      [text('Branch ID', 'معرّف الفرع'), report.branchId ?? text('All branches', 'كل الفروع')],
      [],
      [text('Metric', 'المؤشر'), text('Value', 'القيمة'), text('Unit', 'الوحدة')],
      [text('Placed orders', 'الطلبات المنشأة'), report.orders.placedCount, 'orders'],
      [text('Accepted orders', 'الطلبات المقبولة'), report.orders.acceptedCount, 'orders'],
      [text('Completed orders', 'الطلبات المكتملة'), report.orders.completedCount, 'orders'],
      [text('Paid orders', 'الطلبات المسددة'), report.orders.paidCount, 'orders'],
      [text('Cancelled orders', 'الطلبات الملغاة'), report.orders.cancelledCount, 'orders'],
      [text('Order value', 'قيمة الطلبات'), report.orders.value, 'EGP'],
      [text('Current outstanding', 'المتبقي حاليًا'), report.orders.outstanding, 'EGP'],
      [text('Settled checks', 'الحسابات المسددة'), report.checks.settledCount, 'checks'],
      [text('Cash collected', 'التحصيل النقدي'), report.collections.cash, 'EGP'],
      [text('Terminal collected', 'تحصيل الماكينة'), report.collections.terminal, 'EGP'],
      [text('Total collected', 'إجمالي التحصيل'), report.collections.total, 'EGP'],
      [text('Cash refunds', 'استرداد نقدي'), report.refunds.cash, 'EGP'],
      [text('Terminal refunds', 'استرداد الماكينة'), report.refunds.terminal, 'EGP'],
      [text('Total refunds', 'إجمالي الاسترداد'), report.refunds.total, 'EGP'],
      [text('Net collected', 'صافي التحصيل'), report.netCollected, 'EGP'],
      [
        text('Accepted to preparation', 'من القبول إلى بدء التحضير'),
        report.preparation.acceptedToStartSeconds ?? '',
        'seconds',
      ],
      [
        text('Preparation to ready', 'من بدء التحضير إلى الجاهزية'),
        report.preparation.startToReadySeconds ?? '',
        'seconds',
      ],
    ];
    rows.push(
      [],
      [
        text('Cash collected by couriers', 'كاش دفعه العميل للطيار'),
        report.deliveryCash?.customerCollections ?? '0.00',
        'EGP',
      ],
      [
        text('Courier cash received into drawers', 'كاش الطيار المستلم في الأدراج'),
        report.deliveryCash?.drawerReceipts ?? '0.00',
        'EGP',
      ],
      [],
      [text('Cashier activity', 'نشاط الكاشيرين')],
      [
        text('Cashier / operator', 'الكاشير / الموظف'),
        text('Orders opened', 'الطلبات المنشأة'),
        text('Cancelled orders', 'الطلبات الملغاة'),
        text('Order value (EGP)', 'قيمة الطلبات (جنيه)'),
        text('Payments recorded', 'المدفوعات المسجلة'),
        text('Cash collected (EGP)', 'التحصيل النقدي (جنيه)'),
        text('Terminal collected (EGP)', 'تحصيل الماكينة (جنيه)'),
        text('Refunds recorded', 'عمليات الاسترداد'),
        text('Refunded (EGP)', 'المبالغ المستردة (جنيه)'),
        text('Net collected (EGP)', 'صافي التحصيل (جنيه)'),
        text('Courier cash received into drawer (EGP)', 'كاش الطيار المستلم في الدرج (جنيه)'),
      ],
    );
    for (const activity of cashierActivity) {
      rows.push([
        activity.employeeName ?? text('Unattributed activity', 'نشاط غير منسوب'),
        activity.ordersOpened,
        activity.cancelledOrders,
        activity.orderValue,
        activity.paymentCount,
        activity.collections.cash,
        activity.collections.terminal,
        activity.refundCount,
        activity.refunds.total,
        activity.netCollected,
        activity.deliveryCashReceived ?? '0.00',
      ]);
    }
    const csv =
      '\uFEFF' +
      rows
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pos-operations-${report.from.slice(0, 10)}-${report.to.slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="inventory-page pos-operations-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader
        title={text('POS operations', 'تشغيل نقطة البيع')}
        description={text(
          'Your daily overview, with the details one click away.',
          'ملخص التشغيل، والتفاصيل وقت ما تحتاجها.',
        )}
        showInventoryNavigation={false}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={!report || loading}
              onClick={downloadCsv}
            >
              {text('Download CSV', 'تنزيل CSV')}
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              <Icon name="refresh" />
              {text('Refresh', 'تحديث')}
            </Button>
          </>
        }
      />

      <section
        className="pos-operations-filter-card"
        aria-label={text('Report filters', 'فلاتر التقرير')}
      >
        <div className="pos-operations-filters">
          <div className="pos-operations-filter-field">
            <span>{text('Branch', 'الفرع')}</span>
            <PagedEntitySelect<InventoryBranch>
              path="/owner/inventory/branches"
              value={branchId}
              label={text('Filter by branch', 'تصفية حسب الفرع')}
              emptyLabel={text('All branches', 'كل الفروع')}
              required={false}
              searchMode="combobox"
              onSelect={(branch) => setBranchId(branch?.id ?? '')}
            />
          </div>
          <label className="pos-operations-filter-field" htmlFor="operations-period">
            <span>{text('Period', 'الفترة')}</span>
            <select
              id="operations-period"
              value={period}
              onChange={(event) => changePeriod(event.target.value as Period)}
            >
              <option value="today">{text('Today', 'اليوم')}</option>
              <option value="yesterday">{text('Yesterday', 'أمس')}</option>
              <option value="last7">{text('Last 7 days', 'آخر 7 أيام')}</option>
              <option value="month">{text('This month', 'هذا الشهر')}</option>
              <option value="custom">{text('Custom period', 'فترة مخصصة')}</option>
            </select>
          </label>
          <p className="pos-operations-range">
            <span>{periodDescription}</span>
            <small>
              {text('Device time', 'بتوقيت جهازك')} · <bdi>{timeZone}</bdi>
            </small>
          </p>
        </div>
        {period === 'custom' && (
          <div className="pos-operations-custom-range">
            <label className="pos-operations-filter-field" htmlFor="operations-from">
              <span>{text('From', 'من')}</span>
              <input
                id="operations-from"
                type="datetime-local"
                dir="ltr"
                value={draftRange.from}
                max={draftRange.to}
                aria-invalid={rangeError}
                aria-describedby={rangeError ? 'operations-range-error' : undefined}
                onChange={(event) => setDraftRange({ ...draftRange, from: event.target.value })}
              />
            </label>
            <label className="pos-operations-filter-field" htmlFor="operations-to">
              <span>{text('To', 'إلى')}</span>
              <input
                id="operations-to"
                type="datetime-local"
                dir="ltr"
                value={draftRange.to}
                min={draftRange.from}
                aria-invalid={rangeError}
                aria-describedby="operations-range-help"
                onChange={(event) => setDraftRange({ ...draftRange, to: event.target.value })}
              />
            </label>
            <Button type="button" onClick={applyCustomRange}>
              {text('Apply', 'تطبيق')}
            </Button>
            <p id="operations-range-help" className="pos-operations-range-help">
              {text(
                'Up to 93 days. The end time marks the start of the next period.',
                'حتى 93 يومًا. وقت النهاية هو بداية الفترة التالية.',
              )}
            </p>
            {rangeError && (
              <p id="operations-range-error" className="inventory-error" role="alert">
                {text(
                  'Choose a valid period of up to 93 days.',
                  'اختر فترة صحيحة لا تتجاوز 93 يومًا.',
                )}
              </p>
            )}
          </div>
        )}

        <details className="pos-operations-scope">
          <summary>
            <Icon name="help" />
            {text('About these figures', 'عن الأرقام')}
          </summary>
          <p>
            {text(
              'Collections and refunds use their event time. Outstanding is the current balance of orders placed in this range. Order and kitchen counts use order creation time.',
              'يُحسب التحصيل والاسترداد حسب وقت حدوثهما. الرصيد المتبقي هو الرصيد الحالي للطلبات المنشأة خلال الفترة. أعداد الطلبات والمطبخ تعتمد على وقت إنشاء الطلب.',
            )}
          </p>
        </details>
      </section>

      {error && (
        <div className="inventory-error pos-operations-error" role="alert">
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {text('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      )}

      {report && !error && (
        <div className="pos-operations-content" aria-busy={loading}>
          <dl
            className="pos-operations-summary"
            aria-label={text('Operational overview', 'ملخص التشغيل')}
          >
            <Metric
              label={text('Net collected', 'صافي التحصيل')}
              value={money(report.netCollected)}
              detail={text('After refunds', 'بعد الاستردادات')}
              emphasis={Number(report.netCollected) >= 0}
              warning={Number(report.netCollected) < 0}
            />
            <Metric
              label={text('Orders', 'عدد الطلبات')}
              value={number(report.orders.placedCount)}
              detail={text(
                `${number(report.orders.completedCount)} completed`,
                `${number(report.orders.completedCount)} مكتملة`,
              )}
            />
            <Metric
              label={text('Outstanding', 'المتبقي للتحصيل')}
              value={money(report.orders.outstanding)}
              detail={text(
                'Current balance of orders in this period',
                'الرصيد الحالي لطلبات الفترة',
              )}
              warning={Number(report.orders.outstanding) > 0}
            />
            <Metric
              label={text('Average preparation', 'متوسط وقت التحضير')}
              value={duration(report.preparation.startToReadySeconds)}
              detail={text('From preparation to ready', 'من بدء التحضير للجاهزية')}
            />
          </dl>
          <div className="pos-operations-detail-card">
            <div
              className="pos-operations-tabs"
              role="tablist"
              aria-label={text('Report details', 'تفاصيل التقرير')}
            >
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  id={`operations-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`operations-panel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => {
                    let next = index;
                    if (event.key === 'ArrowRight') next += locale === 'ar' ? -1 : 1;
                    else if (event.key === 'ArrowLeft') next += locale === 'ar' ? 1 : -1;
                    else if (event.key === 'Home') next = 0;
                    else if (event.key === 'End') next = tabs.length - 1;
                    else return;
                    event.preventDefault();
                    const nextTab = tabs[(next + tabs.length) % tabs.length]!;
                    setActiveTab(nextTab.id);
                    document.getElementById(`operations-tab-${nextTab.id}`)?.focus();
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div
              id="operations-panel-orders"
              role="tabpanel"
              aria-labelledby="operations-tab-orders"
              hidden={activeTab !== 'orders'}
              tabIndex={0}
            >
              <DashboardCard
                className="pos-operations-orders"
                title={text('Orders and balances', 'الطلبات والأرصدة')}
                description={text(
                  'Orders are counted once even when split into multiple checks.',
                  'يُحسب الطلب مرة واحدة حتى إذا قُسّم إلى عدة حسابات.',
                )}
              >
                <dl className="pos-operations-metrics pos-operations-order-metrics">
                  <Metric
                    label={text('Accepted', 'المقبولة للمطبخ')}
                    value={number(report.orders.acceptedCount)}
                  />
                  <Metric
                    label={text('Completed', 'المكتملة')}
                    value={number(report.orders.completedCount)}
                  />
                  <Metric
                    label={text('Paid orders', 'الطلبات المسددة')}
                    value={number(report.orders.paidCount)}
                  />
                  <Metric
                    label={text('Cancelled', 'الملغاة')}
                    value={number(report.orders.cancelledCount)}
                  />
                  <Metric
                    label={text('Settled checks', 'الحسابات المسددة')}
                    value={number(report.checks.settledCount)}
                  />
                  <Metric
                    label={text('Order value', 'قيمة الطلبات')}
                    value={money(report.orders.value)}
                  />
                </dl>
              </DashboardCard>
            </div>
            <div
              id="operations-panel-collections"
              role="tabpanel"
              aria-labelledby="operations-tab-collections"
              hidden={activeTab !== 'collections'}
              tabIndex={0}
            >
              <DashboardCard
                className="pos-operations-collections"
                title={text('Collections and refunds', 'التحصيلات والاستردادات')}
                description={text(
                  'Tender activity is grouped separately from order value.',
                  'تُعرض حركة وسائل الدفع منفصلة عن قيمة الطلبات.',
                )}
              >
                <dl className="pos-operations-metrics pos-operations-collection-metrics">
                  <Metric
                    label={text('Cash collected', 'التحصيل النقدي')}
                    value={money(report.collections.cash)}
                  />
                  <Metric
                    label={text('Terminal collected', 'تحصيل الماكينة')}
                    value={money(report.collections.terminal)}
                  />
                  <Metric
                    label={text('Total collected', 'إجمالي التحصيل')}
                    value={money(report.collections.total)}
                  />
                </dl>
                <details className="pos-operations-refunds">
                  <summary>
                    {Number(report.refunds.total) === 0
                      ? text('No refunds in this period', 'لا توجد استردادات خلال الفترة')
                      : text(
                          `Refunds · ${money(report.refunds.total)}`,
                          `الاستردادات · ${money(report.refunds.total)}`,
                        )}{' '}
                    <span>{text('View breakdown', 'عرض التفاصيل')}</span>
                  </summary>
                  <dl className="pos-operations-metrics">
                    <Metric
                      label={text('Cash refunds', 'استرداد نقدي')}
                      value={money(report.refunds.cash)}
                    />
                    <Metric
                      label={text('Terminal refunds', 'استرداد الماكينة')}
                      value={money(report.refunds.terminal)}
                    />
                  </dl>
                </details>
              </DashboardCard>
              <DashboardCard
                className="pos-operations-delivery"
                title={text('Delivery cash', 'كاش الدليفري')}
                description={text(
                  'Cash held by couriers and transfers received into drawers are tracked separately.',
                  'يُعرض النقد مع الطيارين منفصلًا عن المبالغ المستلمة في الأدراج.',
                )}
              >
                <dl className="pos-operations-metrics">
                  <Metric
                    label={text('Customer cash paid to couriers', 'كاش دفعه العميل للطيار')}
                    value={money(report.deliveryCash?.customerCollections ?? '0.00')}
                  />
                  <Metric
                    label={text(
                      'Courier cash received into drawers',
                      'كاش الطيار المستلم في الأدراج',
                    )}
                    value={money(report.deliveryCash?.drawerReceipts ?? '0.00')}
                  />
                </dl>
              </DashboardCard>
            </div>
            <div
              id="operations-panel-kitchen"
              role="tabpanel"
              aria-labelledby="operations-tab-kitchen"
              hidden={activeTab !== 'kitchen'}
              tabIndex={0}
            >
              <DashboardCard
                className="pos-operations-kitchen"
                title={text('Kitchen timing', 'توقيت المطبخ')}
                description={text(
                  'Averages include orders that have both timestamps.',
                  'تشمل المتوسطات الطلبات التي لديها وقتا البداية والنهاية.',
                )}
              >
                <dl className="pos-operations-metrics">
                  <Metric
                    label={text('Accepted to preparation', 'من القبول إلى بدء التحضير')}
                    value={duration(report.preparation.acceptedToStartSeconds)}
                  />
                  <Metric
                    label={text('Preparation to ready', 'من بدء التحضير إلى الجاهزية')}
                    value={duration(report.preparation.startToReadySeconds)}
                  />
                </dl>
              </DashboardCard>
            </div>
            <div
              id="operations-panel-cashiers"
              role="tabpanel"
              aria-labelledby="operations-tab-cashiers"
              hidden={activeTab !== 'cashiers'}
              tabIndex={0}
            >
              <DashboardCard
                className="pos-operations-cashiers"
                title={text('Cashier activity', 'نشاط الكاشيرين')}
                description={text(
                  'Orders are attributed to the employee who opened them; collections and refunds are attributed to the employee who recorded each payment action.',
                  'تُنسب الطلبات إلى الموظف الذي أنشأها، ويُنسب التحصيل والاسترداد إلى الموظف الذي سجّل كل حركة.',
                )}
              >
                {cashierActivity.length === 0 ? (
                  <p className="pos-operations-empty">
                    {text(
                      'No cashier activity in this period.',
                      'لا يوجد نشاط للكاشيرين في هذه الفترة.',
                    )}
                  </p>
                ) : (
                  <>
                    <p className="pos-operations-table-hint" id="operations-table-hint">
                      {text(
                        'Scroll horizontally to view all cashier figures.',
                        'مرّر الجدول أفقيًا لعرض جميع أرقام الكاشيرين.',
                      )}
                    </p>
                    <div
                      className="wf-table-scroll pos-operations-table-scroll"
                      role="region"
                      aria-describedby="operations-table-hint"
                      aria-label={text(
                        'Scrollable cashier activity table',
                        'جدول نشاط الكاشيرين القابل للتمرير',
                      )}
                      tabIndex={0}
                    >
                      <table className="wf-data-table pos-operations-cashier-table">
                        <caption className="wf-sr-only">
                          {text('Cashier activity', 'نشاط الكاشيرين')}
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">{text('Cashier / operator', 'الكاشير / الموظف')}</th>
                            <th scope="col">{text('Orders opened', 'الطلبات المنشأة')}</th>
                            <th scope="col">{text('Order value', 'قيمة الطلبات')}</th>
                            <th scope="col">{text('Payments', 'المدفوعات')}</th>
                            <th scope="col">{text('Collections', 'التحصيل')}</th>
                            <th scope="col">{text('Refunds', 'الاسترداد')}</th>
                            <th scope="col">{text('Net collected', 'صافي التحصيل')}</th>
                            <th scope="col">
                              {text('Courier cash received', 'كاش مستلم من الطيار')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cashierActivity.map((activity) => (
                            <tr key={activity.employeeId ?? 'unattributed'}>
                              <th scope="row">
                                <div className="inventory-table-name">
                                  <strong>
                                    {activity.employeeName ??
                                      text('Unattributed activity', 'نشاط غير منسوب')}
                                  </strong>
                                  <small>
                                    {number(activity.cancelledOrders)} {text('cancelled', 'ملغاة')}
                                  </small>
                                </div>
                              </th>
                              <td>{number(activity.ordersOpened)}</td>
                              <td>{money(activity.orderValue)}</td>
                              <td>{number(activity.paymentCount)}</td>
                              <td>
                                <span>
                                  {text('Cash', 'كاش')}: {money(activity.collections.cash)}
                                </span>
                                <small>
                                  {text('Terminal', 'ماكينة')}:{' '}
                                  {money(activity.collections.terminal)}
                                </small>
                              </td>
                              <td>
                                <span>{number(activity.refundCount)}</span>
                                <small>{money(activity.refunds.total)}</small>
                              </td>
                              <td>
                                <strong>{money(activity.netCollected)}</strong>
                              </td>
                              <td>{money(activity.deliveryCashReceived ?? '0.00')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </DashboardCard>
            </div>
          </div>

          <p className="pos-operations-note">
            <Icon name="help" />
            <span>
              {text(
                'Discount totals are not included in this report.',
                'إجمالي الخصومات غير مشمول في هذا التقرير.',
              )}{' '}
              <Link to="/pos-item-returns">
                {text('View POS returns & waste', 'عرض مرتجعات وهالك POS')}
              </Link>
            </span>
          </p>
        </div>
      )}
      {!report && !error && (
        <DashboardCard title={text('Loading report', 'جارٍ تحميل التقرير')}>
          <p className="pos-operations-loading" role="status">
            {text('Loading operational totals…', 'جارٍ تحميل إجماليات التشغيل…')}
          </p>
        </DashboardCard>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  emphasis = false,
  warning = false,
  detail,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  warning?: boolean;
  detail?: string;
}) {
  return (
    <div
      className={`pos-operations-metric${emphasis ? ' is-emphasis' : ''}${warning ? ' is-warning' : ''}`}
    >
      <dt>{label}</dt>
      <dd>
        <bdi>{value}</bdi>
        {detail && <small>{detail}</small>}
      </dd>
    </div>
  );
}
