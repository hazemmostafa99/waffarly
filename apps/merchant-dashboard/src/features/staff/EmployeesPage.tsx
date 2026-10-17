import { useEffect, useState, type FormEvent } from 'react';
import type { CursorPage, InventoryBranch, PosEmployeeSummary } from '@waffarly/contracts';
import { Button, Input, useLocale } from '@waffarly/ui';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { ApiError, apiRequest, apiRequestPage } from '../../lib/api-client.js';

type BranchChoice = { id: string; name: string; archivedAt: string | null };
type Draft = {
  username: string;
  displayName: string;
  password: string;
  active: boolean;
  branches: BranchChoice[];
};

function emptyDraft(): Draft {
  return { username: '', displayName: '', password: '', active: true, branches: [] };
}

export function EmployeesPage() {
  const { locale, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [page, setPage] = useState<CursorPage<PosEmployeeSummary>>({ items: [], nextCursor: null });
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<PosEmployeeSummary | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [branchPicker, setBranchPicker] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ limit: '25', status });
    if (search.trim()) query.set('search', search.trim());
    const cursor = history.at(-1);
    if (cursor) query.set('cursor', cursor);
    void apiRequestPage<PosEmployeeSummary>(`/owner/employees?${query.toString()}`)
      .then((result) => {
        if (current) setPage(result);
      })
      .catch((cause: unknown) => {
        if (current)
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load employees.', 'تعذّر تحميل الموظفين.'),
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [errorText, history, refresh, search, status]);

  function startCreate() {
    setEditing(null);
    setEditorOpen(true);
    setDraft(emptyDraft());
    setBranchPicker('');
    setError('');
    setNotice('');
  }

  function startEdit(employee: PosEmployeeSummary) {
    setEditing(employee);
    setEditorOpen(true);
    setDraft({
      username: employee.username,
      displayName: employee.displayName,
      password: '',
      active: employee.active,
      branches: employee.branches,
    });
    setBranchPicker('');
    setError('');
    setNotice('');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setDraft(emptyDraft());
    setBranchPicker('');
  }

  function addBranch(branch: Pick<InventoryBranch, 'id' | 'name'> | null) {
    setBranchPicker('');
    if (!branch || draft.branches.some((candidate) => candidate.id === branch.id)) return;
    setDraft((current) => ({
      ...current,
      branches: [...current.branches, { ...branch, archivedAt: null }],
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (draft.active && !draft.branches.some((branch) => !branch.archivedAt)) {
      setError(text('Assign at least one active branch.', 'عيّن فرعًا نشطًا واحدًا على الأقل.'));
      return;
    }
    setBusy(true);
    try {
      const body = editing
        ? {
            revision: editing.revision,
            displayName: draft.displayName,
            active: draft.active,
            branchIds: draft.branches
              .filter((branch) => !branch.archivedAt)
              .map((branch) => branch.id),
            ...(draft.password ? { password: draft.password } : {}),
          }
        : {
            username: draft.username,
            displayName: draft.displayName,
            password: draft.password,
            branchIds: draft.branches
              .filter((branch) => !branch.archivedAt)
              .map((branch) => branch.id),
          };
      const saved = await apiRequest<PosEmployeeSummary>(
        editing ? `/owner/employees/${editing.id}` : '/owner/employees',
        { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) },
      );
      setNotice(
        editing
          ? text('Employee settings saved.', 'تم حفظ إعدادات الموظف.')
          : text('Employee account created.', 'تم إنشاء حساب الموظف.'),
      );
      setEditing(null);
      setEditorOpen(false);
      setDraft(emptyDraft());
      setBranchPicker('');
      setRefresh((value) => value + 1);
      if (!editing) setHistory([]);
      if (editing?.active && !saved.active)
        setNotice(
          text(
            'Employee deactivated. Their POS sessions have been signed out.',
            'تم إيقاف الموظف وإنهاء جلسات POS الخاصة به.',
          ),
        );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? errorText(cause.message)
          : cause instanceof Error
            ? errorText(cause.message)
            : text('Could not save this employee.', 'تعذّر حفظ بيانات الموظف.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="employee-workspace">
      <div className="employee-heading-row">
        <div>
          <span className="eyebrow">{text('POS access', 'صلاحيات POS')}</span>
          <p>
            {text(
              'Employees can accept recipe orders and start preparation at assigned branches. Owners keep order rejection and cancellation.',
              'يمكن للموظفين قبول طلبات الوصفات وبدء التحضير في الفروع المعيّنة لهم. يظل رفض الطلبات وإلغاؤها من صلاحيات المالك.',
            )}
          </p>
        </div>
        <Button type="button" onClick={startCreate}>
          {text('Add employee', 'إضافة موظف')}
        </Button>
      </div>

      {error && (
        <p className="employee-message employee-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="employee-message" role="status">
          {notice}
        </p>
      )}

      {editorOpen ? (
        <form className="employee-editor" onSubmit={(event) => void save(event)}>
          <div className="employee-editor-title">
            <h2>
              {editing
                ? text('Edit employee', 'تعديل الموظف')
                : text('New POS employee', 'موظف POS جديد')}
            </h2>
            <Button type="button" variant="ghost" onClick={closeEditor}>
              {text('Close', 'إغلاق')}
            </Button>
          </div>
          <div className="employee-form-grid">
            <label>
              {text('Employee name', 'اسم الموظف')}
              <Input
                required
                minLength={2}
                maxLength={160}
                value={draft.displayName}
                onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
              />
            </label>
            <label>
              {text('Username', 'اسم المستخدم')}
              <Input
                required
                minLength={3}
                maxLength={80}
                disabled={Boolean(editing)}
                autoComplete="username"
                value={draft.username}
                onChange={(event) =>
                  setDraft({ ...draft, username: event.target.value.toLowerCase() })
                }
              />
            </label>
            <label>
              {editing
                ? text('New password (optional)', 'كلمة مرور جديدة (اختياري)')
                : text('Password (12 characters minimum)', 'كلمة المرور (12 حرفًا على الأقل)')}
              <Input
                type="password"
                required={!editing}
                minLength={12}
                maxLength={200}
                autoComplete="new-password"
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
              />
            </label>
            {editing && (
              <label className="employee-active-toggle">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                />
                {text('Account active', 'الحساب نشط')}
              </label>
            )}
          </div>
          <fieldset className="employee-branches">
            <legend>{text('Assigned branches', 'الفروع المعيّنة')}</legend>
            <div className="employee-branch-picker">
              <PagedEntitySelect<Pick<InventoryBranch, 'id' | 'name'>>
                key={branchPicker}
                path="/owner/inventory/branches"
                value={branchPicker}
                label={text('Add an active branch', 'إضافة فرع نشط')}
                required={false}
                onSelect={addBranch}
              />
            </div>
            {draft.branches.length ? (
              <ul className="employee-branch-list">
                {draft.branches.map((branch) => (
                  <li key={branch.id}>
                    <span>
                      {branch.name}
                      {branch.archivedAt ? ` · ${text('Archived', 'مؤرشف')}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          branches: current.branches.filter((item) => item.id !== branch.id),
                        }))
                      }
                    >
                      {text('Remove', 'إزالة')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {text('Choose at least one active branch.', 'اختر فرعًا نشطًا واحدًا على الأقل.')}
              </p>
            )}
          </fieldset>
          <div className="employee-form-actions">
            <Button type="submit" disabled={busy}>
              {busy ? text('Saving…', 'جارٍ الحفظ…') : text('Save employee', 'حفظ الموظف')}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={closeEditor}>
                {text('Cancel edit', 'إلغاء التعديل')}
              </Button>
            )}
          </div>
        </form>
      ) : null}

      <div className="employee-list-toolbar">
        <h2>{text('Employees', 'الموظفون')}</h2>
        <Input
          aria-label={text('Search employees', 'ابحث عن موظفين')}
          placeholder={text('Search by name or username', 'البحث بالاسم أو اسم المستخدم')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setHistory([]);
          }}
        />
        <select
          aria-label={text('Employee status', 'حالة الموظف')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as typeof status);
            setHistory([]);
          }}
        >
          <option value="all">{text('All employees', 'كل الموظفين')}</option>
          <option value="active">{text('Active', 'نشط')}</option>
          <option value="inactive">{text('Inactive', 'غير نشط')}</option>
        </select>
      </div>
      {loading ? (
        <p>{text('Loading employees…', 'جارٍ تحميل الموظفين…')}</p>
      ) : page.items.length === 0 ? (
        <p>{text('No employees on this page.', 'لا يوجد موظفون في هذه الصفحة.')}</p>
      ) : (
        <div className="employee-list">
          {page.items.map((employee) => (
            <article className="employee-card" key={employee.id}>
              <div>
                <h3>{employee.displayName}</h3>
                <span>@{employee.username}</span>
                <p>
                  {employee.branches
                    .map(
                      (branch) =>
                        `${branch.name}${branch.archivedAt ? ` (${text('Archived', 'مؤرشف')})` : ''}`,
                    )
                    .join(' · ')}
                </p>
                <small>
                  {employee.active
                    ? text(
                        'Active · accepts and starts preparation',
                        'نشط · يقبل الطلبات ويبدأ التحضير',
                      )
                    : text('Inactive', 'غير نشط')}
                </small>
              </div>
              <Button variant="outline" type="button" onClick={() => startEdit(employee)}>
                {text('Edit', 'تعديل')}
              </Button>
            </article>
          ))}
        </div>
      )}
      <div className="employee-pagination">
        <Button
          variant="outline"
          type="button"
          disabled={!history.length || loading}
          onClick={() => setHistory((current) => current.slice(0, -1))}
        >
          {text('Previous', 'السابق')}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={!page.nextCursor || loading}
          onClick={() => {
            if (page.nextCursor) setHistory((current) => [...current, page.nextCursor!]);
          }}
        >
          {text('Next', 'التالي')}
        </Button>
      </div>
    </section>
  );
}
