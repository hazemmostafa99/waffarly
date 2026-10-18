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
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { ApiError, apiRequest, apiRequestPage } from '../../lib/api-client.js';
import './registers.css';

type RegisterDraft = { name: string; active: boolean; branchId: string; branchName: string };

const emptyDraft = (): RegisterDraft => ({ name: '', active: true, branchId: '', branchName: '' });

export function RegistersPage() {
  const { locale, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [page, setPage] = useState<CursorPage<PosRegisterSummary>>({ items: [], nextCursor: null });
  const [history, setHistory] = useState<Array<string | undefined>>([]);
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
              : text('Could not load POS registers.', 'تعذر تحميل أجهزة نقطة البيع.'),
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [errorText, history, refresh, status]);

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
          ? text('Register settings saved.', 'تم حفظ إعدادات الجهاز.')
          : text(
              `Register created at ${saved.branchName}.`,
              `تم إنشاء الجهاز في ${saved.branchName}.`,
            ),
      );
      setHistory([]);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save this register.', 'تعذر حفظ جهاز نقطة البيع.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<PosRegisterSummary>[] = [
    {
      id: 'register',
      header: text('Register', 'الجهاز'),
      cell: (register) => (
        <div className="register-name-cell">
          <strong>{register.name}</strong>
          <small>{text('POS register', 'جهاز نقطة البيع')}</small>
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
        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(register)}>
          {text('Edit', 'تعديل')}
        </Button>
      ),
    },
  ];

  return (
    <section className="register-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="products-heading register-heading">
        <div>
          <h1>{text('POS registers', 'أجهزة نقطة البيع')}</h1>
          <p>
            {text(
              'Set up one register per cashier station. Each register can have one open shift at a time.',
              'أنشئ جهازًا لكل نقطة بيع. يمكن فتح وردية واحدة فقط على الجهاز في الوقت نفسه.',
            )}
          </p>
        </div>
        <Button type="button" onClick={startCreate}>
          {text('Add register', 'إضافة جهاز')}
        </Button>
      </header>

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

      <DashboardCard
        className="register-table-card"
        title={text('Register directory', 'قائمة الأجهزة')}
        description={text(
          'Registers are scoped to a branch and managed by the merchant owner.',
          'كل جهاز مرتبط بفرع ويديره مالك النشاط.',
        )}
        action={
          <label className="register-status-filter">
            <span>{text('Status', 'الحالة')}</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setHistory([]);
              }}
            >
              <option value="active">{text('Active', 'نشط')}</option>
              <option value="inactive">{text('Inactive', 'متوقف')}</option>
              <option value="all">{text('All registers', 'كل الأجهزة')}</option>
            </select>
          </label>
        }
      >
        <DataTable
          columns={columns}
          rows={page.items}
          rowKey={(register) => register.id}
          caption={text('POS register directory', 'قائمة أجهزة نقطة البيع')}
          loading={loading}
          loadingState={text('Loading registers...', 'جارٍ تحميل الأجهزة...')}
          emptyState={
            <div className="register-empty">
              <strong>{text('No registers on this page.', 'لا توجد أجهزة في هذه الصفحة.')}</strong>
              <p>
                {text(
                  'Create a register for a branch, then cashiers can open shifts from the POS.',
                  'أنشئ جهازًا للفرع ليتمكن الكاشير من فتح وردية من نقطة البيع.',
                )}
              </p>
            </div>
          }
        />
        <div className="register-pagination">
          <span>
            {text(
              `${page.items.length} registers on this page`,
              `${page.items.length} جهاز في هذه الصفحة`,
            )}
          </span>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || history.length === 0}
              onClick={() => setHistory((current) => current.slice(0, -1))}
            >
              {text('Previous', 'السابق')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
              ? text('Edit POS register', 'تعديل جهاز نقطة البيع')
              : text('Add POS register', 'إضافة جهاز نقطة البيع')
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
              <label className="register-field">
                {text('Branch', 'الفرع')}
                <PagedEntitySelect<InventoryBranch>
                  path="/owner/inventory/branches"
                  value={draft.branchId}
                  label={text('Choose branch', 'اختر الفرع')}
                  emptyLabel={text('Choose an active branch', 'اختر فرعًا نشطًا')}
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
            )}
            {editing && (
              <p className="register-branch-summary">
                <span>{text('Branch', 'الفرع')}</span>
                <strong>{draft.branchName}</strong>
              </p>
            )}
            <label className="register-field">
              {text('Register name', 'اسم الجهاز')}
              <Input
                value={draft.name}
                maxLength={80}
                required
                autoFocus
                disabled={busy}
                placeholder={text('e.g. Front counter', 'مثال: الكاشير الأمامي')}
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
                <span>{text('Register is active', 'الجهاز نشط')}</span>
              </label>
            )}
            <footer className="register-form-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditorOpen(false)}
              >
                {text('Cancel', 'إلغاء')}
              </Button>
              <Button type="submit" disabled={busy || (!editing && !draft.branchId)}>
                {busy ? text('Saving...', 'جارٍ الحفظ...') : text('Save register', 'حفظ الجهاز')}
              </Button>
            </footer>
          </form>
        </DashboardDialog>
      )}
    </section>
  );
}
