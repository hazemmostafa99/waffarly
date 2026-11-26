import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Banknote,
  Bike,
  Check,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CursorPage,
  DeliveryCourierOption,
  PosDeliveryCommand,
  PosDeliverySummary,
  PosEmployeeSession,
  PosShiftSummary,
} from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { getPosOrderNumber } from '../orders/pos-order-number.js';
import { apiRequest, ApiError } from '../../lib/api-client.js';
import {
  getCurrentPosShift,
  posCurrentShiftKey,
} from '../shifts/pos-shifts.api.js';
import { recordPosCheckPayment } from '../payments/pos-payments.api.js';
import { useDeliveryRecovery, type PendingDeliveryWrite } from './delivery-recovery.js';
import { requirePairedRegister } from '../registers/register-pairing-prompt.js';

type ReadyDelivery = {
  id: string;
  orderReference?: string | null;
  branchOrderNumber?: number | null;
  revision: number;
  total: string;
  customerName: string | null;
};
type DeliveryView = 'ready' | 'delivery' | 'cash' | 'history';

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
  const hasPendingForAssignedBranch = recovery.pending?.branchId === employee.branch.id;
  const hasRecoveryErrorWithoutPending = !recovery.pending && Boolean(recovery.error);
  if (
    !scope ||
    recovery.scope !== scope ||
    (!hasPendingForAssignedBranch && !hasRecoveryErrorWithoutPending)
  )
    return null;
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
  const recovery = useDeliveryRecovery();
  const scope = workspace
    ? `waffarly:delivery:${employee.merchantId}:${employee.id}:${workspace.deviceId}`
    : '';
  const branchId = employee.branch.id;
  const pending =
    recovery.scope === scope && recovery.pending?.branchId === branchId
      ? recovery.pending
      : null;
  const registerId = employee.deviceRegister?.id ?? '';
  const [cursor, setCursor] = useState<string | undefined>();
  const [readyCursor, setReadyCursor] = useState<string | undefined>();
  const [activeView, setActiveView] = useState<DeliveryView>('ready');
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
  const shift = useQuery({
    queryKey: posCurrentShiftKey(employee.merchantId, branchId, registerId),
    queryFn: ({ signal }) => getCurrentPosShift(registerId, signal),
    enabled: Boolean(registerId),
  });
  const list = useQuery({
    queryKey: ['pos-deliveries', employee.merchantId, branchId, cursor, activeView === 'history'],
    queryFn: ({ signal }) =>
      apiRequest<CursorPage<PosDeliverySummary>>(
        `/pos/deliveries?${new URLSearchParams({ branchId, includeResolved: String(activeView === 'history'), ...(cursor ? { cursor } : {}) })}`,
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
  const courierPages = useInfiniteQuery({
    queryKey: ['pos-delivery-couriers', employee.merchantId, branchId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) params.set('cursor', pageParam);
      return apiRequest<CursorPage<DeliveryCourierOption>>(
        `/pos/delivery-couriers?${params.toString()}`,
        { signal },
      );
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(branchId),
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
    // Ask for the register before saving a delivery command this browser cannot send.
    if (!requirePairedRegister(employee)) return;
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
    (shift.error instanceof Error ? shift.error.message : '');
  const deliveries = list.data?.items ?? [];
  const courierPicker = {
    options: courierPages.data?.pages.flatMap((page) => page.items) ?? [],
    loading: courierPages.isLoading,
    error:
      courierPages.error instanceof Error ? errorText(courierPages.error.message) : '',
    hasMore: Boolean(courierPages.hasNextPage),
    loadingMore: courierPages.isFetchingNextPage,
    loadMore: () => void courierPages.fetchNextPage(),
    retry: () => void courierPages.refetch(),
  };
  const deliveryFollowups = deliveries.filter(
    (delivery) => delivery.status !== 'delivered' || delivery.customerDue !== '0.00',
  );
  const cashDeliveries = deliveries.filter((delivery) => delivery.courierCashHeld !== '0.00');
  const historyDeliveries = deliveries.filter(
    (delivery) =>
      delivery.status === 'delivered' &&
      delivery.customerDue === '0.00' &&
      delivery.courierCashHeld === '0.00',
  );
  const cashGroups = Array.from(
    cashDeliveries.reduce((groups, delivery) => {
      const identity = delivery.courierId ?? `legacy:${delivery.courierName}`;
      const group = groups.get(identity);
      if (group) group.orders.push(delivery);
      else groups.set(identity, { courierName: delivery.courierName, orders: [delivery] });
      return groups;
    }, new Map<string, { courierName: string; orders: PosDeliverySummary[] }>()),
  )
    .map(([id, group]) => ({ id, ...group }))
    .sort((left, right) => left.courierName.localeCompare(right.courierName, locale));
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
    <section
      aria-labelledby="pos-delivery-heading"
      className="grid w-full gap-3 p-3 md:p-4"
    >
      <h1 id="pos-delivery-heading" className="sr-only">
        {text('Delivery follow-up', 'متابعة الدليفري')}
      </h1>
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
      <div className="grid gap-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label={text('Delivery work queues', 'قوائم متابعة الدليفري')}
            className="flex min-w-0 flex-1 overflow-x-auto border-b border-border"
          >
            {(
              [
                {
                  id: 'ready',
                  label: text('Ready to dispatch', 'جاهز للتوصيل'),
                  count: ready.data?.items.length,
                },
                {
                  id: 'delivery',
                  label: text('Delivery follow-up', 'متابعة التوصيل'),
                  count: activeView === 'history' ? undefined : deliveryFollowups.length,
                },
                {
                  id: 'cash',
                  label: text('Courier cash', 'تحصيل كاش الطيار'),
                  count: activeView === 'history' ? undefined : cashDeliveries.length,
                },
                {
                  id: 'history',
                  label: text('History', 'السجل'),
                  count: activeView === 'history' ? historyDeliveries.length : undefined,
                },
              ] as const
            ).map((view) => (
              <button
                key={view.id}
                id={`delivery-tab-${view.id}`}
                type="button"
                role="tab"
                aria-selected={activeView === view.id}
                aria-controls="delivery-tab-panel"
                onClick={() => {
                  setActiveView(view.id);
                  setCursor(undefined);
                }}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-medium transition-colors ${activeView === view.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <span>{view.label}</span>
                {view.count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${activeView === view.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                  >
                    {view.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <PosButton
            size="sm"
            variant="outline"
            className="min-h-10"
            onClick={() => {
              void list.refetch();
              void ready.refetch();
              // refetch() ignores `enabled`; an unpaired browser has no register shift to read.
              if (registerId) void shift.refetch();
              void courierPages.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" size={14} />
            {text('Refresh', 'تحديث')}
          </PosButton>
        </div>
        {(list.data?.nextCursor || ready.data?.nextCursor) && (
          <p className="-mt-2 text-[11px] text-muted-foreground">
            {text(
              'Counts reflect the orders on the current page.',
              'الأعداد بتوضح الطلبات الظاهرة في الصفحة الحالية.',
            )}
          </p>
        )}

        <div
          id="delivery-tab-panel"
          role="tabpanel"
          aria-labelledby={`delivery-tab-${activeView}`}
          className="grid gap-2"
        >
          {activeView === 'ready' && (
            <>
              <div>
                <p className="m-0 text-xs text-muted-foreground">
                  {text('Choose a courier for each prepared order.', 'اختار الطيار لكل طلب جاهز.')}
                </p>
              </div>
              {ready.isLoading && <p>{text('Loading orders...', 'جارٍ تحميل الطلبات...')}</p>}
              {ready.data?.items.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  {text(
                    'All set. There are no orders waiting for dispatch.',
                    'تمام، مفيش طلبات مستنية التوصيل.',
                  )}
                </p>
              )}
              {ready.data?.items.map((order) => (
                <DispatchCard
                  key={order.id}
                  order={order}
                  disabled={disabled}
                  couriers={courierPicker}
                  text={text}
                  onSubmit={(courierId) =>
                    submit({
                      branchId,
                      orderId: order.id,
                      kind: 'action',
                      request: {
                        action: 'dispatch',
                        requestId: crypto.randomUUID(),
                        revision: order.revision,
                        courierId,
                        // Links a website delivery to this register's open shift.
                        ...(registerId ? { registerId } : {}),
                      },
                    })
                  }
                />
              ))}
              <PaginationControls
                cursor={readyCursor}
                nextCursor={ready.data?.nextCursor ?? null}
                text={text}
                onFirst={() => setReadyCursor(undefined)}
                onNext={(next) => setReadyCursor(next)}
              />
            </>
          )}

          {activeView === 'delivery' && (
            <>
              <div>
                <p className="m-0 text-sm text-muted-foreground">
                  {text(
                    'Each order shows its next step. Follow the numbered steps from top to bottom.',
                    'كل طلب مكتوب فيه الخطوة الجاية. امشي على الخطوات المترقمة من فوق لتحت.',
                  )}
                </p>
              </div>
              {list.isLoading && <p>{text('Loading orders...', 'جارٍ تحميل الطلبات...')}</p>}
              {list.data && deliveryFollowups.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  {text(
                    'No delivery follow-up is needed right now.',
                    'مفيش طلبات محتاجة متابعة توصيل حاليًا.',
                  )}
                </p>
              )}
              {deliveryFollowups.map((delivery) => (
                <DeliveryCard
                  key={`${delivery.orderId}:${delivery.revision}`}
                  delivery={delivery}
                  employee={employee}
                  shift={shift.data ?? null}
                  disabled={disabled || shift.isFetching || shift.isError}
                  couriers={courierPicker}
                  text={text}
                  submit={submit}
                />
              ))}
              <PaginationControls
                cursor={cursor}
                nextCursor={list.data?.nextCursor ?? null}
                text={text}
                onFirst={() => setCursor(undefined)}
                onNext={(next) => setCursor(next)}
              />
            </>
          )}

          {activeView === 'cash' && (
            <>
              <div>
                <p className="m-0 text-xs text-muted-foreground">
                  {text(
                    'Customer payments and courier cash are separate. Courier cash counts toward the shift only after receipt; totals here cover this page.',
                    'تحصيل العميل وكاش الطيار منفصلين. كاش الطيار بيتحسب على الوردية بعد استلامه؛ والإجماليات هنا للطلبات الظاهرة في الصفحة دي.',
                  )}
                </p>
              </div>
              {list.isLoading && (
                <p>{text('Loading cash balances...', 'جارٍ تحميل أرصدة الكاش...')}</p>
              )}
              {list.data && cashGroups.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  {text(
                    'No courier cash is waiting to be received.',
                    'مفيش كاش مستني التوريد من الطيارين.',
                  )}
                </p>
              )}
              {cashGroups.map(({ id, courierName, orders }) => {
                const totalCents = orders.reduce(
                  (sum, order) => sum + amountToCents(order.courierCashHeld),
                  0,
                );
                return (
                  <section
                    key={id}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                      <div>
                        <h3 className="font-semibold">{courierName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {text(
                            `${orders.length} order${orders.length === 1 ? '' : 's'}`,
                            `${orders.length} طلب`,
                          )}
                        </p>
                      </div>
                      <p className="text-end">
                        <span className="block text-xs text-muted-foreground">
                          {text('Cash still with courier', 'الكاش المتبقي مع الطيار')}
                        </span>
                        <strong className="text-sm tabular-nums">
                          <bdi dir="ltr">
                            {formatCents(totalCents, locale)} {text('EGP', 'ج.م.')}
                          </bdi>
                        </strong>
                      </p>
                    </header>
                    <div className="divide-y divide-border">
                      {orders.map((delivery) => (
                        <CourierCashOrder
                          key={`${delivery.orderId}:${delivery.revision}`}
                          delivery={delivery}
                          employee={employee}
                          shift={shift.data ?? null}
                          disabled={disabled || shift.isFetching || shift.isError}
                          text={text}
                          submit={submit}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
              <PaginationControls
                cursor={cursor}
                nextCursor={list.data?.nextCursor ?? null}
                text={text}
                onFirst={() => setCursor(undefined)}
                onNext={(next) => setCursor(next)}
              />
            </>
          )}

          {activeView === 'history' && (
            <>
              <div>
                <h2 className="text-sm font-semibold">
                  {text('Completed deliveries', 'الطلبات المكتملة')}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {text(
                    'Delivered orders with customer balances and courier cash fully settled.',
                    'الطلبات اللي اتسلمت واتصفى حساب العميل وكاش الطيار فيها.',
                  )}
                </p>
              </div>
              {list.isLoading && <p>{text('Loading history...', 'جارٍ تحميل السجل...')}</p>}
              {list.data && historyDeliveries.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  {text(
                    'No completed deliveries in this part of the history.',
                    'مفيش طلبات مكتملة في الجزء ده من السجل.',
                  )}
                </p>
              )}
              {historyDeliveries.map((delivery) => (
                <DeliveryCard
                  key={`${delivery.orderId}:${delivery.revision}`}
                  delivery={delivery}
                  employee={employee}
                  shift={shift.data ?? null}
                  disabled
                  readOnly
                  couriers={courierPicker}
                  text={text}
                  submit={submit}
                />
              ))}
              <PaginationControls
                cursor={cursor}
                nextCursor={list.data?.nextCursor ?? null}
                text={text}
                onFirst={() => setCursor(undefined)}
                onNext={(next) => setCursor(next)}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function DispatchCard({
  order,
  disabled,
  couriers,
  text,
  onSubmit,
}: {
  order: ReadyDelivery;
  disabled: boolean;
  couriers: CourierPickerState;
  text: (en: string, ar: string) => string;
  onSubmit: (courierId: string) => void;
}) {
  const [courierId, setCourierId] = useState('');
  return (
    <form
      className="grid gap-3 rounded-lg border border-border bg-card p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)_auto] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(courierId);
      }}
    >
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {text('Ready for dispatch', 'جاهز للتوصيل')}
        </p>
        <h3 className="truncate font-semibold">
          {order.customerName || text('Customer name unavailable', 'اسم العميل غير متاح')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {text('Order', 'طلب')}{' '}
          <bdi dir="ltr">
            #
            {getPosOrderNumber({
              id: order.id,
              orderReference: order.orderReference,
              branchOrderNumber: order.branchOrderNumber,
            })}
          </bdi>
          <span className="mx-2">·</span>
          {text('Total', 'الإجمالي')}{' '}
          <strong className="tabular-nums">
            <bdi dir="ltr">
              {order.total} {text('EGP', 'ج.م.')}
            </bdi>
          </strong>
        </p>
      </div>
      <CourierPicker
        label={text('Choose a courier', 'اختار الطيار')}
        value={courierId}
        onChange={setCourierId}
        disabled={disabled}
        couriers={couriers}
        text={text}
      />
      <PosButton
        type="submit"
        disabled={
          disabled ||
          !courierId ||
          couriers.loading ||
          Boolean(couriers.error) ||
          !couriers.options.some((courier) => courier.id === courierId)
        }
      >
        {text('Dispatch order', 'تسليم للطيار')}
      </PosButton>
    </form>
  );
}

type CourierPickerState = {
  options: DeliveryCourierOption[];
  loading: boolean;
  error: string;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

function CourierPicker({
  label,
  value,
  onChange,
  disabled,
  couriers,
  text,
}: {
  label: string;
  value: string;
  onChange: (courierId: string) => void;
  disabled: boolean;
  couriers: CourierPickerState;
  text: (en: string, ar: string) => string;
}) {
  const selectDisabled =
    disabled || couriers.loading || Boolean(couriers.error) || couriers.options.length === 0;
  return (
    <div className="grid min-w-0 gap-1">
      <label className="grid gap-1">
        {label}
        <select
          aria-label={label}
          className="min-h-11 w-full rounded border border-input bg-background px-3"
          required
          value={value}
          disabled={selectDisabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {couriers.loading
              ? text('Loading couriers…', 'جارٍ تحميل الطيارين…')
              : couriers.error
                ? text('Courier list unavailable', 'قائمة الطيارين غير متاحة')
                : couriers.options.length === 0
                  ? text('No active couriers for this branch', 'لا يوجد طيارون نشطون للفرع')
                  : text('Choose a courier', 'اختار الطيار')}
          </option>
          {couriers.options.map((courier) => (
            <option key={courier.id} value={courier.id}>
              {courier.name}
            </option>
          ))}
        </select>
      </label>
      {couriers.error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          <span>{couriers.error}</span>
          <PosButton type="button" variant="outline" onClick={couriers.retry}>
            {text('Retry', 'إعادة المحاولة')}
          </PosButton>
        </div>
      )}
      {couriers.hasMore && (
        <PosButton
          type="button"
          variant="outline"
          disabled={disabled || couriers.loadingMore}
          onClick={couriers.loadMore}
        >
          {couriers.loadingMore
            ? text('Loading more…', 'جارٍ تحميل المزيد…')
            : text('Load more couriers', 'تحميل طيارين إضافيين')}
        </PosButton>
      )}
      {couriers.options.length === 0 && !couriers.loading && !couriers.error && (
        <small className="text-muted-foreground">
          {text(
            'Ask the owner to add a courier for this branch.',
            'اطلب من المالك إضافة طيار للفرع ده.',
          )}
        </small>
      )}
    </div>
  );
}

function amountToCents(amount: string) {
  const [units = '0', fraction = ''] = amount.split('.');
  return Number(units) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

function formatCents(cents: number, locale: string) {
  // Latin digits keep courier totals consistent with every other amount on the screen.
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function PaginationControls({
  cursor,
  nextCursor,
  text,
  onFirst,
  onNext,
}: {
  cursor: string | undefined;
  nextCursor: string | null;
  text: (en: string, ar: string) => string;
  onFirst: () => void;
  onNext: (cursor: string) => void;
}) {
  if (!cursor && !nextCursor) return null;
  return (
    <div className="flex gap-2 pt-1">
      {cursor && (
        <PosButton variant="outline" onClick={onFirst}>
          {text('First page', 'أول صفحة')}
        </PosButton>
      )}
      {nextCursor && (
        <PosButton variant="outline" onClick={() => onNext(nextCursor)}>
          {text('Next page', 'الصفحة التالية')}
        </PosButton>
      )}
    </div>
  );
}

function CourierCashOrder({
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
  const firstPayment = d.courierPayments.find((payment) => payment.remaining !== '0.00');
  const [paymentId, setPaymentId] = useState(firstPayment?.id ?? '');
  const [amount, setAmount] = useState(firstPayment?.remaining ?? '');
  const mine = employee.permissions.includes('sell') && employee.branch.id === d.branchId;
  const selectedPayment = d.courierPayments.find((payment) => payment.id === paymentId);
  const moneyValid = /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(amount);

  return (
    <article className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] sm:items-center">
      <div className="min-w-0">
        <p className="font-semibold">
          {text('Order', 'طلب')}{' '}
          <bdi dir="ltr">
            #
            {getPosOrderNumber({
              id: d.orderId,
              orderReference: d.orderReference,
              branchOrderNumber: d.branchOrderNumber,
            })}
          </bdi>
          <span className="mx-2 text-muted-foreground">·</span>
          {d.status === 'delivered'
            ? text('Delivered', 'تم التوصيل')
            : d.status === 'failed'
              ? text('Delivery failed', 'تعذر التوصيل')
              : text('Out with courier', 'خرج مع الطيار')}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {text('Customer still owes', 'المتبقي على العميل')}:{' '}
          <bdi dir="ltr">
            {d.customerDue} {text('EGP', 'ج.م.')}
          </bdi>
        </p>
        <p className="mt-1 font-semibold tabular-nums">
          {text('To receive', 'المطلوب استلامه')}:{' '}
          <bdi dir="ltr">
            {d.courierCashHeld} {text('EGP', 'ج.م.')}
          </bdi>
        </p>
        {!mine && (
          <p className="mt-2 text-xs text-muted-foreground">
            {text(
              'A cashier with delivery access for this branch can receive this cash.',
              'أي كاشير عنده صلاحية دليفري للفرع يقدر يستلم الكاش ده.',
            )}
          </p>
        )}
      </div>
      {mine && (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!shift || !paymentId || !moneyValid) return;
            submit({
              branchId: d.branchId,
              orderId: d.orderId,
              kind: 'action',
              request: {
                requestId: crypto.randomUUID(),
                revision: d.revision,
                action: 'remit',
                receivingShiftId: shift.id,
                paymentId,
                amount,
              },
            });
          }}
        >
          {d.courierPayments.filter((payment) => payment.remaining !== '0.00').length > 1 && (
            <label className="grid gap-1 text-sm">
              {text('Payment balance', 'رصيد الدفع')}
              <select
                className="min-h-11 w-full rounded border border-input bg-background px-3"
                value={paymentId}
                onChange={(event) => {
                  const nextPaymentId = event.target.value;
                  setPaymentId(nextPaymentId);
                  setAmount(
                    d.courierPayments.find((payment) => payment.id === nextPaymentId)?.remaining ??
                      '',
                  );
                }}
              >
                {d.courierPayments
                  .filter((payment) => payment.remaining !== '0.00')
                  .map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      #{payment.id.slice(0, 8)} · {payment.remaining} {text('EGP', 'ج.م.')}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="grid gap-1 text-sm">
            {text('Amount received', 'المبلغ المستلم')}
            <Input
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <PosButton
            type="submit"
            disabled={disabled || !shift || !paymentId || !selectedPayment || !moneyValid}
          >
            {text('Confirm cash received', 'تأكيد استلام الكاش')}
          </PosButton>
        </form>
      )}
    </article>
  );
}

type CustomerPaymentMethod = 'courier' | 'cash' | 'terminal';

/** Where a delivery order stands, from leaving with the courier to cash in the drawer. */
function deliveryProgress(d: PosDeliverySummary) {
  const delivered = d.status === 'delivered';
  const paid = d.customerDue === '0.00';
  return {
    delivered,
    paid,
    cashInDrawer: paid && d.courierCashHeld === '0.00',
    done: delivered && paid && d.courierCashHeld === '0.00',
  };
}

function StepTrack({
  d,
  text,
}: {
  d: PosDeliverySummary;
  text: (en: string, ar: string) => string;
}) {
  const progress = deliveryProgress(d);
  const steps: Array<{ label: string; state: 'done' | 'failed' | 'todo' }> = [
    { label: text('With courier', 'خرج مع الطيار'), state: 'done' },
    {
      label: d.status === 'failed' ? text('Not delivered', 'ما وصلش') : text('Delivered', 'وصل للعميل'),
      state: progress.delivered ? 'done' : d.status === 'failed' ? 'failed' : 'todo',
    },
    { label: text('Customer paid', 'العميل دفع'), state: progress.paid ? 'done' : 'todo' },
    { label: text('Cash in drawer', 'الكاش في الدرج'), state: progress.cashInDrawer ? 'done' : 'todo' },
  ];
  return (
    <ol className="m-0 grid list-none grid-cols-4 gap-1 p-0" aria-label={text('Delivery progress', 'مراحل الطلب')}>
      {steps.map((step) => (
        <li key={step.label} className="grid min-w-0 gap-1.5">
          <span
            className={`h-1.5 rounded-full ${
              step.state === 'done'
                ? 'bg-success'
                : step.state === 'failed'
                  ? 'bg-warning'
                  : 'bg-muted'
            }`}
          />
          <span
            className={`flex min-w-0 items-center gap-1 text-[11px] leading-tight ${
              step.state === 'todo' ? 'text-muted-foreground' : 'font-semibold text-foreground'
            }`}
          >
            {step.state === 'done' && (
              <Check aria-hidden="true" size={12} className="shrink-0 text-success" />
            )}
            {step.state === 'failed' && (
              <X aria-hidden="true" size={12} className="shrink-0 text-warning" />
            )}
            <span className="truncate">{step.label}</span>
            <span className="sr-only">
              {step.state === 'done'
                ? text('(done)', '(تم)')
                : step.state === 'failed'
                  ? text('(failed)', '(فشل)')
                  : text('(pending)', '(لسه)')}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function MoneyStat({
  label,
  amount,
  settledLabel,
  text,
}: {
  label: string;
  amount: string;
  settledLabel: string;
  text: (en: string, ar: string) => string;
}) {
  const settled = amount === '0.00';
  return (
    <div
      className={`grid gap-0.5 rounded-lg border p-3 ${
        settled ? 'border-border bg-muted/20' : 'border-warning/40 bg-warning/10'
      }`}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      {settled ? (
        <strong className="flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 aria-hidden="true" size={15} />
          {settledLabel}
        </strong>
      ) : (
        <strong className="text-lg tabular-nums">
          <bdi dir="ltr">
            {amount} {text('EGP', 'ج.م.')}
          </bdi>
        </strong>
      )}
    </div>
  );
}

/** A numbered block that tells the cashier exactly what to do next for this order. */
function StepSection({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-background/40 p-3">
      <header className="flex items-start gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {number}
        </span>
        <div className="grid gap-0.5">
          <h4 className="m-0 text-sm font-semibold">{title}</h4>
          {hint && <p className="m-0 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function ChoiceButton({
  selected,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`grid min-h-16 gap-1 rounded-lg border p-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary'
          : 'border-border bg-card hover:bg-secondary'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{description}</span>
    </button>
  );
}

function DeliveryCard({
  delivery: d,
  employee,
  shift,
  disabled,
  readOnly = false,
  couriers,
  text,
  submit,
}: {
  delivery: PosDeliverySummary;
  employee: PosEmployeeSession;
  shift: PosShiftSummary | null;
  disabled: boolean;
  readOnly?: boolean;
  couriers: CourierPickerState;
  text: (en: string, ar: string) => string;
  submit: (saved: PendingDeliveryWrite) => void;
}) {
  const openChecks = d.checks.filter((c) => c.balanceDue !== '0.00');
  const openCourierPayments = d.courierPayments.filter((p) => p.remaining !== '0.00');
  const [checkId, setCheckId] = useState(openChecks[0]?.id ?? '');
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState(
    openChecks[0]?.balanceDue ?? '',
  );
  const [method, setMethod] = useState<CustomerPaymentMethod>('courier');
  const [reference, setReference] = useState('');
  const [paymentId, setPaymentId] = useState(openCourierPayments[0]?.id ?? '');
  const [remitAmount, setRemitAmount] = useState(openCourierPayments[0]?.remaining ?? '');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [courierId, setCourierId] = useState(d.courierId ?? '');
  const mine = employee.permissions.includes('sell') && employee.branch.id === d.branchId;
  const progress = deliveryProgress(d);
  const selectedCourierId = couriers.options.some((courier) => courier.id === courierId)
    ? courierId
    : '';
  const action = (command: PosDeliveryCommand) =>
    submit({ branchId: d.branchId, orderId: d.orderId, kind: 'action', request: command });
  const base = () => ({ requestId: crypto.randomUUID(), revision: d.revision });
  const customerMoneyValid = /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(customerPaymentAmount);
  const remitMoneyValid = /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(remitAmount);
  const orderNumber = getPosOrderNumber({
    id: d.orderId,
    orderReference: d.orderReference,
    branchOrderNumber: d.branchOrderNumber,
  });

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
                amount: customerPaymentAmount,
                ...(reference.trim() ? { terminalReference: reference.trim() } : {}),
              }
            : {
                method: 'cash',
                amount: customerPaymentAmount,
                receivedAmount: customerPaymentAmount,
              },
        ],
      },
    });
  }

  const showDeliveryStep = mine && !readOnly && d.status === 'out_for_delivery';
  const showPaymentStep = mine && !readOnly && d.status !== 'failed' && !progress.paid;
  const showRemitStep = mine && !readOnly && d.courierCashHeld !== '0.00';
  const showRedispatchStep = mine && !readOnly && d.status === 'failed';
  // Number only the steps shown, so the cashier always sees 1, 2, 3 in order.
  const visibleSteps = [
    showDeliveryStep && 'delivery',
    showPaymentStep && 'payment',
    showRemitStep && 'remit',
    showRedispatchStep && 'redispatch',
  ].filter(Boolean);
  const stepNumber = (step: string) => visibleSteps.indexOf(step) + 1;

  return (
    <article className="grid gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <h3 className="m-0 text-base font-bold">
            {text('Order', 'طلب')} <bdi dir="ltr">#{orderNumber}</bdi>
          </h3>
          <p className="m-0 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Bike aria-hidden="true" size={15} />
            {text('Courier', 'الطيار')}: <strong className="text-foreground">{d.courierName}</strong>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            progress.done
              ? 'bg-success/15 text-success'
              : d.status === 'failed'
                ? 'bg-warning/15 text-warning'
                : 'bg-primary/10 text-primary'
          }`}
        >
          {progress.done
            ? text('Completed', 'خلص')
            : d.status === 'delivered'
              ? text('Delivered', 'وصل للعميل')
              : d.status === 'failed'
                ? text('Not delivered', 'ما وصلش')
                : text('Out with courier', 'مع الطيار')}
        </span>
      </header>

      <StepTrack d={d} text={text} />

      <div className="grid gap-2 sm:grid-cols-2">
        <MoneyStat
          label={text('Customer still owes', 'المتبقي على العميل')}
          amount={d.customerDue}
          settledLabel={text('Fully paid', 'مدفوع بالكامل')}
          text={text}
        />
        <MoneyStat
          label={text('Cash still with courier', 'كاش لسه مع الطيار')}
          amount={d.courierCashHeld}
          settledLabel={text('Nothing to collect', 'مفيش كاش معاه')}
          text={text}
        />
      </div>

      {d.failureReason && (
        <p className="m-0 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-warning" />
          <span>
            <strong>{text('Why it was not delivered', 'سبب عدم التوصيل')}: </strong>
            {d.failureReason}
          </span>
        </p>
      )}

      {!readOnly && !mine && (
        <p className="m-0 text-sm text-muted-foreground">
          {text(
            'This cashier does not have delivery access for this branch.',
            'الكاشير ده معندوش صلاحية دليفري للفرع.',
          )}
        </p>
      )}

      {mine && !readOnly && progress.done && (
        <p className="m-0 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 aria-hidden="true" size={16} />
          {text('Nothing left to do for this order.', 'الطلب ده خلص، مفيش حاجة مطلوبة.')}
        </p>
      )}

      {showDeliveryStep && (
        <StepSection
          number={stepNumber('delivery')}
          title={text('Did the customer receive the order?', 'الطلب وصل للعميل؟')}
          hint={text(
            'Ask the courier, then choose one answer.',
            'اسأل الطيار، واختار إجابة واحدة.',
          )}
        >
          {!reporting ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <PosButton
                variant="solid"
                className="min-h-12"
                disabled={disabled}
                onClick={() => action({ ...base(), action: 'delivered' })}
              >
                <Check aria-hidden="true" size={17} />
                {text('Yes, delivered', 'أيوه، وصل')}
              </PosButton>
              <PosButton
                className="min-h-12"
                disabled={disabled}
                onClick={() => setReporting(true)}
              >
                <X aria-hidden="true" size={17} />
                {text('No, not delivered', 'لأ، ما وصلش')}
              </PosButton>
            </div>
          ) : (
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                action({ ...base(), action: 'failed', reason: reason.trim() });
              }}
            >
              <label className="grid gap-1 text-sm font-medium">
                {text('What happened?', 'إيه اللي حصل؟')}
                <Input
                  autoFocus
                  placeholder={text(
                    'e.g. Customer did not answer',
                    'مثلًا: العميل مابيردش',
                  )}
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <PosButton
                  type="submit"
                  variant="destructive"
                  className="min-h-11"
                  disabled={disabled || !reason.trim()}
                >
                  {text('Save: not delivered', 'سجّل إنه ما وصلش')}
                </PosButton>
                <PosButton
                  type="button"
                  className="min-h-11"
                  onClick={() => {
                    setReporting(false);
                    setReason('');
                  }}
                >
                  {text('Back', 'رجوع')}
                </PosButton>
              </div>
            </form>
          )}
        </StepSection>
      )}

      {showPaymentStep && (
        <StepSection
          number={stepNumber('payment')}
          title={text('How did the customer pay?', 'العميل دفع إزاي؟')}
          hint={
            d.status === 'delivered'
              ? text(
                  'The order arrived. Record the money the customer paid.',
                  'الطلب وصل. سجّل الفلوس اللي العميل دفعها.',
                )
              : text(
                  'You can record it now or after the courier is back.',
                  'تقدر تسجلها دلوقتي أو لما الطيار يرجع.',
                )
          }
        >
          <form className="grid gap-3" onSubmit={payment}>
            <div
              role="radiogroup"
              aria-label={text('Payment method', 'طريقة الدفع')}
              className="grid gap-2 sm:grid-cols-3"
            >
              <ChoiceButton
                selected={method === 'courier'}
                icon={<Bike aria-hidden="true" size={16} />}
                title={text('Cash to the courier', 'كاش مع الطيار')}
                description={text(
                  'The courier has it. You receive it later.',
                  'الفلوس مع الطيار، وهتستلمها منه بعدين.',
                )}
                onClick={() => setMethod('courier')}
              />
              <ChoiceButton
                selected={method === 'cash'}
                disabled={!shift}
                icon={<Banknote aria-hidden="true" size={16} />}
                title={text('Cash in the drawer', 'كاش في الدرج')}
                description={text(
                  'The cash is already in your drawer.',
                  'الفلوس دخلت درج الكاشير خلاص.',
                )}
                onClick={() => setMethod('cash')}
              />
              <ChoiceButton
                selected={method === 'terminal'}
                disabled={!shift}
                icon={<CreditCard aria-hidden="true" size={16} />}
                title={text('Card machine', 'فيزا / ماكينة')}
                description={text(
                  'Paid by card on the payment machine.',
                  'اتدفعت بالكارت على الماكينة.',
                )}
                onClick={() => setMethod('terminal')}
              />
            </div>
            {!shift && (
              <p className="m-0 text-xs text-muted-foreground">
                {text(
                  'Open a shift to record drawer or card payments.',
                  'افتح وردية عشان تقدر تسجل كاش في الدرج أو فيزا.',
                )}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {openChecks.length > 1 && (
                <label className="grid gap-1 text-sm font-medium">
                  {text('Which bill?', 'أنهي حساب؟')}
                  <select
                    className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
                    value={checkId}
                    onChange={(e) => {
                      setCheckId(e.target.value);
                      setCustomerPaymentAmount(
                        openChecks.find((c) => c.id === e.target.value)?.balanceDue ?? '',
                      );
                    }}
                  >
                    {openChecks.map((c) => (
                      <option key={c.id} value={c.id}>
                        {text('Bill', 'الحساب')} {c.position + 1} · {c.balanceDue}{' '}
                        {text('EGP', 'ج.م.')}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="grid gap-1 text-sm font-medium">
                {text('Amount paid (EGP)', 'المبلغ المدفوع (ج.م.)')}
                <Input
                  inputMode="decimal"
                  dir="ltr"
                  required
                  className="min-h-11 text-base font-semibold tabular-nums"
                  value={customerPaymentAmount}
                  onChange={(event) => setCustomerPaymentAmount(event.target.value)}
                />
              </label>
              {method === 'terminal' && (
                <label className="grid gap-1 text-sm font-medium">
                  {text('Machine receipt number (optional)', 'رقم إيصال الماكينة (اختياري)')}
                  <Input
                    maxLength={80}
                    className="min-h-11"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
              )}
            </div>
            <PosButton
              type="submit"
              variant="solid"
              className="min-h-12 sm:justify-self-start"
              disabled={
                disabled || !customerMoneyValid || !checkId || (method !== 'courier' && !shift)
              }
            >
              <Check aria-hidden="true" size={17} />
              {customerMoneyValid
                ? text(
                    `Save payment of ${customerPaymentAmount} EGP`,
                    `سجّل دفع ${customerPaymentAmount} ج.م.`,
                  )
                : text('Save payment', 'سجّل الدفع')}
            </PosButton>
          </form>
        </StepSection>
      )}

      {showRemitStep && (
        <StepSection
          number={stepNumber('remit')}
          title={text('Take the cash from the courier', 'استلم الكاش من الطيار')}
          hint={text(
            'Count the money, put it in the drawer, then confirm. This does not charge the customer again.',
            'عِد الفلوس وحطها في الدرج، وبعدين أكّد. ده مش تحصيل تاني من العميل.',
          )}
        >
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              action({
                ...base(),
                action: 'remit',
                receivingShiftId: shift!.id,
                paymentId,
                amount: remitAmount,
              });
            }}
          >
            {openCourierPayments.length > 1 && (
              <label className="grid gap-1 text-sm font-medium sm:col-span-2">
                {text('Which payment?', 'أنهي دفعة؟')}
                <select
                  className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
                  value={paymentId}
                  onChange={(e) => {
                    setPaymentId(e.target.value);
                    setRemitAmount(
                      openCourierPayments.find((p) => p.id === e.target.value)?.remaining ?? '',
                    );
                  }}
                >
                  {openCourierPayments.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id.slice(0, 8)} · {p.remaining} {text('EGP', 'ج.م.')}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-1 text-sm font-medium">
              {text('Amount received (EGP)', 'المبلغ اللي استلمته (ج.م.)')}
              <Input
                inputMode="decimal"
                dir="ltr"
                required
                className="min-h-11 text-base font-semibold tabular-nums"
                value={remitAmount}
                onChange={(event) => setRemitAmount(event.target.value)}
              />
            </label>
            <PosButton
              type="submit"
              variant="solid"
              className="min-h-11"
              disabled={disabled || !shift || !paymentId || !remitMoneyValid}
            >
              <Wallet aria-hidden="true" size={17} />
              {text('Confirm cash received', 'أكّد إنك استلمت الكاش')}
            </PosButton>
          </form>
          {!shift && (
            <p className="m-0 text-xs text-muted-foreground">
              {text(
                'Open a shift to receive the cash into a drawer.',
                'افتح وردية عشان تستلم الكاش في الدرج.',
              )}
            </p>
          )}
        </StepSection>
      )}

      {showRedispatchStep && (
        <StepSection
          number={stepNumber('redispatch')}
          title={text('Send it out again', 'ابعته تاني')}
          hint={
            d.courierCashHeld !== '0.00'
              ? text(
                  'Receive the cash from the courier first, then send the order again.',
                  'استلم الكاش من الطيار الأول، وبعدين ابعت الطلب تاني.',
                )
              : text('Choose a courier for another attempt.', 'اختار طيار للمحاولة التانية.')
          }
        >
          <form
            className="grid gap-2 sm:grid-cols-[minmax(14rem,22rem)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              action({ ...base(), action: 'dispatch', courierId: selectedCourierId });
            }}
          >
            <CourierPicker
              label={text('Courier', 'الطيار')}
              value={selectedCourierId}
              onChange={setCourierId}
              disabled={disabled || d.courierCashHeld !== '0.00'}
              couriers={couriers}
              text={text}
            />
            <PosButton
              type="submit"
              variant="solid"
              className="min-h-11"
              disabled={
                disabled ||
                !selectedCourierId ||
                couriers.loading ||
                Boolean(couriers.error) ||
                d.courierCashHeld !== '0.00'
              }
            >
              <Bike aria-hidden="true" size={17} />
              {text('Send again', 'ابعته تاني')}
            </PosButton>
          </form>
        </StepSection>
      )}

      {Boolean(d.remittances?.length) && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {text('Cash received so far', 'الكاش اللي اتستلم قبل كده')}
          </summary>
          <ul className="m-0 grid gap-1.5 py-2 ps-4">
            {d.remittances?.map((r, i) => (
              <li key={`${r.shiftId}:${r.receivedAt}:${i}`}>
                <bdi dir="ltr">
                  {r.amount} {text('EGP', 'ج.م.')}
                </bdi>{' '}
                · {r.operatorName} ·{' '}
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(r.receivedAt))}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
