import type { PosEmployeeSession } from '@waffarly/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocale } from '@waffarly/ui';
import { PosButton } from '../../components/pos-button.js';
import { usePosAppearanceStore } from '../../app/pos-appearance-store.js';
import { apiRequest } from '../../lib/api-client.js';
import { listPosRegisters, posRegisterKey } from '../shifts/pos-shifts.api.js';
import { posSessionKey } from '../auth/pos-session.api.js';
import '@waffarly/ui/pos-theme.css';

interface PosRegisterPairingProps {
  employee: PosEmployeeSession;
  onSignOut: () => void;
  signingOut: boolean;
}

export function PosRegisterPairing({
  employee,
  onSignOut,
  signingOut,
}: PosRegisterPairingProps) {
  const { t, errorText } = useLocale();
  const queryClient = useQueryClient();
  const theme = usePosAppearanceStore((state) => state.theme);
  const [registerId, setRegisterId] = useState('');
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const selectedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  const registersQuery = useQuery({
    queryKey: posRegisterKey(employee.merchantId, employee.branch.id),
    queryFn: ({ signal }) => listPosRegisters(employee.branch.id, signal),
  });
  const pairMutation = useMutation({
    mutationFn: () =>
      apiRequest('/pos/registers/bind', {
        method: 'POST',
        body: JSON.stringify({ registerId }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: posSessionKey });
    },
  });
  const registers = registersQuery.data ?? [];
  const error = registersQuery.error ?? pairMutation.error;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  return (
    <main
      className="pos-theme flex min-h-dvh items-center justify-center bg-background p-4 font-sans text-sm text-foreground sm:p-6"
      data-theme={selectedTheme}
      data-accent="orange"
    >
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <header className="mb-6">
          <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('POS device setup')}
          </p>
          <h1 className="mb-0 mt-2 text-2xl font-semibold tracking-tight">
            {t('Connect this browser to a register')}
          </h1>
          <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
            {t('Choose the cashier station for this browser. It will stay fixed for this branch.')}
          </p>
        </header>

        <div className="mb-5 rounded-lg border border-border bg-background px-3 py-3 text-sm">
          <span className="text-muted-foreground">{t('Assigned branch')}: </span>
          <strong>{employee.branch.name}</strong>
        </div>

        {error && (
          <p
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
          >
            {errorText(error instanceof Error ? error.message : t('Could not pair this browser.'))}
          </p>
        )}

        {registersQuery.isLoading ? (
          <p className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground" role="status">
            {t('Loading available registers…')}
          </p>
        ) : registers.length > 0 ? (
          <label className="grid gap-2 text-sm font-medium">
            {t('Cashier register')}
            <select
              className="min-h-12 rounded-lg border border-input bg-background px-3 text-sm"
              value={registerId}
              disabled={pairMutation.isPending}
              onChange={(event) => setRegisterId(event.target.value)}
            >
              <option value="">{t('Choose a register')}</option>
              {registers.map((register) => (
                <option key={register.id} value={register.id}>
                  {register.name}
                </option>
              ))}
            </select>
          </label>
        ) : !registersQuery.isError ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm leading-6">
            <strong className="block">{t('No available registers at this branch.')}</strong>
            <span className="mt-1 block text-muted-foreground">
              {t('Ask the owner to add a register or unpair a browser after its shift is closed.')}
            </span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <PosButton
            type="button"
            variant="outline"
            disabled={signingOut}
            onClick={onSignOut}
          >
            {signingOut ? t('Signing out…') : t('Sign out')}
          </PosButton>
          {registersQuery.isError && (
            <PosButton
              type="button"
              variant="outline"
              disabled={registersQuery.isFetching}
              onClick={() => void registersQuery.refetch()}
            >
              {t('Retry')}
            </PosButton>
          )}
          <PosButton
            type="button"
            variant="solid"
            disabled={!registerId || registersQuery.isError || pairMutation.isPending}
            onClick={() => pairMutation.mutate()}
          >
            {pairMutation.isPending ? t('Connecting…') : t('Connect register')}
          </PosButton>
        </div>
      </section>
    </main>
  );
}
