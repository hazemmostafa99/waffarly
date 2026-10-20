import { useEffect, useState } from 'react';
import type { CursorPage, InventoryBranch, OwnerPosItemReturnReportRow } from '@waffarly/contracts';
import { Button, DashboardCard, DataTable, useLocale, type DataTableColumn } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { apiRequestPage } from '../../lib/api-client.js';
import './shift-reports.css';
import './item-return-reports.css';

const pageSize = 25;
const emptyPage: CursorPage<OwnerPosItemReturnReportRow> = { items: [], nextCursor: null };

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
        <div className="shift-report-primary-cell">
          <strong>{row.returnNumber}</strong>
          <small>{row.orderReference}</small>
        </div>
      ),
    },
    {
      id: 'date-branch',
      header: text('Issued / branch', 'التاريخ / الفرع'),
      cell: (row) => (
        <div className="shift-report-primary-cell">
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
              <span>
                {text('Qty', 'الكمية')} {formatNumber(line.quantity)} · {text('Waste', 'هالك')}
              </span>
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
        <div className="shift-report-money-cell">
          <strong>{amount(row.referenceValue)}</strong>
          <small>{text('Not a refund', 'ليست مبلغًا مستردًا')}</small>
        </div>
      ),
    },
    {
      id: 'operators',
      header: text('Recorded by / approved by', 'سجله / اعتمده'),
      cell: (row) => (
        <div className="shift-report-primary-cell">
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
      className="shift-reports-page item-return-reports-page"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <header className="products-heading shift-reports-heading">
        <div>
          <h1>{text('POS returns & waste', 'مرتجعات وهالك نقطة البيع')}</h1>
          <p>
            {text(
              'Audit recorded item returns by branch and date. Returned goods are marked as waste; the reference value is not a cash refund.',
              'راجع مرتجعات الأصناف المسجلة حسب الفرع والتاريخ. تُسجل الأصناف كهالك، والقيمة الاسترشادية ليست مبلغًا مستردًا.',
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
        className="shift-reports-table-card item-return-report-card"
        title={text('Recorded returns', 'المرتجعات المسجلة')}
        description={text(
          'These records document returned goods as waste. They do not change the original receipt, payments or inventory.',
          'توثق هذه السجلات الأصناف المرتجعة كهالك، ولا تعدل الإيصال الأصلي أو المدفوعات أو المخزون.',
        )}
      >
        <DataTable
          columns={columns}
          rows={page.items}
          rowKey={(row) => row.id}
          caption={text('POS item returns and waste', 'مرتجعات وهالك أصناف نقطة البيع')}
          loading={loading}
          loadingState={text('Loading return reports...', 'جارٍ تحميل تقارير المرتجعات...')}
          emptyState={
            <div className="shift-reports-empty">
              <strong>
                {text('No item returns in this period.', 'لا توجد مرتجعات أصناف خلال هذه الفترة.')}
              </strong>
              <p>
                {text(
                  'Try another date range or branch. Only recorded POS returns appear here.',
                  'جرّب فترة أو فرعًا آخر. تظهر هنا مرتجعات نقطة البيع المسجلة فقط.',
                )}
              </p>
            </div>
          }
        />
        <div className="register-pagination">
          <span>
            {text(
              `${formatNumber(page.items.length)} returns on this page`,
              `${formatNumber(page.items.length)} مرتجع في هذه الصفحة`,
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
