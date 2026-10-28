import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { useState } from 'react';
import { AdminSidebar } from './components/AdminSidebar.js';
import { AdminTopbar } from './components/AdminTopbar.js';
import { adminQueryKeys } from './app/query-keys.js';
import { apiRequest } from './lib/api-client.js';
import { adminThemeClass } from './lib/admin-theme.js';
import { PageTitleProvider } from './components/PageTitleProvider.js';

interface AdminProfile {
  username: string;
}

export function AppLayout() {
  const { locale, t, errorText } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [signOutError, setSignOutError] = useState('');
  const profile = useQuery({
    queryKey: adminQueryKeys.profile,
    queryFn: () => apiRequest<AdminProfile>('/auth/admin/me'),
    retry: false,
  });

  const signOut = useMutation({
    mutationFn: () => apiRequest('/auth/admin/logout', { method: 'POST' }),
    onSuccess: () => {
      cache.clear();
      navigate('/login', { replace: true });
    },
    onError: (cause: unknown) => {
      setSignOutError(cause instanceof Error ? cause.message : 'Something went wrong.');
    },
  });

  if (profile.isPending) {
    return (
      <div className={adminThemeClass} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <main id="main-content" className="grid min-h-screen place-content-center justify-items-center gap-4 p-6" tabIndex={-1}>
          <span className="grid size-12 place-items-center rounded-2xl bg-waffarly-primary text-lg font-bold text-white" aria-hidden="true">W</span>
          <p className="text-sm text-waffarly-muted" role="status">{t('Loading Super Admin…')}</p>
        </main>
      </div>
    );
  }

  if (profile.isError) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  return (
    <PageTitleProvider key={location.pathname}>
      <div className={`${adminThemeClass} admin-workspace`} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <a className="fixed -top-14 start-4 z-[100] rounded-lg border-2 border-waffarly-primary bg-white px-4 py-3 text-sm font-semibold text-waffarly-primary focus:top-3" href="#main-content">{t('Skip to content')}</a>
        <div className="flex min-h-screen">
          <AdminSidebar />
          <main id="main-content" className="min-w-0 flex-1" tabIndex={-1}>
            <AdminTopbar
              adminName={profile.data?.username ?? ''}
              onSignOut={() => {
                setSignOutError('');
                signOut.mutate();
              }}
              signingOut={signOut.isPending}
            />
            <div className="admin-content mx-auto space-y-3">
              {signOutError && <p className="rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">{errorText(signOutError)}</p>}
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </PageTitleProvider>
  );
}
