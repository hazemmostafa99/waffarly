import type { PosEmployeeSession, StorefrontOrderSummary } from '@waffarly/contracts';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { cn, useLocale } from '@waffarly/ui';
import { ArrowRight, Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PosButton } from './components/pos-button.js';
import { ApiError } from './lib/api-client.js';
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
  const { t, errorText, formatDate, formatNumber } = useLocale();
  const queryClient = useQueryClient();
  const scope = posWorkspaceScope(employee.merchantId, employee.id);
  const workspace = usePosWorkspaceStore((state) =>
    state.activeScope === scope ? state.workspace : null,
  );
  const hydratedScope = usePosWorkspaceStore((state) => state.hydratedScope);
  const persistenceError = usePosWorkspaceStore((state) => state.persistenceError);
  const hydrate = usePosWorkspaceStore((state) => state.hydrate);
  const selectBranch = usePosWorkspaceStore((state) => state.selectBranch);
  const savePendingAction = usePosWorkspaceStore((state) => state.savePendingAction);
  const removePendingAction = usePosWorkspaceStore((state) => state.removePendingAction);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const isWorkspaceHydrated = hydratedScope === scope;
  const firstAssignedBranch = employee.branches[0]?.id ?? '';
  const savedBranchId = workspace?.selectedBranchId;
  const branchId = employee.branches.some((branch) => branch.id === savedBranchId)
    ? savedBranchId!
    : firstAssignedBranch;

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
    if (isOnline && isWorkspaceHydrated && branchId) {
      void queryClient.invalidateQueries({
        queryKey: posOrderKeys.branch(employee.merchantId, branchId),
      });
    }
  }, [branchId, employee.merchantId, isOnline, isWorkspaceHydrated, queryClient]);

  const actionMutation = useMutation({
    mutationFn: ({ orderId, action }: { orderId: string; action: PendingPosAction }) =>
      runPosOrderAction(orderId, action),
  });

  const orders = useMemo(
    () => ordersQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [ordersQuery.data],
  );
  const pendingActions = workspace?.pendingActions ?? {};
  const activeOrderId = actionMutation.isPending ? actionMutation.variables?.orderId : null;
  const ordersQueryError = ordersQuery.error instanceof Error ? ordersQuery.error.message : '';

  async function performAction(order: StorefrontOrderSummary, saved?: PendingPosAction) {
    if (actionMutation.isPending || !isOnline) return;
    const pending =
      saved ??
      (order.status === 'pending'
        ? { action: 'accept' as const, requestId: crypto.randomUUID(), branchId }
        : { action: 'prepare' as const, requestId: crypto.randomUUID(), branchId });
    if (
      !employee.permissions.includes(
        pending.action === 'accept' ? 'accept_recipe_orders' : 'start_preparation',
      )
    )
      return;
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
      const message =
        cause instanceof Error ? cause.message : t('The action could not be completed.');
      setActionErrors((current) => ({ ...current, [order.id]: message }));
      if (cause instanceof ApiError && [400, 422].includes(cause.statusCode)) {
        try {
          removePendingAction(employee.merchantId, employee.id, order.id);
        } catch {
          // Storage still contains the command; a retry cannot change its request identity.
        }
      }
    }
  }

  function changeBranch(nextBranchId: string) {
    try {
      selectBranch(employee.merchantId, employee.id, nextBranchId);
      setActionErrors({});
    } catch (cause) {
      setActionErrors((current) => ({
        ...current,
        workspace: cause instanceof Error ? cause.message : t('Could not save this POS workspace.'),
      }));
    }
  }

  function getStatusClass(status: StorefrontOrderSummary['status']) {
    if (status === 'pending') return 'bg-warning/15 text-warning';
    if (status === 'accepted') return 'bg-info/15 text-info';
    if (status === 'preparing') return 'bg-success/15 text-success';
    return 'bg-secondary text-foreground';
  }

  return (
    <section className="space-y-5 p-4 sm:p-6 lg:p-8" aria-labelledby="pos-orders-heading">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {t('Kitchen orders')}
          </span>
          <h2 id="pos-orders-heading" className="m-0 mt-1 text-xl font-semibold sm:text-2xl">
            {t('Incoming orders')}
          </h2>
        </div>
        <div className="flex flex-wrap items-end justify-start gap-3 md:justify-end">
          <label className="grid min-w-44 flex-1 gap-1.5 text-xs text-muted-foreground sm:flex-none">
            {t('Branch')}
            <select
              className="min-h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
              value={branchId}
              onChange={(event) => changeBranch(event.target.value)}
            >
              {employee.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <PosButton
            variant="outline"
            type="button"
            onClick={() => void ordersQuery.refetch()}
            disabled={ordersQuery.isFetching || !branchId}
            className="min-h-10"
          >
            {ordersQuery.isFetching ? t('Refreshing…') : t('Refresh')}
          </PosButton>
        </div>
      </div>
      <p className="m-0 max-w-none text-sm text-muted-foreground">
        {t(
          'Orders update automatically. Accepting deducts the saved recipe requirements from this branch.',
        )}
      </p>
      {!isOnline && (
        <p
          className="m-0 max-w-none rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground"
          role="status"
        >
          {t('POS is offline. Showing saved orders where available; order actions are paused.')}
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
      {ordersQueryError && (
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
      ) : !employee.branches.length ? (
        <div
          className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground"
          role="status"
        >
          {t('No branches are assigned to this employee.')}
        </div>
      ) : orders.length === 0 && !ordersQueryError ? (
        <div
          className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground"
          role="status"
        >
          {t('No incoming kitchen orders for this branch.')}
        </div>
      ) : orders.length > 0 ? (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {orders.map((order) => {
            const pending = pendingActions[order.id];
            const canAct =
              (order.status === 'pending' &&
                employee.permissions.includes('accept_recipe_orders')) ||
              (order.status === 'accepted' && employee.permissions.includes('start_preparation'));
            const canRetry =
              pending &&
              employee.permissions.includes(
                pending.action === 'accept' ? 'accept_recipe_orders' : 'start_preparation',
              );
            return (
              <article
                className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card"
                key={order.id}
              >
                <header className="flex items-start justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold tabular-nums"
                      title={order.id}
                    >
                      #{order.id.slice(0, 6).toUpperCase()}
                    </span>
                    <div className="grid min-w-0 gap-1.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="max-w-full truncate text-sm font-semibold">
                          {order.customerName ?? t('Walk-in customer')}
                        </strong>
                        <span className="rounded-md bg-card px-2 py-0.5 text-xs text-muted-foreground">
                          {t(order.fulfillmentType)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
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
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                      getStatusClass(order.status),
                    )}
                  >
                    {t(order.status)}
                  </span>
                </header>
                <ul className="m-0 grid list-none divide-y divide-border px-4">
                  {order.lines.map((line) => (
                    <li className="flex items-start gap-3 py-3" key={line.id}>
                      <strong className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-sm tabular-nums">
                        {formatNumber(line.quantity)}
                      </strong>
                      <div className="grid min-w-0 flex-1 gap-1">
                        <strong className="break-words text-sm font-medium">
                          {line.productName}
                        </strong>
                        {line.variantName && (
                          <span className="text-xs text-muted-foreground">{line.variantName}</span>
                        )}
                        {line.selections.map((selection, index) => (
                          <span
                            className="text-xs text-muted-foreground"
                            key={`${line.id}-${index}`}
                          >
                            {selection.quantity && selection.quantity > 1
                              ? `${formatNumber(selection.quantity)} × `
                              : ''}
                            {selection.optionName}
                          </span>
                        ))}
                        {line.note && (
                          <span className="mt-1 border-s-2 border-primary/70 bg-secondary/60 px-2 py-1 text-xs text-foreground">
                            {t('Note: {{note}}', { note: line.note })}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 pt-1 text-sm font-medium tabular-nums">
                        {formatNumber(Number(line.lineTotal), {
                          style: 'currency',
                          currency: order.currency,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                {(order.deliveryAddress || order.inventoryLifecycle?.branchName) && (
                  <div className="grid gap-1 border-t border-border px-4 py-3 text-xs text-muted-foreground">
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
                <footer className="grid gap-3 border-t border-border bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      {t('Total')}
                    </span>
                    <strong className="text-base tabular-nums">
                      {formatNumber(Number(order.total), {
                        style: 'currency',
                        currency: order.currency,
                      })}
                    </strong>
                  </div>
                  {(canAct || canRetry) && (
                    <PosButton
                      variant="solid"
                      type="button"
                      disabled={activeOrderId !== null || !isOnline}
                      onClick={() => void performAction(order, pending)}
                      className="min-h-11 w-full justify-center"
                    >
                      {activeOrderId === order.id
                        ? t('Saving…')
                        : pending
                          ? t('Retry saved action')
                          : order.status === 'pending'
                            ? t('Accept and deduct stock')
                            : t('Start preparation')}
                      <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
                    </PosButton>
                  )}
                </footer>
                {(pending || actionErrors[order.id]) && (
                  <div className="grid gap-3 px-4 pb-4">
                    {pending && (
                      <p className="m-0 max-w-none rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                        {t(
                          'A previous reply was uncertain. Retry the saved action before continuing.',
                        )}
                      </p>
                    )}
                    {actionErrors[order.id] && (
                      <p
                        className="m-0 max-w-none rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                        role="alert"
                      >
                        {errorText(actionErrors[order.id]!)}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
      {ordersQuery.hasNextPage && (
        <div className="flex justify-center py-6">
          <PosButton
            variant="outline"
            type="button"
            disabled={ordersQuery.isFetchingNextPage}
            onClick={() => void ordersQuery.fetchNextPage()}
            className="min-h-11"
          >
            {ordersQuery.isFetchingNextPage ? t('Loading…') : t('Load more orders')}
          </PosButton>
        </div>
      )}
    </section>
  );
}
