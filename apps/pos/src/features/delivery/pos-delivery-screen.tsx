import { useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CursorPage,
  PosDeliveryCommand,
  PosDeliverySummary,
  PosEmployeeSession,
  PosShiftSummary,
} from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { apiRequest, ApiError } from '../../lib/api-client.js';
import {
  getCurrentPosShift,
  listPosRegisters,
  posCurrentShiftKey,
  posRegisterKey,
} from '../shifts/pos-shifts.api.js';
import { recordPosCheckPayment } from '../payments/pos-payments.api.js';
import { useDeliveryRecovery, type PendingDeliveryWrite } from './delivery-recovery.js';

type ReadyDelivery = { id: string; revision: number; total: string; customerName: string | null };

export function PosDeliveryRecoveryNotice({ employee }: { employee: PosEmployeeSession }) {
  const { locale } = useLocale();
  const storedWorkspace = usePosWorkspaceStore((s) => s.workspace);
  const workspace =
    storedWorkspace?.merchantId === employee.merchantId &&
    storedWorkspace.employeeId === employee.id
      ? storedWorkspace
      : null;
  const recovery = useDeliveryRecovery();
  const scope = workspace
    ? `waffarly:delivery:${workspace.merchantId}:${workspace.employeeId}:${workspace.deviceId}`
    : '';
  useEffect(() => {
    if (scope) recovery.hydrate(scope);
  }, [scope, recovery.hydrate]);
  if (!scope || recovery.scope !== scope || (!recovery.pending && !recovery.error)) return null;
  return (
    <div role="alert" className="m-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <Link to="/deliveries" className="underline">
        {locale === 'ar'
          ? 'فيه عملية دليفري محتاجة تأكيد — افتح متابعة الدليفري'
          : 'A delivery action needs confirmation — open delivery follow-up'}
      </Link>
      {recovery.error && <p>{recovery.error}</p>}
    </div>
  );
}

export function PosDeliveryScreen() {
  const { employee } = useOutletContext<{ employee: PosEmployeeSession }>();
  const { locale, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const client = useQueryClient();
  const storedWorkspace = usePosWorkspaceStore((s) => s.workspace);
  const workspace =
    storedWorkspace?.merchantId === employee.merchantId &&
    storedWorkspace.employeeId === employee.id
      ? storedWorkspace
      : null;
  const selectBranch = usePosWorkspaceStore((s) => s.selectBranch);
  const recovery = useDeliveryRecovery();
  const branches = employee.branches.filter((b) => b.archivedAt === null);
  const scope = workspace
    ? `waffarly:delivery:${employee.merchantId}:${employee.id}:${workspace.deviceId}`
    : '';
  const pending = recovery.scope === scope ? recovery.pending : null;
  const branchId =
    pending?.branchId ??
    branches.find((branch) => branch.id === workspace?.selectedBranchId)?.id ??
    branches[0]?.id ??
    '';
  const [registerId, setRegisterId] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [readyCursor, setReadyCursor] = useState<string | undefined>();
  const [includeResolved, setIncludeResolved] = useState(false);
  const [formError, setFormError] = useState('');
  const [savedResult, setSavedResult] = useState<'unknown' | 'committed' | 'not_found'>('unknown');
  const [resolving, setResolving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    if (scope) recovery.hydrate(scope);
  }, [scope, recovery.hydrate]);
  const registers = useQuery({
    queryKey: posRegisterKey(employee.merchantId, branchId),
    queryFn: ({ signal }) => listPosRegisters(branchId, signal),
    enabled: Boolean(branchId),
  });
  const selectedRegister = registers.data?.some((r) => r.id === registerId)
    ? registerId
    : (registers.data?.[0]?.id ?? '');
  const shift = useQuery({
    queryKey: posCurrentShiftKey(employee.merchantId, branchId, selectedRegister),
    queryFn: ({ signal }) => getCurrentPosShift(selectedRegister, signal),
    enabled: Boolean(selectedRegister),
  });
  const list = useQuery({
    queryKey: ['pos-deliveries', employee.merchantId, branchId, cursor, includeResolved],
    queryFn: ({ signal }) =>
      apiRequest<CursorPage<PosDeliverySummary>>(
        `/pos/deliveries?${new URLSearchParams({ branchId, includeResolved: String(includeResolved), ...(cursor ? { cursor } : {}) })}`,
        { signal },
      ),
    enabled: Boolean(branchId),
    refetchInterval: 15_000,
  });
  const ready = useQuery({
    queryKey: ['pos-delivery-ready', employee.merchantId, branchId, readyCursor],
    queryFn: ({ signal }) =>
      apiRequest<CursorPage<ReadyDelivery>>(
        `/pos/deliveries/ready?${new URLSearchParams({ branchId, ...(readyCursor ? { cursor: readyCursor } : {}) })}`,
        { signal },
      ),
    enabled: Boolean(branchId),
    refetchInterval: 15_000,
  });
  const write = useMutation({
    mutationFn: (saved: PendingDeliveryWrite) =>
      saved.kind === 'action'
        ? apiRequest(`/pos/deliveries/${saved.orderId}/actions`, {
            method: 'POST',
            body: JSON.stringify(saved.request),
          })
        : recordPosCheckPayment(saved.orderId, saved.checkId, saved.request),
    onSuccess: async (_result, saved) => {
      recovery.clear(scope, saved.request.requestId);
      setFormError('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['pos-deliveries'] }),
        client.invalidateQueries({ queryKey: ['pos-delivery-ready'] }),
        client.invalidateQueries({ queryKey: ['pos', employee.merchantId] }),
        client.invalidateQueries({ queryKey: ['pos', 'payments', employee.merchantId] }),
      ]);
    },
    onError: async (_error, saved) => {
      await Promise.all([list.refetch(), ready.refetch()]);
      try {
        const result = await apiRequest<{ committed: boolean }>(
          `/pos/deliveries/${saved.orderId}/requests/${saved.request.requestId}`,
        );
        setSavedResult(result.committed ? 'committed' : 'not_found');
      } catch {
        setSavedResult('unknown');
      }
    },
  });
  function submit(saved: PendingDeliveryWrite) {
    setFormError('');
    try {
      if (!online || recovery.scope !== scope || recovery.error)
        throw new Error(
          text(
            'Connect and verify recovery storage before continuing.',
            'اتصل بالإنترنت واتأكد إن حفظ العمليات شغال قبل المتابعة.',
          ),
        );
      recovery.save(scope, saved);
      setSavedResult('unknown');
      write.mutate(saved);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  }
  async function dismissRejected(saved: PendingDeliveryWrite) {
    setResolving(true);
    try {
      await apiRequest(
        `/pos/deliveries/${saved.orderId}/requests/${saved.request.requestId}/abandon`,
        { method: 'POST' },
      );
      recovery.clear(scope, saved.request.requestId);
      write.reset();
      await Promise.all([list.refetch(), ready.refetch()]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setResolving(false);
    }
  }
  const error =
    formError ||
    recovery.error ||
    (write.error instanceof Error ? write.error.message : '') ||
    (list.error instanceof Error ? list.error.message : '') ||
    (ready.error instanceof Error ? ready.error.message : '') ||
    (shift.error instanceof Error ? shift.error.message : '') ||
    (registers.error instanceof Error ? registers.error.message : '');
  const disabled =
    !online ||
    write.isPending ||
    resolving ||
    Boolean(pending) ||
    Boolean(recovery.error) ||
    recovery.scope !== scope ||
    list.isFetching ||
    ready.isFetching ||
    list.isError ||
    ready.isError;
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-7 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {text('Delivery follow-up', 'متابعة الدليفري')}
          </h1>
          <p className="text-muted-foreground">
            {text(
              'Customer payment and cash received from the courier are separate. Only received drawer cash enters your shift.',
              'دفع العميل غير استلام الفلوس من الطيار. الوردية بتحسب بس الكاش اللي دخل درجها فعلًا.',
            )}
          </p>
        </div>
        <PosButton
          variant="outline"
          onClick={() => {
            void list.refetch();
            void ready.refetch();
            void shift.refetch();
            void registers.refetch();
          }}
        >
          {text('Refresh', 'تحديث')}
        </PosButton>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive"
        >
          {errorText(error)}
        </p>
      )}
      {!online && (
        <p role="status">
          {text('Offline — new actions are paused.', 'مفيش اتصال — العمليات الجديدة متوقفة.')}
        </p>
      )}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={includeResolved}
          disabled={Boolean(pending)}
          onChange={(event) => {
            setIncludeResolved(event.target.checked);
            setCursor(undefined);
          }}
        />
        {text(
          'Include completed follow-up and receipt history',
          'عرض الطلبات اللي خلصت وسجل استلام الفلوس',
        )}
      </label>
      {pending && (
        <div className="grid gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <strong>
            {text(
              'Confirm the saved action before starting another.',
              'أكد نتيجة العملية المحفوظة قبل ما تبدأ عملية تانية.',
            )}
          </strong>
          <p>
            {text('Order', 'الأوردر')}: {pending.orderId.slice(0, 8)} ·{' '}
            {pending.kind === 'action'
              ? {
                  dispatch: text('Courier dispatch', 'خروج مع الطيار'),
                  delivered: text('Customer delivery', 'وصول للعميل'),
                  failed: text('Failed delivery', 'فشل التوصيل'),
                  claim: text('Follow-up acceptance', 'استلام المتابعة'),
                  remit: text('Courier cash receipt', 'استلام كاش الطيار'),
                }[pending.request.action]
              : text('Customer payment', 'دفع العميل')}{' '}
            ·{' '}
            {'amount' in pending.request
              ? pending.request.amount
              : pending.kind === 'payment'
                ? pending.request.tenders.map((t) => t.amount).join(' + ')
                : ''}
          </p>
          <PosButton
            disabled={!online || write.isPending || resolving}
            onClick={() => {
              setSavedResult('unknown');
              write.mutate(pending);
            }}
          >
            {text('Retry the exact saved action', 'إعادة نفس العملية المحفوظة')}
          </PosButton>
          {savedResult === 'committed' && (
            <PosButton
              variant="outline"
              disabled={!online || write.isPending || resolving}
              onClick={() => void dismissRejected(pending)}
            >
              {text(
                'Server confirms success — clear recovery',
                'السيرفر أكد النجاح — إنهاء الاسترجاع',
              )}
            </PosButton>
          )}
          {savedResult === 'not_found' &&
            write.error instanceof ApiError &&
            [400, 409].includes(write.error.statusCode) && (
              <PosButton
                variant="outline"
                disabled={!online || write.isPending || resolving}
                onClick={() => void dismissRejected(pending)}
              >
                {text(
                  'Dismiss rejected action and review current details',
                  'إلغاء الطلب المرفوض ومراجعة البيانات الحالية',
                )}
              </PosButton>
            )}
        </div>
      )}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <label>
          {text('Branch', 'الفرع')}
          <select
            className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
            value={branchId}
            disabled={Boolean(pending)}
            onChange={(event) => {
              selectBranch(employee.merchantId, employee.id, event.target.value);
              setRegisterId('');
              setCursor(undefined);
              setReadyCursor(undefined);
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {text('Receiving drawer', 'الدرج اللي هيستلم الكاش')}
          <select
            className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
            value={selectedRegister}
            disabled={Boolean(pending)}
            onChange={(event) => setRegisterId(event.target.value)}
          >
            {!registers.data?.length && (
              <option value="">{text('No available drawer', 'مفيش درج متاح')}</option>
            )}
            {registers.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {shift.data
              ? text('Open shift', 'الوردية مفتوحة')
              : text('Open a shift to receive drawer cash.', 'افتح وردية عشان تستلم كاش في الدرج.')}
          </span>{' '}
          <Link className="underline" to="/shift">
            {text('Register shift', 'الوردية')}
          </Link>
        </label>
      </div>
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">
          {text('Ready to leave with a courier', 'جاهز يخرج مع الطيار')}
        </h2>
        {ready.isLoading && <p>{text('Loading...', 'جارٍ التحميل...')}</p>}
        {ready.data?.items.length === 0 && (
          <p>{text('No ready deliveries.', 'مفيش طلبات دليفري جاهزة للخروج.')}</p>
        )}
        {ready.data?.items.map((order) => (
          <DispatchCard
            key={order.id}
            order={order}
            disabled={disabled}
            text={text}
            onSubmit={(courierName) =>
              submit({
                branchId,
                orderId: order.id,
                kind: 'action',
                request: {
                  action: 'dispatch',
                  requestId: crypto.randomUUID(),
                  revision: order.revision,
                  courierName,
                },
              })
            }
          />
        ))}
        <div className="flex gap-2">
          {readyCursor && (
            <PosButton variant="outline" onClick={() => setReadyCursor(undefined)}>
              {text('First page', 'أول صفحة')}
            </PosButton>
          )}
          {ready.data?.nextCursor && (
            <PosButton variant="outline" onClick={() => setReadyCursor(ready.data!.nextCursor!)}>
              {text('Next', 'التالي')}
            </PosButton>
          )}
        </div>
      </div>
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">
          {text('Deliveries and money still being followed up', 'طلبات وفلوس لسه تحت المتابعة')}
        </h2>
        {list.isLoading && <p>{text('Loading...', 'جارٍ التحميل...')}</p>}
        {list.data?.items.length === 0 && (
          <p>{text('No pending delivery follow-up.', 'مفيش دليفري معلق تحت المتابعة.')}</p>
        )}
        {list.data?.items.map((delivery) => (
          <DeliveryCard
            key={`${delivery.orderId}:${delivery.revision}`}
            delivery={delivery}
            employee={employee}
            shift={shift.data ?? null}
            disabled={disabled || shift.isFetching || shift.isError}
            text={text}
            submit={submit}
          />
        ))}
        <div className="flex gap-2">
          {cursor && (
            <PosButton variant="outline" onClick={() => setCursor(undefined)}>
              {text('First page', 'أول صفحة')}
            </PosButton>
          )}
          {list.data?.nextCursor && (
            <PosButton variant="outline" onClick={() => setCursor(list.data!.nextCursor!)}>
              {text('Next', 'التالي')}
            </PosButton>
          )}
        </div>
      </div>
    </section>
  );
}

function DispatchCard({
  order,
  disabled,
  text,
  onSubmit,
}: {
  order: ReadyDelivery;
  disabled: boolean;
  text: (en: string, ar: string) => string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(name.trim());
      }}
    >
      <p className="me-auto">
        #{order.id.slice(0, 8)} · {order.customerName} · {order.total} EGP
      </p>
      <label>
        {text('Courier name / reference', 'اسم الطيار / مرجعه')}
        <Input
          required
          maxLength={160}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <PosButton type="submit" disabled={disabled || !name.trim()}>
        {text('Send with courier', 'خرج مع الطيار')}
      </PosButton>
    </form>
  );
}

function DeliveryCard({
  delivery: d,
  employee,
  shift,
  disabled,
  text,
  submit,
}: {
  delivery: PosDeliverySummary;
  employee: PosEmployeeSession;
  shift: PosShiftSummary | null;
  disabled: boolean;
  text: (en: string, ar: string) => string;
  submit: (saved: PendingDeliveryWrite) => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [courier, setCourier] = useState(d.courierName);
  const [checkId, setCheckId] = useState(d.checks.find((c) => c.balanceDue !== '0.00')?.id ?? '');
  const [paymentId, setPaymentId] = useState(
    d.courierPayments.find((p) => p.remaining !== '0.00')?.id ?? '',
  );
  const [method, setMethod] = useState<'courier' | 'cash' | 'terminal'>('courier');
  const [reference, setReference] = useState('');
  const mine =
    d.custodianEmployeeId === employee.id || employee.permissions.includes('approve_shift_close');
  const action = (command: PosDeliveryCommand) =>
    submit({ branchId: d.branchId, orderId: d.orderId, kind: 'action', request: command });
  const base = () => ({ requestId: crypto.randomUUID(), revision: d.revision });
  const moneyValid = /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(amount);
  function payment(event: FormEvent) {
    event.preventDefault();
    submit({
      branchId: d.branchId,
      orderId: d.orderId,
      kind: 'payment',
      checkId,
      request: {
        requestId: crypto.randomUUID(),
        revision: d.orderRevision,
        ...(method === 'courier'
          ? { cashCustody: 'courier' as const }
          : { receivingShiftId: shift!.id }),
        tenders: [
          method === 'terminal'
            ? {
                method: 'terminal',
                amount,
                ...(reference.trim() ? { terminalReference: reference.trim() } : {}),
              }
            : { method: 'cash', amount, receivedAmount: amount },
        ],
      },
    });
  }
  return (
    <article className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <header>
        <h3 className="font-semibold">
          #{d.orderId.slice(0, 8)} · {d.courierName}
        </h3>
        <p>
          {d.status === 'delivered'
            ? text('Delivered to customer', 'وصل للعميل')
            : d.status === 'failed'
              ? text('Delivery failed', 'التوصيل فشل')
              : text('Out with courier', 'خرج مع الطيار')}{' '}
          · {text('Responsible', 'مسؤول المتابعة')}: {d.custodianName}
        </p>
        {d.failureReason && <p className="text-warning">{d.failureReason}</p>}
      </header>
      <div className="grid gap-2 sm:grid-cols-2">
        <p>
          {text('Customer still owes', 'لسه مطلوب من العميل')}: <strong>{d.customerDue} EGP</strong>
        </p>
        <p>
          {text('Cash still with courier', 'كاش لسه مع الطيار')}:{' '}
          <strong>{d.courierCashHeld} EGP</strong>
        </p>
      </div>
      {Boolean(d.remittances?.length) && (
        <details>
          <summary>{text('Cash receipt history', 'سجل استلام الفلوس')}</summary>
          <ul className="grid gap-2 py-2">
            {d.remittances?.map((r, i) => (
              <li key={`${r.shiftId}:${r.receivedAt}:${i}`}>
                {r.amount} EGP · {r.operatorName} ·{' '}
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(r.receivedAt))}{' '}
                · {text('Shift', 'وردية')} #{r.shiftId.slice(0, 8)}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        {mine &&
          shift &&
          (d.followupShiftId !== shift.id || d.custodianEmployeeId !== employee.id) && (
            <PosButton
              disabled={disabled}
              onClick={() => action({ ...base(), action: 'claim', receivingShiftId: shift.id })}
            >
              {text('Accept follow-up into this shift', 'استلم المتابعة على الوردية دي')}
            </PosButton>
          )}
        {mine && d.status === 'out_for_delivery' && (
          <PosButton disabled={disabled} onClick={() => action({ ...base(), action: 'delivered' })}>
            {text('Confirm delivered to customer', 'تأكيد وصل للعميل')}
          </PosButton>
        )}
      </div>
      {!mine && (
        <p className="text-muted-foreground">
          {text(
            'The assigned employee or a supervisor handles these actions.',
            'العمليات دي ينفذها مسؤول المتابعة أو المشرف.',
          )}
        </p>
      )}
      {mine && d.status === 'out_for_delivery' && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            action({ ...base(), action: 'failed', reason: reason.trim() });
          }}
        >
          <Input
            aria-label={text('Failure reason', 'سبب فشل التوصيل')}
            placeholder={text('Failure reason', 'سبب فشل التوصيل')}
            required
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <PosButton variant="outline" type="submit" disabled={disabled || !reason.trim()}>
            {text('Record failed delivery', 'تسجيل فشل التوصيل')}
          </PosButton>
        </form>
      )}
      {mine && d.status === 'failed' && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            action({ ...base(), action: 'dispatch', courierName: courier.trim() });
          }}
        >
          <Input
            aria-label={text('Courier name', 'اسم الطيار')}
            required
            maxLength={160}
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
          />
          <PosButton
            type="submit"
            disabled={disabled || !courier.trim() || d.courierCashHeld !== '0.00'}
          >
            {text('Send again', 'خروج للتوصيل مرة تانية')}
          </PosButton>
        </form>
      )}
      {mine && (
        <label className="grid max-w-xs gap-1">
          {text('Amount (EGP)', 'المبلغ بالجنيه')}
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      )}
      {mine && d.status !== 'failed' && d.customerDue !== '0.00' && (
        <form className="grid gap-3 border-t border-border pt-3" onSubmit={payment}>
          <label>
            {text('Customer payment', 'تسجيل دفع العميل')}
            <select
              className="min-h-11 w-full rounded border border-input bg-background px-3"
              value={checkId}
              onChange={(e) => setCheckId(e.target.value)}
            >
              {d.checks
                .filter((c) => c.balanceDue !== '0.00')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {text('Check', 'الحساب')} {c.position + 1} · {c.balanceDue} EGP
                  </option>
                ))}
            </select>
          </label>
          <label>
            {text('Where did the money go?', 'الفلوس راحت فين؟')}
            <select
              className="min-h-11 w-full rounded border border-input bg-background px-3"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
            >
              <option value="courier">
                {text(
                  'Customer paid courier cash — still outside drawer',
                  'العميل دفع كاش للطيار — لسه برّه الدرج',
                )}
              </option>
              <option value="cash">
                {text(
                  'Cash directly received into selected drawer',
                  'الكاش دخل الدرج المختار مباشرة',
                )}
              </option>
              <option value="terminal">
                {text('Confirmed external terminal payment', 'دفع مؤكد على الماكينة الخارجية')}
              </option>
            </select>
          </label>
          {method === 'terminal' && (
            <Input
              aria-label={text('Terminal reference', 'مرجع الماكينة')}
              placeholder={text('Terminal reference', 'مرجع الماكينة')}
              maxLength={80}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
          <PosButton
            type="submit"
            disabled={disabled || !moneyValid || !checkId || (method !== 'courier' && !shift)}
          >
            {text('Record customer payment once', 'سجل دفع العميل مرة واحدة')}
          </PosButton>
        </form>
      )}
      {mine && d.courierCashHeld !== '0.00' && (
        <form
          className="grid gap-3 border-t border-border pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            action({ ...base(), action: 'remit', receivingShiftId: shift!.id, paymentId, amount });
          }}
        >
          <label>
            {text(
              'Receive courier cash into selected drawer',
              'استلام كاش الطيار في الدرج المختار',
            )}
            <select
              className="min-h-11 w-full rounded border border-input bg-background px-3"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
            >
              {d.courierPayments
                .filter((p) => p.remaining !== '0.00')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id.slice(0, 8)} · {p.remaining} EGP
                  </option>
                ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            {text(
              'This receives existing courier money; it does not charge the customer again.',
              'ده استلام فلوس موجودة مع الطيار؛ مش تحصيل تاني من العميل.',
            )}
          </p>
          <PosButton type="submit" disabled={disabled || !shift || !paymentId || !moneyValid}>
            {text('Confirm cash actually received', 'تأكيد الكاش اللي استلمته فعلًا')}
          </PosButton>
        </form>
      )}
    </article>
  );
}
