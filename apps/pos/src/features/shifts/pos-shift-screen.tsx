import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OpenPosShiftRequest, PosEmployeeSession } from '@waffarly/contracts';
import { Button, Input, useLocale } from '@waffarly/ui';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { ApiError } from '../../lib/api-client.js';
import {
  getCurrentPosShift,
  listPosRegisters,
  openPosShift,
  posCurrentShiftKey,
  posRegisterKey,
} from './pos-shifts.api.js';

type LayoutContext = { employee: PosEmployeeSession };

export function PosShiftScreen() {
  const { employee } = useOutletContext<LayoutContext>();
  const { t, errorText, formatNumber, formatDate } = useLocale();
  const queryClient = useQueryClient();
  const hydrate = usePosWorkspaceStore((state) => state.hydrate);
  const workspace = usePosWorkspaceStore((state) => state.workspace);
  const selectBranch = usePosWorkspaceStore((state) => state.selectBranch);
  const savePendingShiftOpen = usePosWorkspaceStore((state) => state.savePendingShiftOpen);
  const removePendingShiftOpen = usePosWorkspaceStore((state) => state.removePendingShiftOpen);
  const persistenceError = usePosWorkspaceStore((state) => state.persistenceError);
  const pendingShiftOpen = workspace?.pendingShiftOpen ?? null;
  const branches = useMemo(
    () => employee.branches.filter((branch) => branch.archivedAt === null),
    [employee.branches],
  );
  const [branchId, setBranchId] = useState<string | null>(null);
  const [registerId, setRegisterId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('');
  const [formError, setFormError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const canOpenShift = employee.permissions.includes('open_register_shift');

  useEffect(() => {
    hydrate(employee.merchantId, employee.id);
  }, [employee.id, employee.merchantId, hydrate]);

  useEffect(() => {
    const pendingBranchId = pendingShiftOpen?.branchId;
    const preferred = pendingBranchId ?? workspace?.selectedBranchId;
    const next = branches.find((branch) => branch.id === preferred)?.id ?? branches[0]?.id ?? null;
    setBranchId(next);
    if (next && workspace && workspace.selectedBranchId !== next && !pendingShiftOpen) {
      try {
        selectBranch(employee.merchantId, employee.id, next);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : t('Could not save this branch.'));
      }
    }
  }, [branches, employee.id, employee.merchantId, pendingShiftOpen, selectBranch, t, workspace]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const registersQuery = useQuery({
    queryKey: posRegisterKey(employee.merchantId, branchId ?? ''),
    queryFn: ({ signal }) => listPosRegisters(branchId!, signal),
    enabled: canOpenShift && Boolean(branchId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const registers = registersQuery.data ?? [];

  useEffect(() => {
    if (!registers.length) {
      setRegisterId('');
      return;
    }
    const preferred = pendingShiftOpen?.registerId ?? registerId;
    setRegisterId(
      registers.some((register) => register.id === preferred) ? preferred : registers[0]!.id,
    );
  }, [pendingShiftOpen?.registerId, registerId, registers]);

  const currentShiftKey = posCurrentShiftKey(employee.merchantId, branchId ?? '', registerId);
  const currentShiftQuery = useQuery({
    queryKey: currentShiftKey,
    queryFn: ({ signal }) => getCurrentPosShift(registerId, signal),
    enabled: canOpenShift && Boolean(branchId && registerId),
    refetchOnWindowFocus: true,
  });

  const openMutation = useMutation({
    mutationFn: (input: OpenPosShiftRequest) => openPosShift(input),
    onSuccess: async (shift, variables) => {
      removePendingShiftOpen(employee.merchantId, employee.id, variables.requestId);
      queryClient.setQueryData(currentShiftKey, shift);
      await queryClient.invalidateQueries({ queryKey: currentShiftKey });
    },
    onError: (cause, variables) => {
      if (cause instanceof ApiError && cause.statusCode === 409) {
        removePendingShiftOpen(employee.merchantId, employee.id, variables.requestId);
        void queryClient.invalidateQueries({ queryKey: currentShiftKey });
      }
    },
  });

  useEffect(() => {
    if (pendingShiftOpen && currentShiftQuery.data?.openRequestId === pendingShiftOpen.requestId) {
      removePendingShiftOpen(employee.merchantId, employee.id, pendingShiftOpen.requestId);
    }
  }, [
    currentShiftQuery.data?.openRequestId,
    employee.id,
    employee.merchantId,
    pendingShiftOpen,
    removePendingShiftOpen,
  ]);

  function handleBranchChange(nextBranchId: string) {
    setFormError('');
    setBranchId(nextBranchId);
    setRegisterId('');
    try {
      selectBranch(employee.merchantId, employee.id, nextBranchId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Could not save this branch.'));
    }
  }

  function handleOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    if (!online) {
      setFormError(t('Connect to the internet before opening a register shift.'));
      return;
    }
    if (pendingShiftOpen) {
      openMutation.mutate({
        registerId: pendingShiftOpen.registerId,
        requestId: pendingShiftOpen.requestId,
        openingFloat: pendingShiftOpen.openingFloat,
      });
      return;
    }
    if (!branchId || !registerId) {
      setFormError(t('Select a branch and register first.'));
      return;
    }
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(openingFloat)) {
      setFormError(t('Enter a non-negative amount with up to two decimal places.'));
      return;
    }
    const action = {
      branchId,
      registerId,
      requestId: crypto.randomUUID(),
      openingFloat,
    };
    try {
      savePendingShiftOpen(employee.merchantId, employee.id, action);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Could not save this shift safely.'));
      return;
    }
    openMutation.mutate({
      registerId: action.registerId,
      requestId: action.requestId,
      openingFloat: action.openingFloat,
    });
  }

  if (!canOpenShift) {
    return (
      <section className="mx-auto grid max-w-2xl gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold">
          {t('Register shifts are not enabled for this account.')}
        </h2>
        <p className="m-0 text-sm text-muted-foreground">
          {t('Ask the merchant owner to assign the cashier or supervisor role.')}
        </p>
      </section>
    );
  }

  const activeShift = currentShiftQuery.data ?? null;
  const queryError =
    registersQuery.error instanceof Error
      ? registersQuery.error.message
      : currentShiftQuery.error instanceof Error
        ? currentShiftQuery.error.message
        : '';
  const selectedRegister = registers.find((register) => register.id === registerId);

  return (
    <section className="mx-auto grid max-w-4xl gap-5" aria-labelledby="pos-shift-heading">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('Register control')}
          </p>
          <h2 id="pos-shift-heading" className="mb-0 mt-1 text-2xl font-semibold tracking-tight">
            {t('Open register shift')}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${online ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}
          role="status"
        >
          {online ? t('Online') : t('Offline - shift opening unavailable')}
        </span>
      </header>

      {queryError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <span>{errorText(queryError)}</span>
          <Button type="button" variant="outline" onClick={() => void registersQuery.refetch()}>
            {t('Retry')}
          </Button>
        </div>
      )}
      {(formError || openMutation.error || persistenceError) && (
        <p
          className="m-0 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {errorText(
            formError ||
              (openMutation.error instanceof Error
                ? openMutation.error.message
                : (persistenceError ?? t('Could not open this shift.'))),
          )}
        </p>
      )}
      {!online && pendingShiftOpen && (
        <p
          className="m-0 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="status"
        >
          {t(
            'A shift opening request is saved. Reconnect and retry the exact same request to confirm its result.',
          )}
        </p>
      )}

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:grid-cols-2 sm:p-6">
        <label className="grid gap-2 text-sm font-medium">
          {t('Branch')}
          <select
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={branchId ?? ''}
            disabled={Boolean(pendingShiftOpen) || branches.length === 0}
            onChange={(event) => handleBranchChange(event.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t('Register')}
          <select
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={registerId}
            disabled={
              Boolean(pendingShiftOpen) || registers.length === 0 || registersQuery.isLoading
            }
            onChange={(event) => setRegisterId(event.target.value)}
          >
            {registers.map((register) => (
              <option key={register.id} value={register.id}>
                {register.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {registersQuery.isLoading ? (
        <p className="m-0 text-sm text-muted-foreground" role="status">
          {t('Loading registers...')}
        </p>
      ) : registers.length === 0 ? (
        <div className="grid gap-2 rounded-xl border border-dashed border-border bg-card p-8 text-center text-card-foreground">
          <h3 className="m-0 text-base font-semibold">
            {t('No active registers at this branch.')}
          </h3>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Ask the merchant owner to create a POS register before opening a shift.')}
          </p>
        </div>
      ) : currentShiftQuery.isLoading ? (
        <p className="m-0 text-sm text-muted-foreground" role="status">
          {t('Checking the current shift...')}
        </p>
      ) : activeShift ? (
        <div className="grid gap-4 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              {t('Register shift is open')}
            </span>
            <h3 className="m-0 text-lg font-semibold">{activeShift.registerName}</h3>
            <p className="m-0 text-sm text-emerald-900">
              {t('Opened by {{name}}', { name: activeShift.openedByName })} ·{' '}
              {formatDate(activeShift.openedAt, true)}
            </p>
          </div>
          <strong className="text-lg tabular-nums">
            {formatNumber(Number(activeShift.openingFloat), {
              style: 'currency',
              currency: activeShift.currency,
            })}
          </strong>
          <p className="m-0 text-xs text-emerald-900 sm:col-span-2">
            {t(
              'Operators share this register shift; each sale will be recorded under the employee who performs it.',
            )}
          </p>
        </div>
      ) : (
        <form
          className="grid gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
          onSubmit={handleOpen}
        >
          <div>
            <h3 className="m-0 text-base font-semibold">
              {pendingShiftOpen ? t('Resolve saved opening request') : t('Start a new shift')}
            </h3>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">
              {selectedRegister?.name ?? t('Select a register')}
            </p>
          </div>
          <label className="grid max-w-sm gap-2 text-sm font-medium">
            {t('Opening cash float (EGP)')}
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              max="9999999999.99"
              step="0.01"
              required
              value={pendingShiftOpen?.openingFloat ?? openingFloat}
              disabled={Boolean(pendingShiftOpen) || openMutation.isPending}
              onChange={(event) => setOpeningFloat(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="m-0 max-w-xl text-xs text-muted-foreground">
              {t(
                'The opening amount is recorded once. The same request is safely reused after a network interruption.',
              )}
            </p>
            <Button
              type="submit"
              disabled={
                !online ||
                !branchId ||
                !registerId ||
                openMutation.isPending ||
                Boolean(activeShift)
              }
            >
              {openMutation.isPending
                ? t('Opening...')
                : pendingShiftOpen
                  ? t('Retry saved request')
                  : t('Open shift')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
