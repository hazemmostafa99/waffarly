import { Navigate, Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useLocale, LanguageSwitcher } from '@waffarly/ui';
import { useCallback, useEffect, useState } from 'react';
import type { OwnerProfile } from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';
import { Icon } from './Icons.js';
import { dashboardCopy } from './dashboard-copy.js';
import { SubscriptionStatusBadge } from './features/account/SubscriptionStatusBadge.js';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'orders', label: 'Orders', icon: 'orders' },
  { id: 'products', label: 'Products', icon: 'box' },
  { id: 'categories', label: 'Categories', icon: 'grid' },
  { id: 'inventory', label: 'Inventory', icon: 'box' },
  { id: 'media', label: 'Media Library', icon: 'image' },
  { id: 'customers', label: 'Customers', icon: 'customers' },
  { id: 'discounts', label: 'Discounts', icon: 'discounts' },
  { id: 'branches', label: 'Branches', icon: 'branches' },
  { id: 'employees', label: 'Employees', icon: 'customers' },
  { id: 'pos-registers', label: 'POS Registers', icon: 'orders' },
  { id: 'pos-cash', label: 'Cash drawers & safes', icon: 'revenue' },
  { id: 'pos-tables', label: 'POS Tables', icon: 'grid' },
  { id: 'pos-shift-reports', label: 'POS Shift Reports', icon: 'receipt' },
  { id: 'pos-item-returns', label: 'POS Returns & Waste', icon: 'receipt' },
  { id: 'pos-operations', label: 'POS Operations', icon: 'revenue' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
] as const;

export function MerchantLayout() {
  const { t, locale, errorText, formatNumber } = useLocale();
  const copy = (message: string) => dashboardCopy(message, locale, t);
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<OwnerProfile | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [utilityPanel, setUtilityPanel] = useState<'help' | 'notifications' | null>(null);
  const updateProfile = useCallback((changes: Partial<OwnerProfile>) => {
    setProfile((current) => (current ? { ...current, ...changes } : current));
  }, []);

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
        (item.id === 'inventory' && location.pathname.startsWith('/inventory/')) ||
        (item.id === 'products' && location.pathname.startsWith('/products/')) ||
        (item.id === 'dashboard' && location.pathname === '/'),
    ) ?? navigation[0];
  const isProductBuilder = [
    '/products/new',
    '/products/create',
    '/products/builder',
    '/product-builder',
  ].includes(location.pathname);

  function navigationLabel(item: (typeof navigation)[number]): string {
    if (item.id === 'inventory') return copy('Inventory');
    if (locale === 'ar') {
      if (item.id === 'pos-cash') return 'النقدية والخزنة';
      if (item.id === 'pos-operations') return 'تقارير تشغيل POS';
      if (item.id === 'pos-registers') return 'نقاط البيع';
      if (item.id === 'pos-tables') return 'ترابيزات POS';
      if (item.id === 'pos-shift-reports') return 'تقارير ورديات POS';
      if (item.id === 'pos-item-returns') return 'مرتجعات وهالك POS';
      if (item.id === 'employees') return 'الموظفون';
    }
    return t(item.label);
  }

  function navigationLink(item: (typeof navigation)[number]) {
    return (
      <NavLink
        key={item.id}
        to={item.id === 'dashboard' ? '/' : `/${item.id}`}
        end={item.id !== 'inventory'}
        className={({ isActive }) =>
          `merchant-nav-item ${isActive || (item.id === 'products' && isProductBuilder) ? 'active' : ''}`
        }
        onClick={() => setMenuOpen(false)}
      >
        <Icon name={item.icon} />
        <span>{navigationLabel(item)}</span>
        {item.id === 'orders' && <small aria-hidden="true">{formatNumber(12)}</small>}
      </NavLink>
    );
  }

  return profile === undefined ? (
    <main id="main-content" tabIndex={-1} className="shell">
      {t('Loading Merchant Dashboard…')}
    </main>
  ) : profile === null ? (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  ) : (
    <div className="merchant-layout">
      {location.pathname !== '/account' &&
        profile.subscriptionStatus &&
        !['active', 'legacy'].includes(profile.subscriptionStatus) && (
          <div
            role="status"
            className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-warning/30 bg-waffarly-warning-bg p-4 text-sm text-waffarly-gold-ink shadow-lg"
          >
            {t(
              'Your subscription is inactive. You can review records and finish existing work. Contact Waffarly to renew or reactivate.',
            )}
            <NavLink to="/account" className="ms-2 font-semibold underline">
              {locale === 'ar' ? 'تفاصيل الاشتراك' : 'Subscription details'}
            </NavLink>
          </div>
        )}
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
          {navigation.map((item) => {
            if (item.id === 'pos-registers') {
              return (
                <details
                  key={`pos-${current.id}`}
                  className="merchant-pos-navigation"
                  open={current.id.startsWith('pos-')}
                >
                  <summary className="merchant-nav-item">
                    <Icon name="store" />
                    <span>{locale === 'ar' ? 'إدارة نقاط البيع' : 'POS workspace'}</span>
                    <Icon name="chevron" />
                  </summary>
                  <div className="merchant-pos-navigation-links">
                    {navigation.filter((entry) => entry.id.startsWith('pos-')).map(navigationLink)}
                  </div>
                </details>
              );
            }
            return item.id.startsWith('pos-') ? null : navigationLink(item);
          })}
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
          <NavLink to="/account" className="min-w-0 no-underline">
            <SubscriptionStatusBadge status={profile.subscriptionStatus} />
          </NavLink>
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
          <NavLink
            to="/account"
            aria-label={locale === 'ar' ? 'فتح حسابي' : 'Open my account'}
            title={profile.ownerName}
            className="order-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground no-underline hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="merchant-avatar">{profile.ownerName.slice(0, 1).toUpperCase()}</span>
          </NavLink>
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
          className={`merchant-content ${location.pathname === '/' ? 'merchant-content-dashboard' : location.pathname === '/settings' ? 'merchant-content-settings' : ''}`}
        >
          {error && (
            <p className="error" role="alert">
              {errorText(error)}
            </p>
          )}
          <Outlet context={{ profile, search, updateProfile }} />
          <footer className="merchant-content-footer">
            {t('Waffarly')} <span>·</span> {t('Everything your business needs, in one place.')}
          </footer>
        </main>
      </div>
    </div>
  );
}
