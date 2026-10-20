import { useEffect, useState } from 'react';
import type { InventoryBranch, OwnerPosOperationsReport } from '@waffarly/contracts';
import { Button, DashboardCard, useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { apiRequest } from '../../lib/api-client.js';
import './pos-operations-report.css';

const maxRangeMs = 93 * 24 * 60 * 60 * 1000;

function utcInputValue(value: Date): string {
  return value.toISOString().slice(0, 16);
}

function utcInputDate(value: string): Date | null {
  const date = new Date(`${value}:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function PosOperationsReportPage() {
  const { locale, errorText, formatNumber } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [branchId, setBranchId] = useState('');
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 29);
    date.setUTCHours(0, 0, 0, 0);
    return utcInputValue(date);
  });
  const [to, setTo] = useState(() => utcInputValue(new Date()));
  const [report, setReport] = useState<OwnerPosOperationsReport | null>(null);
  const cashierActivity = report?.cashierActivity ?? [];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    const fromDate = utcInputDate(from);
    const toDate = utcInputDate(to);
    if (
      !fromDate ||
      !toDate ||
      toDate <= fromDate ||
      toDate.getTime() - fromDate.getTime() > maxRangeMs
    ) {
      setReport(null);
      setError(
        text(
          'Choose a valid UTC range of up to 93 days.',
          'اختر فترة UTC صحيحة لا تتجاوز ٩٣ يومًا.',
        ),
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

  const money = (amount: string) => `${amount} EGP`;
  const number = (value: number) => formatNumber(value);
  const duration = (seconds: number | null) =>
    seconds === null
      ? text('No completed samples', 'لا توجد بيانات مكتملة')
      : text(`${number(Math.round(seconds / 60))} min`, `${number(Math.round(seconds / 60))} د`);

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
    <section className="pos-operations-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="pos-operations-heading">
        <div>
          <span className="pos-operations-eyebrow">{text('Reports', 'التقارير')}</span>
          <h1>{text('POS operations', 'تشغيل نقطة البيع')}</h1>
          <p>
            {text(
              'Review order progress, current balances, collections, refunds and kitchen timing.',
              'تابع تقدم الطلبات والأرصدة الحالية والتحصيلات والاستردادات ووقت تجهيز المطبخ.',
            )}
          </p>
        </div>
        <div className="pos-operations-actions">
          <Button
            type="button"
            variant="outline"
            disabled={!report || loading}
            onClick={downloadCsv}
          >
            {text('Download CSV', 'تنزيل CSV')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <Icon name="refresh" />
            {text('Refresh', 'تحديث')}
          </Button>
        </div>
      </header>

      <div className="pos-operations-filters">
        <label>
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
        </label>
        <label>
          <span>{text('From (UTC)', 'من (UTC)')}</span>
          <input
            type="datetime-local"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          <span>{text('Until, exclusive (UTC)', 'حتى، غير شامل (UTC)')}</span>
          <input
            type="datetime-local"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>

      <p className="pos-operations-scope">
        {text(
          'Collections and refunds use their event time. Outstanding is the current balance of orders placed in this range. Order and kitchen counts use order creation time.',
          'يُحسب التحصيل والاسترداد حسب وقت حدوثهما. الرصيد المتبقي هو الرصيد الحالي للطلبات المنشأة خلال الفترة. أعداد الطلبات والمطبخ تعتمد على وقت إنشاء الطلب.',
        )}
      </p>

      {error && (
        <div className="pos-operations-error" role="alert">
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
          <DashboardCard
            title={text('Orders and balances', 'الطلبات والأرصدة')}
            description={text(
              'Orders are counted once even when split into multiple checks.',
              'يُحسب الطلب مرة واحدة حتى إذا قُسّم إلى عدة حسابات.',
            )}
          >
            <div className="pos-operations-metrics">
              <Metric
                label={text('Placed orders', 'الطلبات المنشأة')}
                value={number(report.orders.placedCount)}
              />
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
              <Metric
                label={text('Current outstanding', 'المتبقي حاليًا')}
                value={money(report.orders.outstanding)}
                emphasis
              />
            </div>
          </DashboardCard>

          <DashboardCard
            title={text('Collections and refunds', 'التحصيلات والاستردادات')}
            description={text(
              'Tender activity is grouped separately from order value.',
              'تُعرض حركة وسائل الدفع منفصلة عن قيمة الطلبات.',
            )}
          >
            <div className="pos-operations-metrics">
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
                emphasis
              />
              <Metric
                label={text('Cash refunds', 'استرداد نقدي')}
                value={money(report.refunds.cash)}
              />
              <Metric
                label={text('Terminal refunds', 'استرداد الماكينة')}
                value={money(report.refunds.terminal)}
              />
              <Metric
                label={text('Net collected', 'صافي التحصيل')}
                value={money(report.netCollected)}
                emphasis
              />
            </div>
          </DashboardCard>

          <DashboardCard
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
              <div
                className="pos-operations-table-scroll"
                role="region"
                aria-label={text(
                  'Scrollable cashier activity table',
                  'جدول نشاط الكاشيرين القابل للتمرير',
                )}
                tabIndex={0}
              >
                <table className="pos-operations-cashier-table">
                  <thead>
                    <tr>
                      <th scope="col">{text('Cashier / operator', 'الكاشير / الموظف')}</th>
                      <th scope="col">{text('Orders opened', 'الطلبات المنشأة')}</th>
                      <th scope="col">{text('Order value', 'قيمة الطلبات')}</th>
                      <th scope="col">{text('Payments', 'المدفوعات')}</th>
                      <th scope="col">{text('Collections', 'التحصيل')}</th>
                      <th scope="col">{text('Refunds', 'الاسترداد')}</th>
                      <th scope="col">{text('Net collected', 'صافي التحصيل')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashierActivity.map((activity) => (
                      <tr key={activity.employeeId ?? 'unattributed'}>
                        <th scope="row">
                          <strong>
                            {activity.employeeName ??
                              text('Unattributed activity', 'نشاط غير منسوب')}
                          </strong>
                          <small>
                            {number(activity.cancelledOrders)} {text('cancelled', 'ملغاة')}
                          </small>
                        </th>
                        <td>{number(activity.ordersOpened)}</td>
                        <td>{money(activity.orderValue)}</td>
                        <td>{number(activity.paymentCount)}</td>
                        <td>
                          <span>
                            {text('Cash', 'كاش')}: {money(activity.collections.cash)}
                          </span>
                          <small>
                            {text('Terminal', 'ماكينة')}: {money(activity.collections.terminal)}
                          </small>
                        </td>
                        <td>
                          <span>{number(activity.refundCount)}</span>
                          <small>{money(activity.refunds.total)}</small>
                        </td>
                        <td>
                          <strong>{money(activity.netCollected)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>

          <DashboardCard
            title={text('Kitchen timing', 'توقيت المطبخ')}
            description={text(
              'Averages include orders that have both timestamps.',
              'تشمل المتوسطات الطلبات التي لديها وقتا البداية والنهاية.',
            )}
          >
            <div className="pos-operations-metrics pos-operations-timing">
              <Metric
                label={text('Accepted to preparation', 'من القبول إلى بدء التحضير')}
                value={duration(report.preparation.acceptedToStartSeconds)}
              />
              <Metric
                label={text('Preparation to ready', 'من بدء التحضير إلى الجاهزية')}
                value={duration(report.preparation.startToReadySeconds)}
              />
            </div>
          </DashboardCard>

          <p className="pos-operations-note">
            <Icon name="help" />
            {text(
              'Discount totals are omitted until POS discounts are recorded as an auditable sale adjustment. Returned-item waste is available in POS Returns & Waste.',
              'لا نعرض إجمالي الخصومات حتى تُسجل خصومات نقطة البيع كتعديلات بيع قابلة للمراجعة. بيانات هالك المرتجعات متاحة في تقرير مرتجعات وهالك POS.',
            )}
          </p>
        </div>
      )}
      {!report && !error && (
        <DashboardCard title={text('Loading report', 'جارٍ تحميل التقرير')}>
          <p className="pos-operations-loading">
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
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`pos-operations-metric ${emphasis ? 'is-emphasis' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
