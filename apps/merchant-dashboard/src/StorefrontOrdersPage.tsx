import { Fragment, useEffect, useState } from 'react';
import type {
  StorefrontOrderListPage,
  StorefrontOrderStatus,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Icon } from './Icons.js';
import { apiRequestSingle } from './lib/api-client.js';
import { ordersCopy } from './orders-copy.js';

type FulfillmentFilter = 'all' | 'pickup' | 'delivery' | 'dine_in' | 'takeaway';
type OrderStatusFilter = 'all' | StorefrontOrderStatus;
type OrderSourceFilter = 'all' | 'waffarly' | 'storefront' | 'pos';
type OrderListItem = StorefrontOrderListPage['items'][number];
const pageSize = 25;

const statusColors: Record<StorefrontOrderStatus, string> = {
  pending: '#f5bd59',
  accepted: '#087c61',
  preparing: '#6488d4',
  ready: '#31936f',
  completed: '#607d72',
  cancelled: '#9a789b',
  rejected: '#e98978',
};

export function StorefrontOrdersPage() {
  const { t, locale, formatNumber, formatDigits, errorText } = useLocale();
  const language = locale === 'ar' ? 'ar' : 'en';
  const copy = (message: string, values?: Record<string, unknown>) =>
    ordersCopy(message, locale, t, values);
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const { search: globalSearch } = useOutletContext<{ search: string }>();
  const [searchParams] = useSearchParams();
  const linkedOrderId = searchParams.get('orderId');
  const [orders, setOrders] = useState<StorefrontOrderListPage['items']>([]);
  const [recentOrders, setRecentOrders] = useState<StorefrontOrderListPage['items']>([]);
  const [pageData, setPageData] = useState<StorefrontOrderListPage | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fulfillment, setFulfillment] = useState<FulfillmentFilter>('all');
  const [source, setSource] = useState<OrderSourceFilter>('all');
  const [status, setStatus] = useState<OrderStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(linkedOrderId);
  const [details, setDetails] = useState<Record<string, StorefrontOrderSummary>>({});
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const searchInput = (linkedOrderId ? [query] : [globalSearch, query])
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 120);
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);
  const filterKey = JSON.stringify([from, to, source, fulfillment, status, search]);
  const [pagination, setPagination] = useState<{ filterKey: string; cursors: string[] }>({
    filterKey: '',
    cursors: [],
  });
  const history = pagination.filterKey === filterKey ? pagination.cursors : [];
  const cursor = history.at(-1);
  const pageNumber = history.length + 1;
  const hasActiveFilters = Boolean(
    from || to || source !== 'all' || status !== 'all' || fulfillment !== 'all' || search,
  );

  useEffect(() => {
    setRecentOrders([]);
  }, [filterKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams({ limit: String(pageSize) });
    if (cursor) params.set('cursor', cursor);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (source !== 'all') params.set('source', source);
    if (fulfillment !== 'all') params.set('fulfillment', fulfillment);
    if (status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    void apiRequestSingle<StorefrontOrderListPage>(`/owner/orders/inbox?${params}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setPageData(result);
        setOrders(result.items);
        if (!cursor) setRecentOrders(result.items.slice(0, 3));
        setPagination((current) =>
          current.filterKey === filterKey ? current : { filterKey, cursors: [] },
        );
        setSelectedId((selected) => {
          if (!selected) return null;
          if (selected === linkedOrderId || result.items.some((order) => order.id === selected)) {
            return selected;
          }
          return null;
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cursor, filterKey, from, fulfillment, linkedOrderId, refreshKey, search, source, status, to]);

  useEffect(() => {
    if (!linkedOrderId) return;
    setFrom('');
    setTo('');
    setFulfillment('all');
    setSource('all');
    setStatus('all');
    setQuery(linkedOrderId);
    setSelectedId(linkedOrderId);
  }, [linkedOrderId]);

  useEffect(() => {
    if (!selectedId || details[selectedId]) return;
    const controller = new AbortController();
    setDetailsLoadingId(selectedId);
    void apiRequestSingle<StorefrontOrderSummary>(`/owner/orders/${selectedId}`, {
      signal: controller.signal,
    })
      .then((order) => setDetails((current) => ({ ...current, [order.id]: order })))
      .catch(() => {
        if (!controller.signal.aborted) setDetailsLoadingId(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoadingId(null);
      });
    return () => controller.abort();
  }, [details, selectedId]);

  const counts = pageData?.stats?.statusCounts;
  const orderCount = pageData?.stats?.totalOrders ?? 0;
  const orderValue = pageData?.stats?.totalOrderValue ?? '0';
  const uniqueCustomers = pageData?.stats?.uniqueCustomers ?? 0;
  const averageOrderValue = pageData?.stats?.averageOrderValue ?? '0';

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
      value: formatNumber(orderCount),
      icon: 'calendar',
      tone: 'cream',
    },
    { label: copy('Total order value'), value: money(orderValue), icon: 'revenue', tone: 'mint' },
  ] as const;

  const distribution = (
    ['accepted', 'preparing', 'pending', 'rejected', 'cancelled', 'ready', 'completed'] as const
  ).map((key) => ({
    key,
    count: counts?.[key] ?? 0,
    color: statusColors[key],
  }));
  let donutPosition = 0;
  const donutSegments = distribution.map(({ count, color }) => {
    const nextPosition = orderCount ? donutPosition + (count / orderCount) * 100 : 100;
    const segment = `${color} ${donutPosition}% ${nextPosition}%`;
    donutPosition = nextPosition;
    return segment;
  });
  const donutBackground = orderCount ? `conic-gradient(${donutSegments.join(', ')})` : '#edf1f5';

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
      timeZone: 'Africa/Cairo',
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
            : value === 'ready'
              ? 'Ready'
              : value === 'completed'
                ? 'Completed'
                : value === 'cancelled'
                  ? 'Cancelled'
                  : 'Rejected',
    );
  }

  function sourceLabel(value: string) {
    if (value === 'waffarly') return copy('Wfarly');
    if (value === 'pos') return copy('POS');
    if (value === 'storefront') return copy('Storefront');
    return value;
  }

  function fulfillmentLabel(value: StorefrontOrderSummary['fulfillmentType']) {
    if (value === 'pickup') return 'Pickup';
    if (value === 'delivery') return 'Delivery';
    if (value === 'dine_in') return 'Dine-in';
    return 'Takeaway';
  }

  function orderNumber(order: OrderListItem) {
    if (order.branchOrderNumber != null) return String(order.branchOrderNumber);
    return order.orderReference || order.id.slice(0, 8).toLocaleUpperCase();
  }

  function resetFilters() {
    setFrom('');
    setTo('');
    setFulfillment('all');
    setSource('all');
    setStatus('all');
    setQuery('');
    setSelectedId(null);
    setPagination({ filterKey, cursors: [] });
  }

  const fulfillmentOptions: Array<[FulfillmentFilter, string]> = [
    ['all', 'All fulfillment'],
    ['pickup', 'Pickup'],
    ['delivery', 'Delivery'],
    ['dine_in', 'Dine-in'],
    ['takeaway', 'Takeaway'],
  ];
  const sourceOptions: Array<[OrderSourceFilter, string]> = [
    ['all', 'All sources'],
    ['waffarly', 'Wfarly'],
    ['storefront', 'Storefront'],
    ['pos', 'POS'],
  ];
  const statusOptions: Array<[OrderStatusFilter, string]> = [
    ['all', 'All statuses'],
    ['pending', 'Pending'],
    ['accepted', 'Accepted'],
    ['preparing', 'Preparing'],
    ['ready', 'Ready'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
    ['rejected', 'Rejected'],
  ];

  function goToNextPage() {
    if (!pageData?.nextCursor) return;
    setPagination({ filterKey, cursors: [...history, pageData.nextCursor] });
  }

  function goToPreviousPage() {
    if (history.length) setPagination({ filterKey, cursors: history.slice(0, -1) });
  }

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
                <small>{copy('Based on orders matching the filters')}</small>
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
          <span>{copy('From')}</span>
          <input
            type="date"
            aria-label={copy('From date')}
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="orders-date-field">
          <span>{copy('To')}</span>
          <input
            type="date"
            aria-label={copy('To date')}
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
          />
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
        <label className="orders-select-field">
          <span className="sr-only">{copy('Order source')}</span>
          <select
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            aria-label={copy('Order source')}
            value={source}
            onChange={(event) => setSource(event.target.value as OrderSourceFilter)}
          >
            {sourceOptions.map(([value, label]) => (
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
            placeholder={copy('Search by order number, customer, or item...')}
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

      <div className="orders-content-grid">
        <section className="orders-table-card" aria-labelledby="orders-list-title">
          <div className="orders-table-heading">
            <div>
              <h3 id="orders-list-title">{copy('Order list')}</h3>
              <p>
                {copy('Showing {{count}} of {{total}} orders', {
                  count: orders.length,
                  total: pageData?.stats?.totalOrders ?? 0,
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
                      <th>{copy('Order source')}</th>
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
                    {orders.map((order) => {
                      const isSelected = selectedId === order.id;
                      const itemCount = order.itemCount;
                      const detail = details[order.id];
                      return (
                        <Fragment key={order.id}>
                          <tr className={isSelected ? 'is-selected' : ''}>
                            <td>
                              <strong dir="ltr">#{formatDigits(orderNumber(order))}</strong>
                            </td>
                            <td>
                              <span className="orders-source">{sourceLabel(order.source)}</span>
                            </td>
                            <td>
                              <strong>{order.customerName ?? copy('Walk-in customer')}</strong>
                              {order.customerPhone && (
                                <small dir="ltr">{formatDigits(order.customerPhone)}</small>
                              )}
                            </td>
                            <td>
                              <span className="orders-fulfillment">
                                {copy(fulfillmentLabel(order.fulfillmentType))}
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
                              {order.previewItemName && <small>{order.previewItemName}</small>}
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
                                aria-label={`${copy('Order details')} ${formatDigits(orderNumber(order))}`}
                                aria-expanded={isSelected}
                                onClick={() => setSelectedId(isSelected ? null : order.id)}
                              >
                                <Icon name="arrow" />
                              </button>
                            </td>
                          </tr>
                          {isSelected && (
                            <tr className="orders-expanded-row">
                              <td colSpan={9}>
                                <div className="orders-expanded-detail">
                                  {detail ? (
                                    <>
                                      <div className="orders-expanded-heading">
                                        <div>
                                          <strong>
                                            {copy('Order details')}{' '}
                                            <b dir="ltr">
                                              #{formatDigits(orderNumber(order))}
                                            </b>
                                          </strong>
                                          <span>
                                            {sourceLabel(order.source)} ·{' '}
                                            {order.fulfillmentType === 'delivery'
                                              ? order.deliveryAddress
                                              : copy(fulfillmentLabel(order.fulfillmentType))}
                                            {order.fulfillmentType === 'dine_in' && detail.tableCode
                                              ? ` · ${copy('Table')} ${detail.tableCode}`
                                              : ''}
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
                                        {detail.lines.map((line) => (
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
                                                        `${selection.groupName}: ${selection.optionName} × ${selection.quantity ?? 1}`,
                                                    )
                                                    .join(' · ')}
                                                </small>
                                              )}
                                              {line.promotionType &&
                                                line.promotionDiscount &&
                                                Number(line.promotionDiscount) > 0 && (
                                                  <small className="orders-promotion-discount">
                                                    {copy('Product discount')} −
                                                    {money(
                                                      (
                                                        Number(line.promotionDiscount) *
                                                        line.quantity
                                                      ).toFixed(2),
                                                    )}
                                                  </small>
                                                )}
                                            </div>
                                            <strong dir="ltr">{money(line.lineTotal)}</strong>
                                          </div>
                                        ))}
                                      </div>
                                      <OrderDetailSummary
                                        order={detail}
                                        money={money}
                                        text={text}
                                      />
                                      <OwnerOrderActions
                                        order={detail}
                                        text={text}
                                        errorText={errorText}
                                        onChanged={(updated) => {
                                          setDetails((current) => ({ ...current, [updated.id]: updated }));
                                          setRefreshKey((value) => value + 1);
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <p role="status">
                                      {detailsLoadingId === order.id
                                        ? copy('Loading order details…')
                                        : copy('Order details could not be loaded.')}
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {orders.length === 0 && (
                  <div className="orders-empty-state">
                    <Icon name="orders" />
                    <strong>
                      {copy(hasActiveFilters ? 'No matching orders.' : 'No orders yet.')}
                    </strong>
                    {hasActiveFilters && (
                      <button type="button" className="orders-reset-button" onClick={resetFilters}>
                        {copy('Clear filters')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="orders-pagination">
                <span>
                  {copy('Page {{page}} · {{total}} orders', {
                    page: formatNumber(pageNumber),
                    total: formatNumber(pageData?.stats?.totalOrders ?? 0),
                  })}
                </span>
                <div className="orders-pagination-actions">
                  <button
                    type="button"
                    disabled={loading || history.length === 0}
                    onClick={goToPreviousPage}
                  >
                    {copy('Previous')}
                  </button>
                  <button
                    type="button"
                    disabled={loading || !pageData?.nextCursor}
                    onClick={goToNextPage}
                  >
                    {copy('Next')}
                  </button>
                </div>
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
                  <strong>{formatNumber(orderCount)}</strong>
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
                    {orderCount
                      ? `${formatNumber(Math.round((count / orderCount) * 100))}%`
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
              {recentOrders.map((order) => (
                <button
                  type="button"
                  className="orders-recent-row"
                  key={order.id}
                  onClick={() => {
                    setPagination({ filterKey, cursors: [] });
                    setSelectedId(order.id);
                  }}
                >
                  <span>
                    <strong dir="ltr">
                      #{formatDigits(orderNumber(order))}
                    </strong>
                    <small>{order.customerName}</small>
                    <small>{sourceLabel(order.source)}</small>
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
              {!loading && recentOrders.length === 0 && (
                <p className="orders-recent-empty">
                  {copy(hasActiveFilters ? 'No matching orders.' : 'No orders yet.')}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

/** Branch, subtotal, delivery fee and total for an expanded order. */
function OrderDetailSummary({
  order,
  money,
  text,
}: {
  order: StorefrontOrderSummary;
  money: (value: string) => string;
  text: (en: string, ar: string) => string;
}) {
  const branchName = order.inventoryLifecycle?.branchName;
  const fee = order.deliveryFee && Number(order.deliveryFee) > 0 ? order.deliveryFee : null;
  return (
    <dl className="orders-expanded-summary">
      {branchName && (
        <div>
          <dt>{text('Branch', 'الفرع')}</dt>
          <dd>{branchName}</dd>
        </div>
      )}
      {order.subtotal && (
        <div>
          <dt>{text('Items', 'المنتجات')}</dt>
          <dd dir="ltr">{money(order.subtotal)}</dd>
        </div>
      )}
      {fee && (
        <div>
          <dt>{text('Delivery fee', 'رسوم التوصيل')}</dt>
          <dd dir="ltr">{money(fee)}</dd>
        </div>
      )}
      <div>
        <dt>{text('Total', 'الإجمالي')}</dt>
        <dd dir="ltr">
          <strong>{money(order.total)}</strong>
        </dd>
      </div>
    </dl>
  );
}

/**
 * Lets the owner accept, start preparing or cancel a website order from the
 * dashboard. The API still requires an open cashier shift at the order's branch.
 */
function OwnerOrderActions({
  order,
  text,
  errorText,
  onChanged,
}: {
  order: StorefrontOrderSummary;
  text: (en: string, ar: string) => string;
  errorText: (message: string) => string;
  onChanged: (order: StorefrontOrderSummary) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const website = order.source === 'storefront' || order.source === 'waffarly';
  const branchId = order.inventoryLifecycle?.branchId ?? null;
  // Cancellation is allowed only before preparation starts, so preparing orders show no actions.
  if (!website || !['pending', 'accepted'].includes(order.status)) return null;

  async function run(action: 'accept' | 'start-preparation' | 'cancel' | 'reject', body: object) {
    setBusy(true);
    setError('');
    try {
      // Rejecting a pending order is a status change; the other actions are lifecycle commands.
      const updated = await apiRequestSingle<StorefrontOrderSummary>(
        action === 'reject' ? `/owner/orders/${order.id}/status` : `/owner/orders/${order.id}/${action}`,
        action === 'reject'
          ? { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) }
          : { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), ...body }) },
      );
      onChanged(updated);
    } catch (cause) {
      setError(cause instanceof Error ? errorText(cause.message) : text('Action failed.', 'تعذر تنفيذ الإجراء.'));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (order.status === 'pending') {
      void run('reject', {});
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed) return;
    // Pending orders were rejected above; an accepted order already deducted stock, so restore it.
    void run('cancel', { reason: trimmed, restoreStock: true });
  }

  return (
    <div className="orders-expanded-actions">
      {order.status === 'pending' && (
        <button
          type="button"
          className="products-button"
          disabled={busy || !branchId}
          onClick={() => void run('accept', { branchId })}
        >
          {text('Accept and deduct stock', 'قبول الطلب وخصم المخزون')}
        </button>
      )}
      {order.status === 'accepted' && (
        <button
          type="button"
          className="products-button"
          disabled={busy}
          onClick={() => void run('start-preparation', {})}
        >
          {text('Start preparation', 'بدء التحضير')}
        </button>
      )}
      {/* Only own-storefront orders can be rejected while pending. */}
      {order.status === 'pending' && order.source !== 'storefront' ? null : !cancelling ? (
        <button type="button" className="products-button" disabled={busy} onClick={() => setCancelling(true)}>
          {order.status === 'pending' ? text('Reject order', 'رفض الطلب') : text('Cancel order', 'إلغاء الطلب')}
        </button>
      ) : (
        <>
          {order.status !== 'pending' && <input
            className="products-input"
            aria-label={text('Cancellation reason', 'سبب الإلغاء')}
            placeholder={text('Cancellation reason', 'سبب الإلغاء')}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />}
          <button
            type="button"
            className="products-button"
            disabled={busy || (order.status !== 'pending' && !reason.trim())}
            onClick={cancel}
          >
            {order.status === 'pending' ? text('Confirm rejection', 'تأكيد الرفض') : text('Confirm', 'تأكيد')}
          </button>
          <button type="button" className="products-button" disabled={busy} onClick={() => setCancelling(false)}>
            {text('Back', 'رجوع')}
          </button>
        </>
      )}
      {error && (
        <p className="products-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
