import { useEffect, useState, type FormEvent } from 'react';
import type { CursorPage, InventoryBranch, PosRegisterSummary } from '@waffarly/contracts';
import {
  Button,
  DashboardCard,
  DataTable,
  Input,
  useLocale,
  type DataTableColumn,
} from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { PosAppearanceSettings } from './PosAppearanceSettings.js';
import { ApiError, apiRequest, apiRequestPage } from '../../lib/api-client.js';
import './registers.css';

type RegisterDraft = { name: string; active: boolean; branchId: string; branchName: string };

const emptyDraft = (): RegisterDraft => ({ name: '', active: true, branchId: '', branchName: '' });

export function RegistersPage() {
  const { locale, errorText, formatNumber } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [page, setPage] = useState<CursorPage<PosRegisterSummary>>({ items: [], nextCursor: null });
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<PosRegisterSummary | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<RegisterDraft>(emptyDraft);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ limit: '25', status });
    if (branchId) query.set('branchId', branchId);
    const cursor = history.at(-1);
    if (cursor) query.set('cursor', cursor);
    void apiRequestPage<PosRegisterSummary>(`/owner/pos/registers?${query.toString()}`)
      .then((result) => {
        if (current) setPage(result);
      })
      .catch((cause: unknown) => {
        if (current) {
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load POS registers.', 'تعذر تحميل نقاط البيع.'),
          );
        }
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
    setDraft(emptyDraft());
    setError('');
    setNotice('');
    setEditorOpen(true);
  }

  function startEdit(register: PosRegisterSummary) {
    setEditing(register);
    setDraft({
      name: register.name,
      active: register.active,
      branchId: register.branchId,
      branchName: register.branchName,
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
      const saved = await apiRequest<PosRegisterSummary>(
        editing ? `/owner/pos/registers/${editing.id}` : '/owner/pos/registers',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(
            editing
              ? { revision: editing.revision, name: draft.name.trim(), active: draft.active }
              : { branchId: draft.branchId, name: draft.name.trim() },
          ),
        },
      );
      setEditorOpen(false);
      setEditing(null);
      setDraft(emptyDraft());
      setNotice(
        editing
          ? text('Register settings saved.', 'تم حفظ إعدادات نقطة البيع.')
          : text(
              `Register created at ${saved.branchName}.`,
              `تم إنشاء نقطة البيع في ${saved.branchName}.`,
            ),
      );
      setHistory([]);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save this register.', 'تعذر حفظ نقطة البيع.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<PosRegisterSummary>[] = [
    {
      id: 'register',
      header: text('Register', 'نقطة البيع'),
      cell: (register) => (
        <div className="register-name-cell">
          <strong>{register.name}</strong>
          <small>{text('Cashier station', 'نقطة كاشير')}</small>
        </div>
      ),
    },
    { id: 'branch', header: text('Branch', 'الفرع'), cell: (register) => register.branchName },
    {
      id: 'status',
      header: text('Status', 'الحالة'),
      cell: (register) => (
        <span className={`products-pill ${register.active ? 'mint' : 'cream'}`}>
          {register.active ? text('Active', 'نشط') : text('Inactive', 'متوقف')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: text('Actions', 'الإجراءات'),
      cell: (register) => (
        <button
          className="products-button register-edit-button"
          type="button"
          onClick={() => startEdit(register)}
        >
          {text('Edit', 'تعديل')}
        </button>
      ),
    },
  ];

  return (
    <section className="register-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="sr-only">{text('POS registers', 'نقاط البيع')}</h1>

      {error && !editorOpen && (
        <div className="products-error register-message" role="alert">
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
        <p className="products-notice register-message" role="status">
          {notice}
        </p>
      )}

      <div className="register-page-toolbar">
        <div className="products-filters register-filters">
          <label className="register-branch-filter">
            <span className="sr-only">{text('Branch', 'الفرع')}</span>
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
          <label className="register-status-filter">
            <span className="sr-only">{text('Status', 'الحالة')}</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setHistory([]);
              }}
            >
              <option value="active">{text('Active', 'نشطة')}</option>
              <option value="inactive">{text('Inactive', 'متوقفة')}</option>
              <option value="all">{text('All registers', 'كل النقاط')}</option>
            </select>
          </label>
        </div>
        <div className="register-page-toolbar-actions">
          <button className="products-button primary" type="button" onClick={startCreate}>
            <Icon name="plus" />
            {text('Add register', 'إضافة نقطة بيع')}
          </button>
        </div>
      </div>
      <PosAppearanceSettings />

      <DashboardCard
        className="register-table-card"
        title={text('Register directory', 'قائمة نقاط البيع')}
        description={text(
          'Each register belongs to one branch and keeps its sales grouped by cashier shift.',
          'كل نقطة بيع مرتبطة بفرع، وتتجمع مبيعاتها حسب وردية الكاشير.',
        )}
      >
        <DataTable
          columns={columns}
          rows={page.items}
          rowKey={(register) => register.id}
          caption={text('POS register directory', 'قائمة نقاط البيع')}
          loading={loading}
          loadingState={text('Loading registers...', 'جارٍ تحميل نقاط البيع...')}
          emptyState={
            <div className="register-empty">
              <strong>{text('No registers found.', 'لا توجد نقاط بيع.')}</strong>
              <p>
                {text(
                  'Add a cashier station to a branch. Cashiers can then open a shift from the POS.',
                  'أضف نقطة بيع للفرع، وبعدها يقدر الكاشير يفتح وردية من شاشة البيع.',
                )}
              </p>
            </div>
          }
        />
        <div className="register-pagination">
          <span>
            {text(
              `${formatNumber(page.items.length)} registers on this page`,
              `${formatNumber(page.items.length)} نقطة بيع في هذه الصفحة`,
            )}
          </span>
          <div>
            <Button
              type="button"
              className="products-button register-pagination-button"
              disabled={loading || history.length === 0}
              onClick={() => setHistory((current) => current.slice(0, -1))}
            >
              {text('Previous', 'السابق')}
            </Button>
            <Button
              type="button"
              className="products-button register-pagination-button"
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
            editing
              ? text('Edit POS register', 'تعديل نقطة البيع')
              : text('Add POS register', 'إضافة نقطة بيع')
          }
          closeLabel={text('Close', 'إغلاق')}
          busy={busy}
          onClose={() => {
            if (!busy) setEditorOpen(false);
          }}
        >
          <form className="register-editor" onSubmit={(event) => void save(event)}>
            {error && (
              <p className="register-message register-error" role="alert">
                {error}
              </p>
            )}
            {!editing && (
              <label className="register-field register-branch-field">
                {text('Branch', 'الفرع')}
                <PagedEntitySelect<InventoryBranch>
                  path="/owner/inventory/branches"
                  value={draft.branchId}
                  label={text('Choose branch', 'اختر الفرع')}
                  emptyLabel={text('Choose an active branch', 'اختر فرعًا نشطًا')}
                  disabled={busy}
                  searchMode="combobox"
                  onSelect={(branch) =>
                    setDraft((value) => ({
                      ...value,
                      branchId: branch?.id ?? '',
                      branchName: branch?.name ?? '',
                    }))
                  }
                />
              </label>
            )}
            {editing && (
              <p className="register-branch-summary">
                <span>{text('Branch', 'الفرع')}</span>
                <strong>{draft.branchName}</strong>
              </p>
            )}
            <label className="register-field">
              {text('Register name', 'اسم نقطة البيع')}
              <Input
                value={draft.name}
                maxLength={80}
                required
                autoFocus
                disabled={busy}
                placeholder={text('e.g. Front counter', 'مثال: كاشير المدخل')}
                onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
              />
            </label>
            {editing && (
              <label className="register-active-toggle">
                <input
                  type="checkbox"
                  checked={draft.active}
                  disabled={busy}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, active: event.target.checked }))
                  }
                />
                <span>{text('Register is active', 'نقطة البيع نشطة')}</span>
              </label>
            )}
            <footer className="register-form-actions">
              <Button
                type="button"
                className="products-button"
                disabled={busy}
                onClick={() => setEditorOpen(false)}
              >
                {text('Cancel', 'إلغاء')}
              </Button>
              <Button
                type="submit"
                className="products-button primary"
                disabled={busy || (!editing && !draft.branchId)}
              >
                {busy
                  ? text('Saving...', 'جارٍ الحفظ...')
                  : text('Save register', 'حفظ نقطة البيع')}
              </Button>
            </footer>
          </form>
        </DashboardDialog>
      )}
    </section>
  );
}
