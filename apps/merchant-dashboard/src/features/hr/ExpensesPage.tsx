import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import type {
  CashSafeSummary,
  ExpenseMonthSummary,
  InventoryBranch,
  MerchantExpenseSummary,
  OwnerProfile,
} from '@waffarly/contracts';
import { Button, useLocale } from '@waffarly/ui';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { ApiError, apiBaseUrl, apiRequest, apiRequestPage, apiUpload } from '../../lib/api-client.js';
import { HrPageShell } from './HrPageShell.js';
import { validReportMonth } from '../reports/report-helpers.js';
import {
  listBranches,
  listSafes,
  localToday,
  moneyValue,
  readSavedCommand,
  sendSavedCommand,
  type SavedCommand,
  validPositiveMoney,
} from './hr-api.js';

type ExpenseDraft = {
  branchId: string;
  incurredOn: string;
  category: string;
  amount: string;
  description: string;
};
type PaymentDraft = { safeId: string; amount: string; reason: string };
const emptyExpense = (): ExpenseDraft => ({ branchId: '', incurredOn: localToday(), category: '', amount: '', description: '' });

export function ExpensesPage() {
  const [searchParams] = useSearchParams();
  const { locale, errorText, formatNumber, formatDigits } = useLocale();
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const storageKey = 'waffarly:hr:expenses:' + profile.merchantId + ':' + profile.username;
  const [month, setMonth] = useState(() => validReportMonth(searchParams.get('month')));
  const [branchFilter, setBranchFilter] = useState(() => searchParams.get('branchId') ?? '');
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [summary, setSummary] = useState<ExpenseMonthSummary | null>(null);
  const [expenses, setExpenses] = useState<MerchantExpenseSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MerchantExpenseSummary | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(emptyExpense());
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentExpense, setPaymentExpense] = useState<MerchantExpenseSummary | null>(null);
  const [payment, setPayment] = useState<PaymentDraft>({ safeId: '', amount: '', reason: '' });
  const [safes, setSafes] = useState<CashSafeSummary[]>([]);
  const [pendingCommand, setPendingCommand] = useState<SavedCommand | null>(() => readSavedCommand(storageKey));
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const money = (amount: string) => formatNumber(moneyValue(amount), { style: 'currency', currency: 'EGP' });
  const cursor = cursorStack.at(-1);

  useEffect(() => {
    let live = true;
    void Promise.all([listBranches(), apiRequest<string[]>('/owner/expenses/categories')])
      .then(([branchRows, categoryRows]) => {
        if (!live) return;
        setBranches(branchRows);
        setCategories(categoryRows);
      })
      .catch((cause: unknown) => { if (live) setError(cause instanceof Error ? errorText(cause.message) : text('Could not load expense settings.', 'تعذر تحميل إعدادات المصروفات.')); });
    return () => { live = false; };
  }, [errorText, locale]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ month, limit: '50' });
    if (branchFilter) query.set('branchId', branchFilter);
    if (cursor) query.set('cursor', cursor);
    void Promise.all([
      apiRequestPage<MerchantExpenseSummary>('/owner/expenses?' + query.toString()),
      apiRequest<ExpenseMonthSummary>('/owner/expenses/summary?' + new URLSearchParams({ month, ...(branchFilter ? { branchId: branchFilter } : {}) })),
    ])
      .then(([page, monthlySummary]) => {
        if (!live) return;
        setExpenses(page.items);
        setNextCursor(page.nextCursor);
        setSummary(monthlySummary);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setExpenses([]);
        setNextCursor(null);
        setError(cause instanceof Error ? errorText(cause.message) : text('Could not load expenses.', 'تعذر تحميل المصروفات.'));
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [branchFilter, cursor, errorText, locale, month, refresh]);

  useEffect(() => {
    let live = true;
    setSafes([]);
    if (!paymentExpense) return () => { live = false; };
    void listSafes(paymentExpense.branchId)
      .then((result) => { if (live) { setSafes(result); setPayment((current) => ({ ...current, safeId: result[0]?.id ?? '' })); } })
      .catch((cause: unknown) => { if (live) setError(cause instanceof Error ? errorText(cause.message) : text('Could not load safes.', 'تعذر تحميل الخزن.')); });
    return () => { live = false; };
  }, [errorText, locale, paymentExpense]);

  useEffect(() => () => {
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
  }, [receiptUrl]);

  function openCreate() {
    setEditing(null);
    setDraft({ ...emptyExpense(), branchId: branchFilter });
    setReceiptFile(null);
    setEditorOpen(true);
    setError('');
    setNotice('');
  }

  function openEdit(expense: MerchantExpenseSummary) {
    setEditing(expense);
    setDraft({
      branchId: expense.branchId,
      incurredOn: expense.incurredOn,
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
    });
    setReceiptFile(null);
    setEditorOpen(true);
    setError('');
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!draft.branchId) {
      setError(text('Choose a branch.', 'اختار الفرع.'));
      return;
    }
    if (!validPositiveMoney(draft.amount)) {
      setError(text('Enter a valid amount.', 'اكتب مبلغ صحيح.'));
      return;
    }
    if (receiptFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(receiptFile.type) || receiptFile.size > 4 * 1024 * 1024)) {
      setError(text('Use a JPG, PNG or WebP receipt image up to 4 MB.', 'ارفع صورة JPG أو PNG أو WebP لحد ٤ ميجابايت.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = {
        branchId: draft.branchId,
        incurredOn: draft.incurredOn,
        category: draft.category.trim(),
        amount: draft.amount.trim(),
        description: draft.description.trim(),
        ...(editing ? { revision: editing.revision } : {}),
      };
      const saved = await apiRequest<MerchantExpenseSummary>(editing ? '/owner/expenses/' + editing.id : '/owner/expenses', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      setEditing(saved);
      if (receiptFile) await apiUpload('/owner/expenses/' + saved.id + '/receipt', receiptFile);
      setEditorOpen(false);
      setEditing(null);
      setReceiptFile(null);
      setNotice(editing ? text('Expense updated.', 'تم تعديل المصروف.') : text('Expense recorded.', 'تم تسجيل المصروف.'));
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? errorText(cause.message) : text('Could not save expense.', 'تعذر حفظ المصروف.'));
    } finally {
      setBusy(false);
    }
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentExpense || busy || !payment.safeId || !validPositiveMoney(payment.amount)) return;
    const command: SavedCommand = {
      path: '/owner/expenses/' + paymentExpense.id + '/payments',
      body: { ...payment, requestId: crypto.randomUUID(), reason: payment.reason.trim() },
    };
    if (pendingCommand) return;
    setBusy(true);
    setError('');
    setNotice('');
    setPendingCommand(command);
    try {
      await sendSavedCommand<unknown>(storageKey, command);
      setPendingCommand(null);
      setPaymentExpense(null);
      setPayment({ safeId: '', amount: '', reason: '' });
      setNotice(text('Expense payment recorded.', 'تم تسجيل دفع المصروف.'));
      setRefresh((value) => value + 1);
    } catch (cause) {
      const saved = readSavedCommand(storageKey);
      setPendingCommand(saved);
      if (saved) setPaymentExpense(null);
      setError(cause instanceof Error ? errorText(cause.message) : text('Cash payment failed. Retry the saved action before starting another.', 'تعذر تسجيل الدفع. أعد المحاولة قبل تسجيل دفعة جديدة.'));
    } finally {
      setBusy(false);
    }
  }

  async function retryPendingCommand() {
    if (!pendingCommand || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(pendingCommand.path, { method: 'POST', body: JSON.stringify(pendingCommand.body) });
      localStorage.removeItem(storageKey);
      setPendingCommand(null);
      setNotice(text('The saved payment was confirmed.', 'تم تأكيد الدفعة المحفوظة.'));
      setRefresh((value) => value + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode >= 400 && cause.statusCode < 500) {
        localStorage.removeItem(storageKey);
        setPendingCommand(null);
      }
      setError(cause instanceof Error ? errorText(cause.message) : text('Could not retry the payment.', 'تعذرت إعادة محاولة الدفع.'));
    } finally {
      setBusy(false);
    }
  }

  async function uploadReceipt(expense: MerchantExpenseSummary, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError(text('Use a JPG, PNG or WebP receipt image up to 4 MB.', 'ارفع صورة JPG أو PNG أو WebP لحد ٤ ميجابايت.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiUpload('/owner/expenses/' + expense.id + '/receipt', file);
      setNotice(text('Receipt uploaded privately.', 'تم رفع الإيصال بشكل خاص.'));
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? errorText(cause.message) : text('Could not upload receipt.', 'تعذر رفع الإيصال.'));
    } finally {
      setBusy(false);
    }
  }

  async function openReceipt(expense: MerchantExpenseSummary) {
    setReceiptLoading(true);
    setError('');
    try {
      const response = await fetch(
        new URL('owner/expenses/' + expense.id + '/receipt', apiBaseUrl().replace(/\/$/, '') + '/'),
        { credentials: 'include' },
      );
      if (!response.ok) throw new ApiError(text('Could not open receipt.', 'تعذر فتح الإيصال.'), response.status);
      const blob = await response.blob();
      setReceiptUrl(URL.createObjectURL(blob));
    } catch (cause) {
      setError(cause instanceof Error ? errorText(cause.message) : text('Could not open receipt.', 'تعذر فتح الإيصال.'));
    } finally {
      setReceiptLoading(false);
    }
  }

  const pageNumber = cursorStack.length;

  return (
    <HrPageShell title="Expenses" actions={<Button onClick={openCreate}>{text('Add expense', 'إضافة مصروف')}</Button>}>
      {error && <p className="hr-message hr-message--error" role="alert">{error}</p>}
      {notice && <p className="hr-message hr-message--success" role="status">{notice}</p>}
      {pendingCommand && <div className="hr-message hr-message--info">
        <div className="hr-toolbar"><span>{text('A cash payment is waiting for a safe retry. Do not submit another payment yet.', 'في دفعة نقدية محتاجة إعادة محاولة آمنة. متسجلش دفعة تانية دلوقتي.')}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void retryPendingCommand()}>{text('Retry saved payment', 'إعادة محاولة الدفع')}</Button></div>
      </div>}
      <section className="hr-summary-grid" aria-label={text('Monthly expenses', 'مصروفات الشهر')}>
        <div className="hr-summary"><span>{text('Expenses incurred', 'المصروفات المسجلة')}</span><strong>{money(summary?.incurredAmount ?? '0.00')}</strong></div>
        <div className="hr-summary"><span>{text('Paid this month', 'المدفوع خلال الشهر')}</span><strong>{money(summary?.paidDuringMonth ?? '0.00')}</strong></div>
        <div className="hr-summary"><span>{text('Currently unpaid from this month', 'المتبقي حاليًا من مصروفات الشهر')}</span><strong>{money(summary?.outstandingAmount ?? '0.00')}</strong></div>
      </section>
      <section className="hr-card">
        <div className="hr-toolbar">
          <div className="hr-inline-form">
            <label className="hr-field">{text('Month', 'الشهر')}<input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setCursorStack([undefined]); }} /></label>
            <label className="hr-field">{text('Branch', 'الفرع')}<select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setCursorStack([undefined]); }}><option value="">{text('All branches', 'كل الفروع')}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{formatDigits(branch.name)}</option>)}</select></label>
          </div>
          <span className="hr-muted">{loading ? text('Loading…', 'جارٍ التحميل…') : text('Page ' + pageNumber, 'صفحة ' + pageNumber)}</span>
        </div>
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead><tr><th>{text('Date', 'التاريخ')}</th><th>{text('Branch', 'الفرع')}</th><th>{text('Category & description', 'التصنيف والوصف')}</th><th>{text('Amount', 'المبلغ')}</th><th>{text('Paid / remaining', 'مدفوع / متبقي')}</th><th>{text('Receipt', 'الإيصال')}</th><th>{text('Actions', 'إجراءات')}</th></tr></thead>
            <tbody>
              {!loading && expenses.map((expense) => <tr key={expense.id}>
                <td>{formatDigits(expense.incurredOn)}</td>
                <td>{formatDigits(expense.branchName)}</td>
                <td><strong>{formatDigits(expense.category)}</strong><span className="hr-subtext">{formatDigits(expense.description)}</span></td>
                <td>{money(expense.amount)}</td>
                <td>{money(expense.paidAmount)}<span className="hr-subtext">{text('Left', 'المتبقي')}: {money(expense.remainingAmount)}</span></td>
                <td>{expense.receiptAvailable ? <button type="button" className="hr-inline-button" disabled={receiptLoading} onClick={() => void openReceipt(expense)}>{text('View', 'عرض')}</button> : <label className="hr-inline-button">{text('Upload', 'رفع')}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void uploadReceipt(expense, event)} /></label>}</td>
                <td><div className="hr-actions">
                  <button type="button" className="hr-inline-button" onClick={() => openEdit(expense)}>{text('Edit', 'تعديل')}</button>
                  {moneyValue(expense.remainingAmount) > 0 && <Button size="sm" variant="outline" disabled={busy || !!pendingCommand} onClick={() => { setPaymentExpense(expense); setPayment({ safeId: '', amount: expense.remainingAmount, reason: '' }); }}>{text('Pay', 'دفع')}</Button>}
                  {expense.receiptAvailable && <label className="hr-inline-button">{text('Replace receipt', 'تغيير الإيصال')}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void uploadReceipt(expense, event)} /></label>}
                </div></td>
              </tr>)}
              {!loading && expenses.length === 0 && <tr><td colSpan={7} className="hr-empty"><strong>{text('No expenses for this selection', 'مفيش مصروفات للاختيار ده')}</strong><p>{text('Choose another month or branch, or use Add expense to record one.', 'اختار شهر أو فرع تاني، أو استخدم إضافة مصروف لتسجيل مصروف جديد.')}</p></td></tr>}
              {loading && <tr><td colSpan={7} className="hr-empty">{text('Loading expenses…', 'جارٍ تحميل المصروفات…')}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="hr-actions" style={{ justifyContent: 'end', marginTop: 12 }}>
          <Button variant="outline" size="sm" disabled={cursorStack.length <= 1 || loading} onClick={() => setCursorStack((stack) => stack.slice(0, -1))}>{text('Previous', 'السابق')}</Button>
          <Button variant="outline" size="sm" disabled={!nextCursor || loading} onClick={() => nextCursor && setCursorStack((stack) => [...stack, nextCursor])}>{text('Next', 'التالي')}</Button>
        </div>
      </section>

      {editorOpen && <DashboardDialog title={editing ? text('Edit expense', 'تعديل مصروف') : text('Record expense', 'تسجيل مصروف')} closeLabel={text('Close', 'إغلاق')} onClose={() => { if (!busy) { setEditorOpen(false); setEditing(null); } }} busy={busy} className="hr-dialog">
        <form className="hr-dialog-form" onSubmit={saveExpense}>
          <div className="hr-field-row">
            <label className="hr-field hr-field--wide">{text('Branch', 'الفرع')}<select required disabled={!!editing && moneyValue(editing.paidAmount) > 0} value={draft.branchId} onChange={(event) => setDraft({ ...draft, branchId: event.target.value })}><option value="">{text('Choose a branch', 'اختار الفرع')}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{formatDigits(branch.name)}</option>)}</select></label>
            <label className="hr-field">{text('Date incurred', 'تاريخ المصروف')}<input type="date" required disabled={!!editing && moneyValue(editing.paidAmount) > 0} value={draft.incurredOn} onChange={(event) => setDraft({ ...draft, incurredOn: event.target.value })} /></label>
          </div>
          <div className="hr-field-row">
            <label className="hr-field hr-field--wide">{text('Category', 'التصنيف')}<input required maxLength={80} list="hr-expense-categories" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /><datalist id="hr-expense-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist></label>
            <label className="hr-field">{text('Amount (EGP)', 'المبلغ (جنيه)')}<input type="number" min="0.01" step="0.01" required disabled={!!editing && moneyValue(editing.paidAmount) > 0} value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
          </div>
          {editing && moneyValue(editing.paidAmount) > 0 && <p className="hr-message hr-message--info">{text('Branch, date and amount are locked after the first payment. You can still edit the category and description.', 'الفرع والتاريخ والمبلغ بيتقفلوا بعد أول دفعة. تقدر لسه تعدل التصنيف والوصف.')}</p>}
          <label className="hr-field">{text('Description', 'الوصف')}<textarea required maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label className="hr-field">{text(editing ? 'Receipt image (optional)' : 'Receipt image (optional)', 'صورة الإيصال (اختياري)')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} /><span className="hr-muted">{text('JPG, PNG or WebP · up to 4 MB · stored privately', 'JPG أو PNG أو WebP · لحد ٤ ميجابايت · محفوظ بشكل خاص')}</span></label>
          {error && <p className="hr-message hr-message--error" role="alert">{error}</p>}
          <div className="hr-dialog-actions"><Button type="button" variant="outline" onClick={() => { setEditorOpen(false); setEditing(null); }}>{text('Cancel', 'إلغاء')}</Button><Button type="submit" disabled={busy || !validPositiveMoney(draft.amount)}>{busy ? text('Saving…', 'جارٍ الحفظ…') : text('Save expense', 'حفظ المصروف')}</Button></div>
        </form>
      </DashboardDialog>}

      {paymentExpense && <DashboardDialog title={text('Pay expense', 'دفع مصروف')} closeLabel={text('Close', 'إغلاق')} onClose={() => { if (!busy) setPaymentExpense(null); }} busy={busy} className="hr-dialog">
        <form className="hr-dialog-form" onSubmit={savePayment}>
          <p className="hr-message hr-message--info">{formatDigits(paymentExpense.category)} · {text('Remaining', 'المتبقي')}: {money(paymentExpense.remainingAmount)}</p>
          <label className="hr-field">{text('Cash safe', 'الخزنة')}<select required value={payment.safeId} onChange={(event) => setPayment({ ...payment, safeId: event.target.value })}><option value="">{text('Choose safe', 'اختار الخزنة')}</option>{safes.map((safe) => <option key={safe.id} value={safe.id}>{formatDigits(safe.name)} · {money(safe.balance)}</option>)}</select></label>
          <label className="hr-field">{text('Payment amount (EGP)', 'مبلغ الدفعة (جنيه)')}<input type="number" min="0.01" max={paymentExpense.remainingAmount} step="0.01" required value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></label>
          <label className="hr-field">{text('Reason or reference', 'السبب أو المرجع')}<input required maxLength={500} value={payment.reason} onChange={(event) => setPayment({ ...payment, reason: event.target.value })} /></label>
          {error && <p className="hr-message hr-message--error" role="alert">{error}</p>}
          <div className="hr-dialog-actions"><Button type="button" variant="outline" onClick={() => setPaymentExpense(null)}>{text('Cancel', 'إلغاء')}</Button><Button type="submit" disabled={busy || !!pendingCommand || !validPositiveMoney(payment.amount)}>{text('Record payment', 'تسجيل الدفع')}</Button></div>
        </form>
      </DashboardDialog>}

      {receiptUrl && <DashboardDialog title={text('Expense receipt', 'إيصال المصروف')} closeLabel={text('Close', 'إغلاق')} onClose={() => setReceiptUrl(null)} className="hr-dialog">
        <div className="hr-dialog-form"><img src={receiptUrl} alt={text('Private expense receipt', 'إيصال مصروف خاص')} style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', margin: '0 auto' }} /><div className="hr-dialog-actions"><Button onClick={() => setReceiptUrl(null)}>{text('Close', 'إغلاق')}</Button></div></div>
      </DashboardDialog>}
    </HrPageShell>
  );
}
