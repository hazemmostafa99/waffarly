import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  AttendanceMonthSummary,
  InventoryBranch,
  StaffAttendanceStatus,
  StaffMemberSummary,
} from '@waffarly/contracts';
import { Button, useLocale } from '@waffarly/ui';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { apiRequest } from '../../lib/api-client.js';
import { HrPageShell } from './HrPageShell.js';
import { currentMonth, listBranches, localToday, monthDays } from './hr-api.js';

type AttendanceData = AttendanceMonthSummary & { staff: StaffMemberSummary[] };
type AttendanceCell = {
  staff: StaffMemberSummary;
  day: number;
  date: string;
  status: StaffAttendanceStatus | null;
};

const statusOrder: Array<StaffAttendanceStatus | ''> = ['present', 'absent', 'leave', 'rest', ''];
const statusCodes: Record<StaffAttendanceStatus, string> = { present: 'P', absent: 'A', leave: 'L', rest: 'R' };

export function AttendancePage() {
  const { locale, errorText, formatDigits } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [month, setMonth] = useState(currentMonth);
  const [branchFilter, setBranchFilter] = useState('');
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [data, setData] = useState<AttendanceData | null>(null);
  const [selected, setSelected] = useState<AttendanceCell | null>(null);
  const [statusDraft, setStatusDraft] = useState<StaffAttendanceStatus | ''>('');
  const [reason, setReason] = useState('');
  const [confirmApproval, setConfirmApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const days = monthDays(month);
  const isMonthComplete = month < currentMonth();

  useEffect(() => {
    let live = true;
    void listBranches().then((result) => { if (live) setBranches(result); })
      .catch((cause: unknown) => { if (live) setError(cause instanceof Error ? errorText(cause.message) : text('Could not load branches.', 'تعذر تحميل الفروع.')); });
    return () => { live = false; };
  }, [errorText, locale]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ month });
    void apiRequest<AttendanceData>('/owner/attendance?' + query.toString())
      .then((result) => { if (live) setData(result); })
      .catch((cause: unknown) => { if (live) { setData(null); setError(cause instanceof Error ? errorText(cause.message) : text('Could not load attendance.', 'تعذر تحميل الحضور.')); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [errorText, locale, month, refresh]);

  const visibleStaff = useMemo(
    () => (data?.staff ?? []).filter((employee) => !branchFilter || employee.branch.id === branchFilter),
    [branchFilter, data],
  );
  const entries = useMemo(
    () =>
      new Map<string, StaffAttendanceStatus>(
        (data?.entries ?? []).map((entry) => [
          entry.staffMemberId + ':' + entry.attendanceDate,
          entry.status,
        ] as const),
      ),
    [data],
  );
  const presentCount = (data?.entries ?? []).filter((entry) => entry.status === 'present').length;
  const absentCount = (data?.entries ?? []).filter((entry) => entry.status === 'absent').length;
  const leaveCount = (data?.entries ?? []).filter((entry) => entry.status === 'leave').length;

  function openCell(staff: StaffMemberSummary, day: number) {
    const date = month + '-' + String(day).padStart(2, '0');
    const existing = entries.get(staff.id + ':' + date) ?? null;
    setSelected({ staff, day, date, status: existing });
    setStatusDraft(existing ?? '');
    setReason('');
    setError('');
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy || data?.status === 'approved') return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/owner/attendance/' + month + '/entries', {
        method: 'POST',
        body: JSON.stringify({
          branchId: selected.staff.branch.id,
          staffMemberId: selected.staff.id,
          attendanceDate: selected.date,
          status: statusDraft || null,
          reason: reason.trim(),
        }),
      });
      setSelected(null);
      setNotice(text('Attendance entry saved.', 'تم حفظ الحضور.'));
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? errorText(cause.message) : text('Could not save attendance.', 'تعذر حفظ الحضور.'));
    } finally {
      setBusy(false);
    }
  }

  async function approveMonth() {
    if (busy || !isMonthComplete || data?.status === 'approved') return;
    setBusy(true);
    setError('');
    try {
      await apiRequest('/owner/attendance/' + month + '/approve', { method: 'POST' });
      setConfirmApproval(false);
      setNotice(text('Attendance approved. The month is now locked for editing.', 'تم اعتماد الحضور وقفل الشهر للتعديل.'));
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? errorText(cause.message) : text('Could not approve attendance.', 'تعذر اعتماد الحضور.'));
    } finally {
      setBusy(false);
    }
  }

  function employeeWorksOnDay(staff: StaffMemberSummary, day: number): boolean {
    const date = month + '-' + String(day).padStart(2, '0');
    return date >= staff.startDate && (!staff.endDate || date <= staff.endDate);
  }

  return (
    <HrPageShell
      title="Attendance"
      actions={data?.status === 'approved'
        ? <span className="hr-pill">{text('Month approved', 'الشهر معتمد')}</span>
        : <div className="hr-approval-action">{!isMonthComplete && <span className="hr-muted">{text("Available after month end", "متاح بعد نهاية الشهر")}</span>}<Button disabled={!isMonthComplete || busy || !data} onClick={() => setConfirmApproval(true)}>{text('Approve month', 'اعتماد الشهر')}</Button></div>}
    >
      {error && <p className="hr-message hr-message--error" role="alert">{error}</p>}
      {notice && <p className="hr-message hr-message--success" role="status">{notice}</p>}
      <section className="hr-card">
        <div className="hr-toolbar">
          <div className="hr-inline-form">
            <label className="hr-field">{text('Month', 'الشهر')}<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
            <label className="hr-field">{text('Branch', 'الفرع')}<select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option value="">{text('All branches', 'كل الفروع')}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{formatDigits(branch.name)}</option>)}</select></label>
          </div>
          <span className={'hr-pill' + (data?.status === 'approved' ? '' : ' hr-pill--muted')}>
            {data?.status === 'approved' ? text('Approved · locked', 'معتمد · مقفول') : text('Draft · editable', 'مسودة · قابل للتعديل')}
          </span>
        </div>
        {!isMonthComplete && <p className="hr-message hr-message--info">{text('You can record attendance during the month. Approval becomes available after the month ends.', 'تقدر تسجل الحضور خلال الشهر، والاعتماد بيتاح بعد انتهائه.')}</p>}
        <div className="hr-actions" style={{ marginBottom: 12 }}>
          <span className="hr-pill">{text('Present', 'حاضر')}: {presentCount}</span>
          <span className="hr-pill hr-pill--muted">{text('Absent', 'غائب')}: {absentCount}</span>
          <span className="hr-pill hr-pill--muted">{text('Leave', 'إجازة')}: {leaveCount}</span>
          <span className="hr-muted">{text('Click a day to record or correct it. Corrections need a reason.', 'اضغط على اليوم لتسجيله أو تصحيحه، والتعديل محتاج سبب.')}</span>
        </div>
        <div className="hr-grid-scroll" data-empty={!loading && visibleStaff.length === 0}>
          <table className="hr-attendance-grid">
            <thead><tr><th>{text('Employee', 'الموظف')}</th>{Array.from({ length: days }, (_, index) => <th key={index + 1}>{formatDigits(index + 1)}</th>)}</tr></thead>
            <tbody>
              {!loading && visibleStaff.map((employee) => (
                <tr key={employee.id}>
                  <td><strong>{formatDigits(employee.displayName)}</strong><span className="hr-subtext">{formatDigits(employee.branch.name)}</span></td>
                  {Array.from({ length: days }, (_, index) => {
                    const day = index + 1;
                    const date = month + '-' + String(day).padStart(2, '0');
                    const status = entries.get(employee.id + ':' + date) ?? null;
                    const eligible = employeeWorksOnDay(employee, day);
                    const label = status ? text(statusLabel(status), statusLabelAr(status)) : text('Not recorded', 'غير مسجل');
                    return <td key={day}>
                      <button
                        type="button"
                        className="hr-attendance-cell"
                        data-status={status ?? 'empty'} data-today={date === localToday()}
                        aria-label={formatDigits(employee.displayName) + ' · ' + formatDigits(date) + ' · ' + label}
                        title={eligible ? label : text('Outside employment dates', 'خارج فترة العمل')}
                        disabled={!eligible || data?.status === 'approved'}
                        onClick={() => openCell(employee, day)}
                      >
                        {status ? (locale === 'ar' ? { present: 'ح', absent: 'غ', leave: 'إ', rest: 'ر' }[status] : statusCodes[status]) : '·'}
                      </button>
                    </td>;
                  })}
                </tr>
              ))}
              {!loading && visibleStaff.length === 0 && <tr><td colSpan={days + 1} className="hr-empty"><strong>{text('No employees for this selection', 'مفيش موظفين للاختيار ده')}</strong><p>{text('Check the selected branch and employment dates.', 'راجع الفرع المختار وتواريخ عمل الموظفين.')}</p></td></tr>}
              {loading && <tr><td colSpan={days + 1} className="hr-empty">{text('Loading attendance…', 'جارٍ تحميل الحضور…')}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="hr-muted">{text('P = present · A = absent · L = leave · R = rest · dot = not recorded', 'ح = حاضر · غ = غائب · إ = إجازة · ر = راحة · النقطة = غير مسجل')}</p>
      </section>

      {selected && <DashboardDialog
        title={text('Attendance entry', 'تسجيل الحضور')}
        closeLabel={text('Close', 'إغلاق')}
        onClose={() => { if (!busy) setSelected(null); }}
        busy={busy}
        className="hr-dialog"
      >
        <form className="hr-dialog-form" onSubmit={saveEntry}>
          <p className="hr-message hr-message--info">{formatDigits(selected.staff.displayName)} · {formatDigits(selected.date)}</p>
          <label className="hr-field">{text('Status', 'الحالة')}
            <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as StaffAttendanceStatus | '')}>
              {statusOrder.map((value) => <option key={value || 'empty'} value={value}>{value ? text(statusLabel(value), statusLabelAr(value)) : text('Not recorded (clear entry)', 'غير مسجل (مسح الحالة)')}</option>)}
            </select>
          </label>
          <label className="hr-field">{text('Reason for this entry or correction', 'سبب التسجيل أو التعديل')}<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          {error && <p className="hr-message hr-message--error" role="alert">{error}</p>}
          <div className="hr-dialog-actions"><Button type="button" variant="outline" onClick={() => setSelected(null)}>{text('Cancel', 'إلغاء')}</Button><Button type="submit" disabled={busy}>{text('Save entry', 'حفظ الحضور')}</Button></div>
        </form>
      </DashboardDialog>}

      {confirmApproval && <DashboardDialog
        title={text('Approve attendance month?', 'اعتماد الحضور؟')}
        closeLabel={text('Close', 'إغلاق')}
        onClose={() => { if (!busy) setConfirmApproval(false); }}
        busy={busy}
        className="hr-dialog"
      >
        <div className="hr-dialog-form">
          <p className="hr-message hr-message--info">{text('Approval locks attendance for every branch in this month. Any later corrections must be handled as payroll adjustments.', 'الاعتماد هيقفل حضور كل الفروع في الشهر ده. أي تصحيح بعد كده يتسجل كتعديل على المرتب.')}</p>
          {!data?.entries.length && <p className="hr-message hr-message--error">{text('No attendance changes are recorded yet. Save at least one entry before approval.', 'لسه مفيش أي تسجيل حضور. سجل حالة واحدة على الأقل قبل الاعتماد.')}</p>}
          {error && <p className="hr-message hr-message--error" role="alert">{error}</p>}
          <div className="hr-dialog-actions"><Button type="button" variant="outline" onClick={() => setConfirmApproval(false)}>{text('Go back', 'رجوع')}</Button><Button disabled={busy || !data?.entries.length} onClick={() => void approveMonth()}>{text('Confirm approval', 'تأكيد الاعتماد')}</Button></div>
        </div>
      </DashboardDialog>}
    </HrPageShell>
  );
}

function statusLabel(value: StaffAttendanceStatus): string {
  return { present: 'Present', absent: 'Absent', leave: 'Leave', rest: 'Rest' }[value];
}
function statusLabelAr(value: StaffAttendanceStatus): string {
  return { present: 'حاضر', absent: 'غائب', leave: 'إجازة', rest: 'راحة' }[value];
}
