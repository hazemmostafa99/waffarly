import { useEffect, useState, type FormEvent } from 'react';
import {
  POS_EMPLOYEE_ROLES,
  resolvePosEmployeePermissions,
  hasPosEmployeePermission,
} from '@waffarly/contracts';
import type {
  CursorPage,
  InventoryBranch,
  PosEmployeeRole,
  PosEmployeeSummary,
} from '@waffarly/contracts';
import { DashboardCard, DataTable, Input, useLocale, type DataTableColumn } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { ApiError, apiRequest, apiRequestPage } from '../../lib/api-client.js';
import { employeePermissionLabels, employeeRoleLabels } from './employee-role-copy.js';

type BranchChoice = { id: string; name: string; archivedAt: string | null };
type Draft = {
  username: string;
  displayName: string;
  password: string;
  active: boolean;
  role: PosEmployeeRole | null;
  branches: BranchChoice[];
};

function emptyDraft(): Draft {
  return {
    username: '',
    displayName: '',
    password: '',
    active: true,
    role: 'cashier',
    branches: [],
  };
}

export function EmployeesPage() {
  const { locale, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [page, setPage] = useState<CursorPage<PosEmployeeSummary>>({ items: [], nextCursor: null });
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<PosEmployeeRole | ''>('');
  const [editing, setEditing] = useState<PosEmployeeSummary | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [branchPicker, setBranchPicker] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const previewPermissions = resolvePosEmployeePermissions(
    draft.role,
    editing?.savedPermissions ??
      (editing
        ? editing.permissions.filter(
            (permission) =>
              permission === 'accept_recipe_orders' || permission === 'start_preparation',
          )
        : draft.role === 'cashier' || draft.role === 'supervisor' || draft.role === null
          ? ['accept_recipe_orders', 'start_preparation']
          : []),
  );
  const preview = { permissions: previewPermissions };
  const visiblePermissions = [...previewPermissions];
  for (const permission of ['view_orders', 'view_receipts'] as const) {
    if (hasPosEmployeePermission(preview, permission) && !visiblePermissions.includes(permission))
      visiblePermissions.push(permission);
  }

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ limit: '25', status });
    if (roleFilter) query.set('role', roleFilter);
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
  }, [errorText, history, refresh, search, status, roleFilter]);

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
      role: employee.role,
      branches: employee.branches,
    });
    setBranchPicker('');
    setError('');
    setNotice('');
  }

  function closeEditor() {
    if (busy) return;
    setEditorOpen(false);
    setEditing(null);
    setDraft(emptyDraft());
    setBranchPicker('');
    setError('');
  }

  function addBranch(branch: Pick<InventoryBranch, 'id' | 'name'> | null) {
    setBranchPicker('');
    if (!branch || draft.branches.some((candidate) => candidate.id === branch.id)) return;
    setError('');
    setDraft((current) => ({
      ...current,
      branches: [...current.branches, { ...branch, archivedAt: null }],
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
            role: draft.role,
            branchIds: draft.branches
              .filter((branch) => !branch.archivedAt)
              .map((branch) => branch.id),
            ...(draft.password ? { password: draft.password } : {}),
          }
        : {
            username: draft.username,
            displayName: draft.displayName,
            password: draft.password,
            role: draft.role,
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

  const columns: DataTableColumn<PosEmployeeSummary>[] = [
    {
      id: 'employee',
      header: text('Employee', 'الموظف'),
      cell: (employee) => (
        <div className="products-identity">
          <span className="products-thumb-empty">
            <Icon name="customers" />
          </span>
          <div>
            <strong>{employee.displayName}</strong>
            <small dir="ltr">@{employee.username}</small>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: text('Role', 'الدور'),
      cell: (employee) => (
        <span className={`products-pill ${employee.role ? 'blue' : 'cream'}`}>
          {employee.role
            ? text(...employeeRoleLabels[employee.role])
            : text('Legacy access', 'الصلاحيات الحالية')}
        </span>
      ),
    },
    {
      id: 'branches',
      header: text('Assigned branches', 'الفروع المعيّنة'),
      cell: (employee) => (
        <div className="employee-table-branches">
          {employee.branches.length ? (
            employee.branches.map((branch) => (
              <span
                key={branch.id}
                className={`products-pill ${branch.archivedAt ? 'cream' : 'blue'}`}
              >
                {branch.name}
                {branch.archivedAt ? ` · ${text('Archived', 'مؤرشف')}` : ''}
              </span>
            ))
          ) : (
            <span className="employee-muted">
              {text('No branches assigned', 'لم يتم تعيين فروع')}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: text('Status', 'الحالة'),
      cell: (employee) => (
        <span className={`products-pill ${employee.active ? 'mint' : 'cream'}`}>
          {employee.active ? text('Active', 'نشط') : text('Inactive', 'غير نشط')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: text('Actions', 'الإجراءات'),
      cell: (employee) => (
        <button
          className="products-button employee-edit-button"
          type="button"
          onClick={() => startEdit(employee)}
        >
          <Icon name="edit" />
          {text('Edit', 'تعديل')}
        </button>
      ),
    },
  ];

  return (
    <section className="employee-workspace">
      <header className="products-heading employee-heading-row">
        <div>
          <h1>{text('Employees', 'الموظفون')}</h1>
          <p>
            {text(
              'Manage employee accounts and branch access.',
              'إدارة حسابات الموظفين وصلاحيات الوصول إلى الفروع.',
            )}
          </p>
        </div>
        <div className="products-heading-actions">
          <button className="products-button primary" type="button" onClick={startCreate}>
            <Icon name="plus" />
            {text('Add employee', 'إضافة موظف')}
          </button>
        </div>
      </header>

      {error && !editorOpen && (
        <div className="products-error employee-load-error" role="alert">
          <span>{error}</span>
          <button
            className="products-button"
            type="button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {text('Retry', 'إعادة المحاولة')}
          </button>
        </div>
      )}
      {notice && (
        <p className="products-notice" role="status">
          {notice}
        </p>
      )}

      <div className="products-filters employee-list-toolbar">
        <label className="products-search">
          <Icon name="search" />
          <input
            aria-label={text('Search employees', 'ابحث عن موظفين')}
            placeholder={text('Search by name or username', 'البحث بالاسم أو اسم المستخدم')}
            value={search}
            maxLength={160}
            type="search"
            onChange={(event) => {
              setSearch(event.target.value);
              setHistory([]);
            }}
          />
        </label>
        <select
          aria-label={text('Employee role', 'دور الموظف')}
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value as PosEmployeeRole | '');
            setHistory([]);
          }}
        >
          <option value="">{text('All roles', 'كل الأدوار')}</option>
          {POS_EMPLOYEE_ROLES.map((role) => (
            <option key={role} value={role}>
              {text(...employeeRoleLabels[role])}
            </option>
          ))}
        </select>
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

      <DashboardCard
        className="employee-table-card"
        title={text('Employee list', 'قائمة الموظفين')}
        description={text(
          'Each employee can use only the actions allowed by their role in their assigned branches.',
          'يستخدم كل موظف الإجراءات المسموح بها لدوره داخل الفروع المعيّنة له فقط.',
        )}
      >
        <DataTable
          columns={columns}
          rows={page.items}
          rowKey={(employee) => employee.id}
          caption={text('Employee list', 'قائمة الموظفين')}
          loading={loading}
          loadingState={text('Loading employees…', 'جارٍ تحميل الموظفين…')}
          emptyState={
            <div className="employee-empty">
              <strong>
                {search || status !== 'all' || roleFilter
                  ? text('No matching employees', 'لا يوجد موظفون مطابقون')
                  : text('No employees yet', 'لا يوجد موظفون بعد')}
              </strong>
              <p>
                {search || status !== 'all' || roleFilter
                  ? text(
                      'Try another search or change the status filter.',
                      'جرّب بحثًا آخر أو غيّر فلتر الحالة.',
                    )
                  : text(
                      'Add your first employee and assign their branches to get started.',
                      'أضف أول موظف وعيّن الفروع المسموح له بالوصول إليها.',
                    )}
              </p>
            </div>
          }
        />
        <div className="employee-pagination">
          <span>
            {text('Employees on this page:', 'الموظفون في هذه الصفحة:')} {page.items.length}
          </span>
          <div>
            <button
              className="products-button"
              type="button"
              disabled={!history.length || loading}
              onClick={() => setHistory((current) => current.slice(0, -1))}
            >
              {text('Previous', 'السابق')}
            </button>
            <button
              className="products-button"
              type="button"
              disabled={!page.nextCursor || loading}
              onClick={() => {
                if (page.nextCursor) setHistory((current) => [...current, page.nextCursor!]);
              }}
            >
              {text('Next', 'التالي')}
            </button>
          </div>
        </div>
      </DashboardCard>

      {editorOpen && (
        <DashboardDialog
          title={
            editing
              ? text('Edit employee', 'تعديل الموظف')
              : text('New POS employee', 'موظف POS جديد')
          }
          closeLabel={text('Close', 'إغلاق')}
          onClose={closeEditor}
          busy={busy}
        >
          <form className="employee-editor" onSubmit={(event) => void save(event)}>
            {error && (
              <p className="employee-message employee-error" role="alert">
                {error}
              </p>
            )}
            <fieldset className="employee-editor-fields" disabled={busy}>
              <div className="employee-form-grid">
                <label>
                  {text('Employee name', 'اسم الموظف')}
                  <Input
                    autoFocus
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
                <label>
                  {text('Role', 'الدور')}
                  <select
                    aria-label={text('Role', 'الدور')}
                    value={draft.role ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        role: event.target.value ? (event.target.value as PosEmployeeRole) : null,
                      })
                    }
                  >
                    <option value="">
                      {text('Existing permissions only', 'الصلاحيات الحالية فقط')}
                    </option>
                    {POS_EMPLOYEE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {text(...employeeRoleLabels[role])}
                      </option>
                    ))}
                    <option disabled>
                      {text('Account owner — owner account only', 'مالك الحساب — حساب المالك فقط')}
                    </option>
                  </select>
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
              <div className="employee-role-help" aria-live="polite">
                <strong>{text('Permissions for this role', 'صلاحيات هذا الدور')}</strong>
                <ul>
                  {visiblePermissions.map((permission) => (
                    <li key={permission}>{text(...employeePermissionLabels[permission])}</li>
                  ))}
                </ul>
                <p>
                  {text(
                    'Access applies only to the assigned active branches below. Employees sign in through the employee/POS workspace.',
                    'يقتصر الوصول على الفروع النشطة المعيّنة أدناه. يسجل الموظف دخوله من مساحة الموظفين / نقاط البيع.',
                  )}
                </p>
                <p>
                  {text(
                    'Stock changes, refunds, employee management, settings and account ownership remain owner-controlled. Accountants currently have read-only receipt access; inventory officers have read-only stock balances.',
                    'تظل تعديلات المخزون والاسترجاعات وإدارة الموظفين والإعدادات وملكية الحساب تحت تحكم المالك. المتاح للمحاسب حاليًا هو عرض الإيصالات، ولمسؤول المخزون عرض الأرصدة فقط.',
                  )}
                </p>
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
                    {text(
                      'Choose at least one active branch.',
                      'اختر فرعًا نشطًا واحدًا على الأقل.',
                    )}
                  </p>
                )}
              </fieldset>
            </fieldset>
            <footer className="employee-form-actions">
              <button
                className="products-button"
                type="button"
                disabled={busy}
                onClick={closeEditor}
              >
                {text('Cancel', 'إلغاء')}
              </button>
              <button className="products-button primary" type="submit" disabled={busy}>
                {busy ? text('Saving…', 'جارٍ الحفظ…') : text('Save employee', 'حفظ الموظف')}
              </button>
            </footer>
          </form>
        </DashboardDialog>
      )}
    </section>
  );
}
