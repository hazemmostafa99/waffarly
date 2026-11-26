import { useEffect, useState, type FormEvent } from 'react';
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
            {text('Refresh', 'تحديث')}
          </PosButton>
        </div>
        <p className="-mt-2 text-[11px] text-muted-foreground">
          {text(
            'Counts reflect the orders on the current page.',
            'الأعداد بتوضح الطلبات الظاهرة في الصفحة الحالية.',
          )}
        </p>

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
                <p className="m-0 text-xs text-muted-foreground">
                  {text(
                    'Confirm delivery, record a failed attempt, or collect an outstanding customer payment.',
                    'أكد التوصيل، سجل محاولة فاشلة، أو سجل المبلغ المتبقي على العميل.',
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
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
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
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState('');
  const [remitAmount, setRemitAmount] = useState(
    d.courierPayments.find((payment) => payment.remaining !== '0.00')?.remaining ?? '',
  );
  const [reason, setReason] = useState('');
  const [courierId, setCourierId] = useState(d.courierId ?? '');
  const [checkId, setCheckId] = useState(d.checks.find((c) => c.balanceDue !== '0.00')?.id ?? '');
  const [paymentId, setPaymentId] = useState(
    d.courierPayments.find((p) => p.remaining !== '0.00')?.id ?? '',
  );
  const [method, setMethod] = useState<'courier' | 'cash' | 'terminal'>('courier');
  const [reference, setReference] = useState('');
  const mine = employee.permissions.includes('sell') && employee.branch.id === d.branchId;
  const selectedCourierId = couriers.options.some((courier) => courier.id === courierId)
    ? courierId
    : '';
  const action = (command: PosDeliveryCommand) =>
    submit({ branchId: d.branchId, orderId: d.orderId, kind: 'action', request: command });
  const base = () => ({ requestId: crypto.randomUUID(), revision: d.revision });
  const customerMoneyValid = /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(customerPaymentAmount);
  const remitMoneyValid = /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(remitAmount);
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
  return (
    <article className="grid gap-3 rounded-lg border border-border bg-card p-3">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">
            {text('Order', 'طلب')}{' '}
            <bdi dir="ltr">
              #
              {getPosOrderNumber({
                id: d.orderId,
                orderReference: d.orderReference,
                branchOrderNumber: d.branchOrderNumber,
              })}
            </bdi>
          </h3>
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${d.status === 'failed' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}
          >
            {d.status === 'delivered'
              ? text('Delivered', 'تم التوصيل')
              : d.status === 'failed'
                ? text('Delivery failed', 'تعذر التوصيل')
                : text('Out with courier', 'خرج مع الطيار')}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {text('Courier', 'الطيار')}: {d.courierName}
        </p>
        {d.failureReason && <p className="mt-2 text-sm text-warning">{d.failureReason}</p>}
      </header>
      <div className="grid gap-2 sm:grid-cols-2">
        <p className="rounded-lg bg-muted/30 p-3">
          <span className="block text-xs text-muted-foreground">
            {text('Customer balance due', 'المتبقي على العميل')}
          </span>
          <strong className="mt-1 block tabular-nums">
            <bdi dir="ltr">
              {d.customerDue} {text('EGP', 'ج.م.')}
            </bdi>
          </strong>
        </p>
        <p className="rounded-lg bg-muted/30 p-3">
          <span className="block text-xs text-muted-foreground">
            {text('Courier cash to receive', 'كاش مطلوب من الطيار')}
          </span>
          <strong className="mt-1 block tabular-nums">
            <bdi dir="ltr">
              {d.courierCashHeld} {text('EGP', 'ج.م.')}
            </bdi>
          </strong>
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
        {mine && d.status === 'out_for_delivery' && (
          <PosButton disabled={disabled} onClick={() => action({ ...base(), action: 'delivered' })}>
            {text('Confirm delivered to customer', 'تأكيد وصل للعميل')}
          </PosButton>
        )}
      </div>
      {!readOnly && !mine && (
        <p className="text-muted-foreground">
          {text(
            'This cashier does not have delivery access for this branch.',
            'الكاشير ده معندوش صلاحية دليفري للفرع.',
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
          className="grid gap-2 sm:grid-cols-[minmax(14rem,22rem)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            action({ ...base(), action: 'dispatch', courierId: selectedCourierId });
          }}
        >
          <CourierPicker
            label={text('Choose a courier', 'اختار الطيار')}
            value={selectedCourierId}
            onChange={setCourierId}
            disabled={disabled || d.courierCashHeld !== '0.00'}
            couriers={couriers}
            text={text}
          />
          <PosButton
            type="submit"
            disabled={
              disabled ||
              !selectedCourierId ||
              couriers.loading ||
              Boolean(couriers.error) ||
              d.courierCashHeld !== '0.00'
            }
          >
            {text('Send again', 'خروج للتوصيل مرة تانية')}
          </PosButton>
        </form>
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
          <label className="grid max-w-xs gap-1">
            {text('Customer payment amount', 'المبلغ اللي دفعه العميل')}
            <Input
              inputMode="decimal"
              required
              value={customerPaymentAmount}
              onChange={(event) => setCustomerPaymentAmount(event.target.value)}
            />
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
            disabled={
              disabled || !customerMoneyValid || !checkId || (method !== 'courier' && !shift)
            }
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
            action({
              ...base(),
              action: 'remit',
              receivingShiftId: shift!.id,
              paymentId,
              amount: remitAmount,
            });
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
              onChange={(e) => {
                setPaymentId(e.target.value);
                setRemitAmount(
                  d.courierPayments.find((payment) => payment.id === e.target.value)?.remaining ??
                    '',
                );
              }}
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
          <label className="grid max-w-xs gap-1">
            {text('Amount received from courier', 'المبلغ المستلم من الطيار')}
            <Input
              inputMode="decimal"
              required
              value={remitAmount}
              onChange={(event) => setRemitAmount(event.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {text(
              'This receives existing courier money; it does not charge the customer again.',
              'ده استلام فلوس موجودة مع الطيار؛ مش تحصيل تاني من العميل.',
            )}
          </p>
          <PosButton type="submit" disabled={disabled || !shift || !paymentId || !remitMoneyValid}>
            {text('Confirm cash actually received', 'تأكيد الكاش اللي استلمته فعلًا')}
          </PosButton>
        </form>
      )}
    </article>
  );
}
