import { useIsFetching, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OpenPosShiftRequest, PosEmployeeSession } from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import {
  CircleCheck,
  CircleDollarSign,
  Clock3,
  Info,
  RefreshCw,
  Store,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { ApiError } from '../../lib/api-client.js';
import { isReadablePosLabel } from '../../lib/display-label.js';
import { PosShiftCashManagement } from './pos-shift-cash-management.js';
import { getCurrentPosShift, listPosRegisters, openPosShift, posCurrentShiftKey, posLatestShiftCloseKey, posRegisterKey, posShiftReconciliationKey } from './pos-shifts.api.js';

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
  const pendingShiftCashMovement = workspace?.pendingShiftCashMovement ?? null;
  const pendingShiftClose = workspace?.pendingShiftClose ?? null;
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
    const pendingBranchId = pendingShiftOpen?.branchId ??
      pendingShiftCashMovement?.branchId ?? pendingShiftClose?.branchId;
    const preferred = pendingBranchId ?? workspace?.selectedBranchId;
    const next = branches.find((branch) => branch.id === preferred)?.id ?? branches[0]?.id ?? null;
    setBranchId(next);
    if (next && workspace && workspace.selectedBranchId !== next &&
      !pendingShiftOpen && !pendingShiftCashMovement && !pendingShiftClose) {
      try {
        selectBranch(employee.merchantId, employee.id, next);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : t('Could not save this branch.'));
      }
    }
  }, [branches, employee.id, employee.merchantId, pendingShiftCashMovement, pendingShiftClose, pendingShiftOpen, selectBranch, t, workspace]);

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
    const preferred = pendingShiftOpen?.registerId ?? pendingShiftCashMovement?.registerId ??
      pendingShiftClose?.registerId ?? registerId;
    setRegisterId(
      registers.some((register) => register.id === preferred) ? preferred : registers[0]!.id,
    );
  }, [pendingShiftCashMovement?.registerId, pendingShiftClose?.registerId, pendingShiftOpen?.registerId, registerId, registers]);

  const currentShiftKey = posCurrentShiftKey(employee.merchantId, branchId ?? '', registerId);
  const currentShiftQuery = useQuery({
    queryKey: currentShiftKey,
    queryFn: ({ signal }) => getCurrentPosShift(registerId, signal),
    enabled: canOpenShift && Boolean(branchId && registerId),
    refetchOnWindowFocus: true,
  });
  const activeShift = currentShiftQuery.data ?? null;
  const cashStatusKey = activeShift
    ? posShiftReconciliationKey(employee.merchantId, activeShift.id)
    : posLatestShiftCloseKey(employee.merchantId, registerId);
  const cashStatusFetching = useIsFetching({ queryKey: cashStatusKey });
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
      <div className="px-4 pt-7 pb-8 sm:px-6 sm:pt-9 lg:pt-10">
        <section className="mx-auto grid w-full max-w-2xl gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <h2 className="m-0 text-lg font-semibold">
            {t('Register shifts are not enabled for this account.')}
          </h2>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Ask the merchant owner to assign the cashier or supervisor role.')}
          </p>
        </section>
      </div>
    );
  }

  const queryError =
    registersQuery.error instanceof Error
      ? registersQuery.error.message
      : currentShiftQuery.error instanceof Error
        ? currentShiftQuery.error.message
        : '';
  const selectedRegister = registers.find((register) => register.id === registerId);
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const openedByName = isReadablePosLabel(activeShift?.openedByName ?? '')
    ? activeShift!.openedByName
    : t('Cashier name unavailable');

  function refreshShiftData() {
    if (branchId) void registersQuery.refetch();
    if (branchId && registerId) {
      void currentShiftQuery.refetch();
      void queryClient.refetchQueries({ queryKey: cashStatusKey, type: 'active' });
    }
  }

  return (
    <section
      className="mx-auto grid w-full max-w-6xl content-start gap-6 px-4 pt-7 pb-10 sm:gap-7 sm:px-6 sm:pt-9 lg:pt-10"
      aria-labelledby="pos-shift-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
        <div className="grid gap-1">
          <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('Register control')}
          </p>
          <h2 id="pos-shift-heading" className="mb-0 mt-1 text-2xl font-semibold tracking-tight">
            {t('Open register shift')}
          </h2>
          <p className="m-0 mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t('Review the selected register and opening cash, or start a new shift.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PosButton
            type="button"
            variant="outline"
            className="min-h-9 px-3"
            disabled={!branchId || registersQuery.isFetching || currentShiftQuery.isFetching || cashStatusFetching > 0}
            onClick={refreshShiftData}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t('Refresh')}
          </PosButton>
          <span
            className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${online ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning'}`}
            role="status"
          >
            <span className="size-2 rounded-full bg-current" aria-hidden="true" />
            {online ? t('Online') : t('Offline - shift opening unavailable')}
          </span>
        </div>
      </header>

      {queryError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <span>{errorText(queryError)}</span>
          <PosButton
            type="button"
            variant="outline"
            disabled={!branchId || registersQuery.isFetching || currentShiftQuery.isFetching || cashStatusFetching > 0}
            onClick={refreshShiftData}
          >
            {t('Retry')}
          </PosButton>
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
          className="m-0 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
          role="status"
        >
          {t(
            'A shift opening request is saved. Reconnect and retry the exact same request to confirm its result.',
          )}
        </p>
      )}

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:grid-cols-2 sm:p-5">
        <label className="grid min-w-0 gap-2 text-sm font-medium">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Store size={15} aria-hidden="true" />
            {t('Branch')}
          </span>
          <select
            className="min-h-12 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            value={branchId ?? ''}
            disabled={Boolean(pendingShiftOpen || pendingShiftCashMovement || pendingShiftClose) || branches.length === 0}
            onChange={(event) => handleBranchChange(event.target.value)}
          >
            {branches.length === 0 && <option value="">{t('No active branches assigned')}</option>}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-medium">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Wallet size={15} aria-hidden="true" />
            {t('Register')}
          </span>
          <select
            className="min-h-12 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            value={registerId}
            disabled={
              Boolean(pendingShiftOpen) ||
              Boolean(pendingShiftCashMovement || pendingShiftClose) ||
              branches.length === 0 ||
              registers.length === 0 ||
              registersQuery.isLoading
            }
            onChange={(event) => setRegisterId(event.target.value)}
          >
            {registers.length === 0 && <option value="">{t('Select a register')}</option>}
            {registers.map((register) => (
              <option key={register.id} value={register.id}>
                {register.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {branches.length === 0 ? (
        <div className="grid gap-2 rounded-xl border border-dashed border-border bg-card p-5 text-card-foreground sm:p-7">
          <h3 className="m-0 text-base font-semibold">
            {t('No active branches are assigned to this account.')}
          </h3>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Ask the merchant owner to assign you to an active POS branch.')}
          </p>
        </div>
      ) : registersQuery.isLoading ? (
        <p
          className="m-0 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"
          role="status"
        >
          {t('Loading registers...')}
        </p>
      ) : registersQuery.isError ? (
        <div className="grid gap-2 rounded-xl border border-warning/30 bg-warning/10 p-5 text-foreground sm:p-7">
          <h3 className="m-0 text-base font-semibold">
            {t('Could not verify register availability.')}
          </h3>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Retry the register lookup before opening a shift.')}
          </p>
        </div>
      ) : registers.length === 0 ? (
        <div className="grid gap-2 rounded-xl border border-dashed border-border bg-card p-5 text-card-foreground sm:p-7">
          <h3 className="m-0 text-base font-semibold">
            {t('No active registers at this branch.')}
          </h3>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Ask the merchant owner to create a POS register before opening a shift.')}
          </p>
        </div>
      ) : currentShiftQuery.isLoading ? (
        <p
          className="m-0 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"
          role="status"
        >
          {t('Checking the current shift...')}
        </p>
      ) : currentShiftQuery.isError ? (
        <div className="grid gap-2 rounded-xl border border-warning/30 bg-warning/10 p-5 text-foreground sm:p-7">
          <h3 className="m-0 text-base font-semibold">
            {t('Could not verify whether a shift is already open.')}
          </h3>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Retry the shift lookup before opening this register.')}
          </p>
        </div>
      ) : activeShift ? (
        <article className="overflow-hidden rounded-xl border border-success/30 bg-card text-card-foreground shadow-sm">
          <div className="flex min-h-11 items-center gap-2 border-b border-success/20 bg-success/10 px-4 py-2 text-sm font-semibold text-success sm:px-5">
            <CircleCheck size={17} aria-hidden="true" />
            {t('Register shift is open')}
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,auto)] sm:items-center sm:gap-6 sm:p-6">
            <div className="grid min-w-0 gap-3">
              <div>
                <h3 className="m-0 break-words text-lg font-semibold">
                  {activeShift.registerName}
                </h3>
                <p className="mb-0 mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Store size={15} aria-hidden="true" />
                  {selectedBranch?.name ?? t('Branch')}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound size={14} aria-hidden="true" />
                  {t('Opened by {{name}}', { name: openedByName })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={14} aria-hidden="true" />
                  {formatDate(activeShift.openedAt, true)}
                </span>
              </div>
            </div>
            <div className="grid gap-1 rounded-lg border border-border bg-secondary/50 p-4 sm:min-w-52">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CircleDollarSign size={14} aria-hidden="true" />
                {t('Opening cash float (EGP)')}
              </span>
              <strong className="text-xl font-bold tabular-nums">
                {formatNumber(Number(activeShift.openingFloat), {
                  style: 'currency',
                  currency: activeShift.currency,
                })}
              </strong>
            </div>
            <p className="m-0 flex gap-2 rounded-lg bg-info/10 p-3 text-xs leading-relaxed text-info sm:col-span-2">
              <Info className="mt-0.5 shrink-0" size={15} aria-hidden="true" />
              {t(
                'Operators share this register shift; each sale will be recorded under the employee who performs it.',
              )}
            </p>
          </div>
        </article>
      ) : pendingShiftCashMovement || pendingShiftClose ? (
        <article className="grid gap-2 rounded-xl border border-warning/30 bg-warning/5 p-5 text-card-foreground">
          <h3 className="m-0 text-base font-semibold">{t('Saved shift action needs confirmation')}</h3>
          <p className="m-0 text-sm text-muted-foreground">{t('Resolve the saved cash movement or shift close before opening a new shift.')}</p>
        </article>
      ) : (
        <form
          className="grid gap-5 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6"
          onSubmit={handleOpen}
        >
          <div className="grid gap-1">
            <h3 className="m-0 text-lg font-semibold">
              {pendingShiftOpen ? t('Resolve saved opening request') : t('Start a new shift')}
            </h3>
            <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet size={15} aria-hidden="true" />
              {selectedRegister?.name ?? t('Select a register')}
            </p>
          </div>
          <label className="grid max-w-lg gap-2 text-sm font-medium">
            <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <CircleDollarSign size={15} aria-hidden="true" />
              {t('Opening cash float (EGP)')}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              max="9999999999.99"
              step="0.01"
              required
              value={pendingShiftOpen?.openingFloat ?? openingFloat}
              disabled={Boolean(pendingShiftOpen) || openMutation.isPending}
              className="min-h-12 text-base font-semibold tabular-nums"
              onChange={(event) => setOpeningFloat(event.target.value)}
            />
          </label>
          <div className="grid gap-4 border-t border-border pt-4 sm:flex sm:items-center sm:justify-between">
            <p className="m-0 flex max-w-2xl gap-2 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 shrink-0" size={15} aria-hidden="true" />
              {t(
                'The opening amount is recorded once. The same request is safely reused after a network interruption.',
              )}
            </p>
            <PosButton
              type="submit"
              variant="solid"
              className="min-h-11 w-full sm:w-auto"
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
            </PosButton>
          </div>
        </form>
      )}
      {currentShiftQuery.isSuccess && branchId && registerId && (
        <PosShiftCashManagement
          employee={employee}
          branchId={branchId}
          registerId={registerId}
          shift={activeShift}
          online={online}
        />
      )}
    </section>
  );
}
