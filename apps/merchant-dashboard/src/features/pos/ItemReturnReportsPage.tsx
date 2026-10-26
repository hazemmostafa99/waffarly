import { useEffect, useState } from 'react';
import type { CursorPage, InventoryBranch, OwnerPosItemReturnReportRow } from '@waffarly/contracts';
import { Button, DashboardCard, DataTable, useLocale, type DataTableColumn } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { apiRequestPage } from '../../lib/api-client.js';
import { InventoryHeader } from '../inventory/InventoryHeader.js';
import { PosReportEmptyState, PosReportFilters, PosReportPagination } from './PosReportLayout.js';
import './item-return-reports.css';

const pageSize = 25;
const emptyPage: CursorPage<OwnerPosItemReturnReportRow> = { items: [], nextCursor: null };

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: dateValue(from), to: dateValue(to) };
}

function reportRange(fromDate: string, toDate: string): { from: string; to: string } {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function ItemReturnReportsPage() {
  const { locale, errorText, formatNumber } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [page, setPage] = useState(emptyPage);
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [branchId, setBranchId] = useState('');
  const [fromDate, setFromDate] = useState(() => defaultRange().from);
  const [toDate, setToDate] = useState(() => defaultRange().to);
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
    void apiRequestPage<OwnerPosItemReturnReportRow>(
      `/owner/pos/returns/reports?${query.toString()}`,
    )
      .then((result) => {
        if (current) setPage(result);
      })
      .catch((cause: unknown) => {
        if (current) {
          setPage(emptyPage);
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load return reports.', 'تعذر تحميل تقارير المرتجعات.'),
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [branchId, errorText, fromDate, history, locale, refresh, toDate]);

  function resetFilters() {
    const range = defaultRange();
    setBranchId('');
    setFromDate(range.from);
    setToDate(range.to);
    setHistory([]);
  }

  const hasFilters =
    Boolean(branchId) || fromDate !== defaultRange().from || toDate !== defaultRange().to;

  const dateTime = (value: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  const amount = (value: string) => `${value} EGP`;
  const fulfillment = (value: OwnerPosItemReturnReportRow['fulfillmentType']) => {
    if (value === 'dine_in') return text('Dine in', 'صالة');
    if (value === 'takeaway') return text('Takeaway', 'تيك أواي');
    if (value === 'delivery') return text('Delivery', 'توصيل');
    return text('Unknown', 'غير محدد');
  };
  const columns: DataTableColumn<OwnerPosItemReturnReportRow>[] = [
    {
      id: 'return',
      header: text('Return / sale', 'المرتجع / الطلب'),
      cell: (row) => (
        <div className="pos-report-cell">
          <strong>{row.returnNumber}</strong>
          <small>{row.orderReference}</small>
        </div>
      ),
    },
    {
      id: 'date-branch',
      header: text('Issued / branch', 'التاريخ / الفرع'),
      cell: (row) => (
        <div className="pos-report-cell">
          <strong>{dateTime(row.issuedAt)}</strong>
          <small>
            {row.branchName} · {fulfillment(row.fulfillmentType)}
          </small>
        </div>
      ),
    },
    {
      id: 'items',
      header: text('Returned items', 'الأصناف المرتجعة'),
      cell: (row) => (
        <div className="item-return-report-lines">
          {row.lines.map((line, index) => (
            <div key={`${line.productName}-${index}`}>
              <strong>
                {line.productName}
                {line.variantName ? ` · ${line.variantName}` : ''}
              </strong>
              <div className="item-return-line-meta">
                <span>
                  {text('Qty', 'الكمية')} {formatNumber(line.quantity)}
                </span>
                <span className="inventory-location-status is-archived">
                  {text('Waste', 'هالك')}
                </span>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'reason',
      header: text('Reason', 'السبب'),
      cell: (row) => <span className="item-return-report-reason">{row.reason}</span>,
    },
    {
      id: 'reference-value',
      header: text('Reference value', 'قيمة استرشادية'),
      cell: (row) => (
        <div className="pos-report-cell pos-report-amount">
          <strong>{amount(row.referenceValue)}</strong>
          <small>{text('Not a refund', 'ليست مبلغًا مستردًا')}</small>
        </div>
      ),
    },
    {
      id: 'operators',
      header: text('Recorded by / approved by', 'سجله / اعتمده'),
      cell: (row) => (
        <div className="pos-report-cell">
          <strong>{row.issuedBy}</strong>
          <small>
            {row.approvedBy ?? text('No separate approval', 'لا يحتاج اعتمادًا منفصلًا')}
          </small>
        </div>
      ),
    },
  ];

  return (
    <section
      className="inventory-page pos-report-page item-return-reports-page"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <InventoryHeader
        title={text('POS returns & waste', 'مرتجعات وهالك نقطة البيع')}
        description={text(
          'Review recorded item returns and waste by branch and date.',
          'راجع مرتجعات الأصناف والهالك المسجل حسب الفرع والتاريخ.',
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
          hasFilters ? (
            <div className="pos-report-filter-actions">
              <Button type="button" variant="ghost" onClick={resetFilters}>
                {text('Reset filters', 'إعادة ضبط الفلاتر')}
              </Button>
            </div>
          ) : undefined
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
            onSelect={(branch) => {
              setBranchId(branch?.id ?? '');
              setHistory([]);
            }}
          />
        </div>
        <label className="pos-report-field">
          <span>{text('From', 'من تاريخ')}</span>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            dir="ltr"
            onChange={(event) => {
              setFromDate(event.target.value);
              setHistory([]);
            }}
          />
        </label>
        <label className="pos-report-field">
          <span>{text('To', 'إلى تاريخ')}</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            dir="ltr"
            onChange={(event) => {
              setToDate(event.target.value);
              setHistory([]);
            }}
          />
        </label>
      </PosReportFilters>

      {error && (
        <div className="inventory-error" role="alert">
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
        className="item-return-report-card"
        title={text('Recorded returns', 'المرتجعات المسجلة')}
        description={text(
          'Returned items are recorded as waste. Reference values are not cash refunds.',
          'تُسجل الأصناف المرتجعة كهالك. القيم الاسترشادية ليست مبالغ مستردة.',
        )}
      >
        {page.items.length > 0 && (
          <p className="pos-report-table-hint">
            {text(
              'Scroll horizontally to view all return details.',
              'مرّر الجدول أفقيًا لعرض جميع تفاصيل المرتجعات.',
            )}
          </p>
        )}
        <DataTable
          columns={columns}
          rows={page.items}
          rowKey={(row) => row.id}
          caption={text('POS item returns and waste', 'مرتجعات وهالك أصناف نقطة البيع')}
          loading={loading}
          loadingState={text('Loading return reports...', 'جارٍ تحميل تقارير المرتجعات...')}
          emptyState={
            <PosReportEmptyState
              title={text(
                'No item returns in this period.',
                'لا توجد مرتجعات أصناف خلال هذه الفترة.',
              )}
              description={text(
                'Try another date range or branch. Only recorded POS returns appear here.',
                'جرّب فترة أو فرعًا آخر. تظهر هنا مرتجعات نقطة البيع المسجلة فقط.',
              )}
              {...(hasFilters ? { onReset: resetFilters } : {})}
            />
          }
        />
        <PosReportPagination
          summary={text(
            `${formatNumber(page.items.length)} returns on this page`,
            `${formatNumber(page.items.length)} مرتجع في هذه الصفحة`,
          )}
          loading={loading}
          hasPrevious={history.length > 0}
          hasNext={Boolean(page.nextCursor)}
          onPrevious={() => setHistory((current) => current.slice(0, -1))}
          onNext={() => setHistory((current) => [...current, page.nextCursor ?? undefined])}
        />
      </DashboardCard>
    </section>
  );
}
