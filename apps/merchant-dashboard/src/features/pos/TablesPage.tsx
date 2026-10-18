import { useEffect, useState, type FormEvent } from 'react';
import type { CursorPage, InventoryBranch, PosDiningTableSummary } from '@waffarly/contracts';
import {
  Button,
  DashboardCard,
  DataTable,
  Input,
  useLocale,
  type DataTableColumn,
} from '@waffarly/ui';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { ApiError, apiRequest, apiRequestPage } from '../../lib/api-client.js';
import './tables.css';

type TableDraft = {
  branchId: string;
  branchName: string;
  code: string;
  capacity: number;
  active: boolean;
};
const emptyDraft = (): TableDraft => ({
  branchId: '',
  branchName: '',
  code: '',
  capacity: 2,
  active: true,
});

export function TablesPage() {
  const { locale, errorText, formatDigits } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [page, setPage] = useState<CursorPage<PosDiningTableSummary>>({
    items: [],
    nextCursor: null,
  });
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<PosDiningTableSummary | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<TableDraft>(emptyDraft);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ limit: '50', status });
    if (branchId) query.set('branchId', branchId);
    const cursor = history.at(-1);
    if (cursor) query.set('cursor', cursor);
    void apiRequestPage<PosDiningTableSummary>(`/owner/pos/tables?${query.toString()}`)
      .then((result) => {
        if (current) setPage(result);
      })
      .catch((cause: unknown) => {
        if (current)
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load tables.', 'تعذر تحميل الترابيزات.'),
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [branchId, errorText, history, refresh, status]);

  function startCreate() {
    setEditing(null);
    setDraft({ ...emptyDraft(), branchId });
    setError('');
    setNotice('');
    setEditorOpen(true);
  }

  function startEdit(table: PosDiningTableSummary) {
    setEditing(table);
    setDraft({
      branchId: table.branchId,
      branchName: table.branchName,
      code: table.code,
      capacity: table.capacity,
      active: table.active,
    });
    setError('');
    setNotice('');
    setEditorOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await apiRequest<PosDiningTableSummary>(
        editing ? `/owner/pos/tables/${editing.id}` : '/owner/pos/tables',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(
            editing
              ? {
                  revision: editing.revision,
                  code: draft.code.trim(),
                  capacity: draft.capacity,
                  active: draft.active,
                }
              : { branchId: draft.branchId, code: draft.code.trim(), capacity: draft.capacity },
          ),
        },
      );
      setEditorOpen(false);
      setEditing(null);
      setDraft(emptyDraft());
      setNotice(
        editing
          ? text('Table settings saved.', 'تم حفظ إعدادات الترابيزة.')
          : text(
              `Table ${saved.code} added at ${saved.branchName}.`,
              `تمت إضافة الترابيزة ${saved.code} إلى ${saved.branchName}.`,
            ),
      );
      setHistory([]);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save this table.', 'تعذر حفظ الترابيزة.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<PosDiningTableSummary>[] = [
    {
      id: 'code',
      header: text('Table', 'الترابيزة'),
      cell: (table) => <strong>{formatDigits(table.code)}</strong>,
    },
    {
      id: 'branch',
      header: text('Branch', 'الفرع'),
      cell: (table) => formatDigits(table.branchName),
    },
    {
      id: 'capacity',
      header: text('Seats', 'المقاعد'),
      cell: (table) => formatDigits(String(table.capacity)),
    },
    {
      id: 'status',
      header: text('Status', 'الحالة'),
      cell: (table) => (table.active ? text('Active', 'نشطة') : text('Inactive', 'متوقفة')),
    },
    {
      id: 'actions',
      header: text('Actions', 'الإجراءات'),
      cell: (table) => (
        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(table)}>
          {text('Edit', 'تعديل')}
        </Button>
      ),
    },
  ];

  return (
    <section className="pos-tables-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="products-heading pos-tables-heading">
        <div>
          <h1>{text('POS tables', 'ترابيزات نقطة البيع')}</h1>
          <p>
            {text(
              'Configure table codes and seat counts per branch. Occupied tables are protected from edits.',
              'اضبط أرقام الترابيزات وعدد المقاعد لكل فرع. لا يمكن تعديل الترابيزة المشغولة.',
            )}
          </p>
        </div>
        <Button type="button" onClick={startCreate}>
          {text('Add table', 'إضافة ترابيزة')}
        </Button>
      </header>

      {error && !editorOpen && (
        <div className="products-error pos-tables-message" role="alert">
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
      {notice && (
        <p className="products-notice pos-tables-message" role="status">
          {notice}
        </p>
      )}

      <DashboardCard
        className="pos-tables-card"
        title={text('Dining table directory', 'قائمة ترابيزات الصالة')}
        description={text(
          'Every table belongs to one branch. An occupied table can receive another round, but it cannot be renamed or deactivated.',
          'كل ترابيزة تابعة لفرع واحد. يمكن إضافة جولة جديدة للترابيزة المشغولة، لكن لا يمكن تغييرها أو إيقافها.',
        )}
        action={
          <div className="pos-tables-filters">
            <label>
              <span>{text('Branch', 'الفرع')}</span>
              <PagedEntitySelect<InventoryBranch>
                path="/owner/inventory/branches"
                value={branchId}
                label={text('Filter by branch', 'تصفية حسب الفرع')}
                emptyLabel={text('All branches', 'كل الفروع')}
                onSelect={(branch) => {
                  setBranchId(branch?.id ?? '');
                  setHistory([]);
                }}
              />
            </label>
            <label>
              <span>{text('Status', 'الحالة')}</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as typeof status);
                  setHistory([]);
                }}
              >
                <option value="active">{text('Active', 'نشطة')}</option>
                <option value="inactive">{text('Inactive', 'متوقفة')}</option>
                <option value="all">{text('All', 'الكل')}</option>
              </select>
            </label>
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={page.items}
          rowKey={(table) => table.id}
          caption={text('POS dining tables', 'ترابيزات الصالة في نقطة البيع')}
          loading={loading}
          loadingState={text('Loading tables...', 'جارٍ تحميل الترابيزات...')}
          emptyState={
            <div className="pos-tables-empty">
              <strong>{text('No tables found.', 'لا توجد ترابيزات.')}</strong>
              <p>
                {text(
                  'Add tables here before opening dine-in orders from the POS.',
                  'أضف الترابيزات هنا قبل استقبال طلبات الصالة من نقطة البيع.',
                )}
              </p>
            </div>
          }
        />
        <div className="pos-tables-pagination">
          <span>
            {text(
              `${page.items.length} tables on this page`,
              `${page.items.length} ترابيزة في الصفحة`,
            )}
          </span>
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || history.length === 0}
              onClick={() => setHistory((current) => current.slice(0, -1))}
            >
              {text('Previous', 'السابق')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || !page.nextCursor}
              onClick={() => setHistory((current) => [...current, page.nextCursor ?? undefined])}
            >
              {text('Next', 'التالي')}
            </Button>
          </div>
        </div>
      </DashboardCard>

      {editorOpen && (
        <DashboardDialog
          title={
            editing ? text('Edit table', 'تعديل الترابيزة') : text('Add table', 'إضافة ترابيزة')
          }
          closeLabel={text('Close', 'إغلاق')}
          busy={busy}
          onClose={() => {
            if (!busy) setEditorOpen(false);
          }}
        >
          <form className="pos-table-editor" onSubmit={(event) => void save(event)}>
            {error && (
              <p className="products-error" role="alert">
                {error}
              </p>
            )}
            {!editing ? (
              <label className="pos-table-field">
                {text('Branch', 'الفرع')}
                <PagedEntitySelect<InventoryBranch>
                  path="/owner/inventory/branches"
                  value={draft.branchId}
                  label={text('Choose branch', 'اختر الفرع')}
                  emptyLabel={text('Choose an active branch', 'اختر فرعاً نشطاً')}
                  disabled={busy}
                  onSelect={(branch) =>
                    setDraft((value) => ({
                      ...value,
                      branchId: branch?.id ?? '',
                      branchName: branch?.name ?? '',
                    }))
                  }
                />
              </label>
            ) : (
              <p className="pos-table-branch">
                <span>{text('Branch', 'الفرع')}</span>
                <strong>{draft.branchName}</strong>
              </p>
            )}
            <label className="pos-table-field">
              {text('Table code', 'رقم الترابيزة')}
              <Input
                autoFocus
                required
                maxLength={32}
                value={draft.code}
                placeholder="#01"
                disabled={busy}
                onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))}
              />
            </label>
            <label className="pos-table-field">
              {text('Seat count', 'عدد المقاعد')}
              <Input
                type="number"
                min="1"
                max="100"
                required
                value={draft.capacity}
                disabled={busy}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    capacity: Math.max(1, Math.min(100, Number(event.target.value) || 1)),
                  }))
                }
              />
            </label>
            {editing && (
              <label className="pos-table-active">
                <input
                  type="checkbox"
                  checked={draft.active}
                  disabled={busy}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, active: event.target.checked }))
                  }
                />
                <span>{text('Table is active', 'الترابيزة نشطة')}</span>
              </label>
            )}
            <footer className="pos-table-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditorOpen(false)}
              >
                {text('Cancel', 'إلغاء')}
              </Button>
              <Button type="submit" disabled={busy || (!editing && !draft.branchId)}>
                {busy ? text('Saving...', 'جارٍ الحفظ...') : text('Save table', 'حفظ الترابيزة')}
              </Button>
            </footer>
          </form>
        </DashboardDialog>
      )}
    </section>
  );
}
