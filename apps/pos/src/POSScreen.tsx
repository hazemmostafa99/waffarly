import type { PosEmployeeSession, StorefrontOrderSummary } from '@waffarly/contracts';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { cn, useLocale } from '@waffarly/ui';
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PosButton } from './components/pos-button.js';
import { ApiError } from './lib/api-client.js';
import {
  orderActionMessage,
  formatOrderActionError,
} from './features/orders/order-action-errors.js';
import {
  isRegisterPairingError,
  requirePairedRegister,
} from './features/registers/register-pairing-prompt.js';
import { PickupCollection } from './features/payments/pickup-collection.js';
import {
  posWorkspaceScope,
  usePosWorkspaceStore,
  type PendingPosAction,
} from './app/pos-workspace-store.js';
import {
  posOrderKeys,
  listPosOrders,
  runPosOrderAction,
} from './features/orders/pos-orders.api.js';

type LayoutContext = { employee: PosEmployeeSession };

export function POSScreen() {
  const { employee } = useOutletContext<LayoutContext>();
  const { t, locale, errorText, formatDate, formatNumber } = useLocale();
  const queryClient = useQueryClient();
  const scope = posWorkspaceScope(employee.merchantId, employee.id);
  const workspace = usePosWorkspaceStore((state) =>
    state.activeScope === scope ? state.workspace : null,
  );
  const hydratedScope = usePosWorkspaceStore((state) => state.hydratedScope);
  const persistenceError = usePosWorkspaceStore((state) => state.persistenceError);
  const hydrate = usePosWorkspaceStore((state) => state.hydrate);
  const savePendingAction = usePosWorkspaceStore((state) => state.savePendingAction);
  const removePendingAction = usePosWorkspaceStore((state) => state.removePendingAction);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [activePageIndex, setActivePageIndex] = useState(0);
  const isWorkspaceHydrated = hydratedScope === scope;
  const branchId = employee.branch.id;

  useEffect(() => {
    hydrate(employee.merchantId, employee.id);
  }, [employee.id, employee.merchantId, hydrate]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const ordersQuery = useInfiniteQuery({
    queryKey: posOrderKeys.branch(employee.merchantId, branchId),
    queryFn: ({ pageParam, signal }) => listPosOrders(branchId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: isWorkspaceHydrated && Boolean(branchId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  useEffect(() => {
    setActivePageIndex(0);
  }, [branchId]);

  const actionMutation = useMutation({
    mutationFn: ({ orderId, action }: { orderId: string; action: PendingPosAction }) =>
      runPosOrderAction(orderId, action),
  });

  const loadedPages = ordersQuery.data?.pages ?? [];
  const currentPageIndex = Math.min(activePageIndex, Math.max(loadedPages.length - 1, 0));
  const orders = loadedPages[currentPageIndex]?.items ?? [];
  const hasLoadedNextPage = currentPageIndex < loadedPages.length - 1;
  const canGoToNextPage = hasLoadedNextPage || (ordersQuery.hasNextPage && !ordersQuery.isFetching);
  const pendingActions = workspace?.pendingActions ?? {};
  const activeOrderId = actionMutation.isPending ? actionMutation.variables?.orderId : null;
  const ordersQueryError = ordersQuery.error instanceof Error ? ordersQuery.error.message : '';
  const queueRefreshingWithSavedData =
    ordersQuery.isFetching && !ordersQuery.isFetchingNextPage && Boolean(ordersQuery.data);
  const queueNeedsFreshRead = ordersQuery.isRefetchError || queueRefreshingWithSavedData;

  async function goToNextPage() {
    const nextPageIndex = currentPageIndex + 1;
    if (hasLoadedNextPage) {
      setActivePageIndex(nextPageIndex);
      return;
    }
    if (!ordersQuery.hasNextPage || ordersQuery.isFetching) return;

    const result = await ordersQuery.fetchNextPage();
    if (result.data?.pages[nextPageIndex]) setActivePageIndex(nextPageIndex);
  }

  async function performAction(
    order: StorefrontOrderSummary,
    saved?: PendingPosAction,
    readyLineId?: string,
  ) {
    if (actionMutation.isPending || !isOnline || (queueNeedsFreshRead && !saved)) return;
    const pending =
      saved ??
      (readyLineId
        ? { action: 'item_ready' as const, requestId: crypto.randomUUID(), lineId: readyLineId }
        : order.status === 'pending'
          ? { action: 'accept' as const, requestId: crypto.randomUUID(), branchId }
          : order.status === 'accepted'
            ? { action: 'prepare' as const, requestId: crypto.randomUUID(), branchId }
            : order.status === 'preparing'
              ? { action: 'ready' as const, requestId: crypto.randomUUID(), branchId }
              : order.status === 'cancelled'
                ? { action: 'cancel_ack' as const, requestId: crypto.randomUUID() }
                : { action: 'handover' as const, requestId: crypto.randomUUID(), branchId });
    const requiredPermission =
      pending.action === 'accept'
        ? 'accept_recipe_orders'
        : pending.action === 'cancel_ack'
          ? 'accept_recipe_orders'
          : pending.action === 'handover'
            ? 'sell'
            : 'start_preparation';
    if (!employee.permissions.includes(requiredPermission)) return;
    // Ask for the register before saving a command that this browser cannot send.
    if (!requirePairedRegister(employee)) return;
    try {
      // Write the exact idempotent command before sending it. A timeout must reuse this payload.
      savePendingAction(employee.merchantId, employee.id, order.id, pending);
    } catch (cause) {
      setActionErrors((current) => ({
        ...current,
        [order.id]:
          cause instanceof Error ? cause.message : t('Could not save this action safely.'),
      }));
      return;
    }

    setActionErrors((current) => ({ ...current, [order.id]: '' }));
    try {
      await actionMutation.mutateAsync({ orderId: order.id, action: pending });
      try {
        removePendingAction(employee.merchantId, employee.id, order.id);
      } catch {
        // Keeping a completed request ID is safe: the server replays its recorded result.
      }
      await queryClient.invalidateQueries({
        queryKey: posOrderKeys.branch(employee.merchantId, branchId),
      });
    } catch (cause) {
      const message = orderActionMessage(cause);
      setActionErrors((current) => ({ ...current, [order.id]: message }));
      if (
        cause instanceof ApiError &&
        ([400, 422].includes(cause.statusCode) ||
          cause.errorCode === 'ORDER_SHIFT_REQUIRED' ||
          isRegisterPairingError(cause))
      ) {
        try {
          removePendingAction(employee.merchantId, employee.id, order.id);
        } catch {
          // Storage still contains the command; a retry cannot change its request identity.
        }
      }
    }
  }

  function getStatusClass(status: StorefrontOrderSummary['status']) {
    if (status === 'pending') return 'bg-warning/15 text-warning';
    if (status === 'accepted') return 'bg-info/15 text-info';
    if (status === 'preparing') return 'bg-primary/15 text-primary';
    if (status === 'ready') return 'bg-success/15 text-success';
    if (status === 'cancelled' || status === 'rejected')
      return 'bg-destructive/15 text-destructive';
    return 'bg-secondary text-foreground';
  }

  return (
    <section className="space-y-4 p-3 md:p-4" aria-labelledby="pos-orders-heading">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="pos-orders-heading" className="m-0 text-base font-semibold sm:text-lg">
            {t('Kitchen')}
          </h2>
          {isOnline && ordersQuery.dataUpdatedAt > 0 && !ordersQuery.isRefetchError && (
            <span className="text-[11px] text-muted-foreground" role="status">
              {t('Last updated')}:{' '}
              {formatDate(new Date(ordersQuery.dataUpdatedAt).toISOString(), true)}
              {ordersQuery.isFetching ? ` · ${t('Refreshing…')}` : ''}
            </span>
          )}
        </div>
        <PosButton
          variant="outline"
          size="sm"
          type="button"
          onClick={() => void ordersQuery.refetch()}
          disabled={ordersQuery.isFetching || !branchId}
          className="h-8 min-h-0 gap-1.5 px-2.5 text-xs max-[767px]:h-11"
        >
          <RefreshCw
            aria-hidden="true"
            size={14}
            className={ordersQuery.isFetching ? 'animate-spin' : undefined}
          />
          {ordersQuery.isFetching ? t('Refreshing…') : t('Refresh')}
        </PosButton>
      </header>
      {!isOnline && (
        <p
          className="m-0 max-w-none rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground"
          role="status"
        >
          {ordersQuery.dataUpdatedAt
            ? t(
                'POS is offline. Showing the last loaded kitchen orders from {{date}}; order actions are paused.',
                {
                  date: formatDate(new Date(ordersQuery.dataUpdatedAt).toISOString(), true),
                },
              )
            : t('POS is offline. The kitchen queue has not loaded yet; order actions are paused.')}
        </p>
      )}
      {isOnline && ordersQuery.isRefetchError && ordersQuery.dataUpdatedAt > 0 && (
        <p
          className="m-0 max-w-none rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground"
          role="alert"
        >
          {t(
            'Could not refresh the kitchen queue. Showing the last successful update from {{date}}. New actions are paused; retry refresh before continuing.',
            {
              date: formatDate(new Date(ordersQuery.dataUpdatedAt).toISOString(), true),
            },
          )}
        </p>
      )}
      {(persistenceError || actionErrors.workspace) && (
        <p
          className="m-0 max-w-none rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {errorText(persistenceError ?? actionErrors.workspace!)}
        </p>
      )}
      {ordersQueryError && !ordersQuery.data && (
        <p
          className="m-0 max-w-none rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {errorText(ordersQueryError)}
        </p>
      )}
      {!isWorkspaceHydrated || ordersQuery.isLoading ? (
        <p className="m-0 text-sm text-muted-foreground" role="status">
          {t('Loading orders…')}
        </p>
      ) : orders.length === 0 && (!ordersQueryError || Boolean(ordersQuery.data)) ? (
        <div
          className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
          role="status"
        >
          {t('No incoming kitchen orders for this branch.')}
        </div>
      ) : orders.length > 0 ? (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {orders.map((order) => {
            const pending = pendingActions[order.id];
            const lineReadiness = Boolean(order.kitchenTicket) && order.status === 'preparing';
            const canAct =
              (order.status === 'pending' &&
                employee.permissions.includes('accept_recipe_orders')) ||
              (order.status === 'accepted' && employee.permissions.includes('start_preparation')) ||
              (order.status === 'preparing' &&
                !lineReadiness &&
                employee.permissions.includes('start_preparation')) ||
              (order.status === 'ready' &&
                (Boolean(order.kitchenTicket) || order.fulfillmentType === 'pickup') &&
                employee.permissions.includes('sell')) ||
              (order.status === 'cancelled' &&
                Boolean(order.kitchenTicket) &&
                !order.kitchenTicket?.cancellationAcknowledgedAt &&
                employee.permissions.includes('accept_recipe_orders'));
            const canHandover =
              order.status === 'ready' &&
              (Boolean(order.kitchenTicket) || order.fulfillmentType === 'pickup');
            const handoverBlocked = canHandover && order.handoverEligible !== true;
            const canRetry =
              pending &&
              pending.action !== 'item_ready' &&
              employee.permissions.includes(
                pending.action === 'accept'
                  ? 'accept_recipe_orders'
                  : pending.action === 'cancel_ack'
                    ? 'accept_recipe_orders'
                    : pending.action === 'handover'
                      ? 'sell'
                      : 'start_preparation',
              );
            return (
              <article
                className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
                key={order.id}
              >
                <header className="flex items-start justify-between gap-2 border-b border-border bg-secondary/40 px-3 py-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      className="flex min-h-8 shrink-0 items-center justify-center rounded-md bg-secondary px-2 text-[11px] font-semibold tabular-nums"
                      title={order.id}
                    >
                      {order.orderReference ?? `#${order.id.slice(0, 6).toUpperCase()}`}
                    </span>
                    <div className="grid min-w-0 gap-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                        <strong className="max-w-full truncate text-[13px] font-semibold">
                          {order.customerName ?? t('Walk-in customer')}
                        </strong>
                        <span className="rounded-md bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {t(order.fulfillmentType)}
                        </span>
                        {order.source && (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                            {t(
                              order.source === 'waffarly'
                                ? 'Wfarly'
                                : order.source === 'storefront'
                                  ? 'Storefront'
                                  : 'POS',
                            )}
                          </span>
                        )}
                        {order.tableCode && (
                          <span className="rounded-md bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {t('Table')} <bdi>{order.tableCode}</bdi>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={13} aria-hidden="true" />
                          <time dateTime={order.createdAt}>
                            {formatDate(order.createdAt, true)}
                          </time>
                        </span>
                        {order.customerPhone && (
                          <a className="hover:text-foreground" href={`tel:${order.customerPhone}`}>
                            {order.customerPhone}
                          </a>
                        )}
                        {order.kitchenTicket && (
                          <span>
                            {t('Station: {{station}}', {
                              station: t(order.kitchenTicket.station.name),
                            })}
                            {' · '}
                            {t(order.kitchenTicket.dispatchMode)}
                            {' · '}
                            {formatDate(order.kitchenTicket.dispatchedAt, true)}
                          </span>
                        )}
                        {lineReadiness && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                            {t('{{ready}} of {{total}} items ready', {
                              ready: formatNumber(
                                order.lines.filter((line) => Boolean(line.kitchenReadyAt)).length,
                              ),
                              total: formatNumber(order.lines.length),
                            })}
                          </span>
                        )}
                        {order.status === 'ready' && order.readyAt && (
                          <span>
                            {t('Ready at {{date}}', { date: formatDate(order.readyAt, true) })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      getStatusClass(order.status),
                    )}
                  >
                    {t(order.status)}
                  </span>
                </header>
                <ul className="m-0 grid list-none divide-y divide-border px-3">
                  {order.lines.map((line) => (
                    <li className="flex items-start gap-2 py-2" key={line.id}>
                      <strong className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs tabular-nums">
                        {formatNumber(line.quantity)}
                      </strong>
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <strong className="break-words text-[13px] font-medium">
                          {line.productName}
                        </strong>
                        {line.variantName && (
                          <span className="text-[11px] text-muted-foreground">{line.variantName}</span>
                        )}
                        {line.selections.map((selection, index) => (
                          <span
                            className="text-[11px] text-muted-foreground"
                            key={`${line.id}-${index}`}
                          >
                            {selection.quantity && selection.quantity > 1
                              ? `${formatNumber(selection.quantity)} × `
                              : ''}
                            {selection.optionName}
                          </span>
                        ))}
                        {line.note && (
                          <span className="mt-0.5 border-s-2 border-primary/70 bg-secondary/60 px-2 py-1 text-[11px] text-foreground">
                            {t('Note: {{note}}', { note: line.note })}
                          </span>
                        )}
                        {lineReadiness && line.kitchenReadyAt && (
                          <span className="text-[11px] text-success">
                            {t('Ready at {{date}}', {
                              date: formatDate(line.kitchenReadyAt, true),
                            })}
                          </span>
                        )}
                      </div>
                      {lineReadiness && (
                        <PosButton
                          variant={line.kitchenReadyAt ? 'outline' : 'solid'}
                          type="button"
                          aria-label={
                            line.kitchenReadyAt
                              ? t('{{item}} ready', { item: line.productName })
                              : t('Mark {{item}} ready', { item: line.productName })
                          }
                          disabled={
                            !employee.permissions.includes('start_preparation') ||
                            activeOrderId !== null ||
                            !isOnline ||
                            (queueNeedsFreshRead &&
                              !(pending?.action === 'item_ready' && pending.lineId === line.id)) ||
                            Boolean(
                              pending &&
                              (pending.action !== 'item_ready' || pending.lineId !== line.id),
                            ) ||
                            Boolean(line.kitchenReadyAt)
                          }
                          onClick={() =>
                            void performAction(
                              order,
                              pending?.action === 'item_ready' && pending.lineId === line.id
                                ? pending
                                : undefined,
                              line.id,
                            )
                          }
                          className="min-h-9 shrink-0 px-2.5 text-xs"
                        >
                          {pending?.action === 'item_ready' && pending.lineId === line.id
                            ? t('Retry saved action')
                            : line.kitchenReadyAt
                              ? t('Ready')
                              : t('Mark ready')}
                        </PosButton>
                      )}
                      <span className="shrink-0 pt-1 text-xs font-medium tabular-nums">
                        {formatNumber(Number(line.lineTotal), {
                          style: 'currency',
                          currency: order.currency,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                {(order.deliveryAddress || order.inventoryLifecycle?.branchName) && (
                  <div className="grid gap-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    {order.deliveryAddress && (
                      <span className="break-words" aria-label={t('Delivery address')}>
                        {order.deliveryAddress}
                      </span>
                    )}
                    {order.inventoryLifecycle?.branchName && (
                      <span>{order.inventoryLifecycle.branchName}</span>
                    )}
                  </div>
                )}
                <footer className="grid gap-2 border-t border-border bg-secondary/20 p-3">
                  {order.status === 'cancelled' && (
                    <p
                      className="m-0 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
                      role="status"
                    >
                      {t(
                        'Cancelled before preparation. Stop this ticket and acknowledge the update.',
                      )}
                      {order.cancellationReason
                        ? ` ${t('Reason')}: ${order.cancellationReason}`
                        : ''}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {t('Total')}
                    </span>
                    <strong className="text-sm tabular-nums">
                      {formatNumber(Number(order.total), {
                        style: 'currency',
                        currency: order.currency,
                      })}
                    </strong>
                  </div>
                  {order.fulfillmentType === 'pickup' &&
                    order.status === 'ready' &&
                    employee.permissions.includes('sell') && (
                      <PickupCollection
                        employee={employee}
                        branchId={branchId}
                        orderId={order.id}
                        onUpdated={() => {
                          void queryClient.invalidateQueries({
                            queryKey: posOrderKeys.branch(employee.merchantId, branchId),
                          });
                        }}
                      />
                    )}
                  {canHandover && (
                    <p
                      className={cn(
                        'm-0 rounded-lg px-2.5 py-1.5 text-[11px]',
                        handoverBlocked
                          ? 'bg-warning/10 text-warning'
                          : 'bg-success/10 text-success',
                      )}
                      role="status"
                    >
                      {handoverBlocked
                        ? t('Settle every check before handover.')
                        : t('All checks are paid. The order is ready for handover.')}
                    </p>
                  )}
                  {(canAct || canRetry) && (
                    <PosButton
                      variant="solid"
                      type="button"
                      disabled={
                        activeOrderId !== null ||
                        !isOnline ||
                        (queueNeedsFreshRead && !pending) ||
                        (handoverBlocked && pending?.action !== 'handover')
                      }
                      onClick={() => void performAction(order, pending)}
                      className="min-h-9 w-full justify-center text-xs max-[767px]:min-h-11"
                    >
                      {activeOrderId === order.id
                        ? t('Saving…')
                        : pending
                          ? t('Retry saved action')
                          : order.status === 'cancelled'
                            ? t('Acknowledge cancellation')
                            : order.status === 'pending'
                              ? order.requiresRecipeAcceptance
                                ? t('Accept and deduct stock')
                                : t('Accept order')
                              : order.status === 'accepted'
                                ? t('Start preparation')
                                : order.status === 'preparing'
                                  ? t('Mark order ready')
                                  : t('Confirm handover')}
                      <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
                    </PosButton>
                  )}
                </footer>
                {(pending || actionErrors[order.id]) && (
                  <div className="grid gap-2 px-3 pb-3">
                    {pending && (
                      <p className="m-0 max-w-none rounded-lg bg-warning/10 px-2.5 py-2 text-xs text-warning">
                        {t(
                          'A previous reply was uncertain. Retry the saved action before continuing.',
                        )}
                      </p>
                    )}
                    {actionErrors[order.id] && (
                      <p
                        className="m-0 max-w-none rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
                        role="alert"
                      >
                        {formatOrderActionError(actionErrors[order.id]!, locale, errorText)}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
      {ordersQuery.isFetchNextPageError && (
        <p
          className="m-0 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {errorText(ordersQueryError || t('Could not load the next order page.'))}
        </p>
      )}
      {(currentPageIndex > 0 || ordersQuery.hasNextPage) && (
        <nav
          className="flex items-center justify-center gap-2 pt-1"
          aria-label={t('Order page navigation')}
        >
          <PosButton
            variant="outline"
            size="sm"
            type="button"
            disabled={currentPageIndex === 0}
            onClick={() => setActivePageIndex(currentPageIndex - 1)}
            className="h-8 min-h-0 gap-1 px-2 text-xs max-[767px]:h-11"
          >
            <ChevronLeft aria-hidden="true" size={15} className="rtl:rotate-180" />
            {t('Previous')}
          </PosButton>
          <span className="min-w-16 text-center text-xs text-muted-foreground" aria-live="polite">
            {t('Page {{page}}', { page: formatNumber(currentPageIndex + 1) })}
          </span>
          <PosButton
            variant="outline"
            size="sm"
            type="button"
            disabled={!canGoToNextPage || (!hasLoadedNextPage && ordersQuery.isFetching)}
            onClick={() => void goToNextPage()}
            className="h-8 min-h-0 gap-1 px-2 text-xs max-[767px]:h-11"
          >
            {ordersQuery.isFetchingNextPage && !hasLoadedNextPage
              ? t('Loading…')
              : t('Next')}
            <ChevronRight aria-hidden="true" size={15} className="rtl:rotate-180" />
          </PosButton>
        </nav>
      )}
    </section>
  );
}
