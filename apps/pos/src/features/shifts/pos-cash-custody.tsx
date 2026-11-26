import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  CashDrawerSummary,
  CashTransferSummary,
  CursorPage,
  PosEmployeeSession,
} from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import { apiRequest, ApiError } from '../../lib/api-client.js';
import { PosButton } from '../../components/pos-button.js';

type SafeOption = { id: string; branchId: string; name: string };
type Command = { path: string; body: Record<string, string> };
// Matches the shift screen's other labels: small muted label above a 40px control.
const fieldClass = 'grid gap-1.5 text-xs font-medium text-muted-foreground';
const selectClass =
  'min-h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground';

export function PosSafeSelect({
  employee,
  branchId,
  value,
  onChange,
  disabled = false,
}: {
  employee: PosEmployeeSession;
  branchId: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const { locale } = useLocale();
  const [cursor, setCursor] = useState<string | null>(null);
  const safes = useQuery({
    queryKey: ['pos', employee.merchantId, employee.id, 'cash-safes', branchId, cursor],
    queryFn: ({ signal }) =>
      apiRequest<CursorPage<SafeOption>>(
        `/pos/cash/safes?${new URLSearchParams({ branchId, limit: '50', ...(cursor ? { cursor } : {}) })}`,
        { signal },
      ),
    enabled: !!branchId,
  });
  return (
    <label className={fieldClass}>
      {locale === 'ar' ? 'الخزنة المستلمة' : 'Receiving safe'}
      <select
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        disabled={disabled || safes.isLoading || safes.isError}
      >
        <option value="">{locale === 'ar' ? 'اختر خزنة' : 'Select safe'}</option>
        {safes.data?.items.map((safe) => (
          <option key={safe.id} value={safe.id}>
            {safe.name}
          </option>
        ))}
      </select>
      {safes.isError ? (
        <span role="alert">
          {locale === 'ar' ? 'تعذر تحميل الخزن.' : 'Could not load safes.'}
          <button type="button" onClick={() => void safes.refetch()}>
            {locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </span>
      ) : safes.isSuccess && !safes.data.items.length ? (
        <small className="text-warning">
          {locale === 'ar'
            ? 'مفيش خزنة في الفرع ده. اطلب من المالك يضيف خزنة الأول.'
            : 'Ask the owner to create a safe for this branch.'}
        </small>
      ) : null}
      <span className="empty:hidden">
        {cursor && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCursor(null);
              onChange('');
            }}
          >
            {locale === 'ar' ? 'أول صفحة' : 'First page'}
          </button>
        )}
        {safes.data?.nextCursor && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCursor(safes.data!.nextCursor);
              onChange('');
            }}
          >
            {locale === 'ar' ? 'خزن أخرى' : 'More safes'}
          </button>
        )}
      </span>
    </label>
  );
}

export function PosCashCustody({
  employee,
  branchId,
  registerId,
}: {
  employee: PosEmployeeSession;
  branchId: string;
  registerId: string;
}) {
  const { locale, formatNumber, formatDate, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const money = (value: string) =>
    formatNumber(Number(value), { style: 'currency', currency: 'EGP' });
  const client = useQueryClient();
  const storageKey = `waffarly:cash:pos:${employee.merchantId}:${employee.id}`;
  const [pending, setPending] = useState<Command | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Command | null;
    } catch {
      return null;
    }
  });
  const [cursor, setCursor] = useState<string | null>(null);
  const [receiptCursor, setReceiptCursor] = useState<string | null>(null);
  const [ownCursor, setOwnCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<CashDrawerSummary | null>(null);
  const [receiving, setReceiving] = useState<CashTransferSummary | null>(null);
  const [safeId, setSafeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canReceive = employee.permissions.includes('manage_cash_movements');
  const ownTransfers = useQuery({
    queryKey: [
      'pos',
      employee.merchantId,
      employee.id,
      'cash-own-transfers',
      branchId,
      registerId,
      ownCursor,
    ],
    queryFn: ({ signal }) =>
      apiRequest<CursorPage<CashTransferSummary>>(
        `/pos/cash/my-transfers?${new URLSearchParams({ branchId, registerId, limit: '10', ...(ownCursor ? { cursor: ownCursor } : {}) })}`,
        { signal },
      ),
    refetchInterval: 15000,
  });
  const drawers = useQuery({
    queryKey: [
      'pos',
      employee.merchantId,
      employee.id,
      'cash-custody',
      branchId,
      registerId,
      cursor,
    ],
    queryFn: ({ signal }) =>
      apiRequest<CursorPage<CashDrawerSummary>>(
        `/pos/cash/drawers?${new URLSearchParams({ branchId, registerId, limit: '10', ...(cursor ? { cursor } : {}) })}`,
        { signal },
      ),
    refetchInterval: 15000,
  });
  const receipts = useQuery({
    queryKey: ['pos', employee.merchantId, employee.id, 'cash-receipts', branchId, receiptCursor],
    queryFn: ({ signal }) =>
      apiRequest<CursorPage<CashTransferSummary>>(
        `/pos/cash/transfers?${new URLSearchParams({ branchId, status: 'pending', limit: '10', ...(receiptCursor ? { cursor: receiptCursor } : {}) })}`,
        { signal },
      ),
    enabled: canReceive,
    refetchInterval: canReceive ? 15000 : false,
  });
  async function send(command: Command) {
    setBusy(true);
    setError('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(command));
      setPending(command);
      await apiRequest(command.path, { method: 'POST', body: JSON.stringify(command.body) });
      localStorage.removeItem(storageKey);
      setPending(null);
      setSelected(null);
      setReceiving(null);
      setSafeId('');
      await client.invalidateQueries({ queryKey: ['pos', employee.merchantId] });
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode >= 400 && cause.statusCode < 500) {
        localStorage.removeItem(storageKey);
        setPending(null);
      }
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save cash handoff.', 'تعذر حفظ تسليم النقدية.'),
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<
      string,
      string
    >;
    body.requestId = crypto.randomUUID();
    if (selected) {
      body.safeId = safeId;
      void send({ path: `/pos/cash/shifts/${selected.id}/transfers`, body });
    } else if (receiving)
      void send({ path: `/pos/cash/transfers/${receiving.id}/receive?branchId=${branchId}`, body });
  }
  return (
    <section
      aria-label={text('Cash custody after shift close', 'عهدة النقدية بعد تقفيل الشيفت')}
      className="grid gap-3 rounded-lg border border-border bg-card p-3 text-sm sm:p-4"
    >
      <div>
        <h3 className="m-0 text-sm font-semibold">
          {text('Cash custody after shift close', 'فلوس الورديات المقفولة')}
        </h3>
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          {text(
            'Closing a shift does not hand over its cash. Remaining cash stays in custody until a recorded handoff.',
            'قفل الوردية مش معناه إن الفلوس اتسلّمت. الفلوس بتفضل عهدة عليك لحد ما تورّدها للخزنة من هنا.',
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {pending && (
        <div className="rounded-lg border border-warning p-3">
          <p>
            {text(
              'A saved cash handoff needs confirmation. Retry before recording another.',
              'فيه توريد محفوظ لسه ما اتأكدش. ابعته تاني قبل أي حاجة جديدة.',
            )}
          </p>
          <PosButton disabled={busy} onClick={() => void send(pending)}>
            {text('Retry saved request', 'إعادة إرسال الطلب المحفوظ')}
          </PosButton>
        </div>
      )}
      {drawers.isLoading ? (
        <p role="status">{text('Loading custody…', 'جارٍ تحميل العهد…')}</p>
      ) : drawers.isError ? (
        <p role="alert">
          {text('Could not load custody.', 'تعذر تحميل العهد.')}
          <button onClick={() => void drawers.refetch()}>{text('Retry', 'إعادة المحاولة')}</button>
        </p>
      ) : (
        <>
          <div className="grid gap-3">
            {drawers.data?.items.map((row) => (
              <div key={row.id} className="grid gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-sm">{row.registerName}</strong>
                  <span className="text-xs text-muted-foreground">
                    {row.closedAt ? formatDate(row.closedAt, true) : ''}
                  </span>
                </div>
                <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                  {[
                    [text('Remaining custody', 'لسه معاك'), row.remainingCash],
                    [text('Awaiting safe receipt', 'مستني الخزنة تستلم'), row.pendingAmount],
                    [text('Received in safe', 'اتسلّم في الخزنة'), row.receivedInSafe],
                    [text('Received by next shift', 'اتنقل للوردية اللي بعدها'), row.carriedForward],
                  ].map(([label, value]) => (
                    <div key={label} className="grid gap-0.5 rounded-md bg-secondary/50 px-2 py-1.5">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="m-0 font-semibold tabular-nums">{money(value!)}</dd>
                    </div>
                  ))}
                </dl>
                {Number(row.remainingCash) > 0 && (
                  <PosButton
                    size="sm"
                    variant="solid"
                    className="w-full sm:w-fit"
                    disabled={busy || !!pending}
                    onClick={() => {
                      setSelected(row);
                      setReceiving(null);
                      setSafeId('');
                    }}
                  >
                    {text('Transfer to safe', 'توريد للخزنة')}
                  </PosButton>
                )}
              </div>
            ))}
          </div>
          {!drawers.data?.items.length && (
            <p className="text-sm text-muted-foreground">
              {text(
                'No closed shifts for this cashier and register.',
                'مفيش ورديات مقفولة ليك على الدرج ده.',
              )}
            </p>
          )}
          <div className="flex gap-3">
            {cursor && (
              <PosButton onClick={() => setCursor(null)}>
                {text('First page', 'أول صفحة')}
              </PosButton>
            )}
            {drawers.data?.nextCursor && (
              <PosButton onClick={() => setCursor(drawers.data!.nextCursor)}>
                {text('Older shifts', 'ورديات أقدم')}
              </PosButton>
            )}
          </div>
        </>
      )}
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          {text('My handoffs & receipt status', 'الفلوس اللي ورّدتها وحالتها')}
        </summary>
        <div className="mt-3 grid gap-3">
          {ownTransfers.isError ? (
            <p role="alert">
              {text('Could not load your handoffs.', 'تعذر تحميل تسليماتك.')}
              <button onClick={() => void ownTransfers.refetch()}>
                {text('Retry', 'إعادة المحاولة')}
              </button>
            </p>
          ) : (
            ownTransfers.data?.items.map((row) => (
              <div key={row.id} className="grid gap-2 rounded-lg border border-border p-3 text-sm">
                <strong>
                  {row.destinationName} · {row.reference}
                </strong>
                <span>
                  {money(row.amount)} · {formatDate(row.createdAt, true)}
                </span>
                <span>
                  {
                    {
                      pending: text('Awaiting receipt', 'بانتظار الاستلام'),
                      received: text('Received', 'تم الاستلام'),
                      discrepancy: text('Receipt difference', 'فرق استلام'),
                      resolved: text('Difference reviewed', 'تمت مراجعة الفرق'),
                    }[row.status]
                  }
                </span>
                {row.receivedAmount !== null && (
                  <span>
                    {text('Actually received', 'المستلم فعليًا')}: {money(row.receivedAmount)} ·{' '}
                    {row.receivedByName ?? row.receivedBy}
                  </span>
                )}
                {row.difference !== null && row.difference !== '0.00' && (
                  <span className="text-warning">
                    {text('Difference', 'الفرق')}: {money(row.difference)}
                  </span>
                )}
              </div>
            ))
          )}
          {ownTransfers.isSuccess && !ownTransfers.data.items.length && (
            <p>{text('No handoffs recorded yet.', 'مفيش تسليمات مسجلة لسه.')}</p>
          )}
          {ownCursor && (
            <PosButton onClick={() => setOwnCursor(null)}>
              {text('First page', 'أول صفحة')}
            </PosButton>
          )}
          {ownTransfers.data?.nextCursor && (
            <PosButton onClick={() => setOwnCursor(ownTransfers.data!.nextCursor)}>
              {text('More handoffs', 'تسليمات أخرى')}
            </PosButton>
          )}
        </div>
      </details>
      {canReceive && (
        <div className="grid gap-3 border-t border-border pt-4">
          <h4>{text('Safe transfers awaiting receipt', 'توريدات مستنية الخزنة تستلمها')}</h4>
          {receipts.isError && (
            <p role="alert">
              {text('Could not load pending receipts.', 'تعذر تحميل التوريدات المعلقة.')}
              <button onClick={() => void receipts.refetch()}>
                {text('Retry', 'إعادة المحاولة')}
              </button>
            </p>
          )}
          {receipts.data?.items.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <span>
                {row.registerName} → {row.destinationName}
                <br />
                {row.reference} · {money(row.amount)}
              </span>
              <PosButton
                disabled={busy || !!pending || row.createdBy === `pos:${employee.id}`}
                onClick={() => {
                  setReceiving(row);
                  setSelected(null);
                }}
              >
                {text('Count & receive', 'عدّ واستلام')}
              </PosButton>
            </div>
          ))}
          {receiptCursor && (
            <PosButton onClick={() => setReceiptCursor(null)}>
              {text('First page', 'أول صفحة')}
            </PosButton>
          )}
          {receipts.data?.nextCursor && (
            <PosButton onClick={() => setReceiptCursor(receipts.data!.nextCursor)}>
              {text('More transfers', 'توريدات أخرى')}
            </PosButton>
          )}
        </div>
      )}
      {(selected || receiving) && (
        <form onSubmit={submit} className="grid gap-4 rounded-lg border border-primary p-4">
          <fieldset disabled={busy || !!pending} className="grid gap-4">
            <h4>
              {selected
                ? text('Hand cash to safe', 'توريد الفلوس للخزنة')
                : text('Confirm safe receipt', 'تأكيد استلام الخزنة')}
            </h4>
            {selected ? (
              <>
                <PosSafeSelect
                  key={branchId}
                  employee={employee}
                  branchId={branchId}
                  value={safeId}
                  onChange={setSafeId}
                />
                <label className={fieldClass}>
                  {text('Amount (EGP)', 'المبلغ (جنيه)')}
                  <Input
                    name="amount"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={selected.remainingCash}
                    defaultValue={selected.remainingCash}
                  />
                </label>
                <label className={fieldClass}>
                  {text('Handoff reference', 'رقم الكيس أو إيصال التوريد')}
                  <Input name="reference" maxLength={80} placeholder={text('Optional', 'اختياري')} />
                </label>
                <label className={fieldClass}>
                  {text('Reason', 'السبب')}
                  <Input name="reason" required maxLength={500} />
                </label>
              </>
            ) : (
              <>
                <p>
                  {receiving?.destinationName} · {receiving?.reference}
                </p>
                <label className={fieldClass}>
                  {text('Physically received (EGP)', 'المستلم فعليًا (جنيه)')}
                  <Input name="receivedAmount" type="number" required min="0" step="0.01" />
                </label>
                <label className={fieldClass}>
                  {text('Note (required for a difference)', 'ملاحظة (إلزامية لو فيه فرق)')}
                  <Input name="note" maxLength={500} />
                </label>
              </>
            )}
            <div className="flex flex-wrap gap-3">
              <PosButton type="submit" variant="solid">
                {text('Confirm', 'تأكيد')}
              </PosButton>
              <PosButton
                type="button"
                onClick={() => {
                  setSelected(null);
                  setReceiving(null);
                }}
              >
                {text('Cancel', 'إلغاء')}
              </PosButton>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

export function PosCarryoverSelect({
  employee,
  branchId,
  registerId,
  value,
  onChange,
  disabled,
}: {
  employee: PosEmployeeSession;
  branchId: string;
  registerId: string;
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const { locale, formatNumber, formatDate } = useLocale();
  const [cursor, setCursor] = useState<string | null>(null);
  const options = useQuery({
    queryKey: [
      'pos',
      employee.merchantId,
      employee.id,
      'cash-carryover',
      branchId,
      registerId,
      cursor,
    ],
    queryFn: ({ signal }) =>
      apiRequest<CursorPage<CashDrawerSummary>>(
        `/pos/cash/carryover?${new URLSearchParams({ branchId, registerId, limit: '25', ...(cursor ? { cursor } : {}) })}`,
        { signal },
      ),
    refetchOnWindowFocus: true,
  });
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  return (
    <div className="grid w-full gap-3">
      <label className={fieldClass}>
        {text('Opening cash source', 'مصدر عهدة الافتتاح')}
        <select
          className={selectClass}
          value={value}
          disabled={disabled || options.isLoading || options.isError}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {text('New cash supplied separately', 'نقدية جديدة مسلّمة بشكل مستقل')}
          </option>
          {options.data?.items
            .filter((row) => Number(row.remainingCash) > 0)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.cashierName} · {row.closedAt ? formatDate(row.closedAt, true) : ''} ·{' '}
                {formatNumber(Number(row.remainingCash), { style: 'currency', currency: 'EGP' })}
              </option>
            ))}
        </select>
      </label>
      {options.isError && (
        <p role="alert">
          {text('Could not check previous custody.', 'تعذر مراجعة العهد السابقة.')}
          <button type="button" onClick={() => void options.refetch()}>
            {text('Retry', 'إعادة المحاولة')}
          </button>
        </p>
      )}
      {value && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required disabled={disabled} defaultChecked={disabled} />
          {text(
            'I physically received and counted the opening amount from this previous shift.',
            'أؤكد استلام وعدّ مبلغ الافتتاح فعليًا من عهدة الشيفت المختار.',
          )}
        </label>
      )}
      {options.data?.items.some((row) => Number(row.remainingCash) > 0) && !value && (
        <p className="text-xs text-warning">
          {text(
            'Previous cash is still in custody. Choosing new cash does not settle it.',
            'فيه نقدية لسه بعهدة شيفت سابق. اختيار نقدية جديدة مش بيسوّي العهدة القديمة.',
          )}
        </p>
      )}
      <div className="flex gap-3">
        {cursor && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCursor(null);
              onChange('');
            }}
          >
            {text('First page', 'أول صفحة')}
          </button>
        )}
        {options.data?.nextCursor && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCursor(options.data!.nextCursor);
              onChange('');
            }}
          >
            {text('Older custody', 'عهد أقدم')}
          </button>
        )}
      </div>
    </div>
  );
}
