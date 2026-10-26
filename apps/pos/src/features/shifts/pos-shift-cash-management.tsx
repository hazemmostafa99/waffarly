import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClosePosShiftRequest,
  PosEmployeeSession,
  PosShiftSummary,
  RecordPosShiftCashMovementRequest,
} from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDollarSign,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import {
  closePosShift,
  getLatestPosShiftClose,
  getPosShiftReconciliation,
  posCurrentShiftKey,
  posLatestShiftCloseKey,
  posShiftReconciliationKey,
  previewPosShiftClose,
  recordPosShiftCashMovement,
} from './pos-shifts.api.js';

interface PosShiftCashManagementProps {
  employee: PosEmployeeSession;
  branchId: string;
  registerId: string;
  shift: PosShiftSummary | null;
  online: boolean;
}

export function PosShiftCashManagement({
  employee,
  branchId,
  registerId,
  shift,
  online,
}: PosShiftCashManagementProps) {
  const { t, errorText, formatNumber, formatDate } = useLocale();
  const queryClient = useQueryClient();
  const workspace = usePosWorkspaceStore((state) => state.workspace);
  const savePendingShiftCashMovement = usePosWorkspaceStore(
    (state) => state.savePendingShiftCashMovement,
  );
  const removePendingShiftCashMovement = usePosWorkspaceStore(
    (state) => state.removePendingShiftCashMovement,
  );
  const savePendingShiftClose = usePosWorkspaceStore((state) => state.savePendingShiftClose);
  const removePendingShiftClose = usePosWorkspaceStore((state) => state.removePendingShiftClose);
  const pendingMovement = workspace?.pendingShiftCashMovement ?? null;
  const pendingClose = workspace?.pendingShiftClose ?? null;
  const canManageCash = employee.permissions.includes('manage_cash_movements');
  const canApproveClose = employee.permissions.includes('approve_shift_close');
  const canSell = employee.permissions.includes('sell');
  const [kind, setKind] = useState<'cash_in' | 'cash_out' | 'cash_drop'>('cash_in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [dropReference, setDropReference] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [requiresCloseApproval, setRequiresCloseApproval] = useState(false);
  const [formError, setFormError] = useState('');

  const reconciliationKey = posShiftReconciliationKey(employee.merchantId, shift?.id ?? '');
  const reconciliation = useQuery({
    queryKey: reconciliationKey,
    queryFn: ({ signal }) => getPosShiftReconciliation(shift!.id, signal),
    enabled: Boolean(shift?.id),
    staleTime: 5_000,
    refetchInterval: shift ? 15_000 : false,
    refetchOnWindowFocus: true,
  });
  const closeReportKey = posLatestShiftCloseKey(employee.merchantId, registerId);
  const latestClose = useQuery({
    queryKey: closeReportKey,
    queryFn: ({ signal }) => getLatestPosShiftClose(registerId, signal),
    enabled: Boolean(registerId && !shift),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const movementMutation = useMutation({
    mutationFn: (command: {
      shiftId: string;
      request: Omit<RecordPosShiftCashMovementRequest, 'approval'>;
      approval?: NonNullable<RecordPosShiftCashMovementRequest['approval']>;
    }) => recordPosShiftCashMovement(command.shiftId, command.request, command.approval),
    onSuccess: async (result, variables) => {
      removePendingShiftCashMovement(employee.merchantId, employee.id, variables.request.requestId);
      setSupervisorPassword('');
      setAmount('');
      setReason('');
      setDropReference('');
      queryClient.setQueryData(reconciliationKey, result.reconciliation);
      await queryClient.invalidateQueries({ queryKey: reconciliationKey });
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: reconciliationKey });
    },
  });

  const closePreviewMutation = useMutation({
    mutationFn: (command: { shiftId: string; request: { countedCash: string; reason?: string } }) =>
      previewPosShiftClose(command.shiftId, command.request),
  });

  const closeMutation = useMutation({
    mutationFn: (command: {
      shiftId: string;
      request: Omit<ClosePosShiftRequest, 'approval'>;
      approval?: NonNullable<ClosePosShiftRequest['approval']>;
    }) => closePosShift(command.shiftId, command.request, command.approval),
    onSuccess: async (report, variables) => {
      removePendingShiftClose(employee.merchantId, employee.id, variables.request.requestId);
      setSupervisorPassword('');
      setCountedCash('');
      setCloseReason('');
      queryClient.setQueryData(posCurrentShiftKey(employee.merchantId, branchId, registerId), null);
      queryClient.setQueryData(closeReportKey, report);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: posCurrentShiftKey(employee.merchantId, branchId, registerId),
        }),
        queryClient.invalidateQueries({ queryKey: closeReportKey }),
      ]);
    },
    onError: async (error) => {
      if (
        error instanceof Error &&
        error.message.includes('Supervisor approval is required for a cash variance.')
      ) {
        setRequiresCloseApproval(true);
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: posCurrentShiftKey(employee.merchantId, branchId, registerId),
        }),
        queryClient.invalidateQueries({ queryKey: reconciliationKey }),
        queryClient.invalidateQueries({ queryKey: closeReportKey }),
      ]);
    },
  });

  useEffect(() => {
    if (pendingMovement) {
      setKind(pendingMovement.request.kind);
      setAmount(pendingMovement.request.amount);
      setReason(pendingMovement.request.reason);
      setDropReference(pendingMovement.request.dropReference ?? '');
    }
  }, [pendingMovement]);

  useEffect(() => {
    if (pendingClose) {
      setCountedCash(pendingClose.request.countedCash);
      setCloseReason(pendingClose.request.reason ?? '');
      setRecipientUsername(pendingClose.request.deliveryHandover?.recipientUsername ?? '');
    }
  }, [pendingClose]);

  function credentials() {
    if (!supervisorUsername.trim() && !supervisorPassword) return undefined;
    if (!supervisorUsername.trim() || !supervisorPassword) {
      setFormError(t('Enter both supervisor username and password.'));
      return undefined;
    }
    return { username: supervisorUsername.trim(), password: supervisorPassword };
  }

  function submitMovement(
    shiftId: string,
    movementBranchId: string,
    movementRegisterId: string,
    request: Omit<RecordPosShiftCashMovementRequest, 'approval'>,
  ) {
    const approval = credentials();
    if (!canManageCash && !approval) {
      setFormError(t('Supervisor approval is required for a cash movement.'));
      return;
    }
    try {
      savePendingShiftCashMovement(employee.merchantId, employee.id, {
        branchId: movementBranchId,
        registerId: movementRegisterId,
        shiftId,
        request,
      });
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : t('Could not save this cash movement safely.'),
      );
      return;
    }
    setFormError('');
    movementMutation.mutate({ shiftId, request, ...(approval ? { approval } : {}) });
  }

  function handleMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || !shift) {
      setFormError(t('Connect to the internet before recording register cash.'));
      return;
    }
    const saved = pendingMovement?.shiftId === shift.id ? pendingMovement.request : null;
    if (!saved && kind === 'cash_drop' && !dropReference.trim()) {
      setFormError(t('Enter a safe bag / drop reference.'));
      return;
    }
    if (!saved && (!/^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(amount) || !reason.trim())) {
      setFormError(t('Enter a positive amount and a reason for this cash movement.'));
      return;
    }
    submitMovement(
      shift.id,
      branchId,
      registerId,
      saved ?? {
        requestId: crypto.randomUUID(),
        kind,
        amount,
        reason: reason.trim(),
        ...(kind === 'cash_drop' ? { dropReference: dropReference.trim() } : {}),
      },
    );
  }

  function retryMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || !pendingMovement) {
      setFormError(t('Connect to the internet before retrying this saved cash movement.'));
      return;
    }
    submitMovement(
      pendingMovement.shiftId,
      pendingMovement.branchId,
      pendingMovement.registerId,
      pendingMovement.request,
    );
  }

  async function submitClose(
    shiftId: string,
    closeBranchId: string,
    closeRegisterId: string,
    request: Omit<ClosePosShiftRequest, 'approval'>,
  ) {
    const approval = credentials();
    if (supervisorUsername.trim() && !approval) return;
    if (!shift && (!canApproveClose || request.deliveryHandover) && !approval) {
      setFormError(t('Re-enter supervisor credentials to safely retry this shift close.'));
      return;
    }
    try {
      if (shift) {
        const preview = await closePreviewMutation.mutateAsync({
          shiftId,
          request: {
            countedCash: request.countedCash,
            ...(request.reason ? { reason: request.reason } : {}),
            ...(request.deliveryHandover ? { deliveryHandover: request.deliveryHandover } : {}),
          },
        });
        if (preview.unsettledCheckCount > 0) {
          setFormError(t('Settle or cancel every open check before closing this shift.'));
          return;
        }
        if (preview.requiresDeliveryHandover) {
          setFormError(t('Enter the employee receiving pending deliveries.'));
          return;
        }
        if (preview.requiresReason && !request.reason) {
          setFormError(t('Enter a reason for the cash variance before closing.'));
          return;
        }
        setRequiresCloseApproval(preview.requiresSupervisorApproval);
        if (preview.requiresSupervisorApproval && !approval) {
          setFormError(
            t(
              preview.pendingDeliveryCount
                ? 'Delivery handover requires a different supervisor.'
                : 'Supervisor approval is required for a cash variance.',
            ),
          );
          return;
        }
      }
      const command = { branchId: closeBranchId, registerId: closeRegisterId, shiftId, request };
      if (!pendingClose) savePendingShiftClose(employee.merchantId, employee.id, command);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : t('Could not save this shift close safely.'),
      );
      return;
    }
    setFormError('');
    closeMutation.mutate({ shiftId, request, ...(approval ? { approval } : {}) });
  }

  function handleClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || !shift) {
      setFormError(t('Connect to the internet before closing this register shift.'));
      return;
    }
    const saved = pendingClose?.shiftId === shift.id ? pendingClose.request : null;
    if (!saved && !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(countedCash)) {
      setFormError(t('Enter the counted cash using up to two decimal places.'));
      return;
    }
    void submitClose(
      shift.id,
      branchId,
      registerId,
      saved ?? {
        requestId: crypto.randomUUID(),
        countedCash,
        ...(closeReason.trim() ? { reason: closeReason.trim() } : {}),
        ...((reconciliation.data?.pendingDeliveryCount ?? 0) > 0 && recipientUsername.trim()
          ? { deliveryHandover: { recipientUsername: recipientUsername.trim() } }
          : {}),
      },
    );
  }

  function retryClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || !pendingClose) {
      setFormError(t('Connect to the internet before retrying this saved shift close.'));
      return;
    }
    void submitClose(
      pendingClose.shiftId,
      pendingClose.branchId,
      pendingClose.registerId,
      pendingClose.request,
    );
  }

  const error =
    formError ||
    (movementMutation.error instanceof Error ? movementMutation.error.message : '') ||
    (closePreviewMutation.error instanceof Error ? closePreviewMutation.error.message : '') ||
    (closeMutation.error instanceof Error ? closeMutation.error.message : '');

  return (
    <div className="grid gap-4" aria-live="polite">
      {error && (
        <p
          className="m-0 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {errorText(error)}
        </p>
      )}
      {shift && (
        <>
          {reconciliation.isLoading ? (
            <p
              className="m-0 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"
              role="status"
            >
              {t('Loading shift reconciliation...')}
            </p>
          ) : reconciliation.isError ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              role="alert"
            >
              <span>
                {t(
                  'Could not load cash reconciliation. Refresh before recording cash or closing the shift.',
                )}
              </span>
              <PosButton
                type="button"
                variant="outline"
                onClick={() => void reconciliation.refetch()}
                disabled={reconciliation.isFetching}
              >
                {t('Retry')}
              </PosButton>
            </div>
          ) : reconciliation.data ? (
            <>
              <section
                className="grid gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
                aria-labelledby="pos-reconciliation-heading"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 id="pos-reconciliation-heading" className="m-0 text-lg font-semibold">
                      {t('Blind cash count')}
                    </h3>
                    <p className="m-0 mt-1 text-xs text-muted-foreground">
                      {t('Count the physical cash before comparing it with the shift totals.')}
                    </p>
                  </div>
                  <PosButton
                    type="button"
                    variant="outline"
                    className="min-h-9 px-3"
                    onClick={() => void reconciliation.refetch()}
                    disabled={reconciliation.isFetching}
                  >
                    <RefreshCw size={14} aria-hidden="true" /> {t('Refresh shift status')}
                  </PosButton>
                </div>
                <p className="m-0 rounded-lg border border-info/30 bg-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
                  {t('Shift totals stay hidden until the physical count is submitted.')}
                </p>
                {reconciliation.data.unsettledCheckCount > 0 && (
                  <div
                    className="grid gap-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
                    role="status"
                  >
                    <strong>
                      {t('Shift close is blocked: {{count}} check(s) still need settlement.', {
                        count: reconciliation.data.unsettledCheckCount,
                      })}
                    </strong>
                    <span>
                      {t('Remaining balance: {{amount}}', {
                        amount: formatMoney(reconciliation.data.unsettledBalance),
                      })}
                    </span>
                  </div>
                )}
                {(reconciliation.data.pendingDeliveryCount ?? 0) > 0 && (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <strong>
                      {t('Pending deliveries')}: {reconciliation.data.pendingDeliveryCount}
                    </strong>
                    <p>
                      {t('Money outside the drawer')}:{' '}
                      {formatMoney(reconciliation.data.pendingDeliveryBalance ?? '0.00')}
                    </p>
                    <Link className="underline" to="/deliveries">
                      {t('Review delivery follow-up')}
                    </Link>
                    <p className="text-xs">
                      {t(
                        'These amounts are not drawer cash. A named recipient and a different supervisor must approve handover.',
                      )}
                    </p>
                  </div>
                )}
                {reconciliation.data.manualMovements.length > 0 && (
                  <details className="rounded-lg border border-border bg-background/60 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      {t('Manual cash movements')} ({reconciliation.data.manualMovements.length})
                    </summary>
                    <ul className="m-0 mt-3 grid list-none gap-2 p-0 text-xs">
                      {reconciliation.data.manualMovements.map((movement) => (
                        <li
                          key={movement.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2"
                        >
                          <span>
                            {movement.kind === 'cash_in'
                              ? t('Cash added')
                              : movement.kind === 'cash_drop'
                                ? t('Cash dropped to safe')
                                : t('Cash removed')}{' '}
                            · {movement.reason}
                            {movement.dropReference
                              ? ` · ${t('Drop reference')}: ${movement.dropReference}`
                              : ''}{' '}
                            · {movement.operatorName}
                          </span>
                          <strong className="tabular-nums">
                            {movement.kind === 'cash_in' ? '+' : '−'}
                            {formatMoney(movement.amount)}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>

              {canSell && (
                <form
                  className="grid gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
                  onSubmit={handleMovement}
                >
                  <div>
                    <h3 className="m-0 text-base font-semibold">{t('Register cash movements')}</h3>
                    <p className="m-0 mt-1 text-xs text-muted-foreground">
                      {t(
                        'Record an addition, paid-out expense, or secured cash drop with a reason. Cashiers need supervisor approval.',
                      )}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[12rem_minmax(9rem,1fr)_minmax(12rem,2fr)]">
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      {t('Movement type')}
                      <select
                        className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        value={pendingMovement?.request.kind ?? kind}
                        disabled={Boolean(pendingMovement) || movementMutation.isPending}
                        onChange={(event) =>
                          setKind(event.target.value as 'cash_in' | 'cash_out' | 'cash_drop')
                        }
                      >
                        <option value="cash_in">{t('Cash added')}</option>
                        <option value="cash_out">{t('Cash removed')}</option>
                        <option value="cash_drop">{t('Cash dropped to safe')}</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      {t('Amount (EGP)')}
                      <Input
                        type="text"
                        inputMode="decimal"
                        required
                        value={pendingMovement?.request.amount ?? amount}
                        disabled={Boolean(pendingMovement) || movementMutation.isPending}
                        onChange={(event) => setAmount(event.target.value)}
                        className="min-h-11 text-sm tabular-nums"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      {t('Reason')}
                      <Input
                        required
                        maxLength={500}
                        value={pendingMovement?.request.reason ?? reason}
                        disabled={Boolean(pendingMovement) || movementMutation.isPending}
                        onChange={(event) => setReason(event.target.value)}
                        className="min-h-11 text-sm"
                      />
                    </label>
                    {(kind === 'cash_drop' || pendingMovement?.request.kind === 'cash_drop') && (
                      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-3">
                        {t('Safe bag / drop reference')}
                        <Input
                          required
                          maxLength={80}
                          value={pendingMovement?.request.dropReference ?? dropReference}
                          disabled={Boolean(pendingMovement) || movementMutation.isPending}
                          onChange={(event) => setDropReference(event.target.value)}
                          className="min-h-11 text-sm"
                        />
                      </label>
                    )}
                  </div>
                  {!canManageCash && (
                    <SupervisorFields
                      username={supervisorUsername}
                      password={supervisorPassword}
                      setUsername={setSupervisorUsername}
                      setPassword={setSupervisorPassword}
                    />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <p className="m-0 text-xs text-muted-foreground">
                      {t(
                        'Supervisor credentials are checked by the server and never saved on this device.',
                      )}
                    </p>
                    <PosButton
                      type="submit"
                      variant="outline"
                      disabled={
                        !online ||
                        movementMutation.isPending ||
                        closePreviewMutation.isPending ||
                        closeMutation.isPending ||
                        Boolean(pendingClose)
                      }
                    >
                      {pendingMovement ? (
                        <RefreshCw size={15} aria-hidden="true" />
                      ) : kind === 'cash_in' ? (
                        <ArrowDownToLine size={15} aria-hidden="true" />
                      ) : (
                        <ArrowUpFromLine size={15} aria-hidden="true" />
                      )}
                      {movementMutation.isPending
                        ? t('Saving...')
                        : pendingMovement
                          ? t('Retry saved movement')
                          : t('Record movement')}
                    </PosButton>
                  </div>
                </form>
              )}

              <form
                className="grid gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
                onSubmit={handleClose}
              >
                <div>
                  <h3 className="m-0 text-base font-semibold">{t('Close register shift')}</h3>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    {t(
                      'Count the physical till. Ordinary unpaid checks block closing; tracked deliveries require an approved handover.',
                    )}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                    {t('Counted cash (EGP)')}
                    <Input
                      type="text"
                      inputMode="decimal"
                      required
                      value={pendingClose?.request.countedCash ?? countedCash}
                      disabled={
                        Boolean(pendingClose) ||
                        closePreviewMutation.isPending ||
                        closeMutation.isPending
                      }
                      onChange={(event) => {
                        setCountedCash(event.target.value);
                        setRequiresCloseApproval(false);
                        setFormError('');
                      }}
                      className="min-h-11 text-base font-semibold tabular-nums"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                    {t('Variance reason')}
                    <Input
                      maxLength={500}
                      value={pendingClose?.request.reason ?? closeReason}
                      disabled={
                        Boolean(pendingClose) ||
                        closePreviewMutation.isPending ||
                        closeMutation.isPending
                      }
                      onChange={(event) => {
                        setCloseReason(event.target.value);
                        setFormError('');
                      }}
                      className="min-h-11 text-sm"
                      placeholder={t('Explain a cash difference if the count is short or over')}
                    />
                  </label>
                </div>
                {(reconciliation.data.pendingDeliveryCount ?? 0) > 0 && (
                  <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                    {t('Receiving employee username')}
                    <Input
                      required
                      maxLength={80}
                      value={
                        pendingClose?.request.deliveryHandover?.recipientUsername ??
                        recipientUsername
                      }
                      disabled={Boolean(pendingClose) || closeMutation.isPending}
                      onChange={(event) => setRecipientUsername(event.target.value)}
                    />
                  </label>
                )}
                {((!canApproveClose && (requiresCloseApproval || pendingClose)) ||
                  (reconciliation.data.pendingDeliveryCount ?? 0) > 0) && (
                  <div className="grid gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 sm:grid-cols-2">
                    <p className="m-0 text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                      {t(
                        (reconciliation.data.pendingDeliveryCount ?? 0) > 0
                          ? 'Delivery handover requires a different supervisor.'
                          : 'A cash variance needs approval from a different supervisor.',
                      )}
                    </p>
                    <SupervisorFields
                      username={supervisorUsername}
                      password={supervisorPassword}
                      setUsername={setSupervisorUsername}
                      setPassword={setSupervisorPassword}
                    />
                  </div>
                )}
                {pendingClose && (
                  <p
                    className="m-0 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning"
                    role="status"
                  >
                    {t(
                      'This close request is saved. Retry the exact same count; re-enter supervisor credentials if the count has a variance.',
                    )}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    {t('The close report shows the comparison after the count is accepted.')}
                  </span>
                  <PosButton
                    type="submit"
                    variant="solid"
                    disabled={
                      !online ||
                      closePreviewMutation.isPending ||
                      closeMutation.isPending ||
                      reconciliation.data.unsettledCheckCount > 0 ||
                      movementMutation.isPending ||
                      Boolean(pendingMovement)
                    }
                  >
                    {closePreviewMutation.isPending
                      ? t('Checking count...')
                      : closeMutation.isPending
                        ? t('Closing...')
                        : pendingClose
                          ? t('Retry shift close')
                          : t('Close shift and save report')}
                  </PosButton>
                </div>
              </form>
            </>
          ) : null}
        </>
      )}

      {!shift && pendingMovement && (
        <form
          className="grid gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-card-foreground"
          onSubmit={retryMovement}
        >
          <div className="flex items-center gap-2">
            <Wallet size={17} aria-hidden="true" />
            <h3 className="m-0 text-base font-semibold">
              {t('Saved cash movement needs confirmation')}
            </h3>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            {t(
              'Retry the exact same request. The amount and reason stay fixed to prevent duplicate till changes.',
            )}
          </p>
          {!canManageCash && (
            <SupervisorFields
              username={supervisorUsername}
              password={supervisorPassword}
              setUsername={setSupervisorUsername}
              setPassword={setSupervisorPassword}
            />
          )}
          <div>
            <PosButton
              type="submit"
              variant="outline"
              disabled={!online || movementMutation.isPending}
            >
              {movementMutation.isPending ? t('Saving...') : t('Retry saved movement')}
            </PosButton>
          </div>
        </form>
      )}
      {!shift && pendingClose && (
        <form
          className="grid gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-card-foreground"
          onSubmit={retryClose}
        >
          <div className="flex items-center gap-2">
            <CircleDollarSign size={17} aria-hidden="true" />
            <h3 className="m-0 text-base font-semibold">
              {t('Saved shift close needs confirmation')}
            </h3>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Counted cash: {{amount}}. Retry the same saved close request.', {
              amount: formatMoney(pendingClose.request.countedCash),
            })}
          </p>
          {(!canApproveClose || Boolean(pendingClose.request.deliveryHandover)) && (
            <SupervisorFields
              username={supervisorUsername}
              password={supervisorPassword}
              setUsername={setSupervisorUsername}
              setPassword={setSupervisorPassword}
            />
          )}
          <div>
            <PosButton
              type="submit"
              variant="outline"
              disabled={!online || closeMutation.isPending}
            >
              {closeMutation.isPending ? t('Closing...') : t('Retry shift close')}
            </PosButton>
          </div>
        </form>
      )}

      {!shift && !pendingMovement && !pendingClose && latestClose.data && (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-base font-semibold">{t('Last shift close')}</h3>
              <p className="m-0 mt-1 text-xs text-muted-foreground">
                {formatDate(latestClose.data.closedAt, true)} · {latestClose.data.operatorName}
              </p>
            </div>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">
              {t('Closed')}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryValue
              label={t('Expected cash')}
              value={latestClose.data.expectedCash}
              formatMoney={formatMoney}
            />
            <SummaryValue
              label={t('Counted cash')}
              value={latestClose.data.countedCash}
              formatMoney={formatMoney}
            />
            <SummaryValue
              label={t('Variance')}
              value={latestClose.data.variance}
              formatMoney={formatMoney}
            />
            <SummaryValue
              label={t('Cash dropped to safe')}
              value={latestClose.data.cashDrop}
              formatMoney={formatMoney}
            />
            <SummaryValue
              label={t('Courier cash received')}
              value={latestClose.data.deliveryCashReceived ?? '0.00'}
              formatMoney={formatMoney}
            />
          </div>
          {latestClose.data.reason && (
            <p className="m-0 text-sm text-muted-foreground">
              {t('Reason')}: {latestClose.data.reason}
            </p>
          )}
          {latestClose.data.deliveryHandover && (
            <div className="rounded-lg border border-border p-3">
              <strong>
                {t('Delivery handover')}: {latestClose.data.deliveryHandover.recipientName}
              </strong>
              <p>
                {t('Approved by')}: {latestClose.data.deliveryHandover.approvedByName}
              </p>
              <ul>
                {latestClose.data.deliveryHandover.deliveries.map((d) => (
                  <li key={d.orderId}>
                    #{d.orderId.slice(0, 8)} · {d.courierName} · {t('Customer due')}:{' '}
                    {d.customerDue} EGP · {t('Cash with courier')}: {d.courierCashHeld} EGP
                  </li>
                ))}
              </ul>
            </div>
          )}
          <PosButton
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => void latestClose.refetch()}
            disabled={latestClose.isFetching}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t('Refresh close report')}
          </PosButton>
        </section>
      )}
    </div>
  );

  function formatMoney(value: string) {
    const numeric = Number(value.replace('−', '-'));
    return formatNumber(numeric, { style: 'currency', currency: 'EGP' });
  }
}

function SupervisorFields({
  username,
  password,
  setUsername,
  setPassword,
}: {
  username: string;
  password: string;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        {t('Supervisor username')}
        <Input
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="min-h-11 text-sm"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        {t('Supervisor password')}
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 text-sm"
        />
      </label>
    </div>
  );
}

function SummaryValue({
  label,
  value,
  formatMoney,
}: {
  label: string;
  value: string;
  formatMoney: (value: string) => string;
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-border bg-background/70 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="text-sm tabular-nums">{formatMoney(value)}</strong>
    </div>
  );
}
