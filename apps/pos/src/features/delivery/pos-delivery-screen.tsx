import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Banknote,
  Bike,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  History as HistoryIcon,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  UserRound,
  Wallet,
  WifiOff,
  X,
  type LucideIcon,
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
import { Dialog, Input, useLocale } from '@waffarly/ui';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { getPosOrderNumber } from '../orders/pos-order-number.js';
import { apiRequest, ApiError } from '../../lib/api-client.js';
import { getCurrentPosShift, posCurrentShiftKey } from '../shifts/pos-shifts.api.js';
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
    recovery.scope === scope && recovery.pending?.branchId === branchId ? recovery.pending : null;
  const registerId = employee.deviceRegister?.id ?? '';
  const [cursor, setCursor] = useState<string | undefined>();
  const [readyCursor, setReadyCursor] = useState<string | undefined>();
  const [activeView, setActiveView] = useState<DeliveryView>('ready');
  const [courierFilter, setCourierFilter] = useState('');
  const [openOrders, setOpenOrders] = useState<Set<string>>(() => new Set());
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
    error: courierPages.error instanceof Error ? errorText(courierPages.error.message) : '',
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
  const followupGroups = groupByCourier(deliveryFollowups, locale);
  const cashGroups = groupByCourier(cashDeliveries, locale);
  // With several couriers out, the cashier can narrow a tab to one courier.
  const visibleFollowupGroups = courierFilter
    ? followupGroups.filter((group) => group.id === courierFilter)
    : followupGroups;
  const visibleCashGroups = courierFilter
    ? cashGroups.filter((group) => group.id === courierFilter)
    : cashGroups;
  function toggleOrder(orderId: string) {
    // One order popup at a time; reopening the same order closes it.
    setOpenOrders((current) => (current.has(orderId) ? new Set() : new Set([orderId])));
  }
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
  const tabs = [
    {
      id: 'ready',
      icon: PackageCheck,
      label: text('Ready to dispatch', 'جاهز للتوصيل'),
      count: ready.data?.items.length,
    },
    {
      id: 'delivery',
      icon: Bike,
      label: text('Delivery follow-up', 'متابعة التوصيل'),
      count: activeView === 'history' ? undefined : deliveryFollowups.length,
    },
    {
      id: 'cash',
      icon: Wallet,
      label: text('Courier cash', 'تحصيل كاش الطيار'),
      count: activeView === 'history' ? undefined : cashDeliveries.length,
    },
    {
      id: 'history',
      icon: HistoryIcon,
      label: text('History', 'السجل'),
      count: undefined,
    },
  ] as const;
  return (
    <section aria-labelledby="pos-delivery-heading" className="grid w-full gap-4 p-3 md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 id="pos-delivery-heading" className="m-0 text-xl font-bold">
            {text('Delivery follow-up', 'متابعة الدليفري')}
          </h1>
          <p className="m-0 text-sm text-muted-foreground">
            {text(
              'Send orders with couriers, follow them until delivery, and receive the cash.',
              'ابعت الطلبات مع الطيارين، تابعها لحد ما توصل، واستلم الكاش.',
            )}
          </p>
        </div>
        <PosButton
          size="sm"
          className="min-h-10"
          disabled={list.isFetching || ready.isFetching}
          onClick={() => {
            void list.refetch();
            void ready.refetch();
            // refetch() ignores `enabled`; an unpaired browser has no register shift to read.
            if (registerId) void shift.refetch();
            void courierPages.refetch();
          }}
        >
          <RefreshCw
            aria-hidden="true"
            size={14}
            className={list.isFetching || ready.isFetching ? 'animate-spin' : undefined}
          />
          {text('Refresh', 'تحديث')}
        </PosButton>
      </header>

      {error && (
        <p
          role="alert"
          className="m-0 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {errorText(error)}
        </p>
      )}
      {!online && (
        <p
          role="status"
          className="m-0 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <WifiOff aria-hidden="true" size={16} className="shrink-0 text-warning" />
          {text(
            'You are offline. New actions are paused until the connection is back.',
            'مفيش إنترنت. العمليات الجديدة متوقفة لحد ما النت يرجع.',
          )}
        </p>
      )}
      {pending && (
        <div
          role="alert"
          className="grid gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-warning" />
            <div className="grid gap-1">
              <strong>
                {text(
                  'Confirm the saved action before starting another.',
                  'أكد نتيجة العملية المحفوظة قبل ما تبدأ عملية تانية.',
                )}
              </strong>
              <p className="m-0 text-sm text-muted-foreground">
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
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PosButton
              variant="solid"
              disabled={!online || write.isPending || resolving}
              onClick={() => {
                setSavedResult('unknown');
                write.mutate(pending);
              }}
            >
              <RefreshCw aria-hidden="true" size={15} />
              {text('Retry the exact saved action', 'إعادة نفس العملية المحفوظة')}
            </PosButton>
            {savedResult === 'committed' && (
              <PosButton
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
        </div>
      )}

      <div
        role="tablist"
        aria-label={text('Delivery work queues', 'قوائم متابعة الدليفري')}
        className="grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        {tabs.map(({ id, icon: Icon, label, count }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              id={`delivery-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="delivery-tab-panel"
              onClick={() => {
                setActiveView(id);
                setCursor(undefined);
                setCourierFilter('');
              }}
              className={`flex min-h-14 items-center justify-between gap-2 rounded-xl border px-3 text-start text-sm font-semibold transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon
                  aria-hidden="true"
                  size={18}
                  className={active ? 'text-primary' : undefined}
                />
                <span className="truncate">{label}</span>
              </span>
              {count !== undefined && (
                <span
                  className={`min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums ${
                    count > 0
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {(list.data?.nextCursor || ready.data?.nextCursor) && (
        <p className="-mt-2 m-0 text-[11px] text-muted-foreground">
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
        className="grid gap-3"
      >
        {activeView === 'ready' && (
          <>
            <TabIntro
              icon={PackageCheck}
              text={text(
                'These orders are prepared. Choose a courier for each one and hand it over.',
                'الطلبات دي جاهزة. اختار طيار لكل طلب وسلّمه له.',
              )}
            />
            {ready.isLoading && (
              <LoadingState text={text('Loading orders…', 'جارٍ تحميل الطلبات…')} />
            )}
            {ready.data?.items.length === 0 && (
              <EmptyState
                icon={PackageCheck}
                title={text('No orders waiting', 'مفيش طلبات مستنية')}
                text={text(
                  'Prepared delivery orders will show up here.',
                  'طلبات الدليفري الجاهزة هتظهر هنا.',
                )}
              />
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
            <TabIntro
              icon={Bike}
              text={text(
                'Each order shows its next step. Follow the numbered steps from top to bottom.',
                'كل طلب مكتوب فيه الخطوة الجاية. امشي على الخطوات المترقمة من فوق لتحت.',
              )}
            />
            {list.isLoading && (
              <LoadingState text={text('Loading orders…', 'جارٍ تحميل الطلبات…')} />
            )}
            {list.data && deliveryFollowups.length === 0 && (
              <EmptyState
                icon={Bike}
                title={text('Nothing to follow up', 'مفيش متابعة مطلوبة')}
                text={text(
                  'Orders out with couriers will show up here.',
                  'الطلبات اللي خرجت مع الطيارين هتظهر هنا.',
                )}
              />
            )}
            <CourierFilter
              groups={followupGroups}
              value={courierFilter}
              onChange={setCourierFilter}
              text={text}
            />
            {visibleFollowupGroups.map(({ id, courierName, orders }) => {
              const outCount = orders.filter((order) => order.status === 'out_for_delivery').length;
              const dueCents = orders.reduce(
                (sum, order) => sum + amountToCents(order.customerDue),
                0,
              );
              return (
                <section key={id} className="grid gap-2">
                  <header className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <h3 className="m-0 flex items-center gap-2 text-base font-bold">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Bike aria-hidden="true" size={16} />
                      </span>
                      {courierName}
                      <span className="text-sm font-normal text-muted-foreground">
                        · {text(`${orders.length} orders`, `${orders.length} طلب`)}
                      </span>
                    </h3>
                    <p className="m-0 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>
                        {text('Still out', 'لسه برّه')}:{' '}
                        <strong className="text-foreground">{outCount}</strong>
                      </span>
                      {dueCents > 0 && (
                        <span>
                          {text('Customers owe', 'على العملاء')}:{' '}
                          <strong className="text-foreground tabular-nums">
                            <bdi dir="ltr">
                              {formatCents(dueCents, locale)} {text('EGP', 'ج.م.')}
                            </bdi>
                          </strong>
                        </span>
                      )}
                    </p>
                  </header>
                  {orders.map((delivery) => (
                    <DeliveryCard
                      key={`${delivery.orderId}:${delivery.revision}`}
                      delivery={delivery}
                      employee={employee}
                      shift={shift.data ?? null}
                      disabled={disabled || shift.isFetching || shift.isError}
                      showCourier={false}
                      expanded={openOrders.has(delivery.orderId)}
                      onToggle={() => toggleOrder(delivery.orderId)}
                      couriers={courierPicker}
                      text={text}
                      submit={submit}
                    />
                  ))}
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

        {activeView === 'cash' && (
          <>
            <TabIntro
              icon={Wallet}
              text={text(
                'Cash customers paid to couriers. Count it, put it in the drawer, then confirm. It counts toward the shift only after you confirm.',
                'الكاش اللي العملاء دفعوه للطيارين. عِدّه وحطه في الدرج وبعدين أكّد. مش بيتحسب على الوردية غير بعد التأكيد.',
              )}
            />
            {list.isLoading && (
              <LoadingState text={text('Loading cash balances…', 'جارٍ تحميل أرصدة الكاش…')} />
            )}
            {list.data && cashGroups.length === 0 && (
              <EmptyState
                icon={Wallet}
                title={text('No cash to receive', 'مفيش كاش مستني')}
                text={text(
                  'When a courier collects cash, it will show up here.',
                  'لما طيار يحصّل كاش من عميل، هيظهر هنا.',
                )}
              />
            )}
            <CourierFilter
              groups={cashGroups}
              value={courierFilter}
              onChange={setCourierFilter}
              text={text}
            />
            {visibleCashGroups.map(({ id, courierName, orders }) => {
              const totalCents = orders.reduce(
                (sum, order) => sum + amountToCents(order.courierCashHeld),
                0,
              );
              return (
                <section
                  key={id}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 sm:px-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Bike aria-hidden="true" size={15} />
                      </span>
                      <div className="grid">
                        <h3 className="m-0 text-sm font-bold">{courierName}</h3>
                        <p className="m-0 text-[11px] text-muted-foreground">
                          {text(
                            `${orders.length} order${orders.length === 1 ? '' : 's'} with cash`,
                            `${orders.length} طلب معاه كاش منهم`,
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1">
                      <span className="text-[11px] text-muted-foreground">
                        {text('Total cash with courier', 'إجمالي الكاش مع الطيار')}
                      </span>
                      <strong className="text-sm tabular-nums">
                        <bdi dir="ltr">
                          {formatCents(totalCents, locale)} {text('EGP', 'ج.م.')}
                        </bdi>
                      </strong>
                    </div>
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
            <TabIntro
              icon={HistoryIcon}
              text={text(
                'Delivered orders where the customer paid and the courier handed over all the cash.',
                'الطلبات اللي اتسلمت، والعميل دفع، والطيار سلّم الكاش كله.',
              )}
            />
            {list.isLoading && (
              <LoadingState text={text('Loading history…', 'جارٍ تحميل السجل…')} />
            )}
            {list.data && historyDeliveries.length === 0 && (
              <EmptyState
                icon={HistoryIcon}
                title={text('No completed deliveries yet', 'لسه مفيش طلبات مكتملة')}
                text={text(
                  'Fully settled deliveries will show up here.',
                  'الطلبات اللي خلصت حسابها بالكامل هتظهر هنا.',
                )}
              />
            )}
            {historyDeliveries.map((delivery) => (
              <DeliveryCard
                key={`${delivery.orderId}:${delivery.revision}`}
                delivery={delivery}
                employee={employee}
                shift={shift.data ?? null}
                disabled
                readOnly
                expanded={openOrders.has(delivery.orderId)}
                onToggle={() => toggleOrder(delivery.orderId)}
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
    </section>
  );
}

type CourierGroup = { id: string; courierName: string; orders: PosDeliverySummary[] };

/** Groups orders under their courier, sorted by courier name. Old records group by name. */
function groupByCourier(orders: PosDeliverySummary[], locale: string): CourierGroup[] {
  return Array.from(
    orders.reduce((groups, delivery) => {
      const identity = delivery.courierId ?? `legacy:${delivery.courierName}`;
      const group = groups.get(identity);
      if (group) group.orders.push(delivery);
      else groups.set(identity, { courierName: delivery.courierName, orders: [delivery] });
      return groups;
    }, new Map<string, { courierName: string; orders: PosDeliverySummary[] }>()),
  )
    .map(([id, group]) => ({ id, ...group }))
    .sort((left, right) => left.courierName.localeCompare(right.courierName, locale));
}

/** "All couriers" plus one chip per courier with how many orders they have in this tab. */
function CourierFilter({
  groups,
  value,
  onChange,
  text,
}: {
  groups: CourierGroup[];
  value: string;
  onChange: (courierId: string) => void;
  text: (en: string, ar: string) => string;
}) {
  if (groups.length < 2) return null;
  const total = groups.reduce((sum, group) => sum + group.orders.length, 0);
  const chips = [
    { id: '', label: text('All couriers', 'كل الطيارين'), count: total },
    ...groups.map((group) => ({
      id: group.id,
      label: group.courierName,
      count: group.orders.length,
    })),
  ];
  return (
    <div
      role="group"
      aria-label={text('Filter by courier', 'فلتر حسب الطيار')}
      className="flex flex-wrap gap-2"
    >
      {chips.map((chip) => {
        const active = value === chip.id;
        return (
          <button
            key={chip.id || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.id)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {chip.id && <Bike aria-hidden="true" size={13} />}
            {chip.label}
            <span className="tabular-nums opacity-80">{chip.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function TabIntro({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <p className="m-0 flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
      <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" size={22} />
      </span>
      <strong className="text-sm">{title}</strong>
      <p className="m-0 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <p role="status" className="m-0 flex items-center gap-2 p-3 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
      {text}
    </p>
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
  const [open, setOpen] = useState(false);
  const [courierId, setCourierId] = useState('');
  const orderNumber = getPosOrderNumber({
    id: order.id,
    orderReference: order.orderReference,
    branchOrderNumber: order.branchOrderNumber,
  });
  return (
    <article className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:px-4">
      {/* Compact row: choosing the courier happens in a popup so long lists stay clean. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <strong className="text-sm">
          {text('Order', 'طلب')} <bdi dir="ltr">#{orderNumber}</bdi>
        </strong>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
          <PackageCheck aria-hidden="true" size={12} />
          {text('Ready', 'جاهز')}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <UserRound aria-hidden="true" size={13} className="shrink-0" />
          <span className="truncate">
            {order.customerName || text('Customer name unavailable', 'اسم العميل غير متاح')}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="rounded-lg bg-muted/50 px-2 py-1 text-xs">
          {text('Total', 'الإجمالي')}{' '}
          <strong className="tabular-nums">
            <bdi dir="ltr">
              {order.total} {text('EGP', 'ج.م.')}
            </bdi>
          </strong>
        </span>
        <PosButton
          type="button"
          variant="solid"
          size="sm"
          className="min-h-9"
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <Bike aria-hidden="true" size={14} />
          {text('Hand over to courier', 'سلّمه للطيار')}
        </PosButton>
      </span>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`${text('Hand over', 'تسليم للطيار')} · ${text('Order', 'طلب')} #${orderNumber}`}
        closeLabel={text('Close', 'إغلاق')}
        className="w-[min(480px,calc(100%-24px))] [&_[data-slot=dialog-header]]:px-4 [&_[data-slot=dialog-header]]:py-3 [&_[data-slot=dialog-header]_h2]:text-base [&_[data-slot=dialog-header]_button]:size-9"
      >
        <form
          className="grid gap-2.5 p-3 sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(courierId);
            setOpen(false);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-xs">
            <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
              <UserRound aria-hidden="true" size={13} className="shrink-0" />
              <span className="truncate">
                {order.customerName || text('Customer name unavailable', 'اسم العميل غير متاح')}
              </span>
            </span>
            <span>
              {text('Total', 'الإجمالي')}{' '}
              <strong className="text-sm tabular-nums">
                <bdi dir="ltr">
                  {order.total} {text('EGP', 'ج.م.')}
                </bdi>
              </strong>
            </span>
          </div>
          <CourierPicker
            label={text('Which courier is taking it?', 'مين الطيار اللي هياخده؟')}
            value={courierId}
            onChange={setCourierId}
            disabled={disabled}
            couriers={couriers}
            text={text}
          />
          <div className="flex flex-wrap gap-2">
            <PosButton
              type="submit"
              variant="solid"
              className="min-h-10"
              disabled={
                disabled ||
                !courierId ||
                couriers.loading ||
                Boolean(couriers.error) ||
                !couriers.options.some((courier) => courier.id === courierId)
              }
            >
              <Bike aria-hidden="true" size={15} />
              {text('Hand over to courier', 'سلّمه للطيار')}
            </PosButton>
            <PosButton type="button" className="min-h-10" onClick={() => setOpen(false)}>
              {text('Cancel', 'إلغاء')}
            </PosButton>
          </div>
        </form>
      </Dialog>
    </article>
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
      <label className="grid gap-1 text-sm font-medium">
        {label}
        <select
          aria-label={label}
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
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

const LATE_DELIVERY_MINUTES = 45;

/** Time since an event in minutes or hours, e.g. 35 -> "35 min", 130 -> "2 h". */
function formatElapsed(iso: string, text: (en: string, ar: string) => string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return text(`${minutes} min`, `${minutes} دقيقة`);
  const hours = Math.floor(minutes / 60);
  return text(`${hours} h`, `${hours} ساعة`);
}

/** Short day-and-time label for delivery events, e.g. "11/26, 5:40 PM". */
function formatDeliveryTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
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
  const openPayments = d.courierPayments.filter((payment) => payment.remaining !== '0.00');
  const [open, setOpen] = useState(false);
  const [paymentId, setPaymentId] = useState(openPayments[0]?.id ?? '');
  const [amount, setAmount] = useState(openPayments[0]?.remaining ?? '');
  const mine = employee.permissions.includes('sell') && employee.branch.id === d.branchId;
  const selectedPayment = d.courierPayments.find((payment) => payment.id === paymentId);
  const moneyValid = /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(amount);
  const orderNumber = getPosOrderNumber({
    id: d.orderId,
    orderReference: d.orderReference,
    branchOrderNumber: d.branchOrderNumber,
  });

  return (
    <article className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
      {/* Compact row: the receive form opens in a popup so long lists stay clean. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <strong className="text-sm">
          {text('Order', 'طلب')} <bdi dir="ltr">#{orderNumber}</bdi>
        </strong>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            d.status === 'delivered'
              ? 'bg-success/15 text-success'
              : d.status === 'failed'
                ? 'bg-warning/15 text-warning'
                : 'bg-primary/10 text-primary'
          }`}
        >
          {d.status === 'delivered'
            ? text('Delivered', 'وصل للعميل')
            : d.status === 'failed'
              ? text('Not delivered', 'ما وصلش')
              : text('Out with courier', 'مع الطيار')}
        </span>
        {d.customerDue !== '0.00' && (
          <span className="text-[11px] text-muted-foreground">
            {text('Customer still owes', 'لسه على العميل')} <bdi dir="ltr">{d.customerDue}</bdi>
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <span className="rounded-lg bg-warning/10 px-2 py-1 text-xs">
          {text('To receive', 'المطلوب')}{' '}
          <strong className="tabular-nums">
            <bdi dir="ltr">
              {d.courierCashHeld} {text('EGP', 'ج.م.')}
            </bdi>
          </strong>
        </span>
        {mine ? (
          <PosButton
            type="button"
            variant="solid"
            size="sm"
            className="min-h-9"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            <Wallet aria-hidden="true" size={14} />
            {text('Receive cash', 'استلم الكاش')}
          </PosButton>
        ) : (
          <span className="max-w-48 text-[11px] text-muted-foreground">
            {text(
              'A cashier with delivery access for this branch can receive it.',
              'كاشير عنده صلاحية دليفري للفرع يقدر يستلمه.',
            )}
          </span>
        )}
      </span>

      {mine && (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title={`${text('Receive cash', 'استلام كاش')} · ${text('Order', 'طلب')} #${orderNumber} · ${d.courierName}`}
          closeLabel={text('Close', 'إغلاق')}
          className="w-[min(480px,calc(100%-24px))] [&_[data-slot=dialog-header]]:px-4 [&_[data-slot=dialog-header]]:py-3 [&_[data-slot=dialog-header]_h2]:text-base [&_[data-slot=dialog-header]_button]:size-9"
        >
          <form
            className="grid gap-2.5 p-3 sm:p-4"
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
            <MoneyStat
              label={text('Cash with the courier', 'الكاش اللي مع الطيار')}
              amount={d.courierCashHeld}
              settledLabel={text('Nothing to collect', 'مفيش كاش معاه')}
              text={text}
            />
            <p className="m-0 text-[11px] leading-snug text-muted-foreground">
              {text(
                'Count the money, put it in the drawer, then confirm. This does not charge the customer again.',
                'عِد الفلوس وحطها في الدرج، وبعدين أكّد. ده مش تحصيل تاني من العميل.',
              )}
            </p>
            {openPayments.length > 1 && (
              <label className="grid gap-1 text-xs font-medium">
                {text('Which payment?', 'أنهي دفعة؟')}
                <select
                  className="min-h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={paymentId}
                  onChange={(event) => {
                    const nextPaymentId = event.target.value;
                    setPaymentId(nextPaymentId);
                    setAmount(
                      d.courierPayments.find((payment) => payment.id === nextPaymentId)
                        ?.remaining ?? '',
                    );
                  }}
                >
                  {openPayments.map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      #{payment.id.slice(0, 8)} · {payment.remaining} {text('EGP', 'ج.م.')}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-1 text-xs font-medium">
              {text('Amount received (EGP)', 'المبلغ اللي استلمته (ج.م.)')}
              <Input
                inputMode="decimal"
                dir="ltr"
                required
                className="min-h-10 text-sm font-semibold tabular-nums"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            {!shift && (
              <p className="m-0 text-[11px] text-muted-foreground">
                {text(
                  'Open a shift to receive the cash into a drawer.',
                  'افتح وردية عشان تستلم الكاش في الدرج.',
                )}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <PosButton
                type="submit"
                variant="solid"
                className="min-h-10"
                disabled={disabled || !shift || !paymentId || !selectedPayment || !moneyValid}
              >
                <Check aria-hidden="true" size={15} />
                {text('Confirm cash received', 'أكّد إنك استلمت الكاش')}
              </PosButton>
              <PosButton type="button" className="min-h-10" onClick={() => setOpen(false)}>
                {text('Cancel', 'إلغاء')}
              </PosButton>
            </div>
          </form>
        </Dialog>
      )}
    </article>
  );
}

// Card-machine payments are not supported for deliveries yet; only cash is offered.
type CustomerPaymentMethod = 'courier' | 'cash';

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
      label:
        d.status === 'failed' ? text('Not delivered', 'ما وصلش') : text('Delivered', 'وصل للعميل'),
      state: progress.delivered ? 'done' : d.status === 'failed' ? 'failed' : 'todo',
    },
    { label: text('Customer paid', 'العميل دفع'), state: progress.paid ? 'done' : 'todo' },
    {
      label: text('Cash in drawer', 'الكاش في الدرج'),
      state: progress.cashInDrawer ? 'done' : 'todo',
    },
  ];
  return (
    <ol
      className="m-0 grid list-none grid-cols-4 gap-1 p-0"
      aria-label={text('Delivery progress', 'مراحل الطلب')}
    >
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
      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${
        settled ? 'border-border bg-muted/20' : 'border-warning/40 bg-warning/10'
      }`}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      {settled ? (
        <strong className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 aria-hidden="true" size={13} />
          {settledLabel}
        </strong>
      ) : (
        <strong className="text-sm tabular-nums">
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
    <section className="grid gap-2 rounded-lg border border-border bg-background/40 p-2.5">
      <header className="flex items-start gap-2">
        <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {number}
        </span>
        <div className="grid">
          <h4 className="m-0 text-[13px] font-semibold">{title}</h4>
          {hint && <p className="m-0 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
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
      className={`grid gap-0.5 rounded-lg border px-2.5 py-2 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary'
          : 'border-border bg-card hover:bg-secondary'
      }`}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-semibold">
        {icon}
        {title}
      </span>
      <span className="text-[11px] leading-snug text-muted-foreground">{description}</span>
    </button>
  );
}

function DeliveryCard({
  delivery: d,
  employee,
  shift,
  disabled,
  readOnly = false,
  showCourier = true,
  expanded,
  onToggle,
  couriers,
  text,
  submit,
}: {
  delivery: PosDeliverySummary;
  employee: PosEmployeeSession;
  shift: PosShiftSummary | null;
  disabled: boolean;
  readOnly?: boolean;
  /** Hidden when the card already sits under its courier's group heading. */
  showCourier?: boolean;
  /** Kept by the screen so a card stays open after its revision changes. */
  expanded: boolean;
  onToggle: () => void;
  couriers: CourierPickerState;
  text: (en: string, ar: string) => string;
  submit: (saved: PendingDeliveryWrite) => void;
}) {
  // An order still out after this long is highlighted so it is not forgotten.
  const late =
    d.status === 'out_for_delivery' &&
    Date.now() - new Date(d.dispatchedAt).getTime() > LATE_DELIVERY_MINUTES * 60_000;
  const openChecks = d.checks.filter((c) => c.balanceDue !== '0.00');
  const openCourierPayments = d.courierPayments.filter((p) => p.remaining !== '0.00');
  const [checkId, setCheckId] = useState(openChecks[0]?.id ?? '');
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState(
    openChecks[0]?.balanceDue ?? '',
  );
  const [method, setMethod] = useState<CustomerPaymentMethod>('courier');
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
          {
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
    <article
      className={`overflow-hidden rounded-xl border bg-card shadow-sm ${
        late ? 'border-warning/60' : 'border-border'
      }`}
    >
      {/* Compact summary row: many orders stay scannable; tap to open the steps. */}
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 p-3 text-start hover:bg-secondary/40 sm:px-4"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <strong className="text-base">
            {text('Order', 'طلب')} <bdi dir="ltr">#{orderNumber}</bdi>
          </strong>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
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
          {showCourier && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Bike aria-hidden="true" size={14} />
              {d.courierName}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              late ? 'font-semibold text-warning' : 'text-muted-foreground'
            }`}
            title={formatDeliveryTime(d.dispatchedAt)}
          >
            <Clock3 aria-hidden="true" size={13} />
            {d.status === 'out_for_delivery'
              ? `${text('Out for', 'خرج من')} ${formatElapsed(d.dispatchedAt, text)}`
              : d.deliveredAt
                ? `${text('Delivered', 'وصل')} ${formatDeliveryTime(d.deliveredAt)}`
                : `${text('Left', 'خرج')} ${formatDeliveryTime(d.dispatchedAt)}`}
            {late && ` · ${text('taking long', 'متأخر')}`}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {d.customerDue !== '0.00' && (
            <span className="rounded-lg bg-warning/10 px-2 py-1 text-xs">
              {text('Owes', 'على العميل')}{' '}
              <strong className="tabular-nums">
                <bdi dir="ltr">{d.customerDue}</bdi>
              </strong>
            </span>
          )}
          {d.courierCashHeld !== '0.00' && (
            <span className="rounded-lg bg-warning/10 px-2 py-1 text-xs">
              {text('With courier', 'مع الطيار')}{' '}
              <strong className="tabular-nums">
                <bdi dir="ltr">{d.courierCashHeld}</bdi>
              </strong>
            </span>
          )}
          <span className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary">
            {readOnly ? text('Details', 'التفاصيل') : text('Open order', 'افتح الطلب')}
            <ChevronRight aria-hidden="true" size={15} className="rtl:rotate-180" />
          </span>
        </span>
      </button>

      {/* The steps open in a popup so a long list of orders stays a clean list. */}
      <Dialog
        open={expanded}
        onOpenChange={(open) => {
          if (!open) onToggle();
        }}
        title={`${text('Order', 'طلب')} #${orderNumber} · ${d.courierName}`}
        closeLabel={text('Close', 'إغلاق')}
        className="w-[min(620px,calc(100%-24px))] [&_[data-slot=dialog-header]]:px-4 [&_[data-slot=dialog-header]]:py-3 [&_[data-slot=dialog-header]_h2]:text-base [&_[data-slot=dialog-header]_button]:size-9"
      >
        <div id={`delivery-${d.orderId}-details`} className="grid gap-2.5 p-3 sm:p-4">
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
              <AlertTriangle
                aria-hidden="true"
                size={16}
                className="mt-0.5 shrink-0 text-warning"
              />
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
                    className="min-h-10"
                    disabled={disabled}
                    onClick={() => action({ ...base(), action: 'delivered' })}
                  >
                    <Check aria-hidden="true" size={15} />
                    {text('Yes, delivered', 'أيوه، وصل')}
                  </PosButton>
                  <PosButton
                    className="min-h-10"
                    disabled={disabled}
                    onClick={() => setReporting(true)}
                  >
                    <X aria-hidden="true" size={15} />
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
                  <label className="grid gap-1 text-xs font-medium">
                    {text('What happened?', 'إيه اللي حصل؟')}
                    <Input
                      autoFocus
                      placeholder={text('e.g. Customer did not answer', 'مثلًا: العميل مابيردش')}
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
                      className="min-h-10"
                      disabled={disabled || !reason.trim()}
                    >
                      {text('Save: not delivered', 'سجّل إنه ما وصلش')}
                    </PosButton>
                    <PosButton
                      type="button"
                      className="min-h-10"
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
                  className="grid gap-2 sm:grid-cols-2"
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
                </div>
                {!shift && (
                  <p className="m-0 text-xs text-muted-foreground">
                    {text(
                      'Open a shift to record cash in the drawer.',
                      'افتح وردية عشان تقدر تسجل كاش في الدرج.',
                    )}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {openChecks.length > 1 && (
                    <label className="grid gap-1 text-xs font-medium">
                      {text('Which bill?', 'أنهي حساب؟')}
                      <select
                        className="min-h-10 w-full rounded-lg border border-input bg-background px-3"
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
                  <label className="grid gap-1 text-xs font-medium">
                    {text('Amount paid (EGP)', 'المبلغ المدفوع (ج.م.)')}
                    <Input
                      inputMode="decimal"
                      dir="ltr"
                      required
                      className="min-h-10 text-sm font-semibold tabular-nums"
                      value={customerPaymentAmount}
                      onChange={(event) => setCustomerPaymentAmount(event.target.value)}
                    />
                  </label>
                </div>
                <PosButton
                  type="submit"
                  variant="solid"
                  className="min-h-10 sm:justify-self-start"
                  disabled={
                    disabled || !customerMoneyValid || !checkId || (method !== 'courier' && !shift)
                  }
                >
                  <Check aria-hidden="true" size={15} />
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
                  <label className="grid gap-1 text-xs font-medium sm:col-span-2">
                    {text('Which payment?', 'أنهي دفعة؟')}
                    <select
                      className="min-h-10 w-full rounded-lg border border-input bg-background px-3"
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
                <label className="grid gap-1 text-xs font-medium">
                  {text('Amount received (EGP)', 'المبلغ اللي استلمته (ج.م.)')}
                  <Input
                    inputMode="decimal"
                    dir="ltr"
                    required
                    className="min-h-10 text-sm font-semibold tabular-nums"
                    value={remitAmount}
                    onChange={(event) => setRemitAmount(event.target.value)}
                  />
                </label>
                <PosButton
                  type="submit"
                  variant="solid"
                  className="min-h-10"
                  disabled={disabled || !shift || !paymentId || !remitMoneyValid}
                >
                  <Wallet aria-hidden="true" size={15} />
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
                  className="min-h-10"
                  disabled={
                    disabled ||
                    !selectedCourierId ||
                    couriers.loading ||
                    Boolean(couriers.error) ||
                    d.courierCashHeld !== '0.00'
                  }
                >
                  <Bike aria-hidden="true" size={15} />
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
        </div>
      </Dialog>
    </article>
  );
}
