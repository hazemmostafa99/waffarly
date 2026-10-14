import { useMemo, useState } from 'react';
import { useLocale } from '@waffarly/ui';
import { useOutletContext } from 'react-router-dom';
import { Icon } from './Icons.js';
import { ordersCopy } from './orders-copy.js';

type OrderStatus = 'delivered' | 'out_for_delivery' | 'preparing' | 'accepted' | 'review';
type OrderChannel = 'App' | 'Website' | 'Talabat' | 'Kareem';

type Order = {
  id: string;
  customer: string;
  customerCode: string;
  branch: string;
  channel: OrderChannel;
  amount: number;
  status: OrderStatus;
  time: string;
};

const orders: Order[] = [
  {
    id: '10028',
    customer: 'Mohamed Ali',
    customerCode: 'C1024',
    branch: 'Zamalek Branch',
    channel: 'App',
    amount: 285,
    status: 'delivered',
    time: '15 minutes ago',
  },
  {
    id: '10027',
    customer: 'Sarah Ahmed',
    customerCode: 'C1025',
    branch: 'October Branch',
    channel: 'Website',
    amount: 165,
    status: 'out_for_delivery',
    time: '32 minutes ago',
  },
  {
    id: '10026',
    customer: 'Ahmed Mahmoud',
    customerCode: 'C1024',
    branch: 'Zamalek Branch',
    channel: 'App',
    amount: 142,
    status: 'preparing',
    time: 'an hour ago',
  },
  {
    id: '10025',
    customer: 'Rana Khaled',
    customerCode: 'C1028',
    branch: 'Maadi Branch',
    channel: 'Talabat',
    amount: 320,
    status: 'accepted',
    time: 'an hour ago',
  },
  {
    id: '10024',
    customer: 'Khaled Anwar',
    customerCode: 'C1027',
    branch: 'Zamalek Branch',
    channel: 'Website',
    amount: 98,
    status: 'review',
    time: '2 hours ago',
  },
  {
    id: '10023',
    customer: 'Mennat Allah Saleh',
    customerCode: 'C1026',
    branch: 'Heliopolis Branch',
    channel: 'Kareem',
    amount: 230,
    status: 'delivered',
    time: '3 hours ago',
  },
  {
    id: '10022',
    customer: 'Youssef Tarek',
    customerCode: 'C1023',
    branch: 'October Branch',
    channel: 'App',
    amount: 176,
    status: 'preparing',
    time: '4 hours ago',
  },
  {
    id: '10021',
    customer: 'Reem Mohamed',
    customerCode: 'C1021',
    branch: 'Zamalek Branch',
    channel: 'Talabat',
    amount: 90,
    status: 'accepted',
    time: '5 hours ago',
  },
  {
    id: '10020',
    customer: 'Amr Gamal',
    customerCode: 'C1020',
    branch: 'Maadi Branch',
    channel: 'Website',
    amount: 310,
    status: 'out_for_delivery',
    time: '6 hours ago',
  },
  {
    id: '10019',
    customer: 'Heba Ibrahim',
    customerCode: 'C1019',
    branch: 'October Branch',
    channel: 'App',
    amount: 125,
    status: 'delivered',
    time: '7 hours ago',
  },
];

const statusLabels: Record<OrderStatus, string> = {
  delivered: 'Delivered',
  out_for_delivery: 'Out for delivery',
  preparing: 'Preparing',
  accepted: 'Accepted',
  review: 'Under review',
};

const statusOptions: OrderStatus[] = [
  'delivered',
  'out_for_delivery',
  'preparing',
  'accepted',
  'review',
];
const branchOptions = [
  'all',
  'Zamalek Branch',
  'October Branch',
  'Maadi Branch',
  'Heliopolis Branch',
] as const;
const channelOptions: Array<'all' | OrderChannel> = ['all', 'App', 'Website', 'Talabat', 'Kareem'];

const statusDistribution = [
  ['delivered', 78, 42, '#087c61'],
  ['out_for_delivery', 34, 18, '#77b9ef'],
  ['preparing', 30, 16, '#f5bd59'],
  ['accepted', 26, 14, '#a9df92'],
  ['review', 15, 8, '#79b8f5'],
  ['other', 3, 2, '#a9b3c3'],
] as const;

const money = (amount: number) =>
  `EGP ${amount.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function OrdersPage() {
  const { t, locale } = useLocale();
  const { search: globalSearch } = useOutletContext<{ search: string }>();
  const copy = (message: string, values?: Record<string, unknown>) =>
    ordersCopy(message, locale, t, values);
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState<(typeof branchOptions)[number]>('all');
  const [channel, setChannel] = useState<'all' | OrderChannel>('all');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const searchTerms = [globalSearch, query]
      .map((value) => value.trim().toLocaleLowerCase())
      .filter(Boolean);
    return orders.filter((order) => {
      const searchableValues = [
        order.id,
        order.customer,
        order.customerCode,
        order.branch,
        order.channel,
      ];
      const matchesQuery =
        searchTerms.length === 0 ||
        searchTerms.some((term) =>
          searchableValues.some((value) => value.toLocaleLowerCase().includes(term)),
        );
      return (
        matchesQuery &&
        (branch === 'all' || order.branch === branch) &&
        (channel === 'all' || order.channel === channel) &&
        (status === 'all' || order.status === status)
      );
    });
  }, [branch, channel, globalSearch, query, status]);

  const stats = [
    ['Average order value', 'EGP 128.40', '8%', 'receipt', 'lavender'],
    ['New customers', '28', '16%', 'customers', 'blue'],
    ['Total orders', '186', '12%', 'calendar', 'cream'],
    ['Total sales', 'EGP 24,320.50', '28%', 'revenue', 'mint'],
  ] as const;

  return (
    <section className="orders-page" aria-labelledby="orders-workspace-title">
      <h2 id="orders-workspace-title" className="sr-only">
        {copy('Orders')}
      </h2>

      <div className="orders-stats" aria-label={copy('Order summary')}>
        {stats.map(([label, value, change, icon, tone]) => (
          <article className="orders-stat" key={label}>
            <div className={`orders-stat-inner ${tone}`}>
              <div>
                <span>{copy(label)}</span>
                <strong dir="ltr">{value}</strong>
                <small className="orders-positive" dir="ltr">
                  ↑ {change}
                </small>
                <small>{copy('Compared with last month')}</small>
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
          <select aria-label={copy('Date range')} defaultValue="june">
            <option value="june">{copy('1 June 2024 – 30 June 2024')}</option>
          </select>
          <Icon name="chevron" />
        </label>
        <label className="orders-select-field">
          <span className="sr-only">{copy('Branch')}</span>
          <select
            aria-label={copy('Branch')}
            value={branch}
            onChange={(event) => setBranch(event.target.value as (typeof branchOptions)[number])}
          >
            <option value="all">{copy('All branches')}</option>
            {branchOptions.slice(1).map((option) => (
              <option value={option} key={option}>
                {copy(option)}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </label>
        <label className="orders-select-field">
          <span className="sr-only">{copy('Channel')}</span>
          <select
            aria-label={copy('Channel')}
            value={channel}
            onChange={(event) => setChannel(event.target.value as 'all' | OrderChannel)}
          >
            <option value="all">{copy('All channels')}</option>
            {channelOptions.slice(1).map((option) => (
              <option value={option} key={option}>
                {copy(option)}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </label>
        <label className="orders-select-field">
          <span className="sr-only">{copy('Status')}</span>
          <select
            aria-label={copy('Status')}
            value={status}
            onChange={(event) => setStatus(event.target.value as 'all' | OrderStatus)}
          >
            <option value="all">{copy('All statuses')}</option>
            {statusOptions.map((option) => (
              <option value={option} key={option}>
                {copy(statusLabels[option])}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </label>
        <label className="orders-search-field">
          <Icon name="search" />
          <input
            aria-label={copy('Search orders')}
            placeholder={copy('Search by order number or customer...')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
                  count: filteredOrders.length,
                  total: 186,
                })}
              </p>
            </div>
          </div>
          <div className="orders-table-scroll">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>{copy('Order number')}</th>
                  <th>{copy('Customer')}</th>
                  <th>{copy('Branch')}</th>
                  <th>{copy('Channel')}</th>
                  <th>{copy('Amount')}</th>
                  <th>{copy('Status')}</th>
                  <th>{copy('Time')}</th>
                  <th>
                    <span className="sr-only">{copy('Order details')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr className={selectedId === order.id ? 'is-selected' : ''} key={order.id}>
                    <td>
                      <strong dir="ltr">#{order.id}</strong>
                    </td>
                    <td>
                      <strong>{copy(order.customer)}</strong>
                      <small dir="ltr">#{order.customerCode}</small>
                    </td>
                    <td>{copy(order.branch)}</td>
                    <td>
                      <span
                        className={`orders-channel orders-channel-${order.channel.toLowerCase()}`}
                      >
                        <Icon
                          name={
                            order.channel === 'App'
                              ? 'phone'
                              : order.channel === 'Website'
                                ? 'globe'
                                : order.channel === 'Talabat'
                                  ? 'bag'
                                  : 'send'
                          }
                        />
                        {copy(order.channel)}
                      </span>
                    </td>
                    <td dir="ltr">{money(order.amount)}</td>
                    <td>
                      <span className={`orders-status orders-status-${order.status}`}>
                        <i />
                        {copy(statusLabels[order.status])}
                      </span>
                    </td>
                    <td>{copy(order.time)}</td>
                    <td>
                      <button
                        type="button"
                        className="orders-row-action"
                        aria-label={`${copy('Order details')} ${order.id}`}
                        aria-pressed={selectedId === order.id}
                        onClick={() => setSelectedId(order.id)}
                      >
                        <Icon name="arrow" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && (
              <div className="orders-empty-state">
                <Icon name="orders" />
                <strong>{copy('No matching orders.')}</strong>
              </div>
            )}
          </div>
          <div className="orders-pagination">
            <span>
              {copy('Showing {{count}} of {{total}} orders', {
                count: filteredOrders.length,
                total: 186,
              })}
            </span>
            <div>
              <button type="button" className="is-current" aria-current="page">
                1
              </button>
              <button type="button">2</button>
              <button type="button">3</button>
              <span>...</span>
              <button type="button">10</button>
              <button type="button" aria-label={copy('Next page')}>
                <Icon name="arrow" />
              </button>
            </div>
          </div>
        </section>

        <aside className="orders-side-column">
          <section className="orders-distribution-card" aria-labelledby="orders-distribution-title">
            <div className="orders-side-heading">
              <h3 id="orders-distribution-title">{copy('Orders status distribution')}</h3>
            </div>
            <div className="orders-donut-wrap">
              <div
                className="orders-donut"
                role="img"
                aria-label={statusDistribution
                  .map(
                    ([key, _count, percentage]) =>
                      `${copy(key === 'other' ? 'Other' : statusLabels[key as OrderStatus])}: ${percentage}%`,
                  )
                  .join(', ')}
              >
                <div>
                  <strong>186</strong>
                  <span>{copy('Total orders')}</span>
                </div>
              </div>
            </div>
            <ul className="orders-legend">
              {statusDistribution.map(([key, count, percentage, color]) => (
                <li key={key}>
                  <span className="orders-legend-label">
                    <i style={{ background: color }} />
                    {copy(key === 'other' ? 'Other' : statusLabels[key as OrderStatus])}
                  </span>
                  <span>
                    {count} {copy('orders')}
                  </span>
                  <strong>{percentage}%</strong>
                </li>
              ))}
            </ul>
          </section>
          <section className="orders-recent-card" aria-labelledby="orders-recent-title">
            <div className="orders-side-heading">
              <h3 id="orders-recent-title">{copy('Latest incoming orders')}</h3>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setBranch('all');
                  setChannel('all');
                  setStatus('all');
                }}
              >
                {copy('View all')}
              </button>
            </div>
            <div className="orders-recent-list">
              {orders.slice(0, 3).map((order) => (
                <button
                  type="button"
                  className="orders-recent-row"
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                >
                  <span>
                    <strong dir="ltr">#{order.id}</strong>
                    <small>{copy(order.customer)}</small>
                  </span>
                  <span>
                    <b dir="ltr">{money(order.amount)}</b>
                    <em className={`orders-status orders-status-${order.status}`}>
                      <i />
                      {copy(statusLabels[order.status])}
                    </em>
                  </span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
