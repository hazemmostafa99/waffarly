import { useEffect, useMemo, useState } from 'react';
import type {
  CatalogProductSummary,
  StorefrontOrderSummary,
  StorefrontOrderStatus,
} from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import type { OwnerProfile } from '@waffarly/contracts';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Icon } from './Icons.js';
import { ProductThumb } from './MerchantDashboard.js';
import { apiRequest } from './lib/api-client.js';
import { dashboardCopy } from './dashboard-copy.js';

type ReportPeriod = 'weekly' | 'monthly';
type SalesPoint = { label: string; orderValue: number; orders: number };

function DashboardOrderChart({
  points,
  t,
  formatNumber,
}: {
  points: SalesPoint[];
  t: (message: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
  const maxValue = Math.max(1, ...points.map((point) => point.orderValue));
  const maxOrders = Math.max(1, ...points.map((point) => point.orders));
  const x = (index: number) => 48 + index * (320 / Math.max(1, points.length - 1));
  const y = (value: number, max: number) => 140 - (value / max) * 100;

  return (
    <>
      <svg
        className="dashboard-chart"
        viewBox="0 0 400 180"
        preserveAspectRatio="none"
        role="img"
        aria-label={t('Order value and order count over time')}
      >
        {[0, 0.5, 1].map((ratio) => {
          const value = Math.round(maxValue * ratio);
          const yPosition = y(value, maxValue);
          return (
            <g key={ratio}>
              <line x1="38" x2="382" y1={yPosition} y2={yPosition} stroke="#edf1f6" />
              <text x="28" y={yPosition + 3} textAnchor="end" className="dashboard-chart-label">
                {value >= 1000
                  ? `${formatNumber(value / 1000, { maximumFractionDigits: value >= 10000 ? 0 : 1 })}k`
                  : formatNumber(value)}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const barY = y(point.orderValue, maxValue);
          return (
            <rect
              key={`bar-${point.label}`}
              x={x(index) - 13}
              y={barY}
              width="26"
              height={140 - barY}
              rx="4"
              fill="#e4f7ec"
            >
              <title>{`${t(point.label)}: EGP ${formatNumber(point.orderValue)} (${formatNumber(point.orders)} ${t('orders')})`}</title>
            </rect>
          );
        })}
        <polyline
          points={points
            .map((point, index) => `${x(index)},${y(point.orders, maxOrders)}`)
            .join(' ')}
          fill="none"
          stroke="#1c654e"
          strokeWidth="2.3"
        />
        {points.map((point, index) => (
          <circle
            key={`dot-${point.label}`}
            cx={x(index)}
            cy={y(point.orders, maxOrders)}
            r="3"
            fill="#1c654e"
          >
            <title>{`${t(point.label)}: ${formatNumber(point.orders)} ${t('orders')}`}</title>
          </circle>
        ))}
        {points.map((point, index) => (
          <text
            key={`label-${point.label}`}
            x={x(index)}
            y="170"
            textAnchor="middle"
            className="dashboard-chart-label"
          >
            {t(point.label)}
          </text>
        ))}
      </svg>
      <div className="dashboard-chart-legend">
        <span>
          <i className="is-order-value" />
          {t('Order value')}
        </span>
        <span>
          <i className="is-order-count" />
          {t('Order count')}
        </span>
      </div>
    </>
  );
}

function statusLabel(status: StorefrontOrderStatus, t: (message: string) => string) {
  return t(
    status === 'pending'
      ? 'Pending'
      : status === 'accepted'
        ? 'Accepted'
        : status === 'preparing'
          ? 'Preparing'
          : status === 'cancelled'
            ? 'Cancelled'
            : 'Rejected',
  );
}

export function Dashboard() {
  const { t, locale, formatNumber } = useLocale();
  const copy = (message: string) => dashboardCopy(message, locale, t);
  const navigate = useNavigate();
  const { profile, search } = useOutletContext<{ profile: OwnerProfile; search: string }>();
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [orders, setOrders] = useState<StorefrontOrderSummary[]>([]);
  const [products, setProducts] = useState<CatalogProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(false);
    void Promise.allSettled([
      apiRequest<StorefrontOrderSummary[]>('/owner/orders'),
      apiRequest<CatalogProductSummary[]>('/owner/catalog/products'),
    ])
      .then(([orderResult, productResult]) => {
        if (!current) return;
        if (orderResult.status === 'fulfilled') setOrders(orderResult.value);
        else {
          setOrders([]);
          setLoadError(true);
        }
        setProducts(productResult.status === 'fulfilled' ? productResult.value : []);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [refreshKey]);

  const matchingOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const filtered = term
      ? orders.filter((order) =>
          [
            order.id,
            order.customerName,
            order.customerPhone,
            ...order.lines.map((line) => line.productName),
          ].some((value) => value.toLocaleLowerCase().includes(term)),
        )
      : orders;
    return filtered.slice(0, 5);
  }, [orders, search]);

  const periodOrders = useMemo(() => {
    const days = period === 'weekly' ? 7 : 30;
    const end = new Date();
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);
    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      return createdAt >= start && createdAt <= end;
    });
  }, [orders, period]);

  const report = useMemo(() => {
    const nonRejected = periodOrders.filter(
      (order) => !['rejected', 'cancelled'].includes(order.status),
    );
    const orderValue = nonRejected.reduce((sum, order) => sum + Number(order.total), 0);
    return {
      orderValue,
      orders: periodOrders.length,
      customers: new Set(nonRejected.map((order) => order.customerPhone)).size,
      average: nonRejected.length ? orderValue / nonRejected.length : 0,
    };
  }, [periodOrders]);

  const series = useMemo<SalesPoint[]>(() => {
    const pointCount = period === 'weekly' ? 7 : 4;
    const days = period === 'weekly' ? 7 : 30;
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    const points = Array.from({ length: pointCount }, (_, index) => {
      const pointDate = new Date(start);
      if (period === 'weekly') pointDate.setDate(pointDate.getDate() + index);
      return {
        label:
          period === 'weekly'
            ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG-u-nu-latn', {
                weekday: 'short',
              }).format(pointDate)
            : `Week ${index + 1}`,
        orderValue: 0,
        orders: 0,
      };
    });
    for (const order of periodOrders) {
      const created = new Date(order.createdAt);
      const offset = Math.floor((created.getTime() - start.getTime()) / 86_400_000);
      const bucket =
        period === 'weekly'
          ? offset
          : Math.min(pointCount - 1, Math.floor(offset / (days / pointCount)));
      const point = points[bucket];
      if (!point) continue;
      point.orders += 1;
      if (!['rejected', 'cancelled'].includes(order.status))
        point.orderValue += Number(order.total);
    }
    return points;
  }, [locale, period, periodOrders]);

  const productTotals = useMemo(() => {
    const totals = new Map<string, { quantity: number; value: number }>();
    for (const order of periodOrders) {
      if (['rejected', 'cancelled'].includes(order.status)) continue;
      for (const line of order.lines) {
        const current = totals.get(line.productName) ?? { quantity: 0, value: 0 };
        current.quantity += line.quantity;
        current.value += Number(line.lineTotal);
        totals.set(line.productName, current);
      }
    }
    return [...totals.entries()]
      .map(([name, totals]) => ({ name, ...totals }))
      .sort((left, right) => right.quantity - left.quantity || right.value - left.value)
      .slice(0, 5);
  }, [periodOrders]);

  const fulfillment = useMemo(
    () => ({
      pickup: periodOrders.filter((order) => order.fulfillmentType === 'pickup').length,
      delivery: periodOrders.filter((order) => order.fulfillmentType === 'delivery').length,
    }),
    [periodOrders],
  );
  const fulfillmentTotal = fulfillment.pickup + fulfillment.delivery;
  const pickupShare = fulfillmentTotal ? (fulfillment.pickup / fulfillmentTotal) * 100 : 0;
  const fulfillmentGradient = fulfillmentTotal
    ? `conic-gradient(#1b654f 0deg ${pickupShare * 3.6}deg, #77b9ef ${pickupShare * 3.6}deg 360deg)`
    : '#edf3f0';

  const money = (amount: number, decimals = 0) =>
    new Intl.NumberFormat('en-EG-u-nu-latn', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  const dateTime = (value: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG-u-nu-latn', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));

  const productByName = new Map(
    products.map((product) => [product.name.toLocaleLowerCase(), product]),
  );
  const stats = [
    ['Order Value', loading || loadError ? '—' : money(report.orderValue, 2), 'revenue', 'mint'],
    ['Total Orders', loading || loadError ? '—' : formatNumber(report.orders), 'calendar', 'cream'],
    [
      'Unique Customers',
      loading || loadError ? '—' : formatNumber(report.customers),
      'customers',
      'blue',
    ],
    [
      'Avg. Order Value',
      loading || loadError ? '—' : money(report.average, 2),
      'receipt',
      'lavender',
    ],
  ] as const;
  const actions = [
    ['Add Product', 'box', '/products', 'mint'],
    ['Create Discount', 'discounts', '/discounts', 'cream'],
    ['Add Branch', 'store', '/branches', 'cream'],
    ['Manage Customers', 'customers', '/customers', 'blue'],
  ] as const;

  return (
    <div className="dashboard-view">
      <div className="dashboard-welcome">
        <div>
          <h1>
            {copy('Welcome, {{name}}!').replace(
              '{{name}}',
              profile.ownerName.split(' ')[0] ?? profile.ownerName,
            )}{' '}
            <span aria-hidden="true">👋</span>
          </h1>
          <p>{copy('Live storefront reporting from the latest 100 orders.')}</p>
        </div>
        <div className="dashboard-date-tools">
          <span className="dashboard-comparison">
            <Icon name="globe" />
            {copy('Storefront orders only')}
          </span>
          <label className="dashboard-date-select">
            <select
              aria-label={copy('Reporting period')}
              value={period}
              onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
            >
              <option value="weekly">{copy('Last 7 days')}</option>
              <option value="monthly">{copy('Last 30 days')}</option>
            </select>
            <Icon name="calendar" />
          </label>
          <button
            type="button"
            className="dashboard-refresh"
            disabled={loading}
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            {loading ? copy('Loading…') : copy('Refresh')}
          </button>
        </div>
      </div>

      {loadError && (
        <p className="dashboard-data-error" role="alert">
          {copy('Could not load dashboard orders. Please refresh and try again.')}
        </p>
      )}

      <div className="dashboard-stats">
        {stats.map(([label, value, icon, tone]) => (
          <article className="dashboard-stat" key={label}>
            <div className={`dashboard-stat-inner ${tone}`}>
              <div className="dashboard-stat-copy">
                <span>{copy(label)}</span>
                <strong dir="ltr">{value}</strong>
                <small>{copy('Selected period · latest 100 orders')}</small>
              </div>
              <span className="dashboard-stat-icon">
                <Icon name={icon} />
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-main-grid">
        <section className="dashboard-card dashboard-orders">
          <div className="dashboard-card-heading">
            <div>
              <h2>{copy('Latest Orders')}</h2>
              <p>{copy('Latest orders from your online storefront')}</p>
            </div>
            <button type="button" onClick={() => navigate('/orders')}>
              {t('View All')}
            </button>
          </div>
          <table className="dashboard-order-table">
            <thead className="dashboard-sr-only">
              <tr>
                {['Product', 'Customer', 'Total', 'Status'].map((label) => (
                  <th scope="col" key={label}>
                    {t(label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matchingOrders.map((order) => {
                const firstLine = order.lines[0];
                const product = firstLine
                  ? productByName.get(firstLine.productName.toLocaleLowerCase())
                  : undefined;
                return (
                  <tr key={order.id}>
                    <td>
                      <div className="dashboard-order-product">
                        <ProductThumb product={product} fallback="product" />
                        <span>
                          <strong>{firstLine?.productName ?? copy('No products')}</strong>
                          <small dir="ltr">
                            #{order.id.slice(0, 8).toLocaleUpperCase()} ·{' '}
                            {dateTime(order.createdAt)}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>{order.customerName}</td>
                    <td>
                      <span dir="ltr">{money(Number(order.total))}</span>
                    </td>
                    <td>
                      <span className={`dashboard-status ${order.status}`}>
                        {copy(statusLabel(order.status, (message) => message))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !loadError && matchingOrders.length === 0 && (
            <p className="dashboard-no-results">
              {copy(search ? 'No matching orders.' : 'No storefront orders yet.')}
            </p>
          )}
          {loading && (
            <p className="dashboard-no-results" role="status">
              {copy('Loading orders…')}
            </p>
          )}
        </section>

        <section className="dashboard-card dashboard-sales">
          <div className="dashboard-card-heading">
            <div>
              <h2>{copy('Online Order Overview')}</h2>
              <p>
                {copy(
                  period === 'monthly'
                    ? 'Order value and count over the last 30 days'
                    : 'Order value and count over the last 7 days',
                )}
              </p>
            </div>
          </div>
          <div className="dashboard-sales-summary">
            <div>
              <span>{copy('Order value')}</span>
              <div>
                <strong dir="ltr">
                  {loading || loadError ? '—' : money(report.orderValue, 2)}
                </strong>
                <small>{copy('Accepted and pending')}</small>
              </div>
            </div>
            <div>
              <span>{copy('Orders')}</span>
              <div>
                <strong>{loading || loadError ? '—' : formatNumber(report.orders)}</strong>
                <small>{copy('All statuses')}</small>
              </div>
            </div>
          </div>
          {periodOrders.length > 0 ? (
            <DashboardOrderChart points={series} t={copy} formatNumber={formatNumber} />
          ) : (
            <p className="dashboard-chart-empty">
              {loading
                ? copy('Loading orders…')
                : loadError
                  ? copy('Dashboard data is unavailable.')
                  : copy('No orders in this period.')}
            </p>
          )}
        </section>
      </div>

      <div className="dashboard-bottom-grid">
        <section className="dashboard-card dashboard-branches">
          <div className="dashboard-card-heading">
            <h2>{copy('Orders by Fulfillment')}</h2>
          </div>
          <div className="dashboard-branch-content">
            <div
              className="dashboard-donut"
              style={{ background: fulfillmentGradient }}
              role="img"
              aria-label={`${copy('Pickup')}: ${formatNumber(fulfillment.pickup)}, ${copy('Delivery')}: ${formatNumber(fulfillment.delivery)}`}
            >
              <div>
                <strong dir="ltr">{formatNumber(fulfillmentTotal)}</strong>
                <small>{copy('Orders in selected period')}</small>
              </div>
            </div>
            <ul className="dashboard-branch-legend">
              {(['pickup', 'delivery'] as const).map((kind) => {
                const count = fulfillment[kind];
                const share = fulfillmentTotal ? Math.round((count / fulfillmentTotal) * 100) : 0;
                return (
                  <li key={kind}>
                    <span
                      className="dashboard-branch-dot"
                      style={{ background: kind === 'pickup' ? '#1b654f' : '#77b9ef' }}
                    />
                    <span>
                      {copy(kind === 'pickup' ? 'Pickup' : 'Delivery')}
                      <small>
                        {formatNumber(count)} {copy('orders')}
                      </small>
                    </span>
                    <strong dir="ltr">{formatNumber(share)}%</strong>
                  </li>
                );
              })}
            </ul>
          </div>
          {!loading && !loadError && fulfillmentTotal === 0 && (
            <p className="dashboard-empty-note">{copy('No orders in this period.')}</p>
          )}
        </section>

        <section className="dashboard-card dashboard-bestsellers">
          <div className="dashboard-card-heading">
            <h2>{copy('Most Ordered Products')}</h2>
            <button type="button" onClick={() => navigate('/products')}>
              {t('View All')}
            </button>
          </div>
          <div className="dashboard-product-list">
            {productTotals.map(({ name, quantity, value }) => (
              <div className="dashboard-product-row" key={name}>
                <ProductThumb
                  product={productByName.get(name.toLocaleLowerCase())}
                  fallback="product"
                />
                <span>
                  <strong>{name}</strong>
                  <small>
                    {formatNumber(quantity)} {copy('items sold')}
                  </small>
                </span>
                <span dir="ltr">{money(value)}</span>
              </div>
            ))}
            {!loading && !loadError && productTotals.length === 0 && (
              <p className="dashboard-empty-note">{copy('No product orders in this period.')}</p>
            )}
          </div>
        </section>

        <section className="dashboard-card dashboard-quick-actions">
          <div className="dashboard-card-heading">
            <div>
              <h2>{copy('Quick Actions')}</h2>
              <p>{copy('Quick access to your most important tasks')}</p>
            </div>
          </div>
          <div className="dashboard-actions">
            {actions.map(([label, icon, destination, tone]) => (
              <button
                type="button"
                className={tone}
                key={label}
                onClick={() => navigate(destination)}
              >
                <Icon name={icon} />
                <span>{t(label)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
