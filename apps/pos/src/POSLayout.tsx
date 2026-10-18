import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, useLocale } from '@waffarly/ui';
import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePosWorkspaceStore } from './app/pos-workspace-store.js';
import { ApiError } from './lib/api-client.js';
import {
  getPosSession,
  posSessionKey,
  signOutPosEmployee,
} from './features/auth/pos-session.api.js';
import { PosPaymentRecoveryNotice } from './features/payments/pos-payment-recovery-notice.js';

export function POSLayout() {
  const { t, errorText } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: posSessionKey,
    queryFn: ({ signal }) => getPosSession(signal),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const signOutMutation = useMutation({ mutationFn: signOutPosEmployee });
  const employee = sessionQuery.data;
  const hydrateWorkspace = usePosWorkspaceStore((state) => state.hydrate);

  useEffect(() => {
    if (sessionQuery.error instanceof ApiError && sessionQuery.error.statusCode === 401) {
      navigate('/login', { replace: true });
    }
  }, [navigate, sessionQuery.error]);

  useEffect(() => {
    if (employee) hydrateWorkspace(employee.merchantId, employee.id);
  }, [employee?.id, employee?.merchantId, hydrateWorkspace]);

  async function signOut() {
    try {
      await signOutMutation.mutateAsync();
      queryClient.clear();
      navigate('/login', { replace: true });
    } catch (cause) {
      console.error('Sign out failed:', cause);
    }
  }

  const sessionExpired =
    sessionQuery.error instanceof ApiError && sessionQuery.error.statusCode === 401;
  if (sessionExpired) return null;

  if (sessionQuery.isLoading && !sessionQuery.data) {
    return (
      <main id="main-content" tabIndex={-1} className="shell pos-shell">
        {t('Loading POS…')}
      </main>
    );
  }

  if (sessionQuery.isError && !sessionQuery.data) {
    return (
      <main id="main-content" tabIndex={-1} className="shell pos-shell">
        <p className="pos-error" role="alert">
          {errorText(
            sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : t('Could not verify the POS session.'),
          )}
        </p>
        <Button type="button" onClick={() => void sessionQuery.refetch()}>
          {t('Retry')}
        </Button>
      </main>
    );
  }

  if (!employee) return null;

  return (
    <main id="main-content" tabIndex={-1} className="shell pos-shell pos-app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">{t('Waffarly · POS')}</div>
          <h1>{t('POS Workspace')}</h1>
          <p>{employee.displayName}</p>
        </div>
        <Button
          variant="outline"
          type="button"
          onClick={() => void signOut()}
          disabled={signOutMutation.isPending}
        >
          {signOutMutation.isPending ? t('Signing out…') : t('Sign out')}
        </Button>
      </header>
      <nav className="pos-primary-nav" aria-label={t('POS workspace')}>
        <NavLink to="/" end>
          {t('Incoming orders')}
        </NavLink>
        <NavLink to="/catalog">{t('New sale')}</NavLink>
        {employee.permissions.includes('sell') && <NavLink to="/dining">{t('Tables')}</NavLink>}
        {employee.permissions.includes('sell') && <NavLink to="/receipts">{t('Receipts')}</NavLink>}
        {employee.permissions.includes('open_register_shift') && (
          <NavLink to="/shift">{t('Register shift')}</NavLink>
        )}
      </nav>
      <PosPaymentRecoveryNotice employee={employee} />
      {sessionQuery.error && (
        <p className="pos-offline-note" role="status">
          {errorText(
            sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : t('Could not refresh the POS session.'),
          )}
        </p>
      )}
      <Outlet context={{ employee }} />
    </main>
  );
}
