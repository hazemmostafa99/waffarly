import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type {
  CashSafeSummary,
  OwnerProfile,
  StaffAdvanceSummary,
  StaffMemberSummary,
} from '@waffarly/contracts';
import { Button, useLocale } from '@waffarly/ui';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { ApiError, apiRequest, apiRequestSingle } from '../../lib/api-client.js';
import { HrPageShell } from './HrPageShell.js';
import {
  currentMonth,
  listSafes,
  monthDays,
  moneyValue,
  moneyCents,
  readSavedCommand,
  sendSavedCommand,
  validPositiveMoney,
  type SavedCommand,
} from './hr-api.js';

type AdvanceDraft = {
  staffMemberId: string;
  safeId: string;
  amount: string;
  installmentAmount: string;
  firstInstallmentMonth: string;
  reason: string;
};
const emptyAdvance = (): AdvanceDraft => ({
  staffMemberId: '',
  safeId: '',
  amount: '',
  installmentAmount: '',
  firstInstallmentMonth: currentMonth(),
  reason: '',
});

export function StaffAdvancesPage() {
  const { locale, errorText, formatNumber, formatDigits } = useLocale();
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  // Keep the original key: a pending advance or salary payment survives navigation.
  const storageKey = 'waffarly:hr:payroll:' + profile.merchantId + ':' + profile.username;
  const [staff, setStaff] = useState<StaffMemberSummary[]>([]);
  const [advances, setAdvances] = useState<StaffAdvanceSummary[]>([]);
  const [safes, setSafes] = useState<CashSafeSummary[]>([]);
  const [advance, setAdvance] = useState<AdvanceDraft>(emptyAdvance);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [editing, setEditing] = useState<StaffAdvanceSummary | null>(null);
  const [cancelling, setCancelling] = useState<StaffAdvanceSummary | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<SavedCommand | null>(() =>
    readSavedCommand(storageKey),
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const money = (amount: string) =>
    formatNumber(moneyValue(amount), { style: 'currency', currency: 'EGP' });
  const activeStaff = useMemo(() => staff.filter((employee) => employee.active), [staff]);
  const month = currentMonth();

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError('');
    setStaff([]);
    setAdvances([]);
    void Promise.all([
      apiRequest<StaffMemberSummary[]>('/owner/staff?limit=100&status=all'),
      apiRequest<StaffAdvanceSummary[]>('/owner/payroll/advances?status=all'),
    ])
      .then(([staffRows, advanceRows]) => {
        if (!live) return;
        setStaff(staffRows);
        setAdvances(advanceRows);
      })
      .catch(() => {
        if (live)
          setLoadError(
            locale === 'ar'
              ? 'تعذر تحميل سلف الموظفين. أعد المحاولة.'
              : 'Could not load staff advances. Please retry.',
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [locale, refresh]);

  useEffect(() => {
    let live = true;
    setSafes([]);
    if (editing || !advance.staffMemberId)
      return () => {
        live = false;
      };
    const employee = staff.find((item) => item.id === advance.staffMemberId);
    if (!employee)
      return () => {
        live = false;
      };
    void listSafes(employee.branch.id)
      .then((result) => {
        if (live) {
          setSafes(result);
          setAdvance((current) => ({ ...current, safeId: result[0]?.id ?? '' }));
        }
      })
      .catch((cause: unknown) => {
        if (live)
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load safes.', 'تعذر تحميل الخزن.'),
          );
      });
    return () => {
      live = false;
    };
  }, [advance.staffMemberId, editing, errorText, locale, staff]);

  async function saveAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      !advance.staffMemberId ||
      (!editing && !advance.safeId) ||
      !validPositiveMoney(advance.amount) ||
      !validPositiveMoney(advance.installmentAmount)
    )
      return;
    if (moneyCents(advance.installmentAmount) > moneyCents(advance.amount)) {
      setError(
        text(
          'Installment cannot exceed the advance amount.',
          'القسط ما ينفعش يزيد عن قيمة السلفة.',
        ),
      );
      return;
    }
    if (editing) {
      if (!correctionReason.trim() || !advance.reason.trim()) return;
      await runCashCommand(
        {
          path: `/owner/payroll/advances/${editing.id}/update`,
          body: {
            requestId: crypto.randomUUID(),
            revision: String(editing.revision),
            amount: advance.amount,
            installmentAmount: advance.installmentAmount,
            firstInstallmentMonth: advance.firstInstallmentMonth,
            reason: advance.reason.trim(),
            correctionReason: correctionReason.trim(),
          },
        },
        text('Advance updated and safe balance corrected.', 'تم تعديل السلفة وتسوية فرق الخزنة.'),
      );
      return;
    }
    const employee = staff.find((item) => item.id === advance.staffMemberId);
    if (!employee) return;
    const command: SavedCommand = {
      path: '/owner/payroll/advances',
      body: {
        ...advance,
        requestId: crypto.randomUUID(),
        reason: advance.reason.trim(),
      },
    };
    await runCashCommand(command, text('Staff advance recorded.', 'تم تسجيل السلفة.'));
  }

  async function runCashCommand(command: SavedCommand, successMessage: string) {
    if (busy || pendingCommand) return;
    setBusy(true);
    setError('');
    setNotice('');
    setPendingCommand(command);
    try {
      await sendSavedCommand<unknown>(storageKey, command);
      setPendingCommand(null);
      setAdvance(emptyAdvance());
      setAdvanceOpen(false);
      setEditing(null);
      setCancelling(null);
      setCorrectionReason('');
      setNotice(successMessage);
      setRefresh((value) => value + 1);
    } catch (cause) {
      const saved = readSavedCommand(storageKey);
      setPendingCommand(saved);
      if (saved) {
        setAdvanceOpen(false);
        setCancelling(null);
      }
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text(
              'Cash action failed. Retry the saved action before starting another.',
              'تعذر تسجيل الحركة النقدية. أعد المحاولة قبل تسجيل حركة جديدة.',
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function retryPendingCommand() {
    if (!pendingCommand || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequestSingle<unknown>(pendingCommand.path, {
        method: 'POST',
        body: JSON.stringify(pendingCommand.body),
      });
      localStorage.removeItem(storageKey);
      setPendingCommand(null);
      setNotice(text('The saved cash action was confirmed.', 'تم تأكيد الحركة النقدية المحفوظة.'));
      setRefresh((value) => value + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode >= 400 && cause.statusCode < 500) {
        localStorage.removeItem(storageKey);
        setPendingCommand(null);
      }
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not retry the saved action.', 'تعذرت إعادة المحاولة.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <HrPageShell
      title="Staff advances"
      actions={
        <Link to="/staff/payroll" className="hr-inline-button">
          {text('Open payroll', 'فتح المرتبات')}
        </Link>
      }
    >
      {loadError && (
        <div className="hr-message hr-message--error" role="alert">
          {loadError}{' '}
          <Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>
            {text('Retry loading', 'إعادة التحميل')}
          </Button>
        </div>
      )}
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
      {pendingCommand && (
        <div className="hr-message hr-message--info">
          <div className="hr-toolbar">
            <span>
              {text(
                'A cash action is waiting for a safe retry. Do not start another cash action yet.',
                'في حركة نقدية محتاجة إعادة محاولة آمنة. متبدأش حركة تانية دلوقتي.',
              )}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void retryPendingCommand()}
            >
              {text('Retry saved action', 'إعادة المحاولة')}
            </Button>
          </div>
        </div>
      )}
      {loading && (
        <p className="hr-empty" role="status">
          {text('Loading staff advances…', 'جارٍ تحميل سلف الموظفين…')}
        </p>
      )}
      {!loading && !loadError && (
        <section className="hr-card">
          <div className="hr-card-heading">
            <div>
              <h2>{text('Staff advances', 'سلف الموظفين')}</h2>
              <p>
                {text(
                  'Each advance is withdrawn from the employee branch safe and repaid through monthly payroll.',
                  'كل سلفة بتتصرف من خزنة فرع الموظف وبتتخصم على أقساط شهرية.',
                )}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy || !activeStaff.length || !!pendingCommand}
              onClick={() => {
                setEditing(null);
                setCorrectionReason('');
                setError('');
                setAdvance(emptyAdvance());
                setSafes([]);
                setAdvanceOpen(true);
              }}
            >
              {text('New advance', 'سلفة جديدة')}
            </Button>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showAll}
            className="hr-history-toggle"
            onClick={() => setShowAll((current) => !current)}
          >
            <span className="hr-history-toggle-track" aria-hidden="true">
              <span />
            </span>
            <span>{text('Show settled and cancelled advances', 'عرض السلف المسددة والملغاة')}</span>
          </button>
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>{text('Employee', 'الموظف')}</th>
                  <th>{text('Branch', 'الفرع')}</th>
                  <th>{text('Original amount', 'قيمة السلفة')}</th>
                  <th>{text('Installment', 'القسط')}</th>
                  <th>{text('Remaining', 'المتبقي')}</th>
                  <th>{text('First month', 'أول شهر خصم')}</th>
                  <th>{text('Reason', 'السبب')}</th>
                  <th>{text('Actions / status', 'الإجراءات / الحالة')}</th>
                </tr>
              </thead>
              <tbody>
                {advances
                  .filter(
                    (item) =>
                      showAll || (!item.cancelledAt && moneyValue(item.remainingBalance) > 0),
                  )
                  .map((item) => (
                    <tr key={item.id}>
                      <td>{formatDigits(item.employeeName)}</td>
                      <td>{formatDigits(item.branchName)}</td>
                      <td>{money(item.amount)}</td>
                      <td>{money(item.installmentAmount)}</td>
                      <td>{money(item.remainingBalance)}</td>
                      <td>{formatDigits(item.firstInstallmentMonth)}</td>
                      <td>{formatDigits(item.reason)}</td>
                      <td>
                        {item.cancelledAt ? (
                          text('Cancelled', 'ملغاة')
                        ) : (
                          <div className="hr-page-actions">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || !!pendingCommand}
                              onClick={() => {
                                setEditing(item);
                                setCorrectionReason('');
                                setError('');
                                setAdvance({
                                  staffMemberId: item.staffMemberId,
                                  safeId: '',
                                  amount: item.amount,
                                  installmentAmount: item.installmentAmount,
                                  firstInstallmentMonth: item.firstInstallmentMonth,
                                  reason: item.reason,
                                });
                                setAdvanceOpen(true);
                              }}
                            >
                              {text('Edit', 'تعديل')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                busy || !!pendingCommand || moneyValue(item.repaidAmount) > 0
                              }
                              onClick={() => {
                                setCancelling(item);
                                setCorrectionReason('');
                                setError('');
                              }}
                            >
                              {text('Delete', 'حذف')}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                {!advances.some(
                  (item) => showAll || (!item.cancelledAt && moneyValue(item.remainingBalance) > 0),
                ) && (
                  <tr>
                    <td colSpan={8} className="hr-empty">
                      {text('No outstanding advances.', 'مفيش سلف متبقية.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {cancelling && (
        <DashboardDialog
          title={text('Cancel advance', 'حذف السلفة')}
          closeLabel={text('Close', 'إغلاق')}
          busy={busy}
          onClose={() => {
            if (!busy) setCancelling(null);
          }}
          className="hr-dialog"
        >
          <form
            className="hr-dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!correctionReason.trim()) return;
              void runCashCommand(
                {
                  path: `/owner/payroll/advances/${cancelling.id}/cancel`,
                  body: {
                    requestId: crypto.randomUUID(),
                    revision: String(cancelling.revision),
                    correctionReason: correctionReason.trim(),
                  },
                },
                text(
                  'Advance cancelled and cash returned to safe.',
                  'تم إلغاء السلفة ورد المبلغ للخزنة.',
                ),
              );
            }}
          >
            <p>
              {text(
                'Confirm only after the full amount has actually been returned to the original safe. The advance and cash history will be retained.',
                'أكد بعد رجوع مبلغ السلفة بالكامل فعليًا لنفس الخزنة. سجل السلفة وحركاتها هيفضل محفوظ.',
              )}
            </p>
            <strong>
              {formatDigits(cancelling.employeeName)} · {money(cancelling.amount)}
            </strong>
            <label className="hr-field">
              {text('Cancellation reason', 'سبب الحذف')}
              <textarea
                required
                maxLength={500}
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
              />
            </label>
            {error && (
              <p className="hr-message hr-message--error" role="alert">
                {error}
              </p>
            )}
            <div className="hr-dialog-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelling(null)}
                disabled={busy}
              >
                {text('Back', 'رجوع')}
              </Button>
              <Button type="submit" disabled={busy || !!pendingCommand}>
                {text('Confirm cancellation and cash return', 'تأكيد الإلغاء ورد الفلوس')}
              </Button>
            </div>
          </form>
        </DashboardDialog>
      )}
      {advanceOpen && (
        <DashboardDialog
          title={
            editing
              ? text('Edit advance', 'تعديل السلفة')
              : text('Record staff advance', 'تسجيل سلفة')
          }
          closeLabel={text('Close', 'إغلاق')}
          onClose={() => {
            if (!busy) {
              setAdvance(emptyAdvance());
              setAdvanceOpen(false);
            }
          }}
          busy={busy}
          className="hr-dialog"
        >
          <form className="hr-dialog-form" onSubmit={saveAdvance}>
            {editing && (
              <>
                <p className="hr-message hr-message--info">
                  {text(
                    'Confirm only after the cash difference has actually been paid or returned to the original safe. Approved repayments lock the amount and first month.',
                    'أكد التعديل بعد صرف أو رد فرق الفلوس فعليًا لنفس الخزنة. لو فيه أقساط معتمدة، المبلغ وأول شهر خصم مش هيتغيروا.',
                  )}
                </p>
                <label className="hr-field">
                  {text('Correction reason', 'سبب التعديل')}
                  <textarea
                    required
                    maxLength={500}
                    value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                  />
                </label>
              </>
            )}
            {editing && (
              <strong>
                {formatDigits(editing.employeeName)} · {formatDigits(editing.branchName)}
              </strong>
            )}
            <fieldset
              disabled={!!editing}
              hidden={!!editing}
              style={{ border: 0, padding: 0, margin: 0 }}
            >
              <label className="hr-field">
                {text('Employee', 'الموظف')}
                <select
                  required
                  value={advance.staffMemberId}
                  onChange={(event) =>
                    setAdvance({ ...advance, staffMemberId: event.target.value, safeId: '' })
                  }
                >
                  <option value="">{text('Choose employee', 'اختار الموظف')}</option>
                  {activeStaff
                    .filter(
                      (employee) =>
                        employee.startDate <=
                          month + '-' + String(monthDays(month)).padStart(2, '0') &&
                        (!employee.endDate || employee.endDate >= month + '-01'),
                    )
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {formatDigits(employee.displayName)} · {formatDigits(employee.branch.name)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="hr-field">
                {text('Cash safe', 'الخزنة')}
                <select
                  required
                  value={advance.safeId}
                  onChange={(event) => setAdvance({ ...advance, safeId: event.target.value })}
                >
                  <option value="">{text('Choose safe', 'اختار الخزنة')}</option>
                  {safes.map((safe) => (
                    <option key={safe.id} value={safe.id}>
                      {formatDigits(safe.name)} · {money(safe.balance)}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <div className="hr-field-row">
              <label className="hr-field">
                {text('Advance amount (EGP)', 'قيمة السلفة (جنيه)')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  disabled={!!editing && moneyValue(editing.repaidAmount) > 0}
                  value={advance.amount}
                  onChange={(event) => setAdvance({ ...advance, amount: event.target.value })}
                />
              </label>
              <label className="hr-field">
                {text('Monthly installment (EGP)', 'القسط الشهري (جنيه)')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  max={advance.amount || undefined}
                  value={advance.installmentAmount}
                  onChange={(event) =>
                    setAdvance({ ...advance, installmentAmount: event.target.value })
                  }
                />
              </label>
              <label className="hr-field">
                {text('First deduction month', 'أول شهر للخصم')}
                <input
                  type="month"
                  required
                  disabled={!!editing && moneyValue(editing.repaidAmount) > 0}
                  value={advance.firstInstallmentMonth}
                  onChange={(event) =>
                    setAdvance({ ...advance, firstInstallmentMonth: event.target.value })
                  }
                />
              </label>
            </div>
            <label className="hr-field">
              {text('Reason', 'السبب')}
              <textarea
                required
                maxLength={500}
                value={advance.reason}
                onChange={(event) => setAdvance({ ...advance, reason: event.target.value })}
              />
            </label>
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
                  setAdvance(emptyAdvance());
                  setAdvanceOpen(false);
                }}
              >
                {text('Cancel', 'إلغاء')}
              </Button>
              <Button
                type="submit"
                disabled={
                  busy ||
                  !!pendingCommand ||
                  !validPositiveMoney(advance.amount) ||
                  !validPositiveMoney(advance.installmentAmount)
                }
              >
                {editing
                  ? text('Save correction', 'حفظ التعديل')
                  : text('Record advance', 'تسجيل السلفة')}
              </Button>
            </div>
          </form>
        </DashboardDialog>
      )}
    </HrPageShell>
  );
}
