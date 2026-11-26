import type { PosEmployeeSession } from '@waffarly/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocale } from '@waffarly/ui';
import { PosButton } from '../../components/pos-button.js';
import { apiRequest } from '../../lib/api-client.js';
import { listPosRegisters, posRegisterKey } from '../shifts/pos-shifts.api.js';
import { posSessionKey } from '../auth/pos-session.api.js';

/**
 * Inline pairing card shown only where register work starts (opening a shift).
 * Browsing the POS does not require a paired browser.
 */
export function PosRegisterPairing({
  employee,
  framed = true,
}: {
  employee: PosEmployeeSession;
  /** False inside a dialog, which supplies its own frame and title. */
  framed?: boolean;
}) {
  const { t, errorText } = useLocale();
  const queryClient = useQueryClient();
  const [registerId, setRegisterId] = useState('');
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

  return (
    <section
      className={
        framed
          ? 'mx-auto grid w-full max-w-lg gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5'
          : 'grid w-full gap-4'
      }
      aria-label={framed ? undefined : t('Connect this browser to a register')}
      aria-labelledby={framed ? 'pos-register-pairing-heading' : undefined}
    >
      <header className="grid gap-1.5">
        {framed && (
          <>
            <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('POS device setup')}
            </p>
            <h3
              id="pos-register-pairing-heading"
              className="m-0 text-lg font-semibold tracking-tight"
            >
              {t('Connect this browser to a register')}
            </h3>
          </>
        )}
        <p className="m-0 text-sm leading-6 text-muted-foreground">
          {t(
            'To open a shift or take payments, connect this browser to a cashier register. You can keep browsing orders without it.',
          )}
        </p>
      </header>

      <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm">
        <span className="text-muted-foreground">{t('Assigned branch')}: </span>
        <strong>{employee.branch.name}</strong>
      </div>

      {error && (
        <p
          className="m-0 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {errorText(error instanceof Error ? error.message : t('Could not pair this browser.'))}
        </p>
      )}

      {registersQuery.isLoading ? (
        <p
          className="m-0 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground"
          role="status"
        >
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

      <div className="flex flex-wrap justify-end gap-3">
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
  );
}
