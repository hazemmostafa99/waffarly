import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
import { Button, DataTable, Input, useLocale, type DataTableColumn } from '@waffarly/ui';
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
type Detail =
  | { kind: 'drawer'; row: CashDrawerSummary }
  | { kind: 'safe'; row: CashSafeSummary }
  | { kind: 'transfer'; row: CashTransferSummary };
type Fact = [string, string];
// Money arrives as decimal strings; use minor units for review calculations.
const cents = (value: string) => {
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  return (
    (value.startsWith('-') ? -1n : 1n) * (BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0')))
  );
};
const decimal = (value: bigint) =>
  `${value < 0n ? '-' : ''}${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, '0')}`;
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
  const [detail, setDetail] = useState<Detail | null>(null);
  const [review, setReview] = useState<{ command: SavedCommand; facts: Fact[] } | null>(null);
  const [safeBranch, setSafeBranch] = useState('');
  const [movementKind, setMovementKind] = useState('deposit');
  const [receivedCount, setReceivedCount] = useState('');
  const [ledgerSafe, setLedgerSafe] = useState<{
    id: string;
    name: string;
    kind: 'safes' | 'drawers';
  } | null>(null);
  const [ledger, setLedger] = useState<CursorPage<CashSafeMovementSummary>>(emptyPage);
  const [ledgerHistory, setLedgerHistory] = useState<string[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
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
    setLedgerLoading(true);
    setLedgerError('');
    void apiRequestPage<CashSafeMovementSummary>(
      `/owner/pos/cash/${ledgerSafe.kind}/${ledgerSafe.id}/movements?${q}`,
      { signal: controller.signal },
    )
      .then(setLedger)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setLedgerError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load ledger.', 'تعذر تحميل كشف الحركة.'),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLedgerLoading(false);
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
      setReview(null);
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
    if (!dialog || pending || review) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<
      string,
      string
    >;
    for (const key of ['amount', 'receivedAmount', 'openingBalance']) {
      if (fields[key] !== undefined && !/^\d+(\.\d{1,2})?$/.test(fields[key]!)) {
        setError(
          text(
            'Enter a valid amount with up to two decimal places.',
            'اكتب مبلغًا صحيحًا بحد أقصى رقمين بعد العلامة العشرية.',
          ),
        );
        return;
      }
    }
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
    if (dialog.kind === 'safe') {
      void send({ path, body: fields });
      return;
    }
    const facts: Fact[] = [];
    if (dialog.kind === 'movement') {
      facts.push(
        [text('Safe', 'الخزنة'), dialog.safe.name],
        [text('Branch', 'الفرع'), dialog.safe.branchName],
        [
          text('Movement', 'الحركة'),
          movementKind === 'deposit' ? text('Deposit', 'إيداع') : text('Withdrawal', 'صرف'),
        ],
        [text('Current balance', 'الرصيد الحالي'), money(dialog.safe.balance)],
        [text('Amount', 'المبلغ'), money(fields.amount!)],
        [
          text('Expected balance after', 'الرصيد المتوقع بعد العملية'),
          money(
            decimal(
              cents(dialog.safe.balance) +
                (movementKind === 'deposit' ? 1n : -1n) * cents(fields.amount!),
            ),
          ),
        ],
      );
    } else if (dialog.kind === 'transfer') {
      const selectedSafe = event.currentTarget.querySelector('[name="safeId"]');
      facts.push(
        [text('Drawer', 'الدرج'), dialog.drawer.registerName],
        [text('Cashier', 'الكاشير'), dialog.drawer.cashierName],
        [
          text('Receiving safe', 'الخزنة المستلمة'),
          (
            selectedSafe
              ?.closest('.cash-field')
              ?.querySelector('[role="combobox"]') as HTMLInputElement | null
          )?.value ?? fields.safeId!,
        ],
        [text('Amount', 'المبلغ'), money(fields.amount!)],
        [
          text('Remaining after handoff', 'المتبقي بعد التسليم'),
          money(decimal(cents(dialog.drawer.remainingCash) - cents(fields.amount!))),
        ],
        [text('Reference', 'المرجع'), fields.reference!],
      );
    } else {
      facts.push(
        [text('Reference', 'المرجع'), dialog.transfer.reference],
        [text('Destination', 'الوجهة'), dialog.transfer.destinationName],
        [text('Declared handoff', 'المبلغ المسلّم'), money(dialog.transfer.amount)],
      );
      if (dialog.kind === 'receive') {
        const difference = cents(fields.receivedAmount!) - cents(dialog.transfer.amount);
        if (difference !== 0n && !fields.note?.trim()) {
          setError(
            text('Add a receipt note explaining the difference.', 'اكتب ملاحظة توضح فرق الاستلام.'),
          );
          return;
        }
        facts.push(
          [text('Actually received', 'المستلم فعليًا'), money(fields.receivedAmount!)],
          [text('Receipt difference', 'فرق الاستلام'), money(decimal(difference))],
        );
      } else {
        facts.push([
          text('Receipt difference', 'فرق الاستلام'),
          money(dialog.transfer.difference ?? '0.00'),
        ]);
      }
    }
    facts.push([text('Reason / note', 'السبب / الملاحظة'), fields.reason || fields.note || '—']);
    setError('');
    setReview({ command: { path, body: fields }, facts });
  }
  const currentPage = tab === 'drawers' ? drawers : tab === 'transfers' ? transfers : safes;
  const statusLabel = (value: string) =>
    ({
      pending: text('Awaiting receipt', 'بانتظار الاستلام'),
      received: text('Received', 'تم الاستلام'),
      discrepancy: text('Receipt difference', 'فرق استلام'),
      resolved: text('Difference reviewed', 'تمت مراجعة الفرق'),
    })[value] ?? value;

  function openAction(value: Dialog) {
    setDetail(null);
    setReview(null);
    setError('');
    setMovementKind('deposit');
    setReceivedCount('');
    setDialog(value);
  }
  function closeAction() {
    if (busy) return;
    setDialog(null);
    setReview(null);
    setError('');
  }
  function openLedger(id: string, name: string, kind: 'drawers' | 'safes') {
    setDetail(null);
    setLedgerHistory([]);
    setLedgerSafe({ id, name, kind });
  }
  function detailTitle(value: Detail) {
    return value.kind === 'drawer'
      ? value.row.registerName
      : value.kind === 'safe'
        ? value.row.name
        : value.row.reference;
  }
  function detailFacts(value: Detail): Fact[] {
    const row = value.row;
    if (value.kind === 'drawer') {
      const d = value.row;
      return [
        [text('Branch', 'الفرع'), d.branchName],
        [text('Cashier', 'الكاشير'), d.cashierName],
        [
          text('Shift status', 'حالة الشيفت'),
          d.status === 'closed'
            ? text('Closed shift', 'شيفت مقفول')
            : text('Open shift', 'شيفت مفتوح'),
        ],
        [text('Opened at', 'وقت الفتح'), formatDate(d.openedAt, true)],
        [text('Closed at', 'وقت التقفيل'), d.closedAt ? formatDate(d.closedAt, true) : '—'],
        [text('Expected at close', 'الرصيد المتوقع'), money(d.expectedCash)],
        [
          text('Counted at close', 'المعدود وقت التقفيل'),
          d.countedCash === null ? '—' : money(d.countedCash),
        ],
        [text('Count variance', 'فرق الجرد'), d.variance === null ? '—' : money(d.variance)],
        [text('Remaining custody', 'المتبقي بالعهدة'), money(d.remainingCash)],
        [text('Awaiting safe receipt', 'بانتظار استلام الخزنة'), money(d.pendingAmount)],
        [text('Received in safe', 'المستلم في الخزنة'), money(d.receivedInSafe)],
        [text('Received by next shift', 'المستلم للشيفت التالي'), money(d.carriedForward)],
        [
          text('Earlier unverified cash drops', 'توريدات سابقة بدون تأكيد استلام'),
          money(d.legacyDropAmount),
        ],
        [text('Shift ID', 'رقم الشيفت'), d.id],
      ];
    }
    if (value.kind === 'safe') {
      const d = value.row;
      return [
        [text('Branch', 'الفرع'), d.branchName],
        [text('Confirmed safe balance', 'رصيد الخزنة المؤكد'), money(d.balance)],
        [text('Awaiting receipt', 'توريدات بانتظار الاستلام'), money(d.pendingAmount)],
        [text('Safe ID', 'رقم الخزنة'), row.id],
      ];
    }
    const d = value.row;
    return [
      [text('Source drawer', 'الدرج المصدر'), d.registerName],
      [text('Destination', 'الوجهة'), d.destinationName],
      [
        text('Movement', 'الحركة'),
        d.kind === 'safe'
          ? text('Safe handoff', 'توريد للخزنة')
          : text('Shift carryover', 'فكة للشيفت التالي'),
      ],
      [text('Receipt status', 'حالة الاستلام'), statusLabel(d.status)],
      [text('Declared handoff', 'المبلغ المسلّم'), money(d.amount)],
      [
        text('Actually received', 'المستلم فعليًا'),
        d.receivedAmount === null ? '—' : money(d.receivedAmount),
      ],
      [
        text('Receipt difference', 'فرق الاستلام'),
        d.difference === null ? '—' : money(d.difference),
      ],
      [text('Handed by', 'سجّل التسليم'), d.createdByName ?? d.createdBy],
      [text('Handed at', 'وقت التسليم'), formatDate(d.createdAt, true)],
      [text('Received by', 'المستلم'), d.receivedByName ?? d.receivedBy ?? '—'],
      [text('Received at', 'وقت الاستلام'), d.receivedAt ? formatDate(d.receivedAt, true) : '—'],
      [text('Reason', 'السبب'), d.reason],
      [text('Receipt note', 'ملاحظة الاستلام'), d.receiptNote ?? '—'],
      [text('Review result', 'نتيجة المراجعة'), d.resolutionNote ?? '—'],
      [text('Reviewed by', 'تمت المراجعة بواسطة'), d.resolvedBy ?? '—'],
      [text('Transfer ID', 'رقم الحركة'), d.id],
    ];
  }
  function primaryAction(value: Detail) {
    if (value.kind === 'drawer')
      return value.row.status === 'closed' && cents(value.row.remainingCash) > 0n ? (
        <Button
          disabled={busy || !!pending}
          onClick={() => openAction({ kind: 'transfer', drawer: value.row })}
        >
          {text('Transfer to safe', 'توريد للخزنة')}
        </Button>
      ) : null;
    if (value.kind === 'safe')
      return (
        <Button
          disabled={busy || !!pending}
          onClick={() => openAction({ kind: 'movement', safe: value.row })}
        >
          {text('Deposit / withdrawal', 'إيداع / صرف')}
        </Button>
      );
    const kind =
      value.row.status === 'pending'
        ? 'receive'
        : value.row.status === 'discrepancy'
          ? 'resolve'
          : null;
    return (
      kind && (
        <Button
          disabled={busy || !!pending}
          onClick={() => openAction({ kind, transfer: value.row })}
        >
          {kind === 'receive'
            ? text('Count & receive', 'عدّ واستلام التوريد')
            : text('Review difference', 'مراجعة الفرق')}
        </Button>
      )
    );
  }
  function secondaryActions(value: Detail) {
    return (
      <>
        <Button
          variant="outline"
          onClick={() =>
            openLedger(
              value.kind === 'transfer' ? value.row.sourceShiftId : value.row.id,
              value.kind === 'safe' ? value.row.name : value.row.registerName,
              value.kind === 'safe' ? 'safes' : 'drawers',
            )
          }
        >
          <Icon name="file" />
          {text('Movement statement', 'كشف الحركة')}
        </Button>
        {value.kind === 'drawer' && (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDetail(null);
                setTab('transfers');
                setHistory([]);
                setStatus('');
                setBranch(value.row.branchId);
              }}
            >
              <Icon name="branches" />
              {text('View branch transfers', 'عرض توريدات الفرع')}
            </Button>
            <Link to="/pos-shift-reports">
              <Icon name="receipt" />
              {text('Shift reports', 'تقارير الشيفتات')}
            </Link>
          </>
        )}
      </>
    );
  }
  function rowActions(value: Detail) {
    return (
      <div className="cash-table-actions">
        <Button variant="outline" onClick={() => setDetail(value)}>
          {text('Details', 'التفاصيل')}
        </Button>
        {primaryAction(value)}
        <CashActionMenu label={text('More actions', 'إجراءات إضافية')} context={detailTitle(value)}>
          {secondaryActions(value)}
        </CashActionMenu>
      </div>
    );
  }
  const drawerColumns: DataTableColumn<CashDrawerSummary>[] = [
    {
      id: 'register',
      header: text('Drawer / cashier', 'الدرج / الكاشير'),
      cell: (r) => (
        <>
          <strong>{r.registerName}</strong>
          <small className="cash-cell-note">{r.cashierName}</small>
        </>
      ),
    },
    { id: 'branch', header: text('Branch', 'الفرع'), cell: (r) => r.branchName },
    {
      id: 'status',
      header: text('Shift status', 'حالة الشيفت'),
      cell: (r) => (
        <>
          <span className={`cash-status ${r.status === 'closed' ? '' : 'pending'}`}>
            {r.status === 'closed'
              ? text('Closed shift', 'شيفت مقفول')
              : text('Open shift', 'شيفت مفتوح')}
          </span>
          <small className="cash-cell-note">{formatDate(r.closedAt ?? r.openedAt, true)}</small>
        </>
      ),
    },
    {
      id: 'expected',
      header: text('Expected balance', 'الرصيد المتوقع'),
      cell: (r) => money(r.expectedCash),
    },
    {
      id: 'remaining',
      header: text('Remaining custody', 'المتبقي بالعهدة'),
      cell: (r) => <strong>{money(r.remainingCash)}</strong>,
    },
    {
      id: 'pending',
      header: text('Awaiting receipt', 'توريدات بانتظار الاستلام'),
      cell: (r) => money(r.pendingAmount),
    },
    {
      id: 'actions',
      header: text('Actions', 'الإجراءات'),
      cell: (r) => rowActions({ kind: 'drawer', row: r }),
    },
  ];
  const transferColumns: DataTableColumn<CashTransferSummary>[] = [
    {
      id: 'reference',
      header: text('Reference / route', 'المرجع / المسار'),
      cell: (r) => (
        <>
          <strong>{r.reference}</strong>
          <small className="cash-cell-note">
            {r.registerName} → {r.destinationName}
          </small>
        </>
      ),
    },
    { id: 'amount', header: text('Handed over', 'المسلّم'), cell: (r) => money(r.amount) },
    {
      id: 'received',
      header: text('Actually received', 'المستلم فعليًا'),
      cell: (r) => (r.receivedAmount === null ? '—' : money(r.receivedAmount)),
    },
    {
      id: 'difference',
      header: text('Receipt difference', 'فرق الاستلام'),
      cell: (r) => (
        <span
          className={
            r.difference && cents(r.difference.replace('-', '')) !== 0n ? 'cash-difference' : ''
          }
        >
          {r.difference === null ? '—' : money(r.difference)}
        </span>
      ),
    },
    {
      id: 'status',
      header: text('Receipt status', 'حالة الاستلام'),
      cell: (r) => <span className={`cash-status ${r.status}`}>{statusLabel(r.status)}</span>,
    },
    { id: 'date', header: text('Time', 'الوقت'), cell: (r) => formatDate(r.createdAt, true) },
    {
      id: 'actions',
      header: text('Actions', 'الإجراءات'),
      cell: (r) => rowActions({ kind: 'transfer', row: r }),
    },
  ];
  const safeColumns: DataTableColumn<CashSafeSummary>[] = [
    { id: 'name', header: text('Safe', 'الخزنة'), cell: (r) => <strong>{r.name}</strong> },
    { id: 'branch', header: text('Branch', 'الفرع'), cell: (r) => r.branchName },
    {
      id: 'balance',
      header: text('Confirmed safe balance', 'رصيد الخزنة المؤكد'),
      cell: (r) => <strong>{money(r.balance)}</strong>,
    },
    {
      id: 'pending',
      header: text('Awaiting receipt', 'توريدات بانتظار الاستلام'),
      cell: (r) => money(r.pendingAmount),
    },
    {
      id: 'actions',
      header: text('Actions', 'الإجراءات'),
      cell: (r) => rowActions({ kind: 'safe', row: r }),
    },
  ];

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
            openAction({ kind: 'safe' });
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
        <>
          {tab === 'drawers' && (
            <DataTable
              columns={drawerColumns}
              rows={drawers.items}
              rowKey={(row) => row.id}
              caption={text('Drawers & custody', 'الأدراج والعهد')}
              emptyState="?"
            />
          )}
          {tab === 'transfers' && (
            <DataTable
              columns={transferColumns}
              rows={transfers.items}
              rowKey={(row) => row.id}
              caption={text('Transfers & receipts', 'التوريدات والاستلام')}
              emptyState="?"
            />
          )}
          {tab === 'safes' && (
            <DataTable
              columns={safeColumns}
              rows={safes.items}
              rowKey={(row) => row.id}
              caption={text('Safes', 'الخزن')}
              emptyState="?"
            />
          )}
        </>
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
      {detail && (
        <DashboardDialog
          wide
          className="cash-dialog"
          title={`${text('Details', 'التفاصيل')} ? ${detailTitle(detail)}`}
          closeLabel={text('Close', 'إغلاق')}
          onClose={() => setDetail(null)}
        >
          <div className="cash-detail-body">
            <CashFacts facts={detailFacts(detail)} />
            <div className="cash-detail-actions">
              {primaryAction(detail)}
              {secondaryActions(detail)}
            </div>
          </div>
        </DashboardDialog>
      )}
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
          onClose={closeAction}
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
            <fieldset disabled={busy || !!pending} hidden={!!review}>
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
                    <Input
                      name="receivedAmount"
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={receivedCount}
                      onChange={(event) => setReceivedCount(event.target.value)}
                    />
                  </label>
                  {/^[0-9]+(\.[0-9]{1,2})?$/.test(receivedCount) && (
                    <p role="status" className="cash-difference">
                      {text('Receipt difference', 'فرق الاستلام')}:{' '}
                      {money(decimal(cents(receivedCount) - cents(dialog.transfer.amount)))}
                    </p>
                  )}
                  <label>
                    {text(
                      'Receipt note (required for a difference)',
                      'ملاحظة الاستلام (إلزامية لو فيه فرق)',
                    )}
                    <Input
                      name="note"
                      maxLength={500}
                      required={
                        /^[0-9]+(\.[0-9]{1,2})?$/.test(receivedCount) &&
                        cents(receivedCount) !== cents(dialog.transfer.amount)
                      }
                    />
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
                    <Input
                      name="amount"
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={movementKind === 'withdrawal' ? dialog.safe.balance : undefined}
                    />
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
                      : text('Review operation', 'مراجعة العملية')}
                </Button>
                <Button type="button" variant="outline" onClick={closeAction}>
                  {text('Cancel', 'إلغاء')}
                </Button>
              </div>
            </fieldset>
            {review && (
              <section
                className="cash-review"
                aria-label={text('Review operation', 'مراجعة العملية')}
              >
                <h3>{text('Review before confirming', 'راجع البيانات قبل التأكيد')}</h3>
                <CashFacts facts={review.facts} />
                <p className="cash-notice">
                  {dialog.kind === 'transfer'
                    ? text(
                        'The safe balance increases only after receipt is confirmed.',
                        'رصيد الخزنة بيزيد بعد تأكيد الاستلام فقط.',
                      )
                    : dialog.kind === 'resolve'
                      ? text(
                          'Reviewing a difference does not change the safe balance.',
                          'مراجعة الفرق لا تغيّر رصيد الخزنة.',
                        )
                      : text(
                          'Confirm to record this cash movement.',
                          'بالتأكيد هتتسجل الحركة بالمبالغ الموضحة.',
                        )}
                </p>
                <div className="cash-form-footer">
                  <Button
                    type="button"
                    autoFocus
                    disabled={busy || !!pending}
                    onClick={() => void send(review.command)}
                  >
                    {busy ? text('Saving…', 'جارٍ الحفظ…') : text('Confirm', 'تأكيد')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !!pending}
                    onClick={() => {
                      setReview(null);
                      setError('');
                    }}
                  >
                    {text('Back to edit', 'رجوع للتعديل')}
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={closeAction}>
                    {text('Cancel', 'إلغاء')}
                  </Button>
                </div>
              </section>
            )}
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
            {ledgerLoading && (
              <p role="status">{text('Loading movements…', 'جارٍ تحميل الحركات…')}</p>
            )}
            {ledgerError && (
              <div role="alert">
                <p>{ledgerError}</p>
                <Button onClick={() => setRefresh((v) => v + 1)}>
                  {text('Retry', 'إعادة المحاولة')}
                </Button>
              </div>
            )}
            {!ledgerLoading && !ledgerError && !ledger.items.length && (
              <p role="status">{text('No movements yet.', 'لا توجد حركات حتى الآن.')}</p>
            )}
            <table hidden={ledgerLoading || !!ledgerError || !ledger.items.length}>
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
                disabled={ledgerLoading || !ledgerHistory.length}
                onClick={() => setLedgerHistory((value) => value.slice(0, -1))}
              >
                {text('Previous', 'السابق')}
              </Button>
              <Button
                variant="outline"
                disabled={ledgerLoading || !ledger.nextCursor}
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

function CashFacts({ facts }: { facts: Fact[] }) {
  return (
    <dl className="cash-detail-facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CashActionMenu({
  label,
  context,
  children,
}: {
  label: string;
  context: string;
  children: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => panel.current?.hidePopover();
    // Keep the popup attached to the row by dismissing when its scroll position changes.
    const dismissOnScroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      dismiss();
    };
    window.addEventListener('resize', dismiss);
    document.addEventListener('scroll', dismissOnScroll, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('scroll', dismissOnScroll, true);
    };
  }, [open]);

  return (
    <>
      <Button
        variant="outline"
        className="cash-more-trigger"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
        onClick={(event) => {
          event.preventDefault();
          const popup = panel.current;
          if (!popup) return;
          if (popup.matches(':popover-open')) {
            popup.hidePopover();
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          const width = Math.min(240, window.innerWidth - 24);
          const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
          popup.style.width = `${width}px`;
          popup.style.left = `${Math.max(12, Math.min(rtl ? rect.left : rect.right - width, window.innerWidth - width - 12))}px`;
          // Measure the contents before showing, including the heading and all action rows.
          popup.style.top = `${rect.bottom + 8}px`;
          popup.style.visibility = 'hidden';
          popup.showPopover();
          const height = popup.getBoundingClientRect().height;
          popup.style.top = `${Math.max(12, rect.bottom + height + 20 <= window.innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`;
          popup.style.visibility = '';
          popup.querySelector<HTMLElement>('button, a')?.focus({ preventScroll: true });
        }}
      >
        <Icon name="more" />
      </Button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        role="dialog"
        aria-label={label}
        className="cash-action-popover"
        onToggle={(event) => setOpen(event.currentTarget.matches(':popover-open'))}
      >
        <div className="cash-action-popover-heading">{context}</div>
        <div className="cash-action-popover-items" onClick={() => panel.current?.hidePopover()}>
          {children}
        </div>
      </div>
    </>
  );
}
