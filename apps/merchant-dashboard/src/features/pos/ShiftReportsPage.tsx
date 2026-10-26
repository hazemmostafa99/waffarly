import { useEffect, useState } from 'react';
import type { CursorPage, InventoryBranch, PosShiftCloseReportRow } from '@waffarly/contracts';
import { Button, DashboardCard, DataTable, useLocale, type DataTableColumn } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { apiRequestPage } from '../../lib/api-client.js';
import './shift-reports.css';

const pageSize = 25;
const emptyPage: CursorPage<PosShiftCloseReportRow> = { items: [], nextCursor: null };

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  const [page, setPage] = useState(emptyPage);
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [branchId, setBranchId] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return dateValue(date);
  });
  const [toDate, setToDate] = useState(() => dateValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);
    const calendarDays =
      (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
        Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000;
    if (!fromDate || !toDate || calendarDays < 0 || calendarDays > 92) {
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
    const cursor = history.at(-1);
    if (cursor) query.set('cursor', cursor);
    void apiRequestPage<PosShiftCloseReportRow>(`/owner/pos/shifts/reports?${query.toString()}`)
      .then((result) => {
        if (current) setPage(result);
      })
      .catch((cause: unknown) => {
        if (current)
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load shift reports.', 'تعذر تحميل تقارير الورديات.'),
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [branchId, errorText, fromDate, history, locale, refresh, toDate]);

  const dateTime = (value: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  const amount = (value: string) => `${value} EGP`;
  const columns: DataTableColumn<PosShiftCloseReportRow>[] = [
    {
      id: 'delivery',
      header: text('Delivery follow-up', 'متابعة الدليفري'),
      cell: (row) => (
        <div className="shift-report-primary-cell">
          <span>
            {text('Courier cash received', 'كاش مستلم من الطيار')}:{' '}
            {amount(row.deliveryCashReceived ?? '0.00')}
          </span>
          {row.deliveryHandover && (
            <details>
              <summary>
                {text('Handed over to', 'المتابعة اتسلمت إلى')}:{' '}
                {row.deliveryHandover.recipientName} ({row.deliveryHandover.deliveries.length})
              </summary>
              <p>
                {text('Approved by', 'اعتمدها')}: {row.deliveryHandover.approvedByName}
              </p>
              {row.deliveryHandover.deliveries.map((d) => (
                <p key={d.orderId}>
                  #{d.orderId.slice(0, 8)} · {d.courierName} ·{' '}
                  {text('Customer due', 'باقي على العميل')}: {amount(d.customerDue)} ·{' '}
                  {text('With courier', 'مع الطيار')}: {amount(d.courierCashHeld)}
                </p>
              ))}
            </details>
          )}
        </div>
      ),
    },
    {
      id: 'register',
      header: text('Register / branch', 'نقطة البيع / الفرع'),
      cell: (row) => (
        <div className="shift-report-primary-cell">
          <strong>{row.registerName}</strong>
          <small>{row.branchName}</small>
        </div>
      ),
    },
    {
      id: 'shift',
      header: text('Shift', 'الوردية'),
      cell: (row) => (
        <div className="shift-report-primary-cell">
          <strong>{dateTime(row.openedAt)}</strong>
          <small>
            {text('Closed', 'الإغلاق')}: {dateTime(row.closedAt)}
          </small>
        </div>
      ),
    },
    {
      id: 'operators',
      header: text('Operators', 'الموظفون'),
      cell: (row) => (
        <div className="shift-report-primary-cell">
          <strong>{row.openedByName}</strong>
          <small>
            {text('Closed by', 'أغلقها')}: {row.operatorName}
          </small>
        </div>
      ),
    },
    {
      id: 'drawer',
      header: text('Cash drawer', 'الصندوق النقدي'),
      cell: (row) => (
        <div className="shift-report-money-cell">
          <span>
            {text('Expected', 'المتوقع')}: {amount(row.expectedCash)}
          </span>
          <span>
            {text('Counted', 'المعدود')}: {amount(row.countedCash)}
          </span>
          <strong className={row.variance === '0.00' ? 'balanced' : 'variance'}>
            {text('Variance', 'الفرق')}: {amount(row.variance)}
          </strong>
        </div>
      ),
    },
    {
      id: 'cash',
      header: text('Cash movement', 'حركة النقد'),
      cell: (row) => (
        <div className="shift-report-money-cell">
          <span>
            {text('Sales', 'المبيعات')}: {amount(row.cashSales)}
          </span>
          <span>
            {text('Refunds', 'المرتجعات')}: {amount(row.cashRefunds)}
          </span>
          <span>
            {text('Dropped to safe', 'وُرّد للخزنة')}: {amount(row.cashDrop)}
          </span>
          <small>
            {text('In', 'داخل')}: {amount(row.cashIn)} · {text('Paid out', 'مصروف')}:{' '}
            {amount(row.cashOut)}
          </small>
        </div>
      ),
    },
    {
      id: 'terminal',
      header: text('External terminal', 'ماكينة الدفع'),
      cell: (row) => (
        <div className="shift-report-money-cell">
          <span>
            {text('Sales', 'المبيعات')}: {amount(row.terminalSales)}
          </span>
          <span>
            {text('Refunds', 'المرتجعات')}: {amount(row.terminalRefunds)}
          </span>
        </div>
      ),
    },
    {
      id: 'approval',
      header: text('Approval / reason', 'الاعتماد / السبب'),
      cell: (row) => (
        <div className="shift-report-primary-cell">
          <strong>{row.approvedByName ?? text('Not required', 'غير مطلوب')}</strong>
          <small>{row.reason ?? text('No variance reason', 'لا يوجد سبب فرق')}</small>
        </div>
      ),
    },
  ];

  return (
    <section className="shift-reports-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="products-heading shift-reports-heading">
        <div>
          <h1>{text('POS shift reports', 'تقارير ورديات نقطة البيع')}</h1>
          <p>
            {text(
              'Review closed-shift cash counts, tenders and approvals for a selected period.',
              'راجع جرد النقد والمدفوعات واعتمادات الورديات المغلقة خلال فترة محددة.',
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <Icon name="refresh" />
          {text('Refresh', 'تحديث')}
        </Button>
      </header>

      <div className="products-filters shift-reports-filters">
        <label>
          <span>{text('Branch', 'الفرع')}</span>
          <PagedEntitySelect<InventoryBranch>
            path="/owner/inventory/branches"
            value={branchId}
            label={text('Filter by branch', 'تصفية حسب الفرع')}
            emptyLabel={text('All branches', 'كل الفروع')}
            required={false}
            searchMode="combobox"
            onSelect={(branch) => {
              setBranchId(branch?.id ?? '');
              setHistory([]);
            }}
          />
        </label>
        <label>
          <span>{text('From', 'من تاريخ')}</span>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setHistory([]);
            }}
          />
        </label>
        <label>
          <span>{text('To', 'إلى تاريخ')}</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setHistory([]);
            }}
          />
        </label>
      </div>

      {error && (
        <div className="products-error shift-reports-error" role="alert">
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

      <DashboardCard
        className="shift-reports-table-card"
        title={text('Closed shifts', 'الورديات المغلقة')}
        description={text(
          'Variance is counted cash minus expected cash. Each row uses the immutable close report.',
          'الفرق هو النقد المعدود ناقص النقد المتوقع. كل صف يعرض تقرير الإغلاق المحفوظ.',
        )}
      >
        <DataTable
          columns={columns}
          rows={page.items}
          rowKey={(row) => row.id}
          caption={text('POS shift close reports', 'تقارير إغلاق ورديات نقطة البيع')}
          loading={loading}
          loadingState={text('Loading shift reports...', 'جارٍ تحميل تقارير الورديات...')}
          emptyState={
            <div className="shift-reports-empty">
              <strong>
                {text('No closed shifts in this period.', 'لا توجد ورديات مغلقة خلال هذه الفترة.')}
              </strong>
              <p>
                {text(
                  'Try another date range or branch. Open shifts appear here after they are closed.',
                  'جرّب فترة أو فرعًا آخر. تظهر الوردية هنا بعد إغلاقها.',
                )}
              </p>
            </div>
          }
        />
        <div className="register-pagination">
          <span>
            {text(
              `${formatNumber(page.items.length)} reports on this page`,
              `${formatNumber(page.items.length)} تقرير في هذه الصفحة`,
            )}
          </span>
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={loading || history.length === 0}
              onClick={() => setHistory((current) => current.slice(0, -1))}
            >
              {text('Previous', 'السابق')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || !page.nextCursor}
              onClick={() => setHistory((current) => [...current, page.nextCursor ?? undefined])}
            >
              {text('Next', 'التالي')}
            </Button>
          </div>
        </div>
      </DashboardCard>
    </section>
  );
}
