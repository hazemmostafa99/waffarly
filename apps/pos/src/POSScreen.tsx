import type { CursorPage, PosEmployeeSession, StorefrontOrderSummary } from '@waffarly/contracts';
import { Button, useLocale } from '@waffarly/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ApiError, apiRequest } from './lib/api-client.js';

type PendingAction =
  | { action: 'accept'; requestId: string; branchId: string }
  | { action: 'prepare'; requestId: string; branchId: string };

type LayoutContext = { employee: PosEmployeeSession };

function storagePrefix(merchantId: string, employeeId: string) {
  return `waffarly:pos:${merchantId}:${employeeId}:`;
}

function readPendingActions(merchantId: string, employeeId: string): Record<string, PendingAction> {
  const result: Record<string, PendingAction> = {};
  try {
    const prefix = storagePrefix(merchantId, employeeId);
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const orderId = key.slice(prefix.length);
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const value = JSON.parse(raw) as PendingAction;
      if (
        value.requestId &&
        typeof value.branchId === 'string' &&
        (value.action === 'accept' || value.action === 'prepare')
      ) {
        result[orderId] = value;
      }
    }
  } catch {
    return result;
  }
  return result;
}

export function POSScreen() {
  const { employee } = useOutletContext<LayoutContext>();
  const { t, errorText, formatDate, formatNumber } = useLocale();
  const initialPending = useMemo(
    () => readPendingActions(employee.merchantId, employee.id),
    [employee.id, employee.merchantId],
  );
  const [branchId, setBranchId] = useState(
    () =>
      Object.values(initialPending).find((pending) =>
        employee.branches.some((branch) => branch.id === pending.branchId),
      )?.branchId ??
      employee.branches[0]?.id ??
      '',
  );
  const [orders, setOrders] = useState<StorefrontOrderSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState(initialPending);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    for (const [orderId, pending] of Object.entries(pendingActions)) {
      try {
        sessionStorage.setItem(
          `${storagePrefix(employee.merchantId, employee.id)}${orderId}`,
          JSON.stringify(pending),
        );
      } catch {
        setError(t('This browser cannot save an in-progress action for safe retry.'));
      }
    }
  }, [employee.id, employee.merchantId, pendingActions, t]);

  const loadOrders = useCallback(
    async (cursor?: string, append = false) => {
      if (!branchId) return;
      setError('');
      setLoading(true);
      try {
        const params = new URLSearchParams({ branchId, limit: '25' });
        if (cursor) params.set('cursor', cursor);
        const page = await apiRequest<CursorPage<StorefrontOrderSummary>>(
          `/pos/orders?${params.toString()}`,
        );
        setOrders((current) => (append ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('Could not load orders.'));
      } finally {
        setLoading(false);
      }
    },
    [branchId, t],
  );

  useEffect(() => {
    setOrders([]);
    setNextCursor(null);
    void loadOrders();
  }, [branchId, loadOrders]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadOrders(), 15_000);
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') void loadOrders();
    };
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [loadOrders]);

  function forgetAction(orderId: string) {
    setPendingActions((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
    try {
      sessionStorage.removeItem(`${storagePrefix(employee.merchantId, employee.id)}${orderId}`);
    } catch {
      // The in-memory state still clears if storage is unavailable.
    }
  }

  async function performAction(order: StorefrontOrderSummary, saved?: PendingAction) {
    if (busyOrder) return;
    const pending: PendingAction =
      saved ??
      (order.status === 'pending'
        ? { action: 'accept', requestId: crypto.randomUUID(), branchId }
        : { action: 'prepare', requestId: crypto.randomUUID(), branchId });
    try {
      sessionStorage.setItem(
        `${storagePrefix(employee.merchantId, employee.id)}${order.id}`,
        JSON.stringify(pending),
      );
    } catch {
      setActionErrors((current) => ({
        ...current,
        [order.id]: t('This browser cannot save an in-progress action for safe retry.'),
      }));
      return;
    }
    setPendingActions((current) => ({ ...current, [order.id]: pending }));
    setActionErrors((current) => ({ ...current, [order.id]: '' }));
    setBusyOrder(order.id);
    try {
      await apiRequest(
        `/pos/orders/${order.id}/${pending.action === 'accept' ? 'accept' : 'start-preparation'}`,
        {
          method: 'POST',
          body: JSON.stringify(
            pending.action === 'accept'
              ? { requestId: pending.requestId, branchId: pending.branchId }
              : { requestId: pending.requestId },
          ),
        },
      );
      forgetAction(order.id);
      await loadOrders();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : t('The action could not be completed.');
      setActionErrors((current) => ({ ...current, [order.id]: message }));
      if (cause instanceof ApiError && [400, 422].includes(cause.statusCode)) {
        forgetAction(order.id);
      }
    } finally {
      setBusyOrder(null);
    }
  }

  return (
    <section className="pos-workspace" aria-labelledby="pos-orders-heading">
      <div className="pos-controls">
        <div>
          <span className="eyebrow">{t('Incoming storefront orders')}</span>
          <h2 id="pos-orders-heading">{t('Recipe order queue')}</h2>
        </div>
        <div className="pos-filters">
          <label>
            {t('Branch')}
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
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
            onClick={() => void loadOrders()}
            disabled={loading}
          >
            {loading ? t('Refreshing…') : t('Refresh')}
          </Button>
        </div>
      </div>
      <p className="pos-scope-note">
        {t('Orders update automatically. Accepting deducts recipe stock from this branch.')}
      </p>
      {error && (
        <p className="pos-error" role="alert">
          {errorText(error)}
        </p>
      )}
      {loading && orders.length === 0 ? (
        <p role="status">{t('Loading orders…')}</p>
      ) : orders.length === 0 ? (
        <div className="pos-empty" role="status">
          {t('No incoming recipe orders for this branch.')}
        </div>
      ) : (
        <div className="pos-order-list">
          {orders.map((order) => {
            const pending = pendingActions[order.id];
            const canAct = order.status === 'pending' || order.status === 'accepted';
            return (
              <article className="pos-order-card" key={order.id}>
                <header className="pos-order-header">
                  <div>
                    <strong>{order.customerName}</strong>
                    <span>{formatDate(order.createdAt, true)}</span>
                  </div>
                  <span className={`pos-status pos-status-${order.status}`}>{t(order.status)}</span>
                </header>
                <div className="pos-order-meta">
                  <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>
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
                      disabled={busyOrder !== null}
                      onClick={() => void performAction(order, pending)}
                    >
                      {busyOrder === order.id
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
      )}
      {nextCursor && (
        <div className="pos-load-more">
          <Button
            variant="outline"
            type="button"
            disabled={loading}
            onClick={() => void loadOrders(nextCursor, true)}
          >
            {loading ? t('Loading…') : t('Load more orders')}
          </Button>
        </div>
      )}
    </section>
  );
}
