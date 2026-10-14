import { Navigate, Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useLocale, Button } from '@waffarly/ui';
import { useEffect, useState } from 'react';
import type { MerchantSummary, MerchantApplicationSummary } from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.';
}

export function AppLayout() {
  const { t, errorText } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [adminName, setAdminName] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [applications, setApplications] = useState<MerchantApplicationSummary[]>([]);
  const [loadingMerchants, setLoadingMerchants] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void apiRequest<{ username: string }>('/auth/admin/me')
      .then((profile) => {
        setAdminName(profile.username);
        setSignedIn(true);
      })
      .catch(() => setSignedIn(false));
  }, [navigate]);

  useEffect(() => {
    if (!adminName) return;
    void Promise.all([
      apiRequest<MerchantSummary[]>('/admin/merchants'),
      apiRequest<MerchantApplicationSummary[]>('/admin/merchant-applications'),
    ])
      .then(([merchantRows, applicationRows]) => {
        setMerchants(merchantRows);
        setApplications(applicationRows);
      })
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoadingMerchants(false));
  }, [adminName]);

  async function signOut() {
    try {
      await apiRequest('/auth/admin/logout', { method: 'POST' });
      setAdminName('');
      setMerchants([]);
      setApplications([]);
      setError('');
      setNotice('');
      setSignedIn(false);
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  const sections = [
    { id: 'businesses', label: t('Businesses'), sub: t('Onboarding') },
    { id: 'templates', label: t('Design library'), sub: t('Storefronts') },
    { id: 'plans', label: t('Plans'), sub: t('Monthly offers') },
    { id: 'activities', label: t('Activities & modules'), sub: t('Capabilities') },
  ] as const;

  const titles: Record<string, string> = {
    businesses: 'Businesses',
    templates: 'Templates & Design Library',
    plans: 'Monthly plans',
    activities: 'Activities & modules',
  };

  if (signedIn === null) {
    return (
      <main id="main-content" tabIndex={-1} className="shell">
        {t('Loading…')}
      </main>
    );
  }
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <main id="main-content" tabIndex={-1} className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">{t('Waffarly · Platform')}</div>
          <h1>{t(titles[location.pathname.slice(1)] ?? 'Businesses')}</h1>
          <p>
            {t('Signed in as')} {adminName}
          </p>
        </div>
        <Button
          variant="outline"
          className="secondary"
          type="button"
          onClick={() => void signOut()}
        >
          {t('Sign out')}{' '}
        </Button>
      </header>
      <nav className="admin-nav" aria-label={t('Platform administration')}>
        {sections.map((section) => (
          <NavLink
            key={section.id}
            to={section.id === 'businesses' ? '/' : `/${section.id}`}
            end
            className={({ isActive }) => `admin-nav-button ${isActive ? 'admin-nav-active' : ''}`}
            aria-current={
              location.pathname === `/${section.id}` ||
              (section.id === 'businesses' && location.pathname === '/')
                ? 'page'
                : undefined
            }
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            {section.label} <span>{section.sub}</span>
          </NavLink>
        ))}
      </nav>
      {location.pathname === '/' && (
        <section className="mb-6 grid gap-4 sm:grid-cols-3" aria-label={t('Business overview')}>
          {[
            ['Businesses', merchants.length],
            [
              'Awaiting review',
              applications.filter((item) => !item.approvedAt && !item.rejectedAt).length,
            ],
            ['Active subscriptions', merchants.filter((item) => item.firstMonthActivatedAt).length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-card p-5">
              <p className="m-0 text-sm">{t(String(label))}</p>
              <strong className="mt-2 block text-3xl">{loadingMerchants ? '—' : value}</strong>
            </div>
          ))}
        </section>
      )}
      {location.pathname === '/' && error && (
        <p className="error" role="alert">
          {errorText(error)}
        </p>
      )}
      {location.pathname === '/' && notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
      <Outlet />
    </main>
  );
}
