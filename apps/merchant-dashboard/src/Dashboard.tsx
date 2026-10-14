import { useLocale } from '@waffarly/ui';
import type { OwnerProfile } from '@waffarly/contracts';
import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Icon } from './Icons.js';
import { RevenueChart, ProductThumb } from './MerchantDashboard.js';
import { dashboardCopy } from './dashboard-copy.js';

// Reference data until the orders and reporting APIs are available.
const recentOrders = [
  ['10028', 'Signature Burger Meal', 'Mohamed Ali', 189, 'Delivered', 'delivered'],
  ['10027', 'Classic Waffle', 'Sarah Ahmed', 124, 'Preparing', 'preparing'],
  ['10026', 'Chicken Wings', 'Karim Hassan', 96, 'Paid', 'paid'],
  ['10025', 'Cheesy Meal', 'Nourhan Ehab', 142, 'Out for delivery', 'shipping'],
  ['10024', 'Truffle Fries', 'Ahmed Mahmoud', 78, 'Cancelled', 'cancelled'],
] as const;
const bestSellers = [
  ['Signature Burger', 86, 6450],
  ['Classic Waffle', 72, 4320],
  ['Chicken Wings', 64, 3840],
  ['Truffle Fries', 58, 2900],
  ['Chicken Burger', 51, 2550],
] as const;
const branches = [
  ['Zamalek Branch', 45, 10944, '#1b654f'],
  ['Nasr City Branch', 28, 6810, '#41b38b'],
  ['Maadi Branch', 18, 4378, '#eaa13c'],
  ['Dokki Branch', 9, 2189, '#f8ecd5'],
] as const;

export function Dashboard() {
  const { t, locale } = useLocale();
  const copy = (message: string) => dashboardCopy(message, locale, t);
  const navigate = useNavigate();
  const { profile, search } = useOutletContext<{ profile: OwnerProfile; search: string }>();
  const [period, setPeriod] = useState('weekly');
  const [week, setWeek] = useState('current');
  const money = (amount: number, decimals = 0) =>
    `EGP ${amount.toLocaleString('en-EG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  const report =
    week === 'previous'
      ? { sales: 19000.39, orders: 152, customers: 31, average: 125.0 }
      : { sales: 24320.5, orders: 186, customers: 42, average: 130.76 };
  const stats = [
    ['Total Sales', money(report.sales, 2), '28%', 'revenue', 'mint'],
    ['Total Orders', String(report.orders), '22%', 'calendar', 'cream'],
    ['New Customers', String(report.customers), '35%', 'customers', 'blue'],
    ['Avg. Order Value', money(report.average, 2), '6%', 'receipt', 'lavender'],
  ] as const;
  const actions = [
    ['Add Product', 'box', '/products', 'mint'],
    ['Create Discount', 'discounts', '/discounts', 'cream'],
    ['Add Branch', 'store', '/branches', 'cream'],
    ['Manage Customers', 'customers', '/customers', 'blue'],
  ] as const;
  const matchingOrders = recentOrders.filter((order) =>
    `${copy(order[1])} ${copy(order[2])} ${order[0]}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
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
          <p>{copy("Here's an overview of your business today.")}</p>
        </div>
        <div className="dashboard-date-tools">
          <span className="dashboard-comparison">
            {copy('Compared to last week')} <Icon name="trend" />
          </span>
          <label className="dashboard-date-select">
            <select
              aria-label={copy('Reporting period')}
              value={week}
              onChange={(event) => setWeek(event.target.value)}
            >
              <option value="current">{copy('8 June – 14 June 2024')}</option>
              <option value="previous">{copy('1 June – 7 June 2024')}</option>
            </select>
            <Icon name="calendar" />
          </label>
        </div>
      </div>
      <div className="dashboard-stats">
        {stats.map(([label, value, change, icon, tone]) => (
          <article className="dashboard-stat" key={label}>
            <div className={`dashboard-stat-inner ${tone}`}>
              <div className="dashboard-stat-copy">
                <span>{copy(label)}</span>
                <strong dir="ltr">{value}</strong>
                <small className="dashboard-growth" dir="ltr">
                  ↑ {change}
                </small>
                <small>{copy('Compared to last week')}</small>
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
              <p>{copy('Latest orders from all channels')}</p>
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
              {matchingOrders.map(([id, name, customer, amount, status, tone]) => (
                <tr key={id}>
                  <td>
                    <div className="dashboard-order-product">
                      <ProductThumb fallback="burger" />
                      <span>
                        <strong>{copy(name)}</strong>
                        <small dir="ltr">#{id}</small>
                      </span>
                    </div>
                  </td>
                  <td>{copy(customer)}</td>
                  <td>
                    <span dir="ltr">{money(amount)}</span>
                  </td>
                  <td>
                    <span className={`dashboard-status ${tone}`}>{copy(status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {matchingOrders.length === 0 && (
            <p className="dashboard-no-results">{copy('No matching orders.')}</p>
          )}
        </section>
        <section className="dashboard-card dashboard-sales">
          <div className="dashboard-card-heading">
            <div>
              <h2>{copy('Sales Overview')}</h2>
              <p>
                {copy(
                  period === 'monthly'
                    ? 'Total sales and orders over 4 weeks'
                    : 'Total sales and orders over 7 days',
                )}
              </p>
            </div>
            <select
              className="dashboard-period"
              aria-label={copy('Chart period')}
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="weekly">{t('Weekly')}</option>
              <option value="monthly">{copy('Monthly')}</option>
            </select>
          </div>
          <div className="dashboard-sales-summary">
            <div>
              <span>{copy('Sales')}</span>
              <div>
                <strong dir="ltr">{money(report.sales, 2)}</strong>
                <small dir="ltr">↑ 28%</small>
              </div>
            </div>
            <div>
              <span>{t('Orders')}</span>
              <div>
                <strong>{report.orders}</strong>
                <small dir="ltr">↑ 22%</small>
              </div>
            </div>
          </div>
          <RevenueChart t={copy} period={period} previous={week === 'previous'} />
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <section className="dashboard-card dashboard-branches">
          <div className="dashboard-card-heading">
            <h2>{copy('Sales by Branch')}</h2>
            <button type="button" onClick={() => navigate('/branches')}>
              {t('View All')}
            </button>
          </div>
          <div className="dashboard-branch-content">
            <div
              className="dashboard-donut"
              role="img"
              aria-label={branches.map(([name, share]) => `${copy(name)}: ${share}%`).join(', ')}
            >
              <div>
                <strong dir="ltr">EGP 24,320</strong>
                <small>{copy('Total Sales')}</small>
              </div>
            </div>
            <ul className="dashboard-branch-legend">
              {branches.map(([name, share, amount, color]) => (
                <li key={name}>
                  <span className="dashboard-branch-dot" style={{ background: color }} />
                  <span>
                    {copy(name)}
                    <small dir="ltr">{money(amount)}</small>
                  </span>
                  <strong dir="ltr">{share}%</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="dashboard-card dashboard-bestsellers">
          <div className="dashboard-card-heading">
            <h2>{copy('Best-Selling Products')}</h2>
            <button type="button" onClick={() => navigate('/products')}>
              {t('View All')}
            </button>
          </div>
          <div className="dashboard-product-list">
            {bestSellers.map(([name, sold, amount]) => (
              <div className="dashboard-product-row" key={name}>
                <ProductThumb fallback="burger" />
                <span>
                  <strong>{copy(name)}</strong>
                  <small>
                    {sold} {copy('orders')}
                  </small>
                </span>
                <span dir="ltr">{money(amount)}</span>
              </div>
            ))}
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
