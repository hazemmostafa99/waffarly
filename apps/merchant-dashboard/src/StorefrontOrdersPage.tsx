import { RecipeOrderActions } from './features/orders/RecipeOrderActions.js';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { StorefrontOrderStatus, StorefrontOrderSummary } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Icon } from './Icons.js';
import { apiRequest } from './lib/api-client.js';
import { ordersCopy } from './orders-copy.js';

type DateRange = 'all' | 'today' | 'week' | 'month';
type FulfillmentFilter = 'all' | 'pickup' | 'delivery';
type OrderStatusFilter = 'all' | StorefrontOrderStatus;

const statusColors: Record<StorefrontOrderStatus, string> = {
  pending: '#f5bd59',
  accepted: '#087c61',
  preparing: '#6488d4',
  ready: '#31936f',
  completed: '#607d72',
  cancelled: '#9a789b',
  rejected: '#e98978',
};

function matchesDateRange(createdAt: string, dateRange: DateRange) {
  if (dateRange === 'all') return true;
  const created = new Date(createdAt);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (dateRange === 'today') return created >= start;
  start.setDate(start.getDate() - (dateRange === 'week' ? 6 : 29));
  return created >= start;
}

export function StorefrontOrdersPage() {
  const { t, locale, formatNumber, formatDigits } = useLocale();
  const language = locale === 'ar' ? 'ar' : 'en';
  const copy = (message: string, values?: Record<string, unknown>) =>
    ordersCopy(message, locale, t, values);
  const { search: globalSearch } = useOutletContext<{ search: string }>();
  const [searchParams] = useSearchParams();
  const linkedOrderId = searchParams.get('orderId');
  const [orders, setOrders] = useState<StorefrontOrderSummary[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [fulfillment, setFulfillment] = useState<FulfillmentFilter>('all');
  const [status, setStatus] = useState<OrderStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [confirmingRejectionId, setConfirmingRejectionId] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(false);
    void apiRequest<StorefrontOrderSummary[]>('/owner/orders')
      .then((result) => {
        if (!current) return;
        setOrders(result);
        setSelectedId((selected) =>
          selected && result.some((order) => order.id === selected) ? selected : null,
        );
      })
      .catch(() => {
        if (current) setLoadError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (loading || !linkedOrderId || !orders.some((order) => order.id === linkedOrderId)) return;
    setDateRange('all');
    setFulfillment('all');
    setStatus('all');
    setQuery('');
    setSelectedId(linkedOrderId);
  }, [linkedOrderId, loading, orders]);

  const terms = useMemo(
    () => [globalSearch, query].map((value) => value.trim().toLocaleLowerCase()).filter(Boolean),
    [globalSearch, query],
  );

  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (status !== 'all' && order.status !== status) return false;
        if (fulfillment !== 'all' && order.fulfillmentType !== fulfillment) return false;
        if (!matchesDateRange(order.createdAt, dateRange)) return false;
        if (terms.length === 0) return true;
        const searchable = [
          order.id,
          order.customerName,
          order.customerPhone,
          order.deliveryAddress ?? '',
          ...order.lines.flatMap((line) => [
            line.productName,
            line.variantName ?? '',
            ...line.selections.map((selection) => `${selection.groupName} ${selection.optionName}`),
          ]),
        ].map((value) => (value ?? '').toLocaleLowerCase());
        return terms.every((term) => searchable.some((value) => value.includes(term)));
      }),
    [dateRange, fulfillment, orders, status, terms],
  );

  const selectedRecipe = visibleOrders.find(
    (order) => order.id === selectedId && order.requiresRecipeAcceptance,
  );

  const counts = useMemo(
    () => ({
      all: orders.length,
      pending: orders.filter((order) => order.status === 'pending').length,
      accepted: orders.filter((order) => order.status === 'accepted').length,
      rejected: orders.filter((order) => order.status === 'rejected').length,
      preparing: orders.filter((order) => order.status === 'preparing').length,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
    }),
    [orders],
  );

  const orderValue = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const uniqueCustomers = new Set(orders.map((order) => order.customerPhone)).size;
  const averageOrderValue = orders.length > 0 ? orderValue / orders.length : 0;

  const stats = [
    {
      label: copy('Average order value'),
      value: money(averageOrderValue),
      icon: 'receipt',
      tone: 'lavender',
    },
    {
      label: copy('Unique customers'),
      value: formatNumber(uniqueCustomers),
      icon: 'customers',
      tone: 'blue',
    },
    {
      label: copy('Total orders'),
      value: formatNumber(orders.length),
      icon: 'calendar',
      tone: 'cream',
    },
    { label: copy('Total order value'), value: money(orderValue), icon: 'revenue', tone: 'mint' },
  ] as const;

  const distribution = (['accepted', 'preparing', 'pending', 'rejected', 'cancelled'] as const).map(
    (key) => ({
      key,
      count: counts[key],
      color: statusColors[key],
    }),
  );
  let donutPosition = 0;
  const donutSegments = distribution.map(({ count, color }) => {
    const nextPosition = counts.all ? donutPosition + (count / counts.all) * 100 : 100;
    const segment = `${color} ${donutPosition}% ${nextPosition}%`;
    donutPosition = nextPosition;
    return segment;
  });
  const donutBackground = counts.all ? `conic-gradient(${donutSegments.join(', ')})` : '#edf1f5';

  function money(amount: string | number) {
    return new Intl.NumberFormat('en-EG-u-nu-latn', {
      style: 'currency',
      currency: 'EGP',
    }).format(Number(amount));
  }

  function dateTime(value: string) {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG-u-nu-latn', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function statusLabel(value: StorefrontOrderStatus) {
    return copy(
      value === 'pending'
        ? 'Pending'
        : value === 'accepted'
          ? 'Accepted'
          : value === 'preparing'
            ? 'Preparing'
            : value === 'cancelled'
              ? 'Cancelled'
              : 'Rejected',
    );
  }

  function resetFilters() {
    setDateRange('all');
    setFulfillment('all');
    setStatus('all');
    setQuery('');
  }

  async function updateStatus(orderId: string, nextStatus: 'accepted' | 'rejected') {
    setBusyOrderId(orderId);
    setActionError(false);
    setConfirmingRejectionId(null);
    try {
      const saved = await apiRequest<StorefrontOrderSummary>(`/owner/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setOrders((current) => current.map((order) => (order.id === saved.id ? saved : order)));
    } catch {
      setActionError(true);
    } finally {
      setBusyOrderId(null);
    }
  }

  const dateOptions: Array<[DateRange, string]> = [
    ['all', 'All dates'],
    ['today', 'Today'],
    ['week', 'Last 7 days'],
    ['month', 'Last 30 days'],
  ];
  const fulfillmentOptions: Array<[FulfillmentFilter, string]> = [
    ['all', 'All fulfillment'],
    ['pickup', 'Pickup'],
    ['delivery', 'Delivery'],
  ];
  const statusOptions: Array<[OrderStatusFilter, string]> = [
    ['all', 'All statuses'],
    ['pending', 'Pending'],
    ['accepted', 'Accepted'],
    ['preparing', 'Preparing'],
    ['cancelled', 'Cancelled'],
    ['rejected', 'Rejected'],
  ];

  return (
    <section
      className="orders-page storefront-orders-redesign"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      aria-labelledby="storefront-orders-title"
    >
      <h2 id="storefront-orders-title" className="sr-only">
        {copy('Orders')}
      </h2>

      <div className="orders-stats" aria-label={copy('Order summary')}>
        {stats.map(({ label, value, icon, tone }) => (
          <article className="orders-stat" key={label}>
            <div className={`orders-stat-inner ${tone}`}>
              <div>
                <span>{label}</span>
                <strong dir="ltr">{value}</strong>
                <small>{copy('Based on the latest orders in this inbox')}</small>
              </div>
              <span className="orders-stat-icon">
                <Icon name={icon} />
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="orders-toolbar" role="search">
        <label className="orders-date-field">
          <Icon name="calendar" />
          <span className="sr-only">{copy('Date range')}</span>
          <select
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            aria-label={copy('Date range')}
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as DateRange)}
          >
            {dateOptions.map(([value, label]) => (
              <option value={value} key={value}>
                {copy(label)}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </label>
        <label className="orders-select-field">
          <span className="sr-only">{copy('Fulfillment')}</span>
          <select
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            aria-label={copy('Fulfillment')}
            value={fulfillment}
            onChange={(event) => setFulfillment(event.target.value as FulfillmentFilter)}
          >
            {fulfillmentOptions.map(([value, label]) => (
              <option value={value} key={value}>
                {copy(label)}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </label>
        <label className="orders-select-field">
          <span className="sr-only">{copy('Status')}</span>
          <select
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            aria-label={copy('Status')}
            value={status}
            onChange={(event) => setStatus(event.target.value as OrderStatusFilter)}
          >
            {statusOptions.map(([value, label]) => (
              <option value={value} key={value}>
                {copy(label)}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </label>
        <label className="orders-search-field">
          <Icon name="search" />
          <input
            type="search"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            aria-label={copy('Search orders')}
            placeholder={copy('Search by order number or customer...')}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          {query && (
            <button type="button" aria-label={copy('Clear search')} onClick={() => setQuery('')}>
              <Icon name="close" />
            </button>
          )}
        </label>
      </div>

      {actionError && (
        <p className="storefront-orders-error" role="alert">
          {copy('The order could not be updated. Please refresh and try again.')}
        </p>
      )}

      <div className="orders-content-grid">
        <section className="orders-table-card" aria-labelledby="orders-list-title">
          <div className="orders-table-heading">
            <div>
              <h3 id="orders-list-title">{copy('Order list')}</h3>
              <p>
                {copy('Showing {{count}} of {{total}} orders', {
                  count: visibleOrders.length,
                  total: orders.length,
                })}
              </p>
            </div>
            <button
              type="button"
              className="orders-refresh-button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={loading}
            >
              {loading ? copy('Loading…') : copy('Refresh')}
            </button>
          </div>

          {loading ? (
            <div className="orders-empty-state" role="status">
              <Icon name="orders" />
              <strong>{copy('Loading orders…')}</strong>
            </div>
          ) : loadError ? (
            <div className="orders-empty-state" role="alert">
              <Icon name="orders" />
              <strong>{copy('Orders could not be loaded. Please refresh and try again.')}</strong>
            </div>
          ) : (
            <>
              <div className="orders-table-scroll">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>{copy('Order number')}</th>
                      <th>{copy('Customer')}</th>
                      <th>{copy('Fulfillment')}</th>
                      <th>{copy('Items')}</th>
                      <th>{copy('Amount')}</th>
                      <th>{copy('Status')}</th>
                      <th>{copy('Time')}</th>
                      <th>
                        <span className="sr-only">{copy('Order details')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => {
                      const isSelected = selectedId === order.id;
                      const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);
                      return (
                        <Fragment key={order.id}>
                          <tr className={isSelected ? 'is-selected' : ''}>
                            <td>
                              <strong dir="ltr">
                                #{formatDigits(order.id.slice(0, 8).toLocaleUpperCase())}
                              </strong>
                            </td>
                            <td>
                              <strong>{order.customerName ?? copy('Walk-in customer')}</strong>
                              {order.customerPhone && (
                                <small dir="ltr">{formatDigits(order.customerPhone)}</small>
                              )}
                            </td>
                            <td>
                              <span className="orders-fulfillment">
                                {copy(order.fulfillmentType === 'pickup' ? 'Pickup' : 'Delivery')}
                              </span>
                              {order.fulfillmentType === 'delivery' && order.deliveryAddress && (
                                <small className="orders-address-cell">
                                  {order.deliveryAddress}
                                </small>
                              )}
                            </td>
                            <td>
                              <strong>
                                {formatNumber(itemCount)} {copy(itemCount === 1 ? 'item' : 'items')}
                              </strong>
                              {order.lines[0] && (
                                <small>
                                  {order.lines.length > 1
                                    ? `${order.lines[0].productName} + ${formatNumber(order.lines.length - 1)}`
                                    : order.lines[0].productName}
                                </small>
                              )}
                            </td>
                            <td dir="ltr">{money(order.total)}</td>
                            <td>
                              <span className={`orders-status orders-status-${order.status}`}>
                                <i />
                                {statusLabel(order.status)}
                              </span>
                            </td>
                            <td>{dateTime(order.createdAt)}</td>
                            <td>
                              <button
                                type="button"
                                className="orders-row-action"
                                aria-label={`${copy('Order details')} ${formatDigits(order.id.slice(0, 8))}`}
                                aria-expanded={isSelected}
                                onClick={() => setSelectedId(isSelected ? null : order.id)}
                              >
                                <Icon name="arrow" />
                              </button>
                            </td>
                          </tr>
                          {isSelected && (
                            <tr className="orders-expanded-row">
                              <td colSpan={8}>
                                <div className="orders-expanded-detail">
                                  <div className="orders-expanded-heading">
                                    <div>
                                      <strong>
                                        {copy('Order details')}{' '}
                                        <b dir="ltr">
                                          #{formatDigits(order.id.slice(0, 8).toLocaleUpperCase())}
                                        </b>
                                      </strong>
                                      <span>
                                        {order.fulfillmentType === 'delivery'
                                          ? order.deliveryAddress
                                          : copy('Pickup')}
                                      </span>
                                    </div>
                                    {order.customerPhone ? (
                                      <a href={`tel:${order.customerPhone}`} dir="ltr">
                                        {formatDigits(order.customerPhone)}
                                      </a>
                                    ) : (
                                      <span>{order.customerName ?? copy('Walk-in customer')}</span>
                                    )}
                                  </div>
                                  <div className="orders-expanded-lines">
                                    {order.lines.map((line) => (
                                      <div className="orders-expanded-line" key={line.id}>
                                        <div>
                                          <strong>
                                            {formatNumber(line.quantity)} × {line.productName}
                                            {line.variantName ? ` — ${line.variantName}` : ''}
                                          </strong>
                                          {line.selections.length > 0 && (
                                            <small>
                                              {line.selections
                                                .map(
                                                  (selection) =>
                                                    `${selection.groupName}: ${selection.optionName} \u00d7 ${selection.quantity ?? 1}`,
                                                )
                                                .join(' · ')}
                                            </small>
                                          )}
                                        </div>
                                        <strong dir="ltr">{money(line.lineTotal)}</strong>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="orders-expanded-footer">
                                    {!order.requiresRecipeAcceptance && (
                                      <span>
                                        {copy(
                                          'Tracked stock remains reserved until the order is rejected.',
                                        )}
                                      </span>
                                    )}
                                    {order.status === 'pending' &&
                                      !order.requiresRecipeAcceptance &&
                                      (confirmingRejectionId === order.id ? (
                                        <div className="orders-action-group">
                                          <span>
                                            {copy(
                                              'Reject this order? Reserved tracked stock will be returned.',
                                            )}
                                          </span>
                                          <button
                                            type="button"
                                            className="orders-action-danger"
                                            disabled={busyOrderId === order.id}
                                            onClick={() => void updateStatus(order.id, 'rejected')}
                                          >
                                            {busyOrderId === order.id
                                              ? copy('Rejecting…')
                                              : copy('Confirm rejection')}
                                          </button>
                                          <button
                                            type="button"
                                            className="orders-action-secondary"
                                            onClick={() => setConfirmingRejectionId(null)}
                                          >
                                            {copy('Cancel')}
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="orders-action-group">
                                          <button
                                            type="button"
                                            className="orders-action-primary"
                                            disabled={busyOrderId === order.id}
                                            onClick={() => void updateStatus(order.id, 'accepted')}
                                          >
                                            {busyOrderId === order.id
                                              ? copy('Accepting…')
                                              : copy('Accept order')}
                                          </button>
                                          <button
                                            type="button"
                                            className="orders-action-danger"
                                            disabled={busyOrderId === order.id}
                                            onClick={() => setConfirmingRejectionId(order.id)}
                                          >
                                            {copy('Reject order')}
                                          </button>
                                        </div>
                                      ))}
                                    {order.status === 'rejected' && (
                                      <strong className="orders-rejected-note">
                                        {copy(
                                          'This order was rejected and any reserved stock was returned.',
                                        )}
                                      </strong>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {visibleOrders.length === 0 && (
                  <div className="orders-empty-state">
                    <Icon name="orders" />
                    <strong>
                      {copy(
                        orders.length === 0 ? 'No storefront orders yet.' : 'No matching orders.',
                      )}
                    </strong>
                    {orders.length > 0 && (
                      <button type="button" className="orders-reset-button" onClick={resetFilters}>
                        {copy('Clear filters')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {selectedRecipe && (
                <RecipeOrderActions
                  key={selectedRecipe.id}
                  order={selectedRecipe}
                  onSaved={(saved) => {
                    setOrders((current) =>
                      current.map((item) => (item.id === saved.id ? saved : item)),
                    );
                    setRefreshKey((key) => key + 1);
                  }}
                  onReject={() => void updateStatus(selectedRecipe.id, 'rejected')}
                />
              )}

              <div className="orders-pagination">
                <span>
                  {copy('Showing {{count}} of {{total}} orders', {
                    count: visibleOrders.length,
                    total: orders.length,
                  })}
                </span>
                <span>{copy('Based on the latest orders in this inbox')}</span>
              </div>
            </>
          )}
        </section>

        <aside className="orders-side-column">
          <section className="orders-distribution-card" aria-labelledby="orders-distribution-title">
            <div className="orders-side-heading">
              <h3 id="orders-distribution-title">{copy('Orders status distribution')}</h3>
            </div>
            <div className="orders-donut-wrap">
              <div
                className="orders-donut"
                style={{ background: donutBackground }}
                role="img"
                aria-label={copy('Order status distribution chart')}
              >
                <div>
                  <strong>{formatNumber(counts.all)}</strong>
                  <span>{copy('Total orders')}</span>
                </div>
              </div>
            </div>
            <ul className="orders-legend">
              {distribution.map(({ key, count, color }) => (
                <li key={key}>
                  <span className="orders-legend-label">
                    <i style={{ background: color }} />
                    {statusLabel(key)}
                  </span>
                  <span>
                    {formatNumber(count)} {copy('orders')}
                  </span>
                  <strong>
                    {counts.all
                      ? `${formatNumber(Math.round((count / counts.all) * 100))}%`
                      : `${formatNumber(0)}%`}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
          <section className="orders-recent-card" aria-labelledby="orders-recent-title">
            <div className="orders-side-heading">
              <h3 id="orders-recent-title">{copy('Latest incoming orders')}</h3>
              <button type="button" onClick={resetFilters}>
                {copy('View all')}
              </button>
            </div>
            <div className="orders-recent-list">
              {orders.slice(0, 3).map((order) => (
                <button
                  type="button"
                  className="orders-recent-row"
                  key={order.id}
                  onClick={() => {
                    resetFilters();
                    setSelectedId(order.id);
                  }}
                >
                  <span>
                    <strong dir="ltr">
                      #{formatDigits(order.id.slice(0, 8).toLocaleUpperCase())}
                    </strong>
                    <small>{order.customerName}</small>
                  </span>
                  <span>
                    <b dir="ltr">{money(order.total)}</b>
                    <em className={`orders-status orders-status-${order.status}`}>
                      <i />
                      {statusLabel(order.status)}
                    </em>
                  </span>
                  <Icon name="arrow" />
                </button>
              ))}
              {orders.length === 0 && (
                <p className="orders-recent-empty">{copy('No storefront orders yet.')}</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
