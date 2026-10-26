import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from '@waffarly/ui';
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { usePosWorkspaceStore } from './app/pos-workspace-store.js';
import { ApiError } from './lib/api-client.js';
import {
  getPosSession,
  posSessionKey,
  signOutPosEmployee,
} from './features/auth/pos-session.api.js';
import { PosPaymentRecoveryNotice } from './features/payments/pos-payment-recovery-notice.js';
import { PosWorkspaceFrame } from './features/workspace/pos-workspace-frame.js';
import { PosButton } from './components/pos-button.js';

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
  const workspace = usePosWorkspaceStore((state) => state.workspace);

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
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-dvh items-center justify-center bg-background p-5 text-sm text-muted-foreground"
      >
        {t('Loading POS…')}
      </main>
    );
  }

  if (sessionQuery.isError && !sessionQuery.data) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-5 text-foreground"
      >
        <p
          className="max-w-xl rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive"
          role="alert"
        >
          {errorText(
            sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : t('Could not verify the POS session.'),
          )}
        </p>
        <PosButton type="button" variant="solid" onClick={() => void sessionQuery.refetch()}>
          {t('Retry')}
        </PosButton>
      </main>
    );
  }

  if (!employee) return null;

  const branch =
    employee.branches.find((item) => item.id === workspace?.selectedBranchId) ??
    employee.branches[0];

  return (
    <PosWorkspaceFrame
      employee={employee}
      branchName={branch?.name ?? ''}
      signingOut={signOutMutation.isPending}
      onSignOut={() => void signOut()}
    >
      {employee.permissions.includes('sell') && <PosPaymentRecoveryNotice employee={employee} />}
      {employee.permissions.includes('sell') && <PosDeliveryRecoveryNotice employee={employee} />}
      {sessionQuery.error && (
        <p
          className="m-0 max-w-none rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground"
          role="status"
        >
          {errorText(
            sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : t('Could not refresh the POS session.'),
          )}
        </p>
      )}
      <Outlet context={{ employee }} />
    </PosWorkspaceFrame>
  );
}
import { PosDeliveryRecoveryNotice } from './features/delivery/pos-delivery-screen.js';
