import { useState, type ReactNode } from 'react';
import { LanguageSwitcher, useLocale } from '@waffarly/ui';
import type { OwnerProfile } from '@waffarly/contracts';
import { CatalogWorkspace, type CatalogSnapshot } from './CatalogWorkspace.js';
import { StorefrontSettings } from './StorefrontSettings.js';

type View =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'categories'
  | 'media'
  | 'customers'
  | 'discounts'
  | 'branches'
  | 'settings';
const navigation: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'orders', label: 'Orders', icon: 'orders' },
  { id: 'products', label: 'Products', icon: 'box' },
  { id: 'categories', label: 'Categories', icon: 'grid' },
  { id: 'media', label: 'Media Library', icon: 'image' },
  { id: 'customers', label: 'Customers', icon: 'customers' },
  { id: 'discounts', label: 'Discounts', icon: 'discounts' },
  { id: 'branches', label: 'Branches', icon: 'branches' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    box: (
      <>
        <path d="m12 3 9 5v9l-9 5-9-5V8Z" />
        <path d="m3 8 9 5 9-5M12 13v9m-4.5-16.5 9 5" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1" />
        <path d="m3 17 6-6 4 4 3-3 5 5" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    orders: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    customers: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c.5-3 2.5-5 6-5s5.5 2 6 5M17 11c2.2.2 3.5 1.5 4 3.5M17 5.5a2.5 2.5 0 0 1 0 5" />
      </>
    ),
    discounts: (
      <>
        <path d="M20 13 13 20l-9-9V4h7Z" />
        <circle cx="8" cy="8" r="1" />
        <path d="m10 14 4-4" />
      </>
    ),
    branches: (
      <>
        <path d="M4 9h16l-2-5H6Zm1 0v11h14V9M9 20v-6h6v6" />
        <path d="M4 9c0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0" />
      </>
    ),
    revenue: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v10M15 9.5c-.6-.7-1.5-1-2.6-1-1.4 0-2.4.7-2.4 1.7 0 2.7 5 1 5 3.7 0 1.1-1 1.8-2.5 1.8-1.1 0-2.1-.3-2.8-1" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.4 2.4 0 1 1 4.3 1.5c-.9 1-2.1 1.3-2.1 3M12 17h.01" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4M16 2v4M3 9h18" />
      </>
    ),
    chevron: <path d="m7 10 5 5 5-5" />,
    store: (
      <>
        <path d="M3 9h18l-2-6H5Zm1 0v12h16V9M9 21v-8h6v8M3 9c0 4 4 4 4 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 4 4 4 0" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg
      className="merchant-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.box}
    </svg>
  );
}

type DashboardProduct = CatalogSnapshot['products'][number];

function ProductThumb({
  product,
  fallback,
}: {
  product?: DashboardProduct | undefined;
  fallback: string;
}) {
  const image =
    product?.images.find((item) => item.isPrimary)?.publicUrl ?? product?.images[0]?.publicUrl;
  return image ? (
    <img className="merchant-dashboard-thumb" src={image} alt="" loading="lazy" />
  ) : (
    <span className="merchant-dashboard-thumb merchant-dashboard-thumb-fallback">{fallback}</span>
  );
}

function RevenueChart({ t }: { t: (message: string) => string }) {
  const values = [1000, 1500, 1300, 1700, 2100, 2400, 2100];
  const labels = ['Jun 8', 'Jun 9', 'Jun 10', 'Jun 11', 'Jun 12', 'Jun 13', 'Jun 14'];
  const points = values
    .map((value, index) => `${48 + index * 94},${142 - ((value - 800) / 1800) * 104}`)
    .join(' ');
  return (
    <div className="merchant-revenue-chart">
      <div className="merchant-chart-y-axis">
        <span>$2,500</span>
        <span>$2,000</span>
        <span>$1,500</span>
        <span>$1,000</span>
        <span>$500</span>
        <span>$0</span>
      </div>
      <svg
        viewBox="0 0 620 170"
        role="img"
        aria-label={t('Revenue chart')}
        preserveAspectRatio="none"
      >
        {[16, 47, 78, 109, 140].map((y) => (
          <line key={y} x1="38" x2="606" y1={y} y2={y} className="merchant-chart-gridline" />
        ))}
        {values.map((value, index) => {
          const height = ((value - 800) / 1800) * 104;
          return (
            <rect
              key={value + index}
              x={28 + index * 94}
              y={142 - height}
              width="42"
              height={height}
              rx="5"
              className="merchant-chart-bar"
            />
          );
        })}
        <polyline points={points} className="merchant-chart-line" />
        {values.map((value, index) => (
          <circle
            key={value + index}
            cx={48 + index * 94}
            cy={142 - ((value - 800) / 1800) * 104}
            r="4"
            className="merchant-chart-point"
          />
        ))}
      </svg>
      <div className="merchant-chart-x-axis">
        {labels.map((label) => (
          <span key={label}>
            {t(label)}
            <small>
              {t(
                label === 'Jun 8'
                  ? 'Mon'
                  : label === 'Jun 9'
                    ? 'Tue'
                    : label === 'Jun 10'
                      ? 'Wed'
                      : label === 'Jun 11'
                        ? 'Thu'
                        : label === 'Jun 12'
                          ? 'Fri'
                          : label === 'Jun 13'
                            ? 'Sat'
                            : 'Sun',
              )}
            </small>
          </span>
        ))}
      </div>
    </div>
  );
}

function MerchantDashboard({
  catalog,
  products,
  preview,
  navigate,
  number,
}: {
  catalog: CatalogSnapshot | null;
  products: DashboardProduct[];
  preview: DashboardProduct[];
  navigate: (view: View) => void;
  number: Intl.NumberFormat;
}) {
  const { t } = useLocale();
  const topProducts = [
    ['Signature Burger', 'Burgers', '86 sold', '$602.00', '🍔'],
    ['Classic Waffle', 'Waffles', '72 sold', '$360.00', '🧇'],
    ['Chicken Bites', 'Mains', '64 sold', '$320.00', '🍗'],
    ['Specialty Waffle', 'Waffles', '58 sold', '$290.00', '🍓'],
    ['Classic Burger', 'Burgers', '51 sold', '$255.00', '🍔'],
  ] as const;
  const lowStock = [
    ['Beef Patties', 'Ingredients', '4 units', 'Min. 20', '🥩'],
    ['Waffle Batter', 'Ingredients', '6 units', 'Min. 20', '🥣'],
    ['Burger Buns', 'Ingredients', '8 units', 'Min. 20', '🍞'],
    ['Cheddar Cheese', 'Ingredients', '10 units', 'Min. 25', '🧀'],
    ['Lettuce', 'Ingredients', '12 units', 'Min. 30', '🥬'],
  ] as const;
  const recentOrders = [
    ['#10028', 'Lim Wei Jun', '2 items', '$24.90', 'Paid', 'Jun 14, 2024', '2:34 PM', '🍔'],
    ['#10027', 'Sarah Lee', '3 items', '$32.50', 'Preparing', 'Jun 14, 2024', '1:22 PM', '🧇'],
    ['#10026', 'Ahmad Rizal', '1 item', '$12.90', 'Completed', 'Jun 14, 2024', '12:18 PM', '🍗'],
    ['#10025', 'Priya Nair', '4 items', '$45.60', 'Paid', 'Jun 14, 2024', '11:03 AM', '🍓'],
    ['#10024', 'Daniel Tan', '2 items', '$28.00', 'Cancelled', 'Jun 14, 2024', '10:21 AM', '🍔'],
  ] as const;
  const branches = [
    ['Main Branch', '218', '$4,320.50', '$19.82', '22%', 'up'],
    ['Orchard Branch', '156', '$2,845.00', '$18.24', '12%', 'up'],
    ['Tampines Branch', '98', '$1,267.30', '$12.93', '5%', 'down'],
  ] as const;
  const quickActions = [
    ['Add Product', 'box', 'products'],
    ['Create Discount', 'discounts', 'discounts'],
    ['Add Branch', 'branches', 'branches'],
    ['Manage Customers', 'customers', 'customers'],
  ] as const;
  const headlineStats = [
    ['Today’s Orders', '48', '↑ 23%', 'vs. yesterday', 'orders', 'gold'],
    ['Revenue', '$1,245.60', 'Revenue', '', 'revenue', 'green'],
    [
      'Active Products',
      catalog ? number.format(products.length) : '124',
      '↑ 4%',
      'vs. last week',
      'box',
      'green',
    ],
    ['New Customers', '18', '↑ 50%', 'vs. yesterday', 'customers', 'gold'],
  ] as const;
  const activity = [
    ['New order #10028 received', '2:34 PM', 'green', 'orders'],
    ['Product “Signature Burger” updated', '1:18 PM', 'amber', 'box'],
    ['New customer registered', '11:42 AM', 'amber', 'customers'],
    ['Order #10025 completed', '11:03 AM', 'green', 'orders'],
    ['Low stock alert: Beef Patties', '9:15 AM', 'red', 'discounts'],
  ] as const;
  return (
    <>
      <div className="merchant-stats merchant-reference-stats">
        {headlineStats.map(([label, value, change, note, icon, tone]) => (
          <article className="merchant-stat merchant-reference-stat" key={label}>
            <span className={`merchant-stat-icon merchant-reference-stat-icon ${tone}`}>
              <Icon name={icon} />
            </span>
            <div>
              <span>{t(label)}</span>
              <strong>{value}</strong>
              <small className={change.startsWith('↑') ? 'merchant-positive' : ''}>
                {change === 'Revenue' ? t(change) : change} {note && <em>{t(note)}</em>}
              </small>
            </div>
          </article>
        ))}
      </div>
      <div className="merchant-reference-grid merchant-reference-top">
        <section className="merchant-card merchant-revenue-card">
          <div className="merchant-card-heading">
            <div>
              <h2>{t('Revenue Overview')}</h2>
              <div className="merchant-revenue-total">
                $8,432.50 <span>↑ 28%</span> <small>{t('vs. previous week')}</small>
              </div>
            </div>
            <button type="button" className="merchant-filter-button">
              <span>{t('Weekly')}</span>
              <Icon name="chevron" />
            </button>
          </div>
          <div className="merchant-chart-legend">
            <span className="merchant-legend-line" />
            {t('Revenue')} <span className="merchant-legend-bar" />
            {t('Orders')}
          </div>
          <RevenueChart t={t} />
        </section>
        <section className="merchant-card merchant-list-card">
          <div className="merchant-card-heading">
            <h2>{t('Top-Selling Products')}</h2>
            <button type="button" onClick={() => navigate('products')}>
              {t('View All')}
            </button>
          </div>
          {topProducts.map(([name, category, sold, total, fallback], index) => (
            <div className="merchant-ranking-row" key={name}>
              <span className={`merchant-rank ${index < 3 ? 'top' : ''}`}>{index + 1}</span>
              <ProductThumb product={preview[index]} fallback={fallback} />
              <span>
                <strong>{t(name)}</strong>
                <small>{t(category)}</small>
              </span>
              <small>{t(sold)}</small>
              <b>{total}</b>
            </div>
          ))}
        </section>
      </div>
      <div className="merchant-reference-grid merchant-reference-middle">
        <section className="merchant-card merchant-orders-card">
          <div className="merchant-card-heading">
            <h2>{t('Recent Orders')}</h2>
            <button type="button" onClick={() => navigate('orders')}>
              {t('View All')}
            </button>
          </div>
          <div className="merchant-orders-table">
            <div className="merchant-orders-head">
              <span>#</span>
              <span>{t('Customer')}</span>
              <span>{t('Items')}</span>
              <span>{t('Total')}</span>
              <span>{t('Status')}</span>
              <span>{t('Ordered At')}</span>
              <span>{t('Actions')}</span>
            </div>
            {recentOrders.map((order) => (
              <div className="merchant-order-row" key={order[0]}>
                <b>{order[0]}</b>
                <span className="merchant-order-customer">
                  <ProductThumb fallback={order[7]} />
                  <strong>{t(order[1])}</strong>
                </span>
                <span>{t(order[2])}</span>
                <b>{order[3]}</b>
                <span className={`merchant-order-status ${order[4].toLowerCase()}`}>
                  {t(order[4])}
                </span>
                <span>
                  {t(order[5])}
                  <small>{order[6]}</small>
                </span>
                <button type="button" aria-label={`${t('Actions')} ${order[0]}`}>
                  •••
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="merchant-card merchant-list-card">
          <div className="merchant-card-heading">
            <h2>{t('Low-Stock Products')}</h2>
            <button type="button" onClick={() => navigate('products')}>
              {t('View All')}
            </button>
          </div>
          {lowStock.map(([name, category, units, min, fallback]) => (
            <div className="merchant-ranking-row merchant-stock-row" key={name}>
              <ProductThumb fallback={fallback} />
              <span>
                <strong>{t(name)}</strong>
                <small>{t(category)}</small>
              </span>
              <b>{t(units)}</b>
              <small>{t(min)}</small>
            </div>
          ))}
        </section>
      </div>
      <div className="merchant-reference-grid merchant-reference-bottom">
        <section className="merchant-card merchant-branch-card">
          <div className="merchant-card-heading">
            <h2>{t('Branch Performance')}</h2>
            <button type="button" onClick={() => navigate('branches')}>
              {t('View All')}
            </button>
          </div>
          <div className="merchant-branch-head">
            <span>{t('Branch')}</span>
            <span>{t('Orders')}</span>
            <span>{t('Revenue')}</span>
            <span>{t('Avg. Order Value')}</span>
            <span>{t('Trend')}</span>
          </div>
          {branches.map(([branch, orders, revenue, avg, trend, direction]) => (
            <div className="merchant-branch-row" key={branch}>
              <span>
                <Icon name="branches" />
                {t(branch)}
              </span>
              <b>{orders}</b>
              <b>{revenue}</b>
              <span>{avg}</span>
              <strong className={direction === 'down' ? 'merchant-negative' : 'merchant-positive'}>
                {direction === 'up' ? '↑' : '↓'} {trend}
              </strong>
            </div>
          ))}
        </section>
        <section className="merchant-card merchant-quick-card">
          <div className="merchant-card-heading">
            <h2>{t('Quick Actions')}</h2>
          </div>
          <div className="merchant-reference-actions">
            {quickActions.map(([label, icon, destination]) => (
              <button type="button" key={label} onClick={() => navigate(destination)}>
                <Icon name={icon} />
                <span>{t(label)}</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </section>
        <section className="merchant-card merchant-activity-card">
          <div className="merchant-card-heading">
            <h2>{t('Recent Activity')}</h2>
            <button type="button">{t('View All')}</button>
          </div>
          <div className="merchant-activity-list">
            {activity.map(([label, time, tone, icon]) => (
              <div key={label}>
                <i className={`merchant-activity-dot ${tone}`} />
                <Icon name={icon} />
                <span>
                  {t(label)}
                  <small>{t(time)}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export function MerchantWorkspace({
  profile,
  account,
  error,
  signOut,
}: {
  profile: OwnerProfile;
  account: ReactNode;
  error: ReactNode;
  signOut: () => void;
}) {
  const { t, locale } = useLocale();
  const [view, setView] = useState<View>('dashboard');
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const current = navigation.find((item) => item.id === view)!;
  const products = catalog?.products.filter((product) => !product.archivedAt) ?? [];
  const available = products.filter((product) => product.availability === 'available').length;
  const showLegacyDashboard = false;
  const categories = catalog?.categories.filter((category) => !category.archivedAt) ?? [];
  const number = new Intl.NumberFormat('en-EG-u-nu-latn');
  const money = new Intl.NumberFormat('en-EG-u-nu-latn', {
    style: 'currency',
    currency: 'EGP',
  });
  const stats = [
    { label: 'Active Products', value: products.length, note: 'In your catalog', icon: 'box' },
    { label: 'Available Products', value: available, note: 'Ready to sell', icon: 'store' },
    { label: 'Categories', value: categories.length, note: 'Organize your products', icon: 'grid' },
    {
      label: 'Media Library',
      value: catalog?.media.length ?? 0,
      note: 'Images in your library',
      icon: 'image',
    },
  ];
  function navigate(next: View) {
    setView(next);
    setSearch('');
    setMenuOpen(false);
  }
  const preview = products
    .filter((product) => product.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .slice(0, 5);

  return (
    <div className="merchant-layout">
      <aside
        id="merchant-mobile-navigation"
        className={`merchant-sidebar ${menuOpen ? 'is-open' : ''}`}
      >
        <a
          className="merchant-brand"
          href="#dashboard"
          onClick={(event) => {
            event.preventDefault();
            navigate('dashboard');
          }}
        >
          <span className="merchant-brand-mark" aria-hidden="true">
            ❖
          </span>
          <span>
            <strong>{t('Waffarly')}</strong>
            <small>{t('Merchant')}</small>
          </span>
        </a>
        <nav aria-label={t('Merchant navigation')}>
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`merchant-nav-item ${view === item.id ? 'active' : ''}`}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{t(item.label)}</span>
              {item.id === 'products' && catalog && <small>{number.format(products.length)}</small>}
            </button>
          ))}
        </nav>
        <div className="merchant-sidebar-tip">
          <span className="merchant-tip-icon">
            <Icon name="store" />
          </span>
          <strong>{t('Make your storefront yours')}</strong>
          <p>{t('Choose a design, add your branding, and make it yours.')}</p>
          <button type="button" onClick={() => navigate('settings')}>
            {t('Customize storefront')} <Icon name="arrow" />
          </button>
        </div>
        <div className="merchant-sidebar-footer">
          <span className="merchant-online-dot" />
          {t('Subscription active')}
        </div>
      </aside>
      <div className="merchant-body">
        <header className="merchant-topbar">
          <button
            type="button"
            className="merchant-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="merchant-mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {t('Menu')}
          </button>
          <button type="button" className="merchant-branch-switcher">
            <span className="merchant-business-icon">
              <Icon name="store" />
            </span>
            <span>{t('Main Branch')}</span>
            <Icon name="chevron" />
          </button>
          <label className="merchant-search">
            <Icon name="search" />
            <input
              aria-label={t('Search catalog')}
              placeholder={t('Search products, orders, customers...')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (view === 'settings') setView('dashboard');
              }}
            />
          </label>
          <div className="merchant-topbar-tools">
            <button type="button" className="merchant-topbar-icon" aria-label={t('Notifications')}>
              <Icon name="bell" />
              <i />
            </button>
            <button type="button" className="merchant-topbar-icon" aria-label={t('Help')}>
              <Icon name="help" />
            </button>
          </div>
          <LanguageSwitcher />
          <div className="merchant-user">
            <span className="merchant-avatar">{profile.ownerName.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{profile.ownerName}</strong>
              <small>{t('Merchant Owner')}</small>
            </span>
          </div>
          <button className="merchant-signout" type="button" onClick={signOut}>
            {t('Sign out')}
          </button>
        </header>
        <main id="main-content" tabIndex={-1} className="merchant-content">
          <div className="merchant-breadcrumb">
            {t('Home')} <span>/</span> {t(current.label)}
          </div>
          <div className="merchant-page-heading">
            <div>
              <h1>{t(current.label)}</h1>
              <p>
                {t(
                  view === 'dashboard'
                    ? "Here's what's happening with your business today."
                    : view === 'settings'
                      ? 'Manage your business details and customer-facing storefront.'
                      : 'Keep your catalog accurate, organized, and ready to sell.',
                )}
              </p>
            </div>
            {view === 'dashboard' ? (
              <button type="button" className="merchant-date-filter">
                <Icon name="calendar" />
                <span>
                  {t('Jun 8, 2024')} – {t('Jun 14, 2024')}
                </span>
                <Icon name="chevron" />
              </button>
            ) : (
              <span className="merchant-account-pill">
                <span className="merchant-online-dot" />
                {profile.merchantName}
              </span>
            )}
          </div>
          {error}
          {showLegacyDashboard && (
            <>
              <div className="merchant-stats">
                {stats.map((stat, index) => (
                  <article className="merchant-stat" key={stat.label}>
                    <span className={`merchant-stat-icon tone-${index % 2}`}>
                      <Icon name={stat.icon} />
                    </span>
                    <div>
                      <span>{t(stat.label)}</span>
                      <strong>{catalog ? number.format(stat.value) : '—'}</strong>
                      <small>{t(stat.note)}</small>
                    </div>
                  </article>
                ))}
              </div>
              <div className="merchant-overview-grid">
                <section className="merchant-card merchant-catalog-overview">
                  <div className="merchant-card-heading">
                    <h2>{t('Catalog Overview')}</h2>
                    <button type="button" onClick={() => navigate('products')}>
                      {t('Manage catalog')} <Icon name="arrow" />
                    </button>
                  </div>
                  <p>{t('See which products are ready to sell at a glance.')}</p>
                  <div className="merchant-health">
                    <div
                      className="merchant-health-ring"
                      style={{
                        background: `conic-gradient(#006647 ${products.length ? (available / products.length) * 360 : 0}deg, #edf2ef 0deg)`,
                      }}
                    >
                      <div>
                        <strong>
                          {catalog
                            ? number.format(
                                products.length
                                  ? Math.round((available / products.length) * 100)
                                  : 0,
                              ) + '%'
                            : '—'}
                        </strong>
                        <small>{t('Available')}</small>
                      </div>
                    </div>
                    <div className="merchant-health-legend">
                      <div>
                        <span className="merchant-online-dot" />
                        {t('Available')}
                        <strong>{catalog ? number.format(available) : '—'}</strong>
                      </div>
                      <div>
                        <span className="merchant-amber-dot" />
                        {t('Unavailable')}
                        <strong>
                          {catalog ? number.format(products.length - available) : '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="merchant-gray-dot" />
                        {t('Archived')}
                        <strong>
                          {number.format((catalog?.products.length ?? 0) - products.length)}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="merchant-overview-foot">
                    <Icon name="box" />
                    <span>
                      {t(
                        'Keep product details and images current for a smoother customer experience.',
                      )}
                    </span>
                  </div>
                </section>
                <section className="merchant-card">
                  <div className="merchant-card-heading">
                    <h2>{t('Your Products')}</h2>
                    <button type="button" onClick={() => navigate('products')}>
                      {t('View All')}
                    </button>
                  </div>
                  {!catalog ? (
                    <p>{t('Loading catalog…')}</p>
                  ) : preview.length === 0 ? (
                    <div className="merchant-empty">
                      <Icon name="box" />
                      <h3>{t(search ? 'No matching products.' : 'Your catalog starts here')}</h3>
                      <p>{t('Add an image, create a category, and add your first product.')}</p>
                      <button type="button" onClick={() => navigate('media')}>
                        {t('Get started')} <Icon name="arrow" />
                      </button>
                    </div>
                  ) : (
                    preview.map((product) => (
                      <div className="merchant-product-row" key={product.id}>
                        {product.images[0] ? (
                          <img
                            src={
                              product.images.find((image) => image.isPrimary)?.publicUrl ??
                              product.images[0]!.publicUrl
                            }
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <span className="merchant-product-placeholder">
                            <Icon name="box" />
                          </span>
                        )}
                        <span>
                          <strong>{product.name}</strong>
                          <small>
                            {product.categories.map((category) => category.name).join(', ')}
                          </small>
                        </span>
                        <span
                          className={`merchant-product-status ${product.availability === 'available' ? '' : 'unavailable'}`}
                        >
                          {t(product.availability === 'available' ? 'Available' : 'Unavailable')}
                        </span>
                        <b>{money.format(Number(product.basePrice))}</b>
                      </div>
                    ))
                  )}
                </section>
                <section className="merchant-card">
                  <div className="merchant-card-heading">
                    <h2>{t('Quick Actions')}</h2>
                  </div>
                  <div className="merchant-quick-actions">
                    {navigation.slice(1).map((item) => (
                      <button key={item.id} type="button" onClick={() => navigate(item.id)}>
                        <Icon name={item.icon} />
                        <span>
                          {t(
                            item.id === 'products'
                              ? 'Add Product'
                              : item.id === 'categories'
                                ? 'Create category'
                                : item.id === 'media'
                                  ? 'Add image'
                                  : 'Customize storefront',
                          )}
                        </span>
                        <Icon name="arrow" />
                      </button>
                    ))}
                  </div>
                </section>
                <section className="merchant-card">
                  <div className="merchant-card-heading">
                    <h2>{t('Business account')}</h2>
                    <button type="button" onClick={() => navigate('settings')}>
                      {t('View details')}
                    </button>
                  </div>
                  <h3 className="merchant-business-name">{profile.merchantName}</h3>
                  <p>
                    {profile.ownerName} · {profile.contactPhone}
                  </p>
                  <span className="status-badge">{t('Subscription active')}</span>
                </section>
              </div>
            </>
          )}
          {view === 'dashboard' && (
            <MerchantDashboard
              catalog={catalog}
              products={products}
              preview={preview}
              navigate={navigate}
              number={number}
            />
          )}
          {view === 'dashboard' && (
            <div className="merchant-dashboard-details">
              {account}
              <StorefrontSettings profile={profile} />
            </div>
          )}
          {(view === 'products' || view === 'categories' || view === 'media') && (
            <div>
              <CatalogWorkspace
                section={
                  view === 'products' || view === 'categories' || view === 'media' ? view : 'all'
                }
                search={search}
                onSnapshot={setCatalog}
              />
            </div>
          )}
          {(view === 'orders' ||
            view === 'customers' ||
            view === 'discounts' ||
            view === 'branches') && (
            <section className="merchant-card merchant-coming-soon">
              <div className="merchant-card-heading">
                <h2>{t(current.label)}</h2>
                <span className="status-badge">{t('Coming soon')}</span>
              </div>
              <p>{t('This workspace is ready for your next merchant workflow.')}</p>
              <button type="button" onClick={() => navigate('dashboard')}>
                {t('Back to dashboard')} <Icon name="arrow" />
              </button>
            </section>
          )}
          {view === 'settings' && (
            <div className="merchant-settings">
              {account}
              <StorefrontSettings profile={profile} />
            </div>
          )}
          <footer className="merchant-content-footer">
            {t('Waffarly')} <span>·</span> {t('Everything your business needs, in one place.')}
          </footer>
        </main>
      </div>
    </div>
  );
}
