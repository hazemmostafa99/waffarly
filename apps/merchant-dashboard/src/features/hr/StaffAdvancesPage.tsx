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
      apiRequest<StaffAdvanceSummary[]>('/owner/payroll/advances?status=open'),
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
    if (!advance.staffMemberId)
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
  }, [advance.staffMemberId, errorText, locale, staff]);

  async function saveAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      !advance.staffMemberId ||
      !advance.safeId ||
      !validPositiveMoney(advance.amount) ||
      !validPositiveMoney(advance.installmentAmount)
    )
      return;
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
      setNotice(successMessage);
      setRefresh((value) => value + 1);
    } catch (cause) {
      const saved = readSavedCommand(storageKey);
      setPendingCommand(saved);
      if (saved) {
        setAdvanceOpen(false);
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
      description="Record staff advances and follow their monthly payroll installments."
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
                setAdvance(emptyAdvance());
                setSafes([]);
                setAdvanceOpen(true);
              }}
            >
              {text('New advance', 'سلفة جديدة')}
            </Button>
          </div>
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
                </tr>
              </thead>
              <tbody>
                {advances.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDigits(item.employeeName)}</td>
                    <td>{formatDigits(item.branchName)}</td>
                    <td>{money(item.amount)}</td>
                    <td>{money(item.installmentAmount)}</td>
                    <td>{money(item.remainingBalance)}</td>
                    <td>{formatDigits(item.firstInstallmentMonth)}</td>
                    <td>{formatDigits(item.reason)}</td>
                  </tr>
                ))}
                {!advances.length && (
                  <tr>
                    <td colSpan={7} className="hr-empty">
                      {text('No outstanding advances.', 'مفيش سلف متبقية.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {advanceOpen && (
        <DashboardDialog
          title={text('Record staff advance', 'تسجيل سلفة')}
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
            <div className="hr-field-row">
              <label className="hr-field">
                {text('Advance amount (EGP)', 'قيمة السلفة (جنيه)')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
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
                {text('Record advance', 'تسجيل السلفة')}
              </Button>
            </div>
          </form>
        </DashboardDialog>
      )}
    </HrPageShell>
  );
}
