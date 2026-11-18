import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { InventoryBranch, StaffMemberSummary, StaffPayBasis } from '@waffarly/contracts';
import { Button, useLocale } from '@waffarly/ui';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { apiRequest, apiRequestPage } from '../../lib/api-client.js';
import { HrPageShell } from './HrPageShell.js';
import { listBranches, localToday, moneyValue } from './hr-api.js';

type PosOption = { id: string; username: string; displayName?: string };
type Draft = {
  employeeNumber: string;
  displayName: string;
  jobTitle: string;
  phone: string;
  branchId: string;
  posEmployeeId: string;
  startDate: string;
  endDate: string;
  active: boolean;
  payBasis: StaffPayBasis;
  payAmount: string;
};

const blankDraft = (): Draft => ({
  employeeNumber: '',
  displayName: '',
  jobTitle: '',
  phone: '',
  branchId: '',
  posEmployeeId: '',
  startDate: localToday(),
  endDate: '',
  active: true,
  payBasis: 'monthly',
  payAmount: '',
});

export function StaffPage() {
  const { locale, errorText, formatNumber, formatDigits } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [staff, setStaff] = useState<StaffMemberSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined]);
  const [editing, setEditing] = useState<StaffMemberSummary | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<StaffMemberSummary | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [posOptions, setPosOptions] = useState<PosOption[]>([]);
  const [rateDraft, setRateDraft] = useState({
    effectiveDate: '',
    basis: 'monthly' as StaffPayBasis,
    amount: '',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let live = true;
    void listBranches()
      .then((result) => {
        if (live) setBranches(result);
      })
      .catch((cause: unknown) => {
        if (live)
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load branches.', 'تعذر تحميل الفروع.'),
          );
      });
    return () => {
      live = false;
    };
  }, [errorText, locale]);

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({ limit: '50', status });
    if (branchFilter) query.set('branchId', branchFilter);
    if (search.trim()) query.set('search', search.trim());
    const cursor = cursorStack.at(-1);
    if (cursor) query.set('cursor', cursor);
    setLoading(true);
    setError('');
    void apiRequestPage<StaffMemberSummary>('/owner/staff?' + query.toString())
      .then((page) => {
        if (!live) return;
        setStaff(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((cause: unknown) => {
        if (live) {
          setStaff([]);
          setNextCursor(null);
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load employees.', 'تعذر تحميل الموظفين.'),
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [branchFilter, cursorStack, errorText, locale, refresh, search, status]);

  useEffect(() => {
    let live = true;
    setPosOptions([]);
    if (!draft.branchId)
      return () => {
        live = false;
      };
    void apiRequest<PosOption[]>(
      '/owner/staff/pos-employee-options?branchId=' + encodeURIComponent(draft.branchId),
    )
      .then((options) => {
        if (!live) return;
        const linked =
          editing?.branch.id === draft.branchId && editing.posEmployee
            ? [{ id: editing.posEmployee.id, username: editing.posEmployee.username }]
            : [];
        setPosOptions([
          ...linked,
          ...options.filter((option) => !linked.some((item) => item.id === option.id)),
        ]);
      })
      .catch((cause: unknown) => {
        if (live)
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load POS accounts.', 'تعذر تحميل حسابات نقاط البيع.'),
          );
      });
    return () => {
      live = false;
    };
  }, [draft.branchId, editing, errorText, locale]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
    setDraft({ ...blankDraft(), branchId: branchFilter });
    setError('');
    setNotice('');
  }

  function openEdit(employee: StaffMemberSummary) {
    const currentRate = employee.payRates[0];
    setEditing(employee);
    setEditorOpen(true);
    setDraft({
      employeeNumber: employee.employeeNumber ?? '',
      displayName: employee.displayName,
      jobTitle: employee.jobTitle,
      phone: employee.phone ?? '',
      branchId: employee.branch.id,
      posEmployeeId: employee.posEmployee?.id ?? '',
      startDate: employee.startDate,
      endDate: employee.endDate ?? '',
      active: employee.active,
      payBasis: currentRate?.basis ?? 'monthly',
      payAmount: currentRate?.amount ?? '',
    });
    setError('');
    setNotice('');
  }

  async function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!draft.branchId) {
      setError(text('Choose a branch.', 'اختار الفرع.'));
      return;
    }
    if (!draft.active && !draft.endDate) {
      setError(
        text(
          'Enter the last working date before deactivating this employee.',
          'اكتب آخر يوم عمل قبل إيقاف الموظف.',
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const profile = {
        employeeNumber: draft.employeeNumber.trim() || null,
        displayName: draft.displayName.trim(),
        jobTitle: draft.jobTitle.trim(),
        phone: draft.phone.trim() || null,
        branchId: draft.branchId,
        posEmployeeId: draft.posEmployeeId || null,
        startDate: draft.startDate,
      };
      const body = editing
        ? {
            ...profile,
            revision: editing.revision,
            endDate: draft.active ? null : draft.endDate,
            active: draft.active,
          }
        : { ...profile, payBasis: draft.payBasis, payAmount: draft.payAmount };
      await apiRequest<StaffMemberSummary>(
        editing ? '/owner/staff/' + editing.id : '/owner/staff',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        },
      );
      setEditing(null);
      setEditorOpen(false);
      setNotice(text('Employee record saved.', 'تم حفظ بيانات الموظف.'));
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save employee.', 'تعذر حفظ الموظف.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRate || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest('/owner/staff/' + editingRate.id + '/pay-rates', {
        method: 'POST',
        body: JSON.stringify(rateDraft),
      });
      setEditingRate(null);
      setNotice(text('New pay rate saved.', 'تم حفظ المرتب الجديد.'));
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save pay rate.', 'تعذر حفظ المرتب.'),
      );
    } finally {
      setBusy(false);
    }
  }

  function openRate(employee: StaffMemberSummary) {
    const lastRate = employee.payRates[0];
    setEditingRate(employee);
    setRateDraft({
      effectiveDate: '',
      basis: lastRate?.basis ?? 'monthly',
      amount: '',
    });
    setError('');
  }

  const currentCursor = cursorStack.at(-1);

  return (
    <HrPageShell
      title="Employees"
      description="Manage employee records, branch assignments and pay rates."
      actions={<Button onClick={openCreate}>{text('Add employee', 'إضافة موظف')}</Button>}
    >
      {error && (
        <p className="hr-message hr-message--error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="hr-message hr-message--success" role="status">
          {notice}
        </p>
      )}
      <p className="hr-message hr-message--info hr-context-note">
        {text(
          'This page holds employee records and pay rates. Cashier accounts handle POS sign-in and permissions separately.',
          'هنا بيانات الموظفين والمرتبات. حسابات الكاشير منفصلة لتسجيل الدخول وصلاحيات نقطة البيع.',
        )}{' '}
        <Link to="/employees">{text('Manage cashier accounts', 'إدارة حسابات الكاشير')}</Link>
      </p>
      <section className="hr-card">
        <div className="hr-toolbar">
          <div className="hr-inline-form">
            <label className="hr-field">
              {text('Search', 'بحث')}
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCursorStack([undefined]);
                }}
                placeholder={text('Name or job title', 'الاسم أو الوظيفة')}
              />
            </label>
            <label className="hr-field">
              {text('Branch', 'الفرع')}
              <select
                value={branchFilter}
                onChange={(event) => {
                  setBranchFilter(event.target.value);
                  setCursorStack([undefined]);
                }}
              >
                <option value="">{text('All branches', 'كل الفروع')}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {formatDigits(branch.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="hr-field">
              {text('Status', 'الحالة')}
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as typeof status);
                  setCursorStack([undefined]);
                }}
              >
                <option value="active">{text('Active', 'نشط')}</option>
                <option value="inactive">{text('Inactive', 'متوقف')}</option>
                <option value="all">{text('All', 'الكل')}</option>
              </select>
            </label>
          </div>
          <span className="hr-muted">
            {loading
              ? text('Loading…', 'جارٍ التحميل…')
              : text(staff.length + ' employees shown', 'الموظفون الظاهرون: ' + staff.length)}
          </span>
        </div>
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr>
                <th>{text('Employee', 'الموظف')}</th>
                <th>{text('Branch', 'الفرع')}</th>
                <th>{text('Current pay', 'المرتب الحالي')}</th>
                <th>{text('POS account', 'حساب نقطة البيع')}</th>
                <th>{text('Status', 'الحالة')}</th>
                <th>{text('Actions', 'إجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                staff.map((employee) => {
                  const rate = employee.payRates.find((item) => item.effectiveDate <= localToday());
                  return (
                    <tr key={employee.id}>
                      <td>
                        <strong>{formatDigits(employee.displayName)}</strong>
                        <span className="hr-subtext">
                          {formatDigits(employee.jobTitle)}
                          {employee.employeeNumber
                            ? ' · ' + formatDigits(employee.employeeNumber)
                            : ''}
                        </span>
                      </td>
                      <td>{formatDigits(employee.branch.name)}</td>
                      <td>
                        {rate ? (
                          <>
                            {formatNumber(moneyValue(rate.amount), {
                              style: 'currency',
                              currency: 'EGP',
                            })}
                            <span className="hr-subtext">
                              {rate.basis === 'monthly'
                                ? text('Monthly', 'شهري')
                                : text('Per day', 'يومي')}{' '}
                              · {formatDigits(rate.effectiveDate)}
                            </span>
                            <details className="hr-rate-history">
                              <summary>
                                {text('Rate history', 'سجل المرتبات')} ({employee.payRates.length})
                              </summary>
                              {employee.payRates.map((item) => (
                                <span className="hr-subtext" key={item.id}>
                                  {formatNumber(moneyValue(item.amount), {
                                    style: 'currency',
                                    currency: 'EGP',
                                  })}{' '}
                                  ·{' '}
                                  {item.basis === 'monthly'
                                    ? text('Monthly', 'شهري')
                                    : text('Per day', 'يومي')}{' '}
                                  · {formatDigits(item.effectiveDate)}
                                </span>
                              ))}
                            </details>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {employee.posEmployee ? (
                          formatDigits(employee.posEmployee.username)
                        ) : (
                          <span className="hr-muted">{text('Not linked', 'غير مربوط')}</span>
                        )}
                      </td>
                      <td>
                        <span className={'hr-pill' + (employee.active ? '' : ' hr-pill--muted')}>
                          {employee.active ? text('Active', 'نشط') : text('Inactive', 'متوقف')}
                        </span>
                      </td>
                      <td>
                        <div className="hr-actions">
                          <button
                            type="button"
                            className="hr-inline-button"
                            onClick={() => openEdit(employee)}
                          >
                            {text('Edit', 'تعديل')}
                          </button>
                          <button
                            type="button"
                            className="hr-inline-button"
                            onClick={() => openRate(employee)}
                          >
                            {text('Change pay', 'تغيير المرتب')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {!loading && staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="hr-empty">
                    <div>
                      <strong>
                        {search || branchFilter || status !== 'active'
                          ? text('No matching employees', 'مفيش موظفين مطابقين للفلاتر')
                          : text('No active employees yet', 'لسه مفيش موظفين نشطين')}
                      </strong>
                      <p>
                        {text(
                          'Add an employee or adjust your filters to get started.',
                          'ضيف موظف أو غيّر الفلاتر عشان تظهر البيانات.',
                        )}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearch('');
                          setBranchFilter('');
                          setStatus('all');
                          setCursorStack([undefined]);
                        }}
                      >
                        {text('Show all employees', 'عرض كل الموظفين')}
                      </Button>{' '}
                      <Button onClick={openCreate}>{text('Add employee', 'إضافة موظف')}</Button>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="hr-empty">
                    {text('Loading employees…', 'جارٍ تحميل الموظفين…')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="hr-actions" style={{ justifyContent: 'end', marginTop: 12 }}>
          <Button
            variant="outline"
            size="sm"
            disabled={cursorStack.length <= 1 || loading}
            onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
          >
            {text('Previous', 'السابق')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextCursor || loading}
            onClick={() => nextCursor && setCursorStack((stack) => [...stack, nextCursor])}
          >
            {text('Next', 'التالي')}
          </Button>
          <span className="hr-muted">
            {currentCursor
              ? text('Page ' + cursorStack.length, 'صفحة ' + cursorStack.length)
              : text('Page 1', 'صفحة ١')}
          </span>
        </div>
      </section>

      {editorOpen && (
        <DashboardDialog
          title={editing ? text('Edit employee', 'تعديل موظف') : text('New employee', 'موظف جديد')}
          closeLabel={text('Close', 'إغلاق')}
          onClose={() => {
            if (!busy) {
              setEditorOpen(false);
              setEditing(null);
              setDraft(blankDraft());
            }
          }}
          busy={busy}
          className="hr-dialog"
        >
          <form className="hr-dialog-form" onSubmit={saveStaff}>
            <h3 className="hr-form-section">{text('Personal information', 'البيانات الأساسية')}</h3>
            <div className="hr-field-row">
              <label className="hr-field hr-field--wide">
                {text('Full name', 'الاسم بالكامل')}
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={draft.displayName}
                  onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
                />
              </label>
              <label className="hr-field hr-field--wide">
                {text('Job title', 'الوظيفة')}
                <input
                  required
                  maxLength={100}
                  value={draft.jobTitle}
                  onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })}
                />
              </label>
            </div>
            <div className="hr-field-row">
              <label className="hr-field">
                {text('Employee number (optional)', 'رقم الموظف (اختياري)')}
                <input
                  maxLength={40}
                  value={draft.employeeNumber}
                  onChange={(event) => setDraft({ ...draft, employeeNumber: event.target.value })}
                />
              </label>
              <label className="hr-field">
                {text('Phone (optional)', 'رقم الهاتف (اختياري)')}
                <input
                  type="tel"
                  maxLength={32}
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                />
              </label>
            </div>
            <h3 className="hr-form-section">
              {text('Branch & POS account', 'الفرع وحساب نقطة البيع')}
            </h3>
            <div className="hr-field-row">
              <label className="hr-field hr-field--wide">
                {text('Branch', 'الفرع')}
                <select
                  required
                  value={draft.branchId}
                  onChange={(event) =>
                    setDraft({ ...draft, branchId: event.target.value, posEmployeeId: '' })
                  }
                >
                  <option value="">{text('Choose a branch', 'اختار الفرع')}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {formatDigits(branch.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hr-field hr-field--wide">
                {text('Link POS account (optional)', 'ربط حساب نقطة بيع (اختياري)')}
                <select
                  value={draft.posEmployeeId}
                  onChange={(event) => setDraft({ ...draft, posEmployeeId: event.target.value })}
                >
                  <option value="">{text('No POS account', 'بدون حساب')}</option>
                  {posOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {formatDigits(option.displayName || option.username)} ·{' '}
                      {formatDigits(option.username)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <h3 className="hr-form-section">{text('Employment & pay', 'بيانات العمل والمرتب')}</h3>
            <div className="hr-field-row">
              <label className="hr-field">
                {text('Start date', 'تاريخ بداية العمل')}
                <input
                  type="date"
                  required
                  value={draft.startDate}
                  onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                />
              </label>
              {!editing && (
                <label className="hr-field">
                  {text('Pay basis', 'طريقة الحساب')}
                  <select
                    value={draft.payBasis}
                    onChange={(event) =>
                      setDraft({ ...draft, payBasis: event.target.value as StaffPayBasis })
                    }
                  >
                    <option value="monthly">{text('Monthly salary', 'مرتب شهري')}</option>
                    <option value="daily">{text('Per day', 'باليومية')}</option>
                  </select>
                </label>
              )}
              {!editing && (
                <label className="hr-field">
                  {text('Initial pay (EGP)', 'المرتب الأولي (جنيه)')}
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={draft.payAmount}
                    onChange={(event) => setDraft({ ...draft, payAmount: event.target.value })}
                  />
                </label>
              )}
            </div>
            {editing && (
              <div className="hr-field-row">
                <label className="hr-field">
                  <span>{text('Employment status', 'حالة العمل')}</span>
                  <select
                    value={draft.active ? 'active' : 'inactive'}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        active: event.target.value === 'active',
                        endDate:
                          event.target.value === 'active' ? '' : draft.endDate || localToday(),
                      })
                    }
                  >
                    <option value="active">{text('Active', 'نشط')}</option>
                    <option value="inactive">{text('Inactive', 'متوقف')}</option>
                  </select>
                </label>
                {!draft.active && (
                  <label className="hr-field">
                    {text('Last working date', 'آخر يوم عمل')}
                    <input
                      type="date"
                      required
                      value={draft.endDate}
                      onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                    />
                  </label>
                )}
              </div>
            )}
            {error && (
              <p className="hr-message hr-message--error" role="alert">
                {error}
              </p>
            )}
            <div className="hr-dialog-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditorOpen(false);
                  setEditing(null);
                  setDraft(blankDraft());
                }}
              >
                {text('Cancel', 'إلغاء')}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? text('Saving…', 'جارٍ الحفظ…') : text('Save employee', 'حفظ الموظف')}
              </Button>
            </div>
          </form>
        </DashboardDialog>
      )}

      {editingRate && (
        <DashboardDialog
          title={text('Add a pay rate', 'إضافة مرتب جديد')}
          closeLabel={text('Close', 'إغلاق')}
          onClose={() => {
            if (!busy) setEditingRate(null);
          }}
          busy={busy}
          className="hr-dialog"
        >
          <form className="hr-dialog-form" onSubmit={saveRate}>
            <p className="hr-message hr-message--info">
              {formatDigits(editingRate.displayName)} ·{' '}
              {text(
                'Rates start on an effective date and keep their history.',
                'المرتب الجديد يبدأ من تاريخ محدد مع الاحتفاظ بالسجل.',
              )}
            </p>
            <div className="hr-field-row">
              <label className="hr-field">
                {text('Effective date', 'تاريخ سريان المرتب')}
                <input
                  type="date"
                  required
                  value={rateDraft.effectiveDate}
                  onChange={(event) =>
                    setRateDraft({ ...rateDraft, effectiveDate: event.target.value })
                  }
                />
              </label>
              <label className="hr-field">
                {text('Pay basis', 'طريقة الحساب')}
                <select
                  value={rateDraft.basis}
                  onChange={(event) =>
                    setRateDraft({ ...rateDraft, basis: event.target.value as StaffPayBasis })
                  }
                >
                  <option value="monthly">{text('Monthly salary', 'مرتب شهري')}</option>
                  <option value="daily">{text('Per day', 'باليومية')}</option>
                </select>
              </label>
              <label className="hr-field">
                {text('New pay (EGP)', 'المرتب الجديد (جنيه)')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={rateDraft.amount}
                  onChange={(event) => setRateDraft({ ...rateDraft, amount: event.target.value })}
                />
              </label>
            </div>
            {error && (
              <p className="hr-message hr-message--error" role="alert">
                {error}
              </p>
            )}
            <div className="hr-dialog-actions">
              <Button type="button" variant="outline" onClick={() => setEditingRate(null)}>
                {text('Cancel', 'إلغاء')}
              </Button>
              <Button type="submit" disabled={busy}>
                {text('Save pay rate', 'حفظ المرتب')}
              </Button>
            </div>
          </form>
        </DashboardDialog>
      )}
    </HrPageShell>
  );
}
