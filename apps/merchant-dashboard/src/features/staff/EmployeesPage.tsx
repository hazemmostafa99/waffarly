import { useEffect, useState, type FormEvent } from 'react';
import {
  POS_EMPLOYEE_PERMISSIONS,
  POS_EMPLOYEE_ROLES,
  defaultPosEmployeePermissions,
  hasPosEmployeePermission,
  normalizePosEmployeePermissions,
} from '@waffarly/contracts';
import type {
  CursorPage,
  InventoryBranch,
  MerchantAccountOverview,
  PosEmployeePermission,
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
  permissions: PosEmployeePermission[];
  branch: BranchChoice | null;
};

function emptyDraft(): Draft {
  return {
    username: '',
    displayName: '',
    password: '',
    active: true,
    role: 'cashier',
    permissions: defaultPosEmployeePermissions('cashier'),
    branch: null,
  };
}

/** True when the owner added or removed permissions from the role's defaults. */
function isCustomized(role: PosEmployeeRole | null, permissions: readonly string[]): boolean {
  const defaults = defaultPosEmployeePermissions(role);
  const current = normalizePosEmployeePermissions(permissions);
  return defaults.join() !== current.join();
}

/**
 * A permission that comes with another one, e.g. selling also shows orders and
 * receipts. Returns the granting permission so the form can explain the lock.
 */
function impliedBy(
  permission: PosEmployeePermission,
  selected: readonly PosEmployeePermission[],
): PosEmployeePermission | null {
  if (selected.includes(permission)) return null;
  const candidates: PosEmployeePermission[] =
    permission === 'view_orders'
      ? ['sell', 'accept_recipe_orders', 'start_preparation']
      : permission === 'view_receipts'
        ? ['sell']
        : [];
  return candidates.find((candidate) => selected.includes(candidate)) ?? null;
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  // Cashiers sign in to the POS with this code; show it where their accounts are created.
  const [businessCode, setBusinessCode] = useState('');
  useEffect(() => {
    let current = true;
    void apiRequest<MerchantAccountOverview>('/owner/account')
      .then((data) => {
        if (current) setBusinessCode(data.profile.storefrontSlug);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);
  const effectivePermissionCount = POS_EMPLOYEE_PERMISSIONS.filter((permission) =>
    hasPosEmployeePermission({ permissions: draft.permissions }, permission),
  ).length;
  const draftCustomized = isCustomized(draft.role, draft.permissions);

  function togglePermission(permission: PosEmployeePermission, granted: boolean) {
    setDraft((current) => ({
      ...current,
      permissions: normalizePosEmployeePermissions(
        granted
          ? [...current.permissions, permission]
          : current.permissions.filter((value) => value !== permission),
      ),
    }));
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
      permissions: normalizePosEmployeePermissions(employee.permissions),
      branch: employee.branch.archivedAt ? null : employee.branch,
    });
    setError('');
    setNotice('');
  }

  function closeEditor() {
    if (busy) return;
    setEditorOpen(false);
    setEditing(null);
    setDraft(emptyDraft());
    setError('');
  }

  function chooseBranch(branch: Pick<InventoryBranch, 'id' | 'name'> | null) {
    setError('');
    setDraft((current) => ({
      ...current,
      branch: branch ? { ...branch, archivedAt: null } : null,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    if (!draft.branch || draft.branch.archivedAt) {
      setError(text('Choose an active branch.', 'اختر فرعًا نشطًا.'));
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
            permissions: draft.permissions,
            branchId: draft.branch.id,
            ...(draft.password ? { password: draft.password } : {}),
          }
        : {
            username: draft.username,
            displayName: draft.displayName,
            password: draft.password,
            role: draft.role,
            permissions: draft.permissions,
            branchId: draft.branch.id,
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
        <span className="employee-role-cell">
          <span className={`products-pill ${employee.role ? 'blue' : 'cream'}`}>
            {employee.role
              ? text(...employeeRoleLabels[employee.role])
              : text('Custom permissions', 'صلاحيات مخصصة')}
          </span>
          {employee.role && isCustomized(employee.role, employee.permissions) && (
            <span className="products-pill cream">{text('Customized', 'معدّلة')}</span>
          )}
        </span>
      ),
    },
    {
      id: 'branches',
      header: text('Assigned branch', 'الفرع المعيّن'),
      cell: (employee) => (
        <div className="employee-table-branches">
          <span
            className={`products-pill ${employee.branch.archivedAt ? 'cream' : 'blue'}`}
          >
            {employee.branch.name}
            {employee.branch.archivedAt ? ` · ${text('Archived', 'مؤرشف')}` : ''}
          </span>
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
    <section className="employee-workspace" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="sr-only">{text('Employees', 'الموظفون')}</h1>
      {businessCode && (
        <p className="products-notice" role="note">
          {text('POS business code for cashier sign-in:', 'معرّف المتجر لدخول الكاشير على نقاط البيع:')}{' '}
          <bdi dir="ltr" className="font-mono font-semibold">
            {businessCode}
          </bdi>
        </p>
      )}

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

      <div className="employee-toolbar">
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
        <div className="employee-toolbar-actions">
          <button className="products-button primary" type="button" onClick={startCreate}>
            <Icon name="plus" />
            {text('Add employee', 'إضافة موظف')}
          </button>
        </div>
      </div>

      <DashboardCard
        className="employee-table-card"
        title={text('Employee list', 'قائمة الموظفين')}
        description={text(
          'POS access by role and branch.',
          'حسابات دخول نقاط البيع حسب الدور والفرع.',
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
                      'Add your first employee and assign one branch to get started.',
                      'أضف أول موظف وعيّن له فرعًا واحدًا للبدء.',
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
                    : text('Password (6 characters minimum)', 'كلمة المرور (6 حروف على الأقل)')}
                  <Input
                    type="password"
                    required={!editing}
                    minLength={6}
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
                    onChange={(event) => {
                      const role = event.target.value
                        ? (event.target.value as PosEmployeeRole)
                        : null;
                      // Picking a role fills in its defaults; "no role" keeps the current choice.
                      setDraft({
                        ...draft,
                        role,
                        permissions: role ? defaultPosEmployeePermissions(role) : draft.permissions,
                      });
                    }}
                  >
                    <option value="">
                      {text('No role — custom permissions', 'بدون دور — صلاحيات مخصصة')}
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
              <details className="employee-role-help" open aria-live="polite">
                <summary>
                  <strong>{text('Permissions', 'الصلاحيات')}</strong>
                  {draftCustomized && draft.role && (
                    <span className="employee-permission-count">
                      {text('Customized', 'معدّلة')}
                    </span>
                  )}
                  <span className="employee-permission-count">
                    {effectivePermissionCount} / {POS_EMPLOYEE_PERMISSIONS.length}
                  </span>
                  <span className="employee-role-disclosure-icon" aria-hidden="true">
                    <span />
                  </span>
                </summary>
                <div className="employee-role-help-content">
                  <div className="employee-permission-actions">
                    <span>
                      {text(
                        'Tick what this employee can do. Choosing a role fills in its defaults.',
                        'حدّد ما يستطيع الموظف فعله. اختيار الدور يملأ صلاحياته الافتراضية.',
                      )}
                    </span>
                    {draft.role && draftCustomized && (
                      <button
                        className="products-button"
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            permissions: defaultPosEmployeePermissions(draft.role),
                          })
                        }
                      >
                        {text('Reset to role defaults', 'استرجاع صلاحيات الدور')}
                      </button>
                    )}
                  </div>
                  <ul className="employee-permission-list">
                    {POS_EMPLOYEE_PERMISSIONS.map((permission) => {
                      const grantedBy = impliedBy(permission, draft.permissions);
                      const inputId = `employee-permission-${permission}`;
                      return (
                        <li key={permission}>
                          <label htmlFor={inputId}>
                            <input
                              id={inputId}
                              type="checkbox"
                              checked={draft.permissions.includes(permission) || !!grantedBy}
                              disabled={!!grantedBy}
                              onChange={(event) =>
                                togglePermission(permission, event.target.checked)
                              }
                            />
                            <span>
                              {text(...employeePermissionLabels[permission])}
                              {grantedBy && (
                                <small>
                                  {text('Included with: ', 'مشمولة مع: ')}
                                  {text(...employeePermissionLabels[grantedBy])}
                                </small>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <p>
                    {text(
                      'Access applies only to the assigned active branch below. Changes apply to the employee’s next POS action. Employee management, settings and account ownership remain owner-only.',
                      'يقتصر الوصول على الفرع النشط المعيّن أدناه، والتعديلات تسري من أول عملية تالية للموظف على نقاط البيع. تظل إدارة الموظفين والإعدادات وملكية الحساب للمالك فقط.',
                    )}
                  </p>
                </div>
              </details>
              <fieldset className="employee-branches">
                <legend>{text('Assigned branch', 'الفرع المعيّن')}</legend>
                <div className="employee-branch-picker">
                  <PagedEntitySelect<Pick<InventoryBranch, 'id' | 'name'>>
                    path="/owner/inventory/branches"
                    value={draft.branch?.id ?? ''}
                    label={text('Choose an active branch', 'اختر فرعًا نشطًا')}
                    required={false}
                    emptyLabel={text('Choose a branch', 'اختر فرعًا')}
                    searchMode="combobox"
                    onSelect={chooseBranch}
                  />
                </div>
                {draft.branch ? (
                  <p>{draft.branch.name}</p>
                ) : (
                  <p role="status">
                    {text('Choose an active branch.', 'اختر فرعًا نشطًا.')}
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
