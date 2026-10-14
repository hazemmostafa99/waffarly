import { Navigate, Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useLocale, LanguageSwitcher } from '@waffarly/ui';
import { useEffect, useState } from 'react';
import type { OwnerProfile } from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';
import { Icon } from './Icons.js';
import { dashboardCopy } from './dashboard-copy.js';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'orders', label: 'Orders', icon: 'orders' },
  { id: 'products', label: 'Products', icon: 'box' },
  { id: 'categories', label: 'Categories', icon: 'grid' },
  { id: 'media', label: 'Media Library', icon: 'image' },
  { id: 'customers', label: 'Customers', icon: 'customers' },
  { id: 'discounts', label: 'Discounts', icon: 'discounts' },
  { id: 'branches', label: 'Branches', icon: 'branches' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
] as const;

export function MerchantLayout() {
  const { t, locale, errorText } = useLocale();
  const copy = (message: string) => dashboardCopy(message, locale, t);
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<OwnerProfile | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [utilityPanel, setUtilityPanel] = useState<'help' | 'notifications' | null>(null);

  useEffect(() => {
    void apiRequest<OwnerProfile>('/auth/owner/me')
      .then(setProfile)
      .catch(() => {
        setProfile(null);
      });
  }, [navigate]);

  async function signOut() {
    try {
      await apiRequest('/auth/owner/logout', { method: 'POST' });
      setProfile(null);
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign out failed.');
    }
  }

  const current =
    navigation.find(
      (item) =>
        location.pathname === `/${item.id}` ||
        (item.id === 'products' && location.pathname.startsWith('/products/')) ||
        (item.id === 'dashboard' && location.pathname === '/'),
    ) ?? navigation[0];
  const isCustomers = location.pathname === '/customers';
  const isOrders = location.pathname === '/orders';
  const isProductBuilder = [
    '/products/new',
    '/products/create',
    '/products/builder',
    '/product-builder',
  ].includes(location.pathname);
  const hasCustomPageHeading =
    !['/products', '/categories', '/media', '/discounts', '/branches'].includes(location.pathname) &&
    !isProductBuilder;
  const hasBreadcrumb = hasCustomPageHeading && !isCustomers && !isOrders && location.pathname !== '/settings';

  return profile === undefined ? (
    <main id="main-content" tabIndex={-1} className="shell">
      {t('Loading Merchant Dashboard…')}
    </main>
  ) : profile === null ? (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  ) : (
    <div className="merchant-layout">
      <aside
        id="merchant-mobile-navigation"
        className={`merchant-sidebar ${menuOpen ? 'is-open' : ''}`}
      >
        <NavLink to="/" className="merchant-brand" onClick={() => setMenuOpen(false)}>
          <span className="merchant-brand-mark" aria-hidden="true">
            <Icon name="store" />
          </span>
          <span>
            <strong>Waffarly</strong>
            <small>Merchant</small>
          </span>
        </NavLink>
        <button
          type="button"
          className="merchant-mobile-close"
          aria-label={t('Close')}
          onClick={() => setMenuOpen(false)}
        >
          <Icon name="close" />
        </button>
        <nav aria-label={t('Merchant navigation')}>
          {navigation.map((item) => (
            <NavLink
              key={item.id}
              to={item.id === 'dashboard' ? '/' : `/${item.id}`}
              end
              className={({ isActive }) =>
                `merchant-nav-item ${isActive || (item.id === 'products' && isProductBuilder) ? 'active' : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{t(item.label)}</span>
              {item.id === 'orders' && <small aria-hidden="true">12</small>}
            </NavLink>
          ))}
        </nav>
        <div className="merchant-sidebar-tip">
          <span className="merchant-tip-icon">
            <Icon name="store" />
          </span>
          <strong>{copy('Grow your business')}</strong>
          <b>{copy('with Waffarly')}</b>
          <p>{copy('Add more branches and reach more customers.')}</p>
          <button
            type="button"
            onClick={() => {
              navigate('/branches');
              setMenuOpen(false);
            }}
          >
            <Icon name="plus" /> {t('Add Branch')}
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
          <button
            type="button"
            className="merchant-branch-switcher"
            onClick={() => navigate('/branches')}
          >
            <span className="merchant-business-icon">
              <Icon name="store" />
            </span>
            <span>{copy('Zamalek Branch')}</span>
            <Icon name="chevron" />
          </button>
          <label className="merchant-search">
            <Icon name="search" />
            <input
              aria-label={t('Search catalog')}
              placeholder={t('Search products, orders, customers...')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="merchant-topbar-tools">
            <button
              type="button"
              className="merchant-topbar-icon"
              aria-label={t('Notifications')}
              aria-expanded={utilityPanel === 'notifications'}
              aria-controls="merchant-utility-panel"
              onClick={() =>
                setUtilityPanel(utilityPanel === 'notifications' ? null : 'notifications')
              }
            >
              <Icon name="bell" />
              <i />
            </button>
            <button
              type="button"
              className="merchant-topbar-icon"
              aria-label={t('Help')}
              aria-expanded={utilityPanel === 'help'}
              aria-controls="merchant-utility-panel"
              onClick={() => setUtilityPanel(utilityPanel === 'help' ? null : 'help')}
            >
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
          <button
            className="merchant-signout"
            type="button"
            aria-label={t('Sign out')}
            title={t('Sign out')}
            onClick={signOut}
          >
            <Icon name="logout" />
          </button>
          {utilityPanel && (
            <div id="merchant-utility-panel" className="merchant-utility-panel" role="status">
              <strong>{t(utilityPanel === 'help' ? 'Help' : 'Notifications')}</strong>
              <p>
                {copy(
                  utilityPanel === 'help'
                    ? 'Need a hand? Manage your store from Settings.'
                    : 'No new notifications.',
                )}
              </p>
              {utilityPanel === 'help' && (
                <button
                  type="button"
                  onClick={() => {
                    navigate('/settings');
                    setUtilityPanel(null);
                  }}
                >
                  {t('Settings')}
                </button>
              )}
            </div>
          )}
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`merchant-content ${location.pathname === '/settings' ? 'merchant-content-settings' : ''}`}
        >
          {location.pathname !== '/' && hasBreadcrumb && (
              <div className="merchant-breadcrumb">
                {t('Home')} <span>/</span> {t(current.label)}
              </div>
            )}
          {location.pathname !== '/' && hasCustomPageHeading && (
              <div className={`merchant-page-heading ${isCustomers ? 'merchant-customers-heading' : ''}`}>
                <div>
                  <h1>{t(current.label)}</h1>
                  <p>
                    {t(
                      location.pathname === '/'
                        ? "Here's what's happening with your business today."
                        : isOrders
                          ? 'Manage and monitor all orders from different branches and channels.'
                        : isCustomers
                          ? 'Manage your customers and build stronger relationships with them.'
                        : location.pathname === '/settings'
                          ? 'Manage your store settings and tailor the customer experience to your needs.'
                          : 'Keep your catalog accurate, organized, and ready to sell.',
                    )}
                  </p>
                </div>
                {!isCustomers && !isOrders && (
                  <span className="merchant-account-pill">
                    <span className="merchant-online-dot" />
                    {profile.merchantName}
                  </span>
                )}
              </div>
            )}
          {error && (
            <p className="error" role="alert">
              {errorText(error)}
            </p>
          )}
          <Outlet context={{ profile, search }} />
          <footer className="merchant-content-footer">
            {t('Waffarly')} <span>·</span> {t('Everything your business needs, in one place.')}
          </footer>
        </main>
      </div>
    </div>
  );
}
