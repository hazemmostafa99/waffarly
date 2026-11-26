import { Navigate, Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { useCallback, useEffect, useState } from 'react';
import type { OwnerProfile } from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';
import { Icon } from './Icons.js';
import { dashboardCopy } from './dashboard-copy.js';
import { MerchantNavigation } from './MerchantNavigation.js';
import { getMerchantBreadcrumbs } from './merchant-navigation.js';
import { SubscriptionStatusBadge } from './features/account/SubscriptionStatusBadge.js';

export function MerchantLayout() {
  const { t, locale, errorText } = useLocale();
  const copy = (message: string) => dashboardCopy(message, locale, t);
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbs = getMerchantBreadcrumbs(location.pathname, location.search);
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
              'Your subscription is inactive. You can review records and finish existing work. Contact Wfarly to renew or reactivate.',
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
            <strong>Wfarly</strong>
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
        <MerchantNavigation onNavigate={() => setMenuOpen(false)} />
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
            <a href={new URL('/login?owner=1', import.meta.env.VITE_POS_BASE_URL || 'http://localhost:5175').toString()} className="merchant-signout" target="_blank" rel="noopener noreferrer">
              {locale === 'ar' ? 'افتح POS' : 'Open POS'}
            </a>
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
          <div className="merchant-page-navigation">
          {breadcrumbs.length > 0 && (
            <nav
              className="merchant-breadcrumbs"
              aria-label={locale === 'ar' ? 'مسار الصفحة' : 'Breadcrumbs'}
            >
              {breadcrumbs.map((item, index) => (
                <span key={`${item.en}-${index}`}>
                  {index > 0 && <Icon name="chevron" />}
                  {item.to && index < breadcrumbs.length - 1 ? (
                    <NavLink to={item.to}>{locale === 'ar' ? item.ar : item.en}</NavLink>
                  ) : (
                    <span aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>
                      {locale === 'ar' ? item.ar : item.en}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <div id="merchant-page-actions" />
          </div>
          {error && (
            <p className="error" role="alert">
              {errorText(error)}
            </p>
          )}
          <Outlet context={{ profile, search, updateProfile }} />
          <footer className="merchant-content-footer">
            {t('Wfarly')} <span>·</span> {t('Everything your business needs, in one place.')}
          </footer>
        </main>
      </div>
    </div>
  );
}
