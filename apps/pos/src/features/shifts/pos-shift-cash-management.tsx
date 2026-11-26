import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClosePosShiftRequest,
  PosEmployeeSession,
  PosShiftSummary,
  RecordPosShiftCashMovementRequest,
} from '@waffarly/contracts';
import { cn, Input, useLocale } from '@waffarly/ui';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDollarSign,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PosCashCustody, PosSafeSelect } from './pos-cash-custody.js';
import { isCorrectableShiftCloseRejection } from './shift-close-recovery.js';
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

type ShiftTab = 'close' | 'cash' | 'custody';

const shiftTabs: { value: ShiftTab; label: string }[] = [
  { value: 'close', label: 'Close register shift' },
  { value: 'cash', label: 'Register cash movements' },
  { value: 'custody', label: 'Cash custody' },
];

type MovementKind = 'cash_in' | 'cash_out' | 'cash_drop';

/** Each movement kind with the short hint shown under the type buttons. */
const movementKinds: { kind: MovementKind; label: string; hint: string }[] = [
  {
    kind: 'cash_in',
    label: 'Cash added',
    hint: 'Money you put into the drawer, like extra change.',
  },
  {
    kind: 'cash_out',
    label: 'Cash removed',
    hint: 'Money you take out of the drawer to pay for something, like an expense.',
  },
  {
    kind: 'cash_drop',
    label: 'Cash dropped to safe',
    hint: 'Extra cash you move from the drawer to the safe during the shift.',
  },
];

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
  const { t, locale, errorText, formatNumber, formatDate } = useLocale();
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
  const pendingMovement =
    workspace?.pendingShiftCashMovement?.branchId === branchId
      ? (workspace.pendingShiftCashMovement ?? null)
      : null;
  const pendingClose =
    workspace?.pendingShiftClose?.branchId === branchId
      ? (workspace.pendingShiftClose ?? null)
      : null;
  const canManageCash = employee.permissions.includes('manage_cash_movements');
  const canApproveClose = employee.permissions.includes('approve_shift_close');
  const canSell = employee.permissions.includes('sell');
  const [kind, setKind] = useState<MovementKind>('cash_in');
  const selectedKind = pendingMovement?.request.kind ?? kind;
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [dropReference, setDropReference] = useState('');
  const [safeId, setSafeId] = useState('');
  useEffect(() => {
    setSafeId('');
  }, [branchId]);
  const [countedCash, setCountedCash] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [requiresCloseApproval, setRequiresCloseApproval] = useState(false);
  // One job at a time: closing, moving cash in or out, or handing custody to the safe.
  const [activeTab, setActiveTab] = useState<ShiftTab>('close');
  // errorText localizes these keys once when rendering; do not translate them on assignment.
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
      // Approval is per action; a leftover username would block the next close silently.
      setSupervisorUsername('');
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
      setSupervisorUsername('');
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
    onError: async (error, variables) => {
      if (isCorrectableShiftCloseRejection(error)) {
        removePendingShiftClose(employee.merchantId, employee.id, variables.request.requestId);
        setSupervisorPassword('');
        setFormError(
          'Shift close was rejected. Review the count, then submit again.',
        );
      }
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
      // A saved movement must be retried before anything else, so show its form.
      setActiveTab('cash');
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
    }
  }, [pendingClose]);

  function credentials() {
    if (!supervisorUsername.trim() && !supervisorPassword) return undefined;
    if (!supervisorUsername.trim() || !supervisorPassword) {
      setFormError('Enter both supervisor username and password.');
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
      setFormError('Supervisor approval is required for a cash movement.');
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
        cause instanceof Error ? cause.message : 'Could not save this cash movement safely.',
      );
      return;
    }
    setFormError('');
    movementMutation.mutate({ shiftId, request, ...(approval ? { approval } : {}) });
  }

  function handleMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || !shift) {
      setFormError('Connect to the internet before recording register cash.');
      return;
    }
    const saved = pendingMovement?.shiftId === shift.id ? pendingMovement.request : null;
    if (!saved && kind === 'cash_drop' && !safeId) {
      setFormError(locale === 'ar' ? 'اختر الخزنة المستلمة.' : 'Select a receiving safe.');
      return;
    }
    if (!saved && (!/^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(amount) || !reason.trim())) {
      setFormError('Enter a positive amount and a reason for this cash movement.');
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
        // The bag or receipt number is optional; the server names the transfer when blank.
        ...(kind === 'cash_drop'
          ? { safeId, ...(dropReference.trim() ? { dropReference: dropReference.trim() } : {}) }
          : {}),
      },
    );
  }

  function retryMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || !pendingMovement) {
      setFormError('Connect to the internet before retrying this saved cash movement.');
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
    if (
      !shift &&
      !approval &&
      ((!canApproveClose &&
        (!request.confirmPendingDeliveries || Boolean(request.reason))) ||
        (Boolean(request.deliveryHandover) && !request.confirmPendingDeliveries))
    ) {
      setFormError('Re-enter supervisor credentials to safely retry this shift close.');
      return;
    }
    let submittedRequest = request;
    try {
      if (shift) {
        const preview = await closePreviewMutation.mutateAsync({
          shiftId,
          request: {
            countedCash: request.countedCash,
            ...(request.reason ? { reason: request.reason } : {}),
            ...(request.confirmPendingDeliveries !== undefined
              ? { confirmPendingDeliveries: request.confirmPendingDeliveries }
              : {}),
            ...(request.deliveryHandover ? { deliveryHandover: request.deliveryHandover } : {}),
          },
        });
        setRequiresCloseApproval(preview.requiresSupervisorApproval);
        if (preview.unsettledCheckCount > 0) {
          setFormError('Settle or cancel every open check before closing this shift.');
          return;
        }
        if (preview.requiresDeliveryConfirmation) {
          const pendingCount = preview.pendingDeliveryCount ?? 0;
          const pendingText =
            pendingCount === 1
              ? '1 delivery is still pending'
              : `${pendingCount} deliveries are still pending`;
          const message =
            locale === 'ar'
              ? `فيه ${pendingCount} طلب توصيل لسه معلّق. هتقفل الوردية من غير تعيين مستلم، والتحصيل اللي يرجع بعد كده هيتسجل في الوردية المفتوحة وقت استلامه. تأكد من قفل الوردية؟`
              : `${pendingText}. This shift will close without assigning a recipient; cash received later will be recorded in the shift open at that time. Close this shift?`;
          if (!window.confirm(message)) return;
          submittedRequest = { ...request, confirmPendingDeliveries: true };
        }
        if (preview.requiresReason && !request.reason) {
          setFormError('Enter a reason for the cash variance before closing.');
          return;
        }
        if (preview.requiresSupervisorApproval && !approval) {
          setFormError('Supervisor approval is required for a cash variance.');
          return;
        }
      }
      const command = {
        branchId: closeBranchId,
        registerId: closeRegisterId,
        shiftId,
        request: submittedRequest,
      };
      if (!pendingClose) savePendingShiftClose(employee.merchantId, employee.id, command);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : 'Could not save this shift close safely.',
      );
      return;
    }
    setFormError('');
    closeMutation.mutate({
      shiftId,
      request: submittedRequest,
      ...(approval ? { approval } : {}),
    });
  }

  function handleClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || !shift) {
      setFormError('Connect to the internet before closing this register shift.');
      return;
    }
    const saved = pendingClose?.shiftId === shift.id ? pendingClose.request : null;
    if (!saved && !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(countedCash)) {
      setFormError('Enter the counted cash using up to two decimal places.');
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
      },
    );
  }

  function retryClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || !pendingClose) {
      setFormError('Connect to the internet before retrying this saved shift close.');
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

  // The alert sits above long forms; bring it into view so a rejected close is never silent.
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  return (
    <div className="grid gap-3" aria-live="polite">
      {error && (
        <p
          ref={errorRef}
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
              className="m-0 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground"
              role="status"
            >
              {t('Loading shift reconciliation...')}
            </p>
          ) : reconciliation.isError ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
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
                size="sm"
                onClick={() => void reconciliation.refetch()}
                disabled={reconciliation.isFetching}
              >
                {t('Retry')}
              </PosButton>
            </div>
          ) : reconciliation.data ? (
            <>
              {reconciliation.data.unsettledCheckCount > 0 && (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm"
                  role="status"
                >
                  <div className="grid gap-0.5">
                    <strong className="text-warning">
                      {t('Shift close is blocked: {{count}} check(s) still need settlement.', {
                        count: reconciliation.data.unsettledCheckCount,
                      })}
                    </strong>
                    <span className="text-xs text-foreground">
                      {t('Remaining balance: {{amount}}', {
                        amount: formatMoney(reconciliation.data.unsettledBalance),
                      })}
                    </span>
                  </div>
                  <Link
                    className="rounded-md border border-warning/40 px-2.5 py-1.5 text-xs font-medium text-warning hover:bg-warning/10"
                    to="/orders"
                  >
                    {t('Open orders')}
                  </Link>
                </div>
              )}
              {(reconciliation.data.pendingDeliveryCount ?? 0) > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
                  <div className="grid gap-0.5">
                    <strong className="text-warning">
                      {t('Pending deliveries')}: {reconciliation.data.pendingDeliveryCount} ·{' '}
                      {formatMoney(reconciliation.data.pendingDeliveryBalance ?? '0.00')}
                    </strong>
                    <span className="text-xs text-foreground">
                      {t(
                        'These amounts are not drawer cash. You can close after confirming, and a later shift records cash when it is received.',
                      )}
                    </span>
                  </div>
                  <Link
                    className="rounded-md border border-warning/40 px-2.5 py-1.5 text-xs font-medium text-warning hover:bg-warning/10"
                    to="/deliveries"
                  >
                    {t('Review delivery follow-up')}
                  </Link>
                </div>
              )}

              <div
                role="tablist"
                aria-label={t('Register shift')}
                className={cn(
                  'grid gap-1 rounded-lg bg-secondary/50 p-1',
                  canSell ? 'grid-cols-3' : 'grid-cols-2',
                )}
              >
                {shiftTabs
                  .filter((tab) => tab.value !== 'cash' || canSell)
                  .map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.value}
                      disabled={Boolean(pendingMovement) && tab.value !== 'cash'}
                      onClick={() => setActiveTab(tab.value)}
                      className={cn(
                        'min-h-9 rounded-md px-2 text-xs font-semibold transition-colors disabled:opacity-50 sm:text-sm',
                        activeTab === tab.value
                          ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t(tab.label)}
                    </button>
                  ))}
              </div>

              {activeTab === 'cash' && canSell && (
                <form
                  className="grid gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm sm:p-4"
                  noValidate
                  onSubmit={handleMovement}
                >
                  <fieldset className="m-0 grid gap-1.5 border-0 p-0">
                    <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {t('Movement type')}
                    </legend>
                    <div className="grid grid-cols-3 gap-1.5">
                      {movementKinds.map((option) => {
                        const selected = selectedKind === option.kind;
                        return (
                          <button
                            key={option.kind}
                            type="button"
                            aria-pressed={selected}
                            disabled={Boolean(pendingMovement) || movementMutation.isPending}
                            onClick={() => setKind(option.kind)}
                            className={cn(
                              'min-h-10 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed',
                              selected
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border text-muted-foreground hover:bg-secondary',
                            )}
                          >
                            {t(option.label)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="m-0 text-xs text-muted-foreground">
                      {t(movementKinds.find((option) => option.kind === selectedKind)!.hint)}
                    </p>
                  </fieldset>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      {t('Amount (EGP)')}
                      <Input
                        type="text"
                        inputMode="decimal"
                        required
                        value={pendingMovement?.request.amount ?? amount}
                        disabled={Boolean(pendingMovement) || movementMutation.isPending}
                        onChange={(event) => setAmount(event.target.value)}
                        className="min-h-10 text-sm tabular-nums"
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
                        className="min-h-10 text-sm"
                      />
                    </label>
                    {selectedKind === 'cash_drop' && (
                      <PosSafeSelect
                        key={branchId}
                        employee={employee}
                        branchId={branchId}
                        value={pendingMovement?.request.safeId ?? safeId}
                        onChange={setSafeId}
                        disabled={Boolean(pendingMovement) || movementMutation.isPending}
                      />
                    )}
                    {selectedKind === 'cash_drop' && (
                      <label className="grid content-start gap-1.5 text-xs font-medium text-muted-foreground">
                        {t('Safe bag / drop reference')}
                        <Input
                          maxLength={80}
                          placeholder={t('Optional')}
                          value={pendingMovement?.request.dropReference ?? dropReference}
                          disabled={Boolean(pendingMovement) || movementMutation.isPending}
                          onChange={(event) => setDropReference(event.target.value)}
                          className="min-h-10 text-sm"
                        />
                      </label>
                    )}
                  </div>
                  {!canManageCash && (
                    <SupervisorApproval note={t('Cashiers need supervisor approval for this.')}>
                      <SupervisorFields
                        username={supervisorUsername}
                        password={supervisorPassword}
                        setUsername={setSupervisorUsername}
                        setPassword={setSupervisorPassword}
                      />
                    </SupervisorApproval>
                  )}
                  <div className="flex justify-end border-t border-border pt-3">
                    <PosButton
                      type="submit"
                      variant="solid"
                      className="w-full sm:w-auto"
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
                      ) : selectedKind === 'cash_in' ? (
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
                </form>
              )}

              {activeTab === 'close' && (
                <form
                  className="grid gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm sm:p-4"
                  noValidate
                  onSubmit={handleClose}
                >
                  <p id="pos-close-count-hint" className="m-0 text-xs text-muted-foreground">
                    {t('Count the cash physically present. Expected cash appears after closing.')}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      {t('Counted cash (EGP)')}
                      <Input
                        aria-describedby="pos-close-count-hint"
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
                        className="min-h-10 text-sm font-semibold tabular-nums"
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
                        className="min-h-10 text-sm"
                        placeholder={t('Explain a cash difference if the count is short or over')}
                      />
                    </label>
                  </div>
                  {!canApproveClose &&
                    (requiresCloseApproval ||
                      (pendingClose &&
                        (!pendingClose.request.confirmPendingDeliveries ||
                          Boolean(pendingClose.request.reason)))) && (
                      <SupervisorApproval
                        note={t('A cash variance needs approval from a different supervisor.')}
                      >
                        <SupervisorFields
                          username={supervisorUsername}
                          password={supervisorPassword}
                          setUsername={setSupervisorUsername}
                          setPassword={setSupervisorPassword}
                        />
                      </SupervisorApproval>
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
                  <div className="flex justify-end border-t border-border pt-3">
                    <PosButton
                      type="submit"
                      variant="solid"
                      className="w-full sm:w-auto"
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
              )}

              {activeTab === 'custody' && (
                <PosCashCustody
                  key={`${employee.id}:${branchId}:${registerId}`}
                  employee={employee}
                  branchId={branchId}
                  registerId={registerId}
                />
              )}
            </>
          ) : null}
        </>
      )}

      {!shift && pendingMovement && (
        <form
          className="grid gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-card-foreground"
          onSubmit={retryMovement}
        >
          <div className="flex items-center gap-2">
            <Wallet size={17} aria-hidden="true" />
            <h3 className="m-0 text-sm font-semibold">
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
          className="grid gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-card-foreground"
          onSubmit={retryClose}
        >
          <div className="flex items-center gap-2">
            <CircleDollarSign size={17} aria-hidden="true" />
            <h3 className="m-0 text-sm font-semibold">
              {t('Saved shift close needs confirmation')}
            </h3>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            {t('Counted cash: {{amount}}. Retry the same saved close request.', {
              amount: formatMoney(pendingClose.request.countedCash),
            })}
          </p>
          {(!canApproveClose &&
            (!pendingClose.request.confirmPendingDeliveries ||
              Boolean(pendingClose.request.reason)) ||
            Boolean(pendingClose.request.deliveryHandover)) && (
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
        <section className="grid gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-sm font-semibold">{t('Last shift close')}</h3>
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
                {latestClose.data.deliveryHandover.recipientName
                  ? `${t('Delivery handover')}: ${latestClose.data.deliveryHandover.recipientName}`
                  : t('Pending deliveries at close')}
              </strong>
              {latestClose.data.deliveryHandover.approvedByName && (
                <p>{t('Approved by')}: {latestClose.data.deliveryHandover.approvedByName}</p>
              )}
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
      {/* With an open shift, custody lives in its own tab above. */}
      {!shift && (
        <PosCashCustody
          key={`${employee.id}:${branchId}:${registerId}`}
          employee={employee}
          branchId={branchId}
          registerId={registerId}
        />
      )}
    </div>
  );

  function formatMoney(value: string) {
    const numeric = Number(value.replace('−', '-'));
    return formatNumber(numeric, { style: 'currency', currency: 'EGP' });
  }
}

/** Groups the supervisor credentials under a clear title, with an optional reason line. */
function SupervisorApproval({ note, children }: { note?: string; children: ReactNode }) {
  const { t } = useLocale();
  return (
    <section
      aria-label={t('Supervisor approval')}
      className="grid gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3"
    >
      <div className="grid gap-0.5">
        <strong className="text-xs">{t('Supervisor approval')}</strong>
        {note && <p className="m-0 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
      <p className="m-0 text-[11px] text-muted-foreground">
        {t('Supervisor credentials are checked by the server and never saved on this device.')}
      </p>
    </section>
  );
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
          autoComplete="off"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="min-h-10 text-sm"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        {t('Supervisor password')}
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-10 text-sm"
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
