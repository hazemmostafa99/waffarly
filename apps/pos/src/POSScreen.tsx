import type { PosEmployeeSession, StorefrontOrderSummary } from '@waffarly/contracts';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Button, useLocale } from '@waffarly/ui';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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

  return (
    <section className="pos-workspace" aria-labelledby="pos-orders-heading">
      <div className="pos-controls">
        <div>
          <span className="eyebrow">{t('Kitchen orders')}</span>
          <h2 id="pos-orders-heading">{t('Incoming orders')}</h2>
        </div>
        <div className="pos-filters">
          <label>
            {t('Branch')}
            <select value={branchId} onChange={(event) => changeBranch(event.target.value)}>
              {employee.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            type="button"
            onClick={() => void ordersQuery.refetch()}
            disabled={ordersQuery.isFetching || !branchId}
          >
            {ordersQuery.isFetching ? t('Refreshing…') : t('Refresh')}
          </Button>
        </div>
      </div>
      <p className="pos-scope-note">
        {t('Orders update automatically. Accepting deducts the saved recipe requirements from this branch.')}
      </p>
      {!isOnline && (
        <p className="pos-offline-note" role="status">
          {t('POS is offline. Showing saved orders where available; order actions are paused.')}
        </p>
      )}
      {(persistenceError || actionErrors.workspace) && (
        <p className="pos-error" role="alert">
          {errorText(persistenceError ?? actionErrors.workspace!)}
        </p>
      )}
      {ordersQueryError && (
        <p className="pos-error" role="alert">
          {errorText(ordersQueryError)}
        </p>
      )}
      {!isWorkspaceHydrated || ordersQuery.isLoading ? (
        <p role="status">{t('Loading orders…')}</p>
      ) : !employee.branches.length ? (
        <div className="pos-empty" role="status">
          {t('No branches are assigned to this employee.')}
        </div>
      ) : orders.length === 0 && !ordersQueryError ? (
        <div className="pos-empty" role="status">
          {t('No incoming kitchen orders for this branch.')}
        </div>
      ) : orders.length > 0 ? (
        <div className="pos-order-list">
          {orders.map((order) => {
            const pending = pendingActions[order.id];
            const canAct = order.status === 'pending' || order.status === 'accepted';
            return (
              <article className="pos-order-card" key={order.id}>
                <header className="pos-order-header">
                  <div>
                    <strong>{order.customerName ?? t('Walk-in customer')}</strong>
                    <span>{formatDate(order.createdAt, true)}</span>
                  </div>
                  <span className={`pos-status pos-status-${order.status}`}>{t(order.status)}</span>
                </header>
                <div className="pos-order-meta">
                  {order.customerPhone && <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>}
                  <span>{t(order.fulfillmentType)}</span>
                  {order.deliveryAddress && <span>{order.deliveryAddress}</span>}
                  {order.inventoryLifecycle?.branchName && (
                    <span>{order.inventoryLifecycle.branchName}</span>
                  )}
                </div>
                <ul className="pos-order-lines">
                  {order.lines.map((line) => (
                    <li key={line.id}>
                      <div>
                        <strong>
                          {line.quantity} × {line.productName}
                        </strong>
                        {line.variantName && <span>{line.variantName}</span>}
                        {line.note && <span>{t('Note: {{note}}', { note: line.note })}</span>}
                        {line.selections.map((selection, index) => (
                          <span key={`${line.id}-${index}`}>
                            {selection.quantity && selection.quantity > 1
                              ? `${selection.quantity} × `
                              : ''}
                            {selection.optionName}
                          </span>
                        ))}
                      </div>
                      <span>
                        {formatNumber(Number(line.lineTotal), {
                          style: 'currency',
                          currency: order.currency,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                <footer className="pos-order-footer">
                  <strong>
                    {t('Total')}:{' '}
                    {formatNumber(Number(order.total), {
                      style: 'currency',
                      currency: order.currency,
                    })}
                  </strong>
                  {(canAct || pending) && (
                    <Button
                      type="button"
                      disabled={activeOrderId !== null || !isOnline}
                      onClick={() => void performAction(order, pending)}
                    >
                      {activeOrderId === order.id
                        ? t('Saving…')
                        : pending
                          ? t('Retry saved action')
                          : order.status === 'pending'
                            ? t('Accept and deduct stock')
                            : t('Start preparation')}
                    </Button>
                  )}
                </footer>
                {pending && (
                  <p className="pos-pending-note">
                    {t('A previous reply was uncertain. Retry the saved action before continuing.')}
                  </p>
                )}
                {actionErrors[order.id] && (
                  <p className="pos-error" role="alert">
                    {errorText(actionErrors[order.id]!)}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
      {ordersQuery.hasNextPage && (
        <div className="pos-load-more">
          <Button
            variant="outline"
            type="button"
            disabled={ordersQuery.isFetchingNextPage}
            onClick={() => void ordersQuery.fetchNextPage()}
          >
            {ordersQuery.isFetchingNextPage ? t('Loading…') : t('Load more orders')}
          </Button>
        </div>
      )}
    </section>
  );
}
