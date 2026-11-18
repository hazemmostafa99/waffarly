import { useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type {
  AttendanceMonthSummary,
  CashSafeSummary,
  OwnerProfile,
  PayrollAdjustmentKind,
  PayrollLineSummary,
  PayrollRunSummary,
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
  type SavedCommand,
  validPositiveMoney,
} from './hr-api.js';

type AdjustmentDraft = {
  staffMemberId: string;
  kind: PayrollAdjustmentKind;
  amount: string;
  reason: string;
};
type PaymentDraft = { safeId: string; amount: string; reason: string };
type AttendanceStatus = AttendanceMonthSummary['status'];

const emptyAdjustment = (): AdjustmentDraft => ({
  staffMemberId: '',
  kind: 'addition',
  amount: '',
  reason: '',
});
export function PayrollPage() {
  const { locale, errorText, formatNumber, formatDate, formatDigits } = useLocale();
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const storageKey = 'waffarly:hr:payroll:' + profile.merchantId + ':' + profile.username;
  const [month, setMonth] = useState(currentMonth);
  const [run, setRun] = useState<PayrollRunSummary | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [staff, setStaff] = useState<StaffMemberSummary[]>([]);
  const [safes, setSafes] = useState<CashSafeSummary[]>([]);
  const [adjustment, setAdjustment] = useState<AdjustmentDraft>(emptyAdjustment);
  const [paymentLine, setPaymentLine] = useState<PayrollLineSummary | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentDraft>({ safeId: '', amount: '', reason: '' });
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
  const monthLastDay = month + '-' + String(monthDays(month)).padStart(2, '0');

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError('');
    setStaff([]);
    setRun(null);
    setAttendanceStatus(null);
    void Promise.all([
      apiRequest<PayrollRunSummary | null>('/owner/payroll?month=' + encodeURIComponent(month)),
      apiRequest<AttendanceMonthSummary>('/owner/attendance?month=' + encodeURIComponent(month)),
      apiRequest<StaffMemberSummary[]>('/owner/staff?limit=100&status=all'),
    ])
      .then(([payroll, attendance, staffRows]) => {
        if (!live) return;
        setRun(payroll);
        setAttendanceStatus(attendance.status);
        setStaff(staffRows);
      })
      .catch(() => {
        if (live)
          setLoadError(
            locale === 'ar'
              ? 'تعذر تحميل بيانات المرتبات. أعد المحاولة.'
              : 'Could not load payroll data. Please retry.',
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [locale, month, refresh]);

  useEffect(() => {
    let live = true;
    setSafes([]);
    if (!paymentLine)
      return () => {
        live = false;
      };
    void listSafes(paymentLine.branchId)
      .then((result) => {
        if (live) {
          setSafes(result);
          setPayment((current) => ({ ...current, safeId: result[0]?.id ?? '' }));
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
  }, [errorText, locale, paymentLine]);

  async function loadRunAndRefresh() {
    setRefresh((value) => value + 1);
  }

  async function createRun() {
    if (busy || attendanceStatus !== 'approved') return;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<PayrollRunSummary>('/owner/payroll', {
        method: 'POST',
        body: JSON.stringify({ month }),
      });
      setRun(result);
      setNotice(text('Payroll draft created.', 'تم إنشاء مسودة المرتبات.'));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not create payroll.', 'تعذر إنشاء المرتبات.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function addAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!run || busy || !validPositiveMoney(adjustment.amount)) return;
    setBusy(true);
    setError('');
    try {
      const saved = await apiRequest<PayrollRunSummary>(
        '/owner/payroll/' + run.id + '/adjustments',
        {
          method: 'POST',
          body: JSON.stringify({
            ...adjustment,
            amount: adjustment.amount.trim(),
            reason: adjustment.reason.trim(),
          }),
        },
      );
      setRun(saved);
      setAdjustment(emptyAdjustment());
      setNotice(text('Payroll adjustment added.', 'تم إضافة تعديل المرتب.'));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not add adjustment.', 'تعذر إضافة التعديل.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeAdjustment(adjustmentId: string) {
    if (!run || busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await apiRequest<PayrollRunSummary>(
        '/owner/payroll/' + run.id + '/adjustments/' + adjustmentId,
        { method: 'DELETE' },
      );
      setRun(saved);
      setNotice(text('Adjustment removed.', 'تم حذف التعديل.'));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not remove adjustment.', 'تعذر حذف التعديل.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function approveRun() {
    if (!run || busy || run.status !== 'draft') return;
    setBusy(true);
    setError('');
    try {
      const saved = await apiRequest<PayrollRunSummary>('/owner/payroll/' + run.id + '/approve', {
        method: 'POST',
      });
      setRun(saved);
      setApprovalOpen(false);
      setNotice(
        text('Payroll approved. Its amounts are now frozen.', 'تم اعتماد المرتبات وتثبيت مبالغها.'),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not approve payroll.', 'تعذر اعتماد المرتبات.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentLine || !validPositiveMoney(payment.amount) || !payment.safeId) return;
    const command: SavedCommand = {
      path: '/owner/payroll/lines/' + paymentLine.id + '/payments',
      body: {
        ...payment,
        requestId: crypto.randomUUID(),
        reason: payment.reason.trim(),
      },
    };
    await runCashCommand(command, text('Payroll payment recorded.', 'تم تسجيل دفع المرتب.'));
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
      setPaymentLine(null);
      setPayment({ safeId: '', amount: '', reason: '' });
      setNotice(successMessage);
      await loadRunAndRefresh();
    } catch (cause) {
      const saved = readSavedCommand(storageKey);
      setPendingCommand(saved);
      if (saved) {
        setPaymentLine(null);
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

  const draftLines = run?.lines ?? [];
  const unpaidLines = draftLines.filter((line) => moneyValue(line.remainingAmount) > 0);

  return (
    <HrPageShell
      title="Payroll"
      description="Review approved attendance, prepare payroll and track salary payments."
      actions={
        <div className="hr-inline-form">
          <label className="hr-field">
            {text('Payroll month', 'شهر المرتب')}
            <input
              type="month"
              required
              value={month}
              onChange={(event) => {
                if (event.target.value) setMonth(event.target.value);
              }}
            />
          </label>
          {run?.status === 'draft' && (
            <Button disabled={busy} onClick={() => setApprovalOpen(true)}>
              {text('Approve payroll', 'اعتماد المرتبات')}
            </Button>
          )}
        </div>
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
      <Link to="/staff/advances">{text('Manage staff advances', 'إدارة سلف الموظفين')}</Link>
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
      {!loading && !loadError && (
        <ol className="hr-payroll-steps" aria-label={text('Payroll progress', 'خطوات المرتبات')}>
          {[
            text('Approve attendance', 'اعتماد الحضور'),
            text('Prepare & review', 'تجهيز ومراجعة'),
            text('Approve payroll', 'اعتماد المرتبات'),
            text('Record payments', 'تسجيل الصرف'),
          ].map((label, index) => {
            const step =
              attendanceStatus !== 'approved'
                ? 0
                : !run || run.status === 'draft'
                  ? 1
                  : run.status === 'paid'
                    ? 4
                    : 3;
            return (
              <li
                key={label}
                data-complete={index < step}
                aria-current={index === step ? 'step' : undefined}
              >
                <span>{formatDigits(index + 1)}</span>
                {label}
              </li>
            );
          })}
        </ol>
      )}
      <section className="hr-summary-grid" aria-label={text('Payroll totals', 'إجمالي المرتبات')}>
        <div className="hr-summary">
          <span>{text('Total net due', 'صافي المستحق')}</span>
          <strong>
            {loading || attendanceStatus === null ? '—' : money(run?.totalDue ?? '0.00')}
          </strong>
        </div>
        <div className="hr-summary">
          <span>{text('Paid', 'المدفوع')}</span>
          <strong>
            {loading || attendanceStatus === null ? '—' : money(run?.totalPaid ?? '0.00')}
          </strong>
        </div>
        <div className="hr-summary">
          <span>{text('Outstanding', 'المتبقي')}</span>
          <strong>
            {loading || attendanceStatus === null ? '—' : money(run?.totalOutstanding ?? '0.00')}
          </strong>
        </div>
      </section>
      <section className="hr-card">
        <div className="hr-card-heading">
          <div>
            <h2>{text('Monthly payroll', 'مرتب الشهر')}</h2>
            <p>
              {text(
                'Attendance must be approved before a draft can be created.',
                'لازم اعتماد الحضور قبل إنشاء المسودة.',
              )}
            </p>
          </div>
          {run && <span className="hr-pill">{statusLabel(run.status, locale)}</span>}
        </div>
        {loading && <p className="hr-empty">{text('Loading payroll…', 'جارٍ تحميل المرتبات…')}</p>}
        {!loading && attendanceStatus !== null && !run && (
          <div className="hr-message hr-message--info">
            {attendanceStatus === 'approved' ? (
              <div className="hr-toolbar">
                <span>
                  {text(
                    'Attendance is approved. Create the payroll draft to calculate this month.',
                    'الحضور معتمد. أنشئ مسودة المرتبات لحساب الشهر.',
                  )}
                </span>
                <Button onClick={() => void createRun()} disabled={busy}>
                  {text('Create payroll draft', 'إنشاء مسودة المرتبات')}
                </Button>
              </div>
            ) : (
              <div>
                {text(
                  'Approve attendance after the month ends, then return here to create payroll.',
                  'اعتمد الحضور بعد انتهاء الشهر، وبعدها ارجع هنا لإنشاء المرتبات.',
                )}{' '}
                <Link to="/staff/attendance">{text('Open attendance', 'فتح الحضور')}</Link>
              </div>
            )}
          </div>
        )}
        {run && (
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>{text('Employee', 'الموظف')}</th>
                  <th>{text('Base pay', 'الأساسي')}</th>
                  <th>{text('Additions', 'إضافات')}</th>
                  <th>{text('Deductions', 'خصومات')}</th>
                  <th>{text('Advance installment', 'قسط السلفة')}</th>
                  <th>{text('Net due', 'الصافي')}</th>
                  <th>{text('Paid / remaining', 'مدفوع / متبقي')}</th>
                  <th>{text('Action', 'إجراء')}</th>
                </tr>
              </thead>
              <tbody>
                {run.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <strong>{formatDigits(line.employeeName)}</strong>
                      <span className="hr-subtext">
                        {formatDigits(line.branchName)} · {formatDigits(line.presentDays)}{' '}
                        {text('present days', 'يوم حضور')}
                      </span>
                    </td>
                    <td>
                      {money(line.basePay)}
                      <span className="hr-subtext">
                        {line.payBasis === 'monthly'
                          ? text('Monthly rate', 'شهري')
                          : text('Daily rate', 'يومي')}
                      </span>
                    </td>
                    <td>{money(line.additions)}</td>
                    <td>{money(line.deductions)}</td>
                    <td>{money(line.advanceDeduction)}</td>
                    <td>
                      <strong>{money(line.netDue)}</strong>
                    </td>
                    <td>
                      {money(line.paidAmount)}
                      <span className="hr-subtext">
                        {text('Left', 'المتبقي')}: {money(line.remainingAmount)}
                      </span>
                      {line.payments.length > 0 && (
                        <details className="hr-payroll-details">
                          <summary>
                            {text('Payment history', 'سجل الدفعات')} ({line.payments.length})
                          </summary>
                          {line.payments.map((item) => (
                            <span className="hr-subtext" key={item.id}>
                              {money(item.amount)} · {formatDate(item.paidAt, true)} ·{' '}
                              {formatDigits(item.reason)}
                            </span>
                          ))}
                        </details>
                      )}
                    </td>
                    <td>
                      <div className="hr-actions">
                        {run.status === 'draft' && line.adjustments.length > 0 && (
                          <details className="hr-payroll-details">
                            <summary>
                              {text('Adjustments', 'التعديلات')} ({line.adjustments.length})
                            </summary>
                            {line.adjustments.map((item) => (
                              <div className="hr-adjustment-entry" key={item.id}>
                                <strong>
                                  {item.kind === 'addition' ? '+' : '−'}
                                  {money(item.amount)}
                                </strong>
                                <span>{formatDigits(item.reason)}</span>
                                <button
                                  type="button"
                                  className="hr-inline-button"
                                  disabled={busy}
                                  onClick={() => void removeAdjustment(item.id)}
                                >
                                  {text('Remove', 'حذف')}
                                </button>
                              </div>
                            ))}
                          </details>
                        )}
                        {['approved', 'paid'].includes(run.status) &&
                          moneyValue(line.remainingAmount) > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || !!pendingCommand}
                              onClick={() => {
                                setPaymentLine(line);
                                setPayment({
                                  safeId: '',
                                  amount: line.remainingAmount,
                                  reason: '',
                                });
                              }}
                            >
                              {text('Pay', 'صرف')}
                            </Button>
                          )}
                        {moneyValue(line.remainingAmount) <= 0 && (
                          <span className="hr-pill">{text('Settled', 'تم السداد')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!run.lines.length && (
                  <tr>
                    <td colSpan={8} className="hr-empty">
                      {text(
                        'No employees were in service during this month.',
                        'مفيش موظفين على قوة العمل خلال الشهر ده.',
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {run?.status === 'draft' && (
          <form className="hr-inline-form" style={{ marginTop: 16 }} onSubmit={addAdjustment}>
            <label className="hr-field hr-field--wide">
              {text('Employee', 'الموظف')}
              <select
                required
                value={adjustment.staffMemberId}
                onChange={(event) =>
                  setAdjustment({ ...adjustment, staffMemberId: event.target.value })
                }
              >
                <option value="">{text('Choose employee', 'اختار الموظف')}</option>
                {staff
                  .filter(
                    (employee) =>
                      employee.startDate <= monthLastDay &&
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
              {text('Type', 'النوع')}
              <select
                value={adjustment.kind}
                onChange={(event) =>
                  setAdjustment({
                    ...adjustment,
                    kind: event.target.value as PayrollAdjustmentKind,
                  })
                }
              >
                <option value="addition">{text('Addition', 'إضافة')}</option>
                <option value="deduction">{text('Deduction', 'خصم')}</option>
              </select>
            </label>
            <label className="hr-field">
              {text('Amount (EGP)', 'المبلغ (جنيه)')}
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={adjustment.amount}
                onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })}
              />
            </label>
            <label className="hr-field hr-field--grow">
              {text('Reason', 'السبب')}
              <input
                required
                maxLength={500}
                value={adjustment.reason}
                onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })}
              />
            </label>
            <Button type="submit" disabled={busy || !validPositiveMoney(adjustment.amount)}>
              {text('Add adjustment', 'إضافة التعديل')}
            </Button>
          </form>
        )}
        {run?.status === 'draft' && (
          <div className="hr-actions" style={{ justifyContent: 'end', marginTop: 14 }}>
            <Button disabled={busy} onClick={() => setApprovalOpen(true)}>
              {text('Approve & freeze payroll', 'اعتماد وتثبيت المرتبات')}
            </Button>
          </div>
        )}
        {run?.status !== 'draft' && run && (
          <p className="hr-message hr-message--info" style={{ marginTop: 14 }}>
            {unpaidLines.length
              ? text(
                  'Payroll is approved. Record payments from each employee row; partial payments are allowed.',
                  'المرتبات معتمدة. سجل الصرف من صف الموظف، وممكن الدفع على دفعات.',
                )
              : run.lines.length
                ? text('Every payroll line has been fully paid.', 'تم سداد كل المرتبات بالكامل.')
                : text('There are no payroll lines for this month.', 'مفيش بنود مرتبات للشهر ده.')}
          </p>
        )}
      </section>

      {approvalOpen && run?.status === 'draft' && (
        <DashboardDialog
          title={text('Approve payroll?', 'اعتماد المرتبات؟')}
          closeLabel={text('Close', 'إغلاق')}
          onClose={() => {
            if (!busy) setApprovalOpen(false);
          }}
          busy={busy}
          className="hr-dialog"
        >
          <div className="hr-dialog-form">
            <p className="hr-message hr-message--info">
              {text(
                'Approval freezes the month’s pay, adjustments and advance installments. Review the totals before continuing.',
                'الاعتماد هيثبت المرتب والتعديلات وأقساط السلف للشهر. راجع الإجمالي قبل ما تكمل.',
              )}
            </p>
            <p>
              {text('Total due', 'إجمالي المستحق')}: <strong>{money(run.totalDue)}</strong>
            </p>
            {error && (
              <p className="hr-message hr-message--error" role="alert">
                {error}
              </p>
            )}
            <div className="hr-dialog-actions">
              <Button variant="outline" onClick={() => setApprovalOpen(false)}>
                {text('Review again', 'مراجعة')}
              </Button>
              <Button disabled={busy} onClick={() => void approveRun()}>
                {text('Approve payroll', 'اعتماد المرتبات')}
              </Button>
            </div>
          </div>
        </DashboardDialog>
      )}

      {paymentLine && (
        <DashboardDialog
          title={text('Record payroll payment', 'تسجيل دفع مرتب')}
          closeLabel={text('Close', 'إغلاق')}
          onClose={() => {
            if (!busy) setPaymentLine(null);
          }}
          busy={busy}
          className="hr-dialog"
        >
          <form className="hr-dialog-form" onSubmit={savePayment}>
            <p className="hr-message hr-message--info">
              {formatDigits(paymentLine.employeeName)} · {text('Remaining', 'المتبقي')}:{' '}
              {money(paymentLine.remainingAmount)}
            </p>
            <label className="hr-field">
              {text('Cash safe', 'الخزنة')}
              <select
                required
                value={payment.safeId}
                onChange={(event) => setPayment({ ...payment, safeId: event.target.value })}
              >
                <option value="">{text('Choose safe', 'اختار الخزنة')}</option>
                {safes.map((safe) => (
                  <option key={safe.id} value={safe.id}>
                    {formatDigits(safe.name)} · {money(safe.balance)}
                  </option>
                ))}
              </select>
            </label>
            <label className="hr-field">
              {text('Payment amount (EGP)', 'مبلغ الدفعة (جنيه)')}
              <input
                type="number"
                min="0.01"
                max={paymentLine.remainingAmount}
                step="0.01"
                required
                value={payment.amount}
                onChange={(event) => setPayment({ ...payment, amount: event.target.value })}
              />
            </label>
            <label className="hr-field">
              {text('Reason or reference', 'السبب أو المرجع')}
              <input
                required
                maxLength={500}
                value={payment.reason}
                onChange={(event) => setPayment({ ...payment, reason: event.target.value })}
              />
            </label>
            {error && (
              <p className="hr-message hr-message--error" role="alert">
                {error}
              </p>
            )}
            <div className="hr-dialog-actions">
              <Button type="button" variant="outline" onClick={() => setPaymentLine(null)}>
                {text('Cancel', 'إلغاء')}
              </Button>
              <Button
                type="submit"
                disabled={busy || !!pendingCommand || !validPositiveMoney(payment.amount)}
              >
                {text('Record payment', 'تسجيل الدفع')}
              </Button>
            </div>
          </form>
        </DashboardDialog>
      )}
    </HrPageShell>
  );
}

function statusLabel(status: PayrollRunSummary['status'], locale: string): string {
  if (locale !== 'ar') return status.charAt(0).toUpperCase() + status.slice(1);
  return { draft: 'مسودة', approved: 'معتمد', paid: 'مدفوع' }[status];
}
