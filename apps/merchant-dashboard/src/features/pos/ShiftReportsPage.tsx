import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CursorPage, InventoryBranch, PosShiftCloseReportRow } from '@waffarly/contracts';
import { Button, DashboardCard, DataTable, useLocale, type DataTableColumn } from '@waffarly/ui';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { Icon } from '../../Icons.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { apiRequestPage } from '../../lib/api-client.js';
import { InventoryHeader } from '../inventory/InventoryHeader.js';
import { PosReportEmptyState, PosReportFilters, PosReportPagination } from './PosReportLayout.js';
import './shift-reports.css';

const pageSize = 25;
const emptyPage: CursorPage<PosShiftCloseReportRow> = { items: [], nextCursor: null };
const emptyHistory: Array<string | undefined> = [];
type ReportPeriod = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

const reportPeriods: ReportPeriod[] = ['today', 'yesterday', 'last7', 'last30', 'custom'];

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isDateValue(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && dateValue(date) === value;
}

function shiftedDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateValue(date);
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return (
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
    86_400_000
  );
}

function presetRange(period: Exclude<ReportPeriod, 'custom'>): { from: string; to: string } {
  const today = dateValue(new Date());
  if (period === 'today') return { from: today, to: today };
  if (period === 'yesterday') {
    const yesterday = shiftedDate(today, -1);
    return { from: yesterday, to: yesterday };
  }
  return { from: shiftedDate(today, period === 'last7' ? -6 : -29), to: today };
}

function reportRange(fromDate: string, toDate: string): { from: string; to: string } {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function ShiftReportsPage() {
  const { locale, errorText, formatNumber } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(emptyPage);
  const branchId = searchParams.get('branchId') ?? '';
  const periodParam = searchParams.get('period');
  const period: ReportPeriod = reportPeriods.includes(periodParam as ReportPeriod)
    ? (periodParam as ReportPeriod)
    : periodParam === null && searchParams.has('from') && searchParams.has('to')
      ? 'custom'
      : 'last30';
  const defaultRange = presetRange('last30');
  const appliedRange =
    period === 'custom'
      ? {
          from: isDateValue(searchParams.get('from'))
            ? searchParams.get('from')!
            : defaultRange.from,
          to: isDateValue(searchParams.get('to')) ? searchParams.get('to')! : defaultRange.to,
        }
      : presetRange(period);
  const filterKey = JSON.stringify([branchId, appliedRange.from, appliedRange.to]);
  const [pagination, setPagination] = useState<{
    filterKey: string;
    cursors: Array<string | undefined>;
  }>(() => ({ filterKey, cursors: [] }));
  const history = pagination.filterKey === filterKey ? pagination.cursors : emptyHistory;
  const cursor = history.at(-1);
  const [draftFromDate, setDraftFromDate] = useState(appliedRange.from);
  const [draftToDate, setDraftToDate] = useState(appliedRange.to);
  const [customEditing, setCustomEditing] = useState(period === 'custom');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [selectedReport, setSelectedReport] = useState<PosShiftCloseReportRow | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setDraftFromDate(appliedRange.from);
    setDraftToDate(appliedRange.to);
    setCustomEditing(period === 'custom');
    setRangeError('');
  }, [appliedRange.from, appliedRange.to, period]);

  function updateFilters(next: {
    branchId: string;
    period: ReportPeriod;
    from?: string;
    to?: string;
  }) {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      if (next.branchId) updated.set('branchId', next.branchId);
      else updated.delete('branchId');
      updated.set('period', next.period);
      if (next.period === 'custom' && next.from && next.to) {
        updated.set('from', next.from);
        updated.set('to', next.to);
      } else {
        updated.delete('from');
        updated.delete('to');
      }
      return updated;
    });
  }

  function selectPeriod(nextPeriod: ReportPeriod) {
    if (nextPeriod === 'custom') {
      setDraftFromDate(appliedRange.from);
      setDraftToDate(appliedRange.to);
      setCustomEditing(true);
      setRangeError('');
      return;
    }
    setCustomEditing(false);
    setRangeError('');
    updateFilters({ branchId, period: nextPeriod });
  }

  function applyCustomRange() {
    const rangeDays = daysBetween(draftFromDate, draftToDate);
    if (
      !isDateValue(draftFromDate) ||
      !isDateValue(draftToDate) ||
      rangeDays < 0 ||
      rangeDays > 92
    ) {
      setRangeError(
        text('Choose a valid range of up to 93 days.', 'اختر فترة صحيحة لا تتجاوز ٩٣ يومًا.'),
      );
      return;
    }
    setRangeError('');
    setCustomEditing(false);
    updateFilters({ branchId, period: 'custom', from: draftFromDate, to: draftToDate });
  }

  function resetFilters() {
    setCustomEditing(false);
    setRangeError('');
    setDraftFromDate(defaultRange.from);
    setDraftToDate(defaultRange.to);
    updateFilters({ branchId: '', period: 'last30' });
  }

  useEffect(() => {
    let current = true;
    const { from: fromDate, to: toDate } = appliedRange;
    const calendarDays = daysBetween(fromDate, toDate);
    if (!isDateValue(fromDate) || !isDateValue(toDate) || calendarDays < 0 || calendarDays > 92) {
      setError(
        text('Choose a valid range of up to 93 days.', 'اختر فترة صحيحة لا تتجاوز ٩٣ يومًا.'),
      );
      setPage(emptyPage);
      setLoading(false);
      return () => {
        current = false;
      };
    }

    setLoading(true);
    setError('');
    const query = new URLSearchParams({
      ...reportRange(fromDate, toDate),
      limit: String(pageSize),
    });
    if (branchId) query.set('branchId', branchId);
    if (cursor) query.set('cursor', cursor);
    void apiRequestPage<PosShiftCloseReportRow>(`/owner/pos/shifts/reports?${query.toString()}`)
      .then((result) => {
        if (current) setPage(result);
      })
      .catch((cause: unknown) => {
        if (current) {
          setPage(emptyPage);
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load shift reports.', 'تعذر تحميل تقارير الورديات.'),
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [appliedRange.from, appliedRange.to, branchId, cursor, errorText, locale, refresh]);

  const dateTime = (value: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
      dateStyle: 'medium',
    }).format(new Date(`${value}T00:00:00`));
  const amount = (value: string) => `${value} EGP`;
  const varianceStatus = (row: PosShiftCloseReportRow) => {
    const variance = Number(row.variance);
    if (!Number.isFinite(variance) || variance === 0) {
      return { tone: 'is-active', label: text('Balanced', 'متوازن') };
    }
    const value = amount(Math.abs(variance).toFixed(2));
    return variance < 0
      ? { tone: 'pos-report-status-warning', label: text(`Short by ${value}`, `عجز ${value}`) }
      : { tone: 'pos-report-status-warning', label: text(`Over by ${value}`, `زيادة ${value}`) };
  };
  const columns: DataTableColumn<PosShiftCloseReportRow>[] = [
    {
      id: 'register',
      header: text('Register / branch', 'نقطة البيع / الفرع'),
      cell: (row) => (
        <div className="pos-report-identity">
          <span className="products-thumb-empty">
            <Icon name="receipt" />
          </span>
          <div className="pos-report-cell">
            <strong>{row.registerName}</strong>
            <small>{row.branchName}</small>
          </div>
        </div>
      ),
    },
    {
      id: 'shift',
      header: text('Closed shift', 'الوردية المغلقة'),
      cell: (row) => (
        <div className="pos-report-cell shift-report-date-cell">
          <strong>{dateTime(row.closedAt)}</strong>
          <small>
            {text('Opened', 'بدأت')}: {dateTime(row.openedAt)}
          </small>
        </div>
      ),
    },
    {
      id: 'operators',
      header: text('Cashier', 'الكاشير'),
      cell: (row) => (
        <div className="pos-report-cell">
          <strong>{row.operatorName}</strong>
          <small>
            {text('Opened by', 'بدأها')}: {row.openedByName}
          </small>
        </div>
      ),
    },
    {
      id: 'expected',
      header: text('Expected cash', 'النقد المتوقع'),
      cell: (row) => <span className="pos-report-amount">{amount(row.expectedCash)}</span>,
    },
    {
      id: 'counted',
      header: text('Counted cash', 'النقد المعدود'),
      cell: (row) => <strong className="pos-report-amount">{amount(row.countedCash)}</strong>,
    },
    {
      id: 'variance',
      header: text('Difference', 'الفرق'),
      cell: (row) => (
        <span className={`inventory-location-status pos-report-status ${varianceStatus(row).tone}`}>
          {varianceStatus(row).label}
        </span>
      ),
    },
    {
      id: 'details',
      header: text('Report', 'التقرير'),
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          className="shift-report-view-button"
          type="button"
          onClick={() => setSelectedReport(row)}
        >
          {text('View details', 'عرض التفاصيل')}
        </Button>
      ),
    },
  ];

  const emptyState = (
    <PosReportEmptyState
      title={text('No closed shifts in this period.', 'لا توجد ورديات مغلقة خلال هذه الفترة.')}
      description={text(
        'Try another date range or branch. Open shifts appear here after they are closed.',
        'جرّب فترة أو فرعًا آخر. تظهر الوردية هنا بعد إغلاقها.',
      )}
      {...(branchId || period !== 'last30' ? { onReset: resetFilters } : {})}
    />
  );

  return (
    <section
      className="inventory-page pos-report-page shift-reports-page"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <InventoryHeader
        title={text('POS shift reports', 'تقارير ورديات نقطة البيع')}
        description={text(
          'Review closed-shift cash counts, payments and approvals for a selected period.',
          'راجع جرد النقد والمدفوعات واعتمادات الورديات المغلقة خلال فترة محددة.',
        )}
        showInventoryNavigation={false}
        actions={
          <Button type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>
            <Icon name="refresh" />
            {text('Refresh', 'تحديث')}
          </Button>
        }
      />

      <PosReportFilters
        footer={
          <>
            {(customEditing || period === 'custom') && (
              <div className="pos-report-custom-range">
                <label className="pos-report-field">
                  <span>{text('From', 'من تاريخ')}</span>
                  <input
                    type="date"
                    aria-label={text('From date', 'من تاريخ')}
                    dir="ltr"
                    value={draftFromDate}
                    max={draftToDate}
                    onChange={(event) => {
                      setDraftFromDate(event.target.value);
                      setRangeError('');
                    }}
                  />
                </label>
                <label className="pos-report-field">
                  <span>{text('To', 'إلى تاريخ')}</span>
                  <input
                    type="date"
                    aria-label={text('To date', 'إلى تاريخ')}
                    dir="ltr"
                    value={draftToDate}
                    min={draftFromDate}
                    onChange={(event) => {
                      setDraftToDate(event.target.value);
                      setRangeError('');
                    }}
                  />
                </label>
                <Button type="button" onClick={applyCustomRange}>
                  {text('Apply dates', 'تطبيق التواريخ')}
                </Button>
              </div>
            )}
            {(branchId || period !== 'last30' || customEditing) && (
              <div className="pos-report-filter-actions">
                <Button type="button" variant="ghost" onClick={resetFilters}>
                  {text('Reset filters', 'إعادة ضبط الفلاتر')}
                </Button>
              </div>
            )}
          </>
        }
      >
        <div className="pos-report-field">
          <span>{text('Branch', 'الفرع')}</span>
          <PagedEntitySelect<InventoryBranch>
            path="/owner/inventory/branches"
            value={branchId}
            label={text('Filter by branch', 'تصفية حسب الفرع')}
            emptyLabel={text('All branches', 'كل الفروع')}
            required={false}
            searchMode="combobox"
            onSelect={(branch) =>
              updateFilters({
                branchId: branch?.id ?? '',
                period,
                ...(period === 'custom' ? appliedRange : {}),
              })
            }
          />
        </div>
        <label className="pos-report-field">
          <span>{text('Period', 'الفترة')}</span>
          <select
            aria-label={text('Report period', 'فترة التقرير')}
            value={customEditing || period === 'custom' ? 'custom' : period}
            onChange={(event) => selectPeriod(event.target.value as ReportPeriod)}
          >
            <option value="today">{text('Today', 'اليوم')}</option>
            <option value="yesterday">{text('Yesterday', 'أمس')}</option>
            <option value="last7">{text('Last 7 days', 'آخر ٧ أيام')}</option>
            <option value="last30">{text('Last 30 days', 'آخر ٣٠ يومًا')}</option>
            <option value="custom">{text('Custom range', 'فترة مخصصة')}</option>
          </select>
        </label>
        <div className="pos-report-field">
          <span>{text('Selected dates', 'التواريخ المحددة')}</span>
          <div className="pos-report-range" aria-live="polite">
            <Icon name="calendar" />
            <span>
              {dateLabel(appliedRange.from)} — {dateLabel(appliedRange.to)}
            </span>
          </div>
        </div>
      </PosReportFilters>

      {rangeError && (
        <div className="inventory-error" role="alert">
          <span>{rangeError}</span>
        </div>
      )}

      {error && (
        <div className="inventory-error" role="alert">
          <span>{error}</span>
          <Button
            variant="outline"
            type="button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {text('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      )}

      <DashboardCard
        className="shift-reports-table-card"
        title={text('Closed shifts', 'الورديات المغلقة')}
        description={text(
          'Scan the cash result first, then open a report for the full shift breakdown.',
          'راجع نتيجة النقد أولًا، ثم افتح التقرير لمراجعة تفاصيل الوردية.',
        )}
      >
        <div className="shift-reports-desktop-table">
          <DataTable
            columns={columns}
            rows={page.items}
            rowKey={(row) => row.id}
            caption={text('POS shift close reports', 'تقارير إغلاق ورديات نقطة البيع')}
            loading={loading}
            loadingState={text('Loading shift reports...', 'جارٍ تحميل تقارير الورديات...')}
            emptyState={emptyState}
          />
        </div>

        {loading ? (
          <div className="shift-reports-mobile-state" role="status">
            {text('Loading shift reports...', 'جارٍ تحميل تقارير الورديات...')}
          </div>
        ) : page.items.length === 0 ? (
          <div className="shift-reports-mobile-state">{emptyState}</div>
        ) : (
          <div className="shift-reports-mobile-list">
            {page.items.map((row) => {
              const status = varianceStatus(row);
              return (
                <article className="shift-report-mobile-card" key={row.id}>
                  <header>
                    <div>
                      <strong>{row.registerName}</strong>
                      <small>{row.branchName}</small>
                    </div>
                    <span className={`inventory-location-status pos-report-status ${status.tone}`}>
                      {status.label}
                    </span>
                  </header>
                  <div className="shift-report-mobile-facts">
                    <span>
                      <small>{text('Closed', 'الإغلاق')}</small>
                      <strong>{dateTime(row.closedAt)}</strong>
                    </span>
                    <span>
                      <small>{text('Cashier', 'الكاشير')}</small>
                      <strong>{row.operatorName}</strong>
                    </span>
                    <span>
                      <small>{text('Expected', 'المتوقع')}</small>
                      <strong>{amount(row.expectedCash)}</strong>
                    </span>
                    <span>
                      <small>{text('Counted', 'المعدود')}</small>
                      <strong>{amount(row.countedCash)}</strong>
                    </span>
                  </div>
                  <Button
                    className="shift-report-view-button"
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setSelectedReport(row)}
                  >
                    {text('View details', 'عرض التفاصيل')}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
        <PosReportPagination
          summary={text(
            `${formatNumber(page.items.length)} reports on this page`,
            `${formatNumber(page.items.length)} تقرير في هذه الصفحة`,
          )}
          loading={loading}
          hasPrevious={history.length > 0}
          hasNext={Boolean(page.nextCursor)}
          onPrevious={() => setPagination({ filterKey, cursors: history.slice(0, -1) })}
          onNext={() => setPagination({ filterKey, cursors: [...history, page.nextCursor ?? undefined] })}
        />
      </DashboardCard>

      {selectedReport && (
        <DashboardDialog
          title={`${text('Shift report', 'تقرير الوردية')} · ${selectedReport.registerName}`}
          closeLabel={text('Close report details', 'إغلاق تفاصيل التقرير')}
          onClose={() => setSelectedReport(null)}
        >
          <div className="shift-report-detail-content">
            <div className="shift-report-detail-intro">
              <span>
                {text('Opened', 'بدأت')}: {dateTime(selectedReport.openedAt)}
              </span>
              <span>
                {text('Closed at', 'أُغلقت في')}: {dateTime(selectedReport.closedAt)}
              </span>
              <span>
                {text('Shift ID', 'رقم الوردية')}: {selectedReport.shiftId.slice(0, 8)}
              </span>
            </div>

            <div className="shift-report-detail-meta">
              <span>
                <small>{text('Branch', 'الفرع')}</small>
                <strong>{selectedReport.branchName}</strong>
              </span>
              <span>
                <small>{text('Register', 'نقطة البيع')}</small>
                <strong>{selectedReport.registerName}</strong>
              </span>
              <span>
                <small>{text('Opened by', 'بدأها')}</small>
                <strong>{selectedReport.openedByName}</strong>
              </span>
              <span>
                <small>{text('Closed by', 'أغلقها')}</small>
                <strong>{selectedReport.operatorName}</strong>
              </span>
            </div>

            <div className="shift-report-detail-grid">
              <section>
                <h3>{text('Cash drawer', 'الصندوق النقدي')}</h3>
                <dl>
                  <div>
                    <dt>{text('Opening float', 'رصيد بداية الوردية')}</dt>
                    <dd>{amount(selectedReport.openingFloat)}</dd>
                  </div>
                  <div>
                    <dt>{text('Expected cash', 'النقد المتوقع')}</dt>
                    <dd>{amount(selectedReport.expectedCash)}</dd>
                  </div>
                  <div>
                    <dt>{text('Counted cash', 'النقد المعدود')}</dt>
                    <dd>{amount(selectedReport.countedCash)}</dd>
                  </div>
                  <div className="shift-report-detail-variance">
                    <dt>{text('Difference', 'الفرق')}</dt>
                    <dd>
                      <span
                        className={`inventory-location-status pos-report-status ${varianceStatus(selectedReport).tone}`}
                      >
                        {varianceStatus(selectedReport).label}
                      </span>
                      <small>{amount(selectedReport.variance)}</small>
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3>{text('Cash movement', 'حركة النقد')}</h3>
                <dl>
                  <div>
                    <dt>{text('Cash sales', 'مبيعات نقدية')}</dt>
                    <dd>{amount(selectedReport.cashSales)}</dd>
                  </div>
                  <div>
                    <dt>{text('Refunds', 'المرتجعات')}</dt>
                    <dd>{amount(selectedReport.cashRefunds)}</dd>
                  </div>
                  <div>
                    <dt>{text('Cash in', 'إيداع نقدي')}</dt>
                    <dd>{amount(selectedReport.cashIn)}</dd>
                  </div>
                  <div>
                    <dt>{text('Paid out', 'مصروف نقدي')}</dt>
                    <dd>{amount(selectedReport.cashOut)}</dd>
                  </div>
                  <div>
                    <dt>{text('Dropped to safe', 'توريد للخزنة')}</dt>
                    <dd>{amount(selectedReport.cashDrop)}</dd>
                  </div>
                  <div>
                    <dt>{text('Courier cash received', 'نقد مستلم من الطيار')}</dt>
                    <dd>{amount(selectedReport.deliveryCashReceived ?? '0.00')}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3>{text('External terminal', 'ماكينة الدفع')}</h3>
                <dl>
                  <div>
                    <dt>{text('Card sales', 'مبيعات البطاقة')}</dt>
                    <dd>{amount(selectedReport.terminalSales)}</dd>
                  </div>
                  <div>
                    <dt>{text('Card refunds', 'مرتجعات البطاقة')}</dt>
                    <dd>{amount(selectedReport.terminalRefunds)}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3>{text('Approval', 'الاعتماد')}</h3>
                <dl>
                  <div>
                    <dt>{text('Approved by', 'اعتمدها')}</dt>
                    <dd>{selectedReport.approvedByName ?? text('Not required', 'غير مطلوب')}</dd>
                  </div>
                  <div>
                    <dt>{text('Variance reason', 'سبب الفرق')}</dt>
                    <dd>{selectedReport.reason ?? text('No reason recorded', 'لم يُسجل سبب')}</dd>
                  </div>
                </dl>
              </section>

              {selectedReport.deliveryHandover && (
                <section className="shift-report-delivery-section">
                  <h3>{text('Delivery handover', 'تسليم عهدة التوصيل')}</h3>
                  <p>
                    {text('Received by', 'استلمها')} {selectedReport.deliveryHandover.recipientName}{' '}
                    · {text('Approved by', 'اعتمدها')}{' '}
                    {selectedReport.deliveryHandover.approvedByName}
                  </p>
                  <div className="shift-report-delivery-list">
                    {selectedReport.deliveryHandover.deliveries.map((delivery) => (
                      <div key={delivery.orderId}>
                        <strong>
                          #{delivery.orderId.slice(0, 8)} · {delivery.courierName}
                        </strong>
                        <span>
                          {text('Customer due', 'المتبقي على العميل')}:{' '}
                          {amount(delivery.customerDue)}
                        </span>
                        <span>
                          {text('With courier', 'مع الطيار')}: {amount(delivery.courierCashHeld)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </DashboardDialog>
      )}
    </section>
  );
}
