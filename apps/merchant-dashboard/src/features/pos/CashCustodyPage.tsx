import { useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type {
  CashDrawerSummary,
  CashSafeSummary,
  CashTransferSummary,
  CashSafeMovementSummary,
  CursorPage,
  InventoryBranch,
  OwnerProfile,
} from '@waffarly/contracts';
import { Button, DashboardCard, Input, useLocale } from '@waffarly/ui';
import { apiRequestPage, apiRequestSingle, ApiError } from '../../lib/api-client.js';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { DashboardSelect } from '../../components/DashboardSelect.js';
import { Icon } from '../../Icons.js';
import './cash-custody.css';

type Dialog =
  | { kind: 'safe' }
  | { kind: 'transfer'; drawer: CashDrawerSummary }
  | { kind: 'receive' | 'resolve'; transfer: CashTransferSummary }
  | { kind: 'movement'; safe: CashSafeSummary };
type SavedCommand = { path: string; body: Record<string, string> };
const emptyPage = { items: [], nextCursor: null };

export function CashCustodyPage() {
  const { locale, formatNumber, formatDate, errorText } = useLocale();
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const money = (amount: string) =>
    formatNumber(Number(amount), { style: 'currency', currency: 'EGP' });
  const storageKey = `waffarly:cash:owner:${profile.merchantId}:${profile.username}`;
  const [pending, setPending] = useState<SavedCommand | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? 'null') as SavedCommand | null;
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState<'drawers' | 'transfers' | 'safes'>('drawers');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [drawers, setDrawers] = useState<CursorPage<CashDrawerSummary>>(emptyPage);
  const [transfers, setTransfers] = useState<CursorPage<CashTransferSummary>>(emptyPage);
  const [safes, setSafes] = useState<CursorPage<CashSafeSummary>>(emptyPage);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [safeBranch, setSafeBranch] = useState('');
  const [movementKind, setMovementKind] = useState('deposit');
  const [ledgerSafe, setLedgerSafe] = useState<{
    id: string;
    name: string;
    kind: 'safes' | 'drawers';
  } | null>(null);
  const [ledger, setLedger] = useState<CursorPage<CashSafeMovementSummary>>(emptyPage);
  const [ledgerHistory, setLedgerHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const cursor = history.at(-1);
  const ledgerCursor = ledgerHistory.at(-1);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const q = new URLSearchParams({ limit: '25' });
    if (branch) q.set('branchId', branch);
    if (cursor) q.set('cursor', cursor);
    if (tab === 'transfers' && status) q.set('status', status);
    const path = `/owner/pos/cash/${tab}?${q}`;
    const run =
      tab === 'drawers'
        ? apiRequestPage<CashDrawerSummary>(path, { signal: controller.signal }).then(setDrawers)
        : tab === 'transfers'
          ? apiRequestPage<CashTransferSummary>(path, { signal: controller.signal }).then(
              setTransfers,
            )
          : apiRequestPage<CashSafeSummary>(path, { signal: controller.signal }).then(setSafes);
    void run
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load cash records.', 'تعذر تحميل سجلات النقدية.'),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [tab, branch, status, cursor, refresh, locale, errorText]);

  useEffect(() => {
    if (!ledgerSafe) return;
    const controller = new AbortController();
    const q = new URLSearchParams({ limit: '25' });
    if (ledgerCursor) q.set('cursor', ledgerCursor);
    setLedger(emptyPage);
    void apiRequestPage<CashSafeMovementSummary>(
      `/owner/pos/cash/${ledgerSafe.kind}/${ledgerSafe.id}/movements?${q}`,
      { signal: controller.signal },
    )
      .then(setLedger)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load ledger.', 'تعذر تحميل كشف الحركة.'),
          );
      });
    return () => controller.abort();
  }, [ledgerSafe, ledgerCursor, refresh, errorText, locale]);

  async function send(command: SavedCommand) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(command));
      setPending(command);
      await apiRequestSingle(command.path, { method: 'POST', body: JSON.stringify(command.body) });
      localStorage.removeItem(storageKey);
      setPending(null);
      setDialog(null);
      setRefresh((value) => value + 1);
      setNotice(text('Cash record saved.', 'تم تسجيل الحركة.'));
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode >= 400 && cause.statusCode < 500) {
        localStorage.removeItem(storageKey);
        setPending(null);
      }
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save the movement.', 'تعذر حفظ الحركة.'),
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || pending) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<
      string,
      string
    >;
    let path = '/owner/pos/cash/';
    if (dialog.kind === 'safe') {
      path += 'safes';
      fields.branchId = safeBranch;
    }
    if (dialog.kind === 'transfer') path += `shifts/${dialog.drawer.id}/transfers`;
    if (dialog.kind === 'receive' || dialog.kind === 'resolve')
      path += `transfers/${dialog.transfer.id}/${dialog.kind}`;
    if (dialog.kind === 'movement') path += `safes/${dialog.safe.id}/movements`;
    if (dialog.kind !== 'resolve') fields.requestId = crypto.randomUUID();
    void send({ path, body: fields });
  }
  const currentPage = tab === 'drawers' ? drawers : tab === 'transfers' ? transfers : safes;
  const statusLabel = (value: string) =>
    ({
      pending: text('Awaiting receipt', 'بانتظار الاستلام'),
      received: text('Received', 'تم الاستلام'),
      discrepancy: text('Receipt difference', 'فرق استلام'),
      resolved: text('Difference reviewed', 'تمت مراجعة الفرق'),
    })[value] ?? value;

  return (
    <div className="inventory-page cash-custody-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="cash-page-heading">
        <div>
          <span className="cash-eyebrow">{text('CASH CONTROL', 'متابعة النقدية')}</span>
          <h1>{text('Cash drawers & safes', 'النقدية والخزنة')}</h1>
          <p>
            {text(
              'Follow every handoff, from the cashier drawer to confirmed safe receipt.',
              'تابع الفلوس من درج الكاشير لحد تأكيد استلامها في الخزنة.',
            )}
          </p>
        </div>
        <Button
          onClick={() => {
            setSafeBranch(branch);
            setDialog({ kind: 'safe' });
          }}
          disabled={busy || !!pending}
        >
          {text('Create safe', 'إضافة خزنة')}
        </Button>
      </header>
      {error && (
        <p role="alert" className="cash-alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="cash-notice">
          {notice}
        </p>
      )}
      {pending && (
        <div className="cash-alert">
          <strong>
            {text(
              'A saved cash request needs a confirmed result.',
              'فيه حركة محفوظة محتاجة تأكيد نتيجتها.',
            )}
          </strong>
          <p>
            {text(
              'Retry the same request before recording another movement.',
              'أعد إرسال نفس الطلب قبل تسجيل حركة جديدة.',
            )}
          </p>
          <Button disabled={busy} onClick={() => void send(pending)}>
            {text('Retry saved request', 'إعادة إرسال الطلب المحفوظ')}
          </Button>
        </div>
      )}
      <div className="cash-guide">
        <span className="cash-guide-icon" aria-hidden="true">
          <Icon name="file" />
        </span>
        <div>
          <strong>
            {text(
              'Closing a shift does not transfer its cash.',
              'تقفيل الشيفت مش معناه توريد الفلوس.',
            )}
          </strong>
          <span>
            {text(
              'Expected balance comes from recorded movements. Counted cash is the physical count at close. Safe balance increases only after receipt.',
              'المتوقع حسب الحركات، والمعدود هو الجرد الفعلي وقت التقفيل. رصيد الخزنة بيزيد بعد تأكيد الاستلام فقط.',
            )}
          </span>
        </div>
      </div>
      <div className="cash-toolbar">
        <nav aria-label={text('Cash views', 'شاشات النقدية')}>
          {(['drawers', 'transfers', 'safes'] as const).map((value) => (
            <button
              key={value}
              className={tab === value ? 'is-active' : ''}
              aria-pressed={tab === value}
              onClick={() => {
                setTab(value);
                setHistory([]);
              }}
            >
              {value === 'drawers'
                ? text('Drawers & custody', 'الأدراج والعهد')
                : value === 'transfers'
                  ? text('Transfers & receipts', 'التوريدات والاستلام')
                  : text('Safes', 'الخزن')}
            </button>
          ))}
        </nav>
        <Button
          variant="outline"
          disabled={loading || busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <Icon name="refresh" />
          {text('Refresh', 'تحديث')}
        </Button>
      </div>
      <div className="cash-filters">
        <div className="cash-field">
          <span>{text('Branch', 'الفرع')}</span>
          <PagedEntitySelect<InventoryBranch>
            path="/owner/inventory/branches"
            label={text('Branch', 'الفرع')}
            value={branch}
            required={false}
            searchMode="combobox"
            onSelect={(item) => {
              setBranch(item?.id ?? '');
              setHistory([]);
            }}
            emptyLabel={text('All branches', 'كل الفروع')}
          />
        </div>
        {tab === 'transfers' && (
          <div className="cash-field">
            <span>{text('Receipt status', 'حالة الاستلام')}</span>
            <DashboardSelect
              label={text('Receipt status', 'حالة الاستلام')}
              value={status}
              options={[
                { value: '', label: text('All statuses', 'كل الحالات') },
                ...['pending', 'received', 'discrepancy', 'resolved'].map((value) => ({
                  value,
                  label: statusLabel(value),
                })),
              ]}
              onChange={(value) => {
                setStatus(value);
                setHistory([]);
              }}
            />
          </div>
        )}
      </div>
      {loading ? (
        <p role="status">{text('Loading cash records…', 'جارٍ تحميل النقدية…')}</p>
      ) : !currentPage.items.length ? (
        <div className="cash-empty">
          <h2>{text('No cash records yet', 'مفيش سجلات نقدية هنا لسه')}</h2>
          <p>
            {text(
              'Create a safe, then record a cash drop from an open shift or settle a closed shift.',
              'أضف خزنة، وبعدها سجّل توريد من شيفت مفتوح أو سلّم عهدة شيفت مقفول.',
            )}
          </p>
        </div>
      ) : (
        <div className={`cash-record-grid cash-record-grid--${tab}`}>
          {tab === 'drawers' &&
            drawers.items.map((row) => (
              <article
                key={row.id}
                className="cash-drawer-card"
                aria-label={`${row.registerName} · ${row.cashierName}`}
              >
                <header className="cash-drawer-header">
                  <div className="cash-drawer-identity">
                    <span className="cash-drawer-icon" aria-hidden="true">
                      <Icon name="orders" />
                    </span>
                    <div>
                      <span className="cash-drawer-overline">
                        {text('Cash drawer', 'درج الكاشير')}
                      </span>
                      <h2>{row.registerName}</h2>
                    </div>
                  </div>
                  <span className={`cash-status ${row.status === 'closed' ? '' : 'pending'}`}>
                    {row.status === 'closed'
                      ? text('Closed shift', 'شيفت مقفول')
                      : text('Open shift', 'شيفت مفتوح')}
                  </span>
                </header>
                <div className="cash-drawer-meta">
                  <span>
                    <Icon name="branches" />
                    <span>
                      {text('Branch', 'الفرع')}
                      <strong>{row.branchName}</strong>
                    </span>
                  </span>
                  <span>
                    <Icon name="customers" />
                    <span>
                      {text('Cashier', 'الكاشير')}
                      <strong>{row.cashierName}</strong>
                    </span>
                  </span>
                  <span>
                    <Icon name="clock" />
                    <span>
                      {row.status === 'closed'
                        ? text('Closed at', 'وقت التقفيل')
                        : text('Opened at', 'وقت الفتح')}
                      <time dateTime={row.closedAt ?? row.openedAt}>
                        {formatDate(row.closedAt ?? row.openedAt, true)}
                      </time>
                    </span>
                  </span>
                </div>
                <div className="cash-drawer-balance cash-primary">
                  <span>
                    {row.status === 'closed'
                      ? text('Remaining custody', 'المتبقي بالعهدة')
                      : text('Expected in drawer', 'المتوقع في الدرج')}
                  </span>
                  <strong>{money(row.remainingCash)}</strong>
                  <p>
                    {row.status !== 'closed'
                      ? text('Based on the recorded cash movements.', 'حسب حركات النقدية المسجلة.')
                      : Number(row.remainingCash) > 0
                        ? text(
                            'Still in custody until a handoff is recorded.',
                            'لسه بالعهدة لحد تسجيل تسليم للخزنة أو للشيفت التالي.',
                          )
                        : Number(row.pendingAmount) > 0
                          ? text(
                              'Handed over. Safe receipt still needs confirmation.',
                              'تم التسليم، وفيه توريدات لسه محتاجة تأكيد استلام.',
                            )
                          : text(
                              'This shift has no remaining cash to hand over.',
                              'مفيش نقدية متبقية للتسليم من الشيفت ده.',
                            )}
                  </p>
                </div>
                <div className="cash-drawer-details">
                  <h3>{text('Cash count', 'ملخص الجرد')}</h3>
                  <dl className="cash-count-grid">
                    <div>
                      <dt>{text('Expected at close', 'الرصيد المتوقع')}</dt>
                      <dd>{money(row.expectedCash)}</dd>
                    </div>
                    <div>
                      <dt>{text('Counted at close', 'المعدود وقت التقفيل')}</dt>
                      <dd>{row.countedCash === null ? '—' : money(row.countedCash)}</dd>
                    </div>
                    <div
                      className={row.variance && Number(row.variance) !== 0 ? 'has-variance' : ''}
                    >
                      <dt>{text('Count variance', 'فرق الجرد')}</dt>
                      <dd>{row.variance === null ? '—' : money(row.variance)}</dd>
                    </div>
                  </dl>
                  <h3>{text('Where the cash went', 'متابعة تسليم النقدية')}</h3>
                  <dl className="cash-handoff-grid">
                    <div className={Number(row.pendingAmount) > 0 ? 'is-pending' : ''}>
                      <dt>
                        <Icon name="clock" />
                        {text('Awaiting safe receipt', 'بانتظار استلام الخزنة')}
                      </dt>
                      <dd>{money(row.pendingAmount)}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="check" />
                        {text('Received in safe', 'المستلم في الخزنة')}
                      </dt>
                      <dd>{money(row.receivedInSafe)}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="customers" />
                        {text('Received by next shift', 'المستلم للشيفت التالي')}
                      </dt>
                      <dd>{money(row.carriedForward)}</dd>
                    </div>
                  </dl>
                </div>
                {row.legacyDropAmount !== '0.00' && (
                  <p className="cash-warning">
                    {text(
                      'Earlier cash drops without verified safe receipt:',
                      'توريدات سابقة بدون تأكيد استلام خزنة:',
                    )}{' '}
                    {money(row.legacyDropAmount)}
                  </p>
                )}
                <footer className="cash-actions cash-drawer-actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLedgerSafe({ id: row.id, name: row.registerName, kind: 'drawers' });
                      setLedgerHistory([]);
                    }}
                  >
                    {text('Movement statement', 'كشف الحركة')}
                  </Button>
                  {row.status === 'closed' && Number(row.remainingCash) > 0 && (
                    <Button
                      className="cash-primary-action"
                      disabled={busy || !!pending}
                      onClick={() => setDialog({ kind: 'transfer', drawer: row })}
                    >
                      {text('Transfer to safe', 'توريد للخزنة')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTab('transfers');
                      setHistory([]);
                      setStatus('');
                      setBranch(row.branchId);
                    }}
                  >
                    {text('View branch transfers', 'عرض توريدات الفرع')}
                  </Button>
                  <Link to="/pos-shift-reports">{text('Shift reports', 'تقارير الشيفتات')}</Link>
                </footer>
              </article>
            ))}
          {tab === 'safes' &&
            safes.items.map((row) => (
              <DashboardCard key={row.id} title={row.name} description={row.branchName}>
                <div className="cash-primary">
                  <span>{text('Confirmed safe balance', 'رصيد الخزنة المؤكد')}</span>
                  <strong>{money(row.balance)}</strong>
                </div>
                <dl className="cash-facts">
                  <dt>{text('Awaiting receipt', 'توريدات بانتظار الاستلام')}</dt>
                  <dd>{money(row.pendingAmount)}</dd>
                </dl>
                <div className="cash-actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLedgerSafe({ id: row.id, name: row.name, kind: 'safes' });
                      setLedgerHistory([]);
                    }}
                  >
                    {text('Movement statement', 'كشف الحركة')}
                  </Button>
                  <Button
                    disabled={busy || !!pending}
                    onClick={() => setDialog({ kind: 'movement', safe: row })}
                  >
                    {text('Deposit / withdrawal', 'إيداع / صرف')}
                  </Button>
                </div>
              </DashboardCard>
            ))}
          {tab === 'transfers' &&
            transfers.items.map((row) => (
              <DashboardCard
                key={row.id}
                title={`${row.registerName} → ${row.destinationName}`}
                description={row.reference}
              >
                <div className="cash-card-heading">
                  <span className={`cash-status ${row.status}`}>{statusLabel(row.status)}</span>
                  <small>{formatDate(row.createdAt, true)}</small>
                </div>
                <div className="cash-primary">
                  <span>
                    {row.kind === 'safe'
                      ? text('Handed to safe', 'المسلّم للخزنة')
                      : text('Shift carryover', 'فكة للشيفت التالي')}
                  </span>
                  <strong>{money(row.amount)}</strong>
                </div>
                <dl className="cash-facts">
                  <dt>{text('Handed by', 'سجّل التسليم')}</dt>
                  <dd>{row.createdByName ?? row.createdBy}</dd>
                  <dt>{text('Received by', 'المستلم')}</dt>
                  <dd>{row.receivedByName ?? row.receivedBy ?? '—'}</dd>
                  <dt>{text('Actually received', 'المستلم فعليًا')}</dt>
                  <dd>{row.receivedAmount === null ? '—' : money(row.receivedAmount)}</dd>
                  <dt>{text('Receipt difference', 'فرق الاستلام')}</dt>
                  <dd>{row.difference === null ? '—' : money(row.difference)}</dd>
                  <dt>{text('Received at', 'وقت الاستلام')}</dt>
                  <dd>{row.receivedAt ? formatDate(row.receivedAt, true) : '—'}</dd>
                </dl>
                <p>{row.reason}</p>
                {row.receiptNote && <p>{row.receiptNote}</p>}
                {row.resolutionNote && (
                  <p className="cash-notice">
                    {row.resolutionNote} · {row.resolvedBy}
                  </p>
                )}
                <small className="cash-reference">
                  {text('Transfer', 'رقم الحركة')}: {row.id}
                </small>
                <div className="cash-actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLedgerSafe({
                        id: row.sourceShiftId,
                        name: row.registerName,
                        kind: 'drawers',
                      });
                      setLedgerHistory([]);
                    }}
                  >
                    {text('Movement statement', 'كشف الحركة')}
                  </Button>
                  {row.status === 'pending' && (
                    <Button
                      disabled={busy || !!pending}
                      onClick={() => setDialog({ kind: 'receive', transfer: row })}
                    >
                      {text('Count & receive', 'عدّ واستلام التوريد')}
                    </Button>
                  )}
                  {row.status === 'discrepancy' && (
                    <Button
                      disabled={busy || !!pending}
                      onClick={() => setDialog({ kind: 'resolve', transfer: row })}
                    >
                      {text('Review difference', 'مراجعة الفرق')}
                    </Button>
                  )}
                </div>
              </DashboardCard>
            ))}
        </div>
      )}
      <footer className="cash-pagination">
        <Button
          variant="outline"
          disabled={!history.length || loading}
          onClick={() => setHistory((value) => value.slice(0, -1))}
        >
          {text('Previous', 'السابق')}
        </Button>
        <span>
          {text('Page', 'صفحة')} {formatNumber(history.length + 1)}
        </span>
        <Button
          variant="outline"
          disabled={!currentPage.nextCursor || loading}
          onClick={() => setHistory((value) => [...value, currentPage.nextCursor!])}
        >
          {text('Next', 'التالي')}
        </Button>
      </footer>
      {dialog && (
        <DashboardDialog
          className="cash-dialog"
          title={
            dialog.kind === 'safe'
              ? text('Create cash safe', 'إضافة خزنة')
              : dialog.kind === 'transfer'
                ? text('Hand cash to safe', 'تسليم النقدية للخزنة')
                : dialog.kind === 'receive'
                  ? text('Count & confirm receipt', 'عدّ وتأكيد الاستلام')
                  : dialog.kind === 'resolve'
                    ? text('Review receipt difference', 'مراجعة فرق الاستلام')
                    : text('Safe deposit / withdrawal', 'إيداع أو صرف من الخزنة')
          }
          closeLabel={text('Close', 'إغلاق')}
          busy={busy}
          onClose={() => setDialog(null)}
        >
          <form className="cash-form" onSubmit={submit}>
            <div className="cash-form-intro">
              <span aria-hidden="true">
                <Icon name={dialog.kind === 'safe' ? 'store' : 'receipt'} />
              </span>
              <p>
                {dialog.kind === 'safe'
                  ? text(
                      'Keep branch cash in a named safe, with a balance based on its actual cash count.',
                      'أضف خزنة للفرع عشان تتابع رصيدها والتوريدات المستلمة فيها.',
                    )
                  : dialog.kind === 'transfer'
                    ? text(
                        'Record a physical cash handoff. The safe balance updates after receipt is confirmed.',
                        'سجّل تسليم النقدية فعليًا. رصيد الخزنة بيتحدث بعد تأكيد الاستلام.',
                      )
                    : dialog.kind === 'receive'
                      ? text(
                          'Count the cash you received before confirming this handoff.',
                          'عدّ النقدية اللي استلمتها فعليًا قبل تأكيد الاستلام.',
                        )
                      : text(
                          'Every movement stays linked to its amount, time and responsible person.',
                          'كل حركة بتفضل مسجلة بمبلغها ووقتها والشخص المسؤول عنها.',
                        )}
              </p>
            </div>
            <fieldset disabled={busy || !!pending}>
              {dialog.kind === 'safe' && (
                <>
                  <div className="cash-field">
                    <span>{text('Branch', 'الفرع')}</span>
                    <PagedEntitySelect<InventoryBranch>
                      path="/owner/inventory/branches"
                      label={text('Branch', 'الفرع')}
                      value={safeBranch}
                      searchMode="combobox"
                      emptyLabel={text('Choose the safe’s branch', 'اختر فرع الخزنة')}
                      onSelect={(item) => setSafeBranch(item?.id ?? '')}
                    />
                  </div>
                  <label>
                    {text('Safe name', 'اسم الخزنة')}
                    <Input
                      name="name"
                      required
                      maxLength={80}
                      autoFocus
                      placeholder={text('e.g. Main branch safe', 'مثال: خزنة الفرع الرئيسي')}
                    />
                  </label>
                  <label className="cash-opening-field">
                    {text(
                      'Physically counted opening balance (EGP)',
                      'الرصيد الافتتاحي المعدود فعليًا (جنيه)',
                    )}
                    <Input
                      name="openingBalance"
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0.00"
                      dir="ltr"
                    />
                    <small>
                      {text(
                        'Enter the cash physically in this safe now. Previous transfers are not included automatically.',
                        'اكتب النقدية الموجودة في الخزنة دلوقتي بعد العدّ. التوريدات السابقة مش بتتضاف تلقائيًا.',
                      )}
                    </small>
                  </label>
                </>
              )}
              {dialog.kind === 'transfer' && (
                <>
                  <p>
                    {dialog.drawer.registerName} · {text('Remaining', 'المتبقي')}:{' '}
                    {money(dialog.drawer.remainingCash)}
                  </p>
                  <SafePicker branchId={dialog.drawer.branchId} />
                  <label>
                    {text('Amount (EGP)', 'المبلغ (جنيه)')}
                    <Input
                      name="amount"
                      type="number"
                      required
                      min="0.01"
                      max={dialog.drawer.remainingCash}
                      step="0.01"
                      defaultValue={dialog.drawer.remainingCash}
                    />
                  </label>
                  <label>
                    {text('Handoff / bag reference', 'مرجع التسليم / الكيس')}
                    <Input name="reference" required maxLength={80} />
                  </label>
                  <label>
                    {text('Reason', 'السبب')}
                    <Input name="reason" required maxLength={500} />
                  </label>
                  <p>
                    {text(
                      'Only record cash that has physically left custody. A different person confirms safe receipt.',
                      'سجّل المبلغ اللي اتسلّم فعلًا وخرج من العهدة. شخص تاني بيؤكد استلامه في الخزنة.',
                    )}
                  </p>
                </>
              )}
              {dialog.kind === 'receive' && (
                <>
                  <p>
                    {text('Declared handoff', 'المبلغ المسلّم')}: {money(dialog.transfer.amount)}
                  </p>
                  <label>
                    {text('Physically received (EGP)', 'المبلغ المستلم فعليًا (جنيه)')}
                    <Input name="receivedAmount" required type="number" min="0" step="0.01" />
                  </label>
                  <label>
                    {text(
                      'Receipt note (required for a difference)',
                      'ملاحظة الاستلام (إلزامية لو فيه فرق)',
                    )}
                    <Input name="note" maxLength={500} />
                  </label>
                </>
              )}
              {dialog.kind === 'resolve' && (
                <>
                  <p>
                    {text(
                      'This records your review. It preserves the original amounts and does not add cash to the safe. Record any recovered cash as a separate deposit.',
                      'المراجعة بتحفظ المبالغ الأصلية ومش بتزوّد رصيد الخزنة. لو الفرق اتسدّد، سجّله كإيداع مستقل بمرجع الحركة.',
                    )}
                  </p>
                  <label>
                    {text('Resolution / responsibility', 'نتيجة المراجعة والمسؤول عن الفرق')}
                    <Input name="note" required maxLength={500} />
                  </label>
                </>
              )}
              {dialog.kind === 'movement' && (
                <>
                  <p>
                    {dialog.safe.name} · {money(dialog.safe.balance)}
                  </p>
                  <div className="cash-field">
                    <span>{text('Movement type', 'نوع الحركة')}</span>
                    <DashboardSelect
                      name="kind"
                      label={text('Movement type', 'نوع الحركة')}
                      value={movementKind}
                      onChange={setMovementKind}
                      options={[
                        { value: 'deposit', label: text('Deposit', 'إيداع') },
                        { value: 'withdrawal', label: text('Withdrawal', 'صرف') },
                      ]}
                    />
                  </div>
                  <label>
                    {text('Amount (EGP)', 'المبلغ (جنيه)')}
                    <Input name="amount" required type="number" min="0.01" step="0.01" />
                  </label>
                  <label>
                    {text('Reason / document reference', 'السبب / مرجع المستند')}
                    <Input name="reason" required maxLength={500} />
                  </label>
                </>
              )}
              <div className="cash-form-footer">
                <Button type="submit" disabled={dialog.kind === 'safe' && !safeBranch}>
                  {busy
                    ? text('Saving…', 'جارٍ الحفظ…')
                    : dialog.kind === 'safe'
                      ? text('Create safe', 'إضافة خزنة')
                      : text('Confirm', 'تأكيد')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                  {text('Cancel', 'إلغاء')}
                </Button>
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="cash-alert">
                {error}
              </p>
            )}
            {pending && !busy && (
              <Button type="button" onClick={() => void send(pending)}>
                {text('Retry saved request', 'إعادة إرسال الطلب المحفوظ')}
              </Button>
            )}
          </form>
        </DashboardDialog>
      )}
      {ledgerSafe && (
        <DashboardDialog
          wide
          title={`${text('Movement statement', 'كشف الحركة')} · ${ledgerSafe.name}`}
          closeLabel={text('Close', 'إغلاق')}
          onClose={() => setLedgerSafe(null)}
        >
          <div className="cash-ledger">
            <table>
              <thead>
                <tr>
                  {[
                    text('Time', 'الوقت'),
                    text('Movement', 'الحركة'),
                    text('Amount', 'المبلغ'),
                    text('Balance after', 'الرصيد بعدها'),
                    text('Actor / reason', 'المسؤول / السبب'),
                  ].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.createdAt, true)}</td>
                    <td>
                      {{
                        opening: text('Opening count', 'جرد افتتاحي'),
                        cash_sale: text('Cash sale', 'بيع نقدي'),
                        cash_refund: text('Cash refund', 'مرتجع نقدي'),
                        cash_in: text('Cash added', 'إضافة نقدية'),
                        cash_out: text('Cash paid out', 'مصروف نقدي'),
                        cash_drop: text('Cash handed to safe', 'توريد أثناء الشيفت'),
                        delivery_receipt: text('Courier cash received', 'استلام كاش طيار'),
                        count_variance: text('Count variance', 'فرق الجرد'),
                        safe_transfer: text('Post-close transfer', 'توريد بعد التقفيل'),
                        carryover: text('Next-shift float', 'فكة للشيفت التالي'),
                        receipt: text('Transfer receipt', 'استلام توريد'),
                        deposit: text('Deposit', 'إيداع'),
                        withdrawal: text('Withdrawal', 'صرف'),
                      }[row.kind] ?? row.kind}
                    </td>
                    <td>{money(row.amount)}</td>
                    <td>{money(row.balanceAfter)}</td>
                    <td>
                      {row.createdBy}
                      <br />
                      {row.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="cash-pagination">
              <Button
                variant="outline"
                disabled={!ledgerHistory.length}
                onClick={() => setLedgerHistory((value) => value.slice(0, -1))}
              >
                {text('Previous', 'السابق')}
              </Button>
              <Button
                variant="outline"
                disabled={!ledger.nextCursor}
                onClick={() => setLedgerHistory((value) => [...value, ledger.nextCursor!])}
              >
                {text('Next', 'التالي')}
              </Button>
            </div>
          </div>
        </DashboardDialog>
      )}
    </div>
  );
}

function SafePicker({ branchId }: { branchId: string }) {
  const { locale } = useLocale();
  const [page, setPage] = useState<CursorPage<CashSafeSummary>>(emptyPage);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [value, setValue] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const q = new URLSearchParams({ branchId, limit: '50' });
    if (cursor) q.set('cursor', cursor);
    void apiRequestPage<CashSafeSummary>(`/owner/pos/cash/safes?${q}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setPage(result);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [branchId, cursor]);
  return (
    <div className="cash-field">
      <span>{locale === 'ar' ? 'الخزنة المستلمة' : 'Receiving safe'}</span>
      <DashboardSelect
        name="safeId"
        required
        label={locale === 'ar' ? 'الخزنة المستلمة' : 'Receiving safe'}
        placeholder={locale === 'ar' ? 'اختر الخزنة المستلمة' : 'Choose the receiving safe'}
        value={value}
        onChange={setValue}
        options={page.items.map((safe) => ({ value: safe.id, label: safe.name }))}
      />
      {failed && (
        <span role="alert">
          {locale === 'ar'
            ? 'تعذر تحميل الخزن. اقفل النافذة وأعد المحاولة.'
            : 'Could not load safes. Close and retry.'}
        </span>
      )}
      {!failed && !page.items.length && (
        <small>
          {locale === 'ar' ? 'أضف خزنة في نفس الفرع أولًا.' : 'Create a safe in this branch first.'}
        </small>
      )}
      <span>
        {cursor && (
          <button
            type="button"
            onClick={() => {
              setCursor(null);
              setValue('');
            }}
          >
            {locale === 'ar' ? 'أول صفحة' : 'First page'}
          </button>
        )}
        {page.nextCursor && (
          <button
            type="button"
            onClick={() => {
              setCursor(page.nextCursor);
              setValue('');
            }}
          >
            {locale === 'ar' ? 'خزن أخرى' : 'More safes'}
          </button>
        )}
      </span>
    </div>
  );
}
