import { useIsFetching, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OpenPosShiftRequest, PosEmployeeSession } from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import { CircleDollarSign, Clock3, Info, RefreshCw, Store, UserRound, Wallet } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { ApiError } from '../../lib/api-client.js';
import { isReadablePosLabel } from '../../lib/display-label.js';
import { PosShiftCashManagement } from './pos-shift-cash-management.js';
import { PosCarryoverSelect } from './pos-cash-custody.js';
import { PosRegisterPairing } from '../registers/pos-register-pairing.js';
import {
  getCurrentPosShift,
  openPosShift,
  posCurrentShiftKey,
  posLatestShiftCloseKey,
  posShiftReconciliationKey,
} from './pos-shifts.api.js';

type LayoutContext = { employee: PosEmployeeSession };

export function PosShiftScreen() {
  const { employee } = useOutletContext<LayoutContext>();
  const { t, errorText, formatNumber, formatDate } = useLocale();
  const queryClient = useQueryClient();
  const hydrate = usePosWorkspaceStore((state) => state.hydrate);
  const workspace = usePosWorkspaceStore((state) => state.workspace);
  const savePendingShiftOpen = usePosWorkspaceStore((state) => state.savePendingShiftOpen);
  const removePendingShiftOpen = usePosWorkspaceStore((state) => state.removePendingShiftOpen);
  const persistenceError = usePosWorkspaceStore((state) => state.persistenceError);
  const branchId = employee.branch.id;
  const registerId = employee.deviceRegister?.id ?? '';
  const pendingShiftOpen =
    workspace?.pendingShiftOpen?.branchId === branchId &&
    workspace?.pendingShiftOpen?.registerId === registerId
      ? (workspace.pendingShiftOpen ?? null)
      : null;
  const pendingShiftCashMovement =
    workspace?.pendingShiftCashMovement?.branchId === branchId &&
    workspace?.pendingShiftCashMovement?.registerId === registerId
      ? (workspace.pendingShiftCashMovement ?? null)
      : null;
  const pendingShiftClose =
    workspace?.pendingShiftClose?.branchId === branchId &&
    workspace?.pendingShiftClose?.registerId === registerId
      ? (workspace.pendingShiftClose ?? null)
      : null;
  const [openingFloat, setOpeningFloat] = useState('0');
  // Opening with no float is allowed, but the cashier confirms it once before submitting.
  const [confirmNoFloat, setConfirmNoFloat] = useState(false);
  const [sourceShiftId, setSourceShiftId] = useState('');
  useEffect(() => {
    setSourceShiftId('');
  }, [registerId]);
  const [formError, setFormError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const canOpenShift = employee.permissions.includes('open_register_shift');

  useEffect(() => {
    hydrate(employee.merchantId, employee.id);
  }, [employee.id, employee.merchantId, hydrate]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

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
      setSourceShiftId('');
      setOpeningFloat('0');
      setConfirmNoFloat(false);
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
        ...(pendingShiftOpen.sourceShiftId
          ? { sourceShiftId: pendingShiftOpen.sourceShiftId }
          : {}),
      });
      return;
    }
    if (!registerId) {
      setFormError(t('Select a register first.'));
      return;
    }
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(openingFloat)) {
      setFormError(t('Enter a non-negative amount with up to two decimal places.'));
      return;
    }
    if (Number(openingFloat) === 0 && !confirmNoFloat) {
      setConfirmNoFloat(true);
      return;
    }
    setConfirmNoFloat(false);
    const action = {
      branchId,
      registerId,
      requestId: crypto.randomUUID(),
      openingFloat,
      ...(sourceShiftId ? { sourceShiftId } : {}),
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
      ...(action.sourceShiftId ? { sourceShiftId: action.sourceShiftId } : {}),
    });
  }

  if (!canOpenShift) {
    return (
      <div className="px-3 pt-3 pb-6 sm:px-4">
        <section className="mx-auto grid w-full max-w-2xl gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm">
          <h2 className="m-0 text-sm font-semibold">
            {t('Register shifts are not enabled for this account.')}
          </h2>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Ask the merchant owner to assign the cashier or supervisor role.')}
          </p>
        </section>
      </div>
    );
  }

  // Opening a shift is where an unpaired browser is asked to choose its register.
  if (!employee.deviceRegister) {
    return (
      <div className="px-3 pt-3 pb-6 sm:px-4">
        <PosRegisterPairing employee={employee} />
      </div>
    );
  }

  const queryError =
    currentShiftQuery.error instanceof Error ? currentShiftQuery.error.message : '';
  const selectedRegister = employee.deviceRegister;
  const selectedBranch = employee.branch;
  const openedByName = isReadablePosLabel(activeShift?.openedByName ?? '')
    ? activeShift!.openedByName
    : t('Cashier name unavailable');

  function refreshShiftData() {
    if (branchId && registerId) {
      void currentShiftQuery.refetch();
      void queryClient.refetchQueries({ queryKey: cashStatusKey, type: 'active' });
    }
  }
  const refreshDisabled = !branchId || currentShiftQuery.isFetching || cashStatusFetching > 0;

  return (
    <section
      className="grid w-full content-start gap-3 p-3 pb-6 md:p-4 md:pb-6"
      aria-labelledby="pos-shift-heading"
    >
      <h2 id="pos-shift-heading" className="sr-only">
        {t('Register shift')}
      </h2>

      {queryError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <span>{errorText(queryError)}</span>
          <PosButton
            type="button"
            variant="outline"
            disabled={refreshDisabled}
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

      {currentShiftQuery.isLoading ? (
        <p
          className="m-0 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground"
          role="status"
        >
          {t('Checking the current shift...')}
        </p>
      ) : currentShiftQuery.isError ? (
        <div className="grid gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-foreground">
          <h3 className="m-0 text-base font-semibold">
            {t('Could not verify whether a shift is already open.')}
          </h3>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Retry the shift lookup before opening this register.')}
          </p>
        </div>
      ) : activeShift ? (
        // One compact status bar: what is open, who opened it, and the starting cash.
        <article className="grid gap-2 rounded-xl border border-success/30 bg-card p-3 text-card-foreground shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              {t('Register shift is open')}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
              <Wallet size={15} aria-hidden="true" />
              <span className="truncate">
                {activeShift.registerName || selectedRegister?.name || t('Cashier register')}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Store size={14} aria-hidden="true" />
              {selectedBranch?.name ?? t('Branch')}
            </span>
            <PosButton
              type="button"
              size="icon"
              variant="outline"
              aria-label={t('Refresh')}
              title={t('Refresh')}
              className="ms-auto size-9 shrink-0 [@media(pointer:coarse)]:size-11"
              disabled={refreshDisabled}
              onClick={refreshShiftData}
            >
              <RefreshCw size={14} aria-hidden="true" />
            </PosButton>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={13} aria-hidden="true" />
              {t('Opened by {{name}}', { name: openedByName })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} aria-hidden="true" />
              {formatDate(activeShift.openedAt, true)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CircleDollarSign size={13} aria-hidden="true" />
              {t('Opening cash float (EGP)')}:{' '}
              <strong className="tabular-nums text-foreground">
                {formatNumber(Number(activeShift.openingFloat), {
                  style: 'currency',
                  currency: activeShift.currency,
                })}
              </strong>
            </span>
          </div>
          <p className="m-0 flex gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 shrink-0" size={13} aria-hidden="true" />
            {t(
              'Operators share this register shift; each sale will be recorded under the employee who performs it.',
            )}
          </p>
        </article>
      ) : pendingShiftCashMovement || pendingShiftClose ? (
        <article className="grid gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-card-foreground">
          <div className="flex items-start justify-between gap-2">
            <h3 className="m-0 text-base font-semibold">
              {t('Saved shift action needs confirmation')}
            </h3>
            <PosButton
              type="button"
              size="icon"
              variant="outline"
              aria-label={t('Refresh')}
              title={t('Refresh')}
              className="size-10 shrink-0 [@media(pointer:coarse)]:size-11"
              disabled={refreshDisabled}
              onClick={refreshShiftData}
            >
              <RefreshCw size={14} aria-hidden="true" />
            </PosButton>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Resolve the saved cash movement or shift close before opening a new shift.')}
          </p>
        </article>
      ) : (
        <form
          className="grid gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm sm:p-4"
          noValidate
          onSubmit={handleOpen}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="grid gap-1">
              <h3 className="m-0 text-sm font-semibold">
                {pendingShiftOpen ? t('Resolve saved opening request') : t('Start a new shift')}
              </h3>
              <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet size={15} aria-hidden="true" />
                {selectedRegister?.name ?? t('Cashier register')}
              </p>
            </div>
            <PosButton
              type="button"
              size="icon"
              variant="outline"
              aria-label={t('Refresh')}
              title={t('Refresh')}
              className="size-10 shrink-0 [@media(pointer:coarse)]:size-11"
              disabled={refreshDisabled}
              onClick={refreshShiftData}
            >
              <RefreshCw size={14} aria-hidden="true" />
            </PosButton>
          </div>
          <label className="grid max-w-lg gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <CircleDollarSign size={15} aria-hidden="true" />
              {t('Opening cash float (EGP)')}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {t('The change you put in the drawer before selling. Leave 0 if there is none.')}
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
              className="min-h-12 text-sm font-semibold tabular-nums"
              onChange={(event) => {
                setOpeningFloat(event.target.value);
                setConfirmNoFloat(false);
              }}
            />
          </label>
          {confirmNoFloat && !pendingShiftOpen && (
            <div
              role="alert"
              className="flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
            >
              <span className="flex gap-2 leading-relaxed text-foreground">
                <Info className="mt-0.5 shrink-0" size={15} aria-hidden="true" />
                {t('You are opening the shift with no cash float (0 EGP). Confirm to continue.')}
              </span>
              <PosButton
                type="button"
                variant="outline"
                className="min-h-10 px-3 text-xs"
                onClick={() => setConfirmNoFloat(false)}
              >
                {t('Cancel')}
              </PosButton>
            </div>
          )}
          <div className="grid gap-3 border-t border-border pt-3 sm:flex sm:items-center sm:justify-between">
            {branchId && registerId && (
              <PosCarryoverSelect
                key={`${branchId}:${registerId}`}
                employee={employee}
                branchId={branchId}
                registerId={registerId}
                value={pendingShiftOpen?.sourceShiftId ?? sourceShiftId}
                onChange={setSourceShiftId}
                disabled={Boolean(pendingShiftOpen) || openMutation.isPending}
              />
            )}
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
                  : confirmNoFloat
                    ? t('Confirm and open with no float')
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
