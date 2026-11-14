import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PosRefundReceipt, PosRefundSummary } from '@waffarly/contracts';
import { Dialog, Input, useLocale } from '@waffarly/ui';
import { AlertTriangle, CheckCircle2, Printer, ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  posRefundRecoveryKey,
  usePosWorkspaceStore,
  type PendingPosRefund,
} from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { ApiError } from '../../lib/api-client.js';
import { formatMoneyCents, parseMoneyCents } from './payment-form-model.js';
import {
  getPosOrderPaymentState,
  posPaymentStateKey,
  recordPosCheckRefund,
} from './pos-payments.api.js';

export function PosRefundDialog({
  merchantId,
  employeeId,
  branchId,
  orderId,
  checkId,
  refundShiftId,
  requiresApproval,
  onClose,
}: {
  merchantId: string;
  employeeId: string;
  branchId: string;
  orderId: string;
  checkId: string;
  refundShiftId: string | null;
  requiresApproval: boolean;
  onClose: () => void;
}) {
  const { t, errorText, formatDate, formatNumber, locale } = useLocale();
  const queryClient = useQueryClient();
  const queryKey = posPaymentStateKey(merchantId, orderId);
  const recoveryKey = posRefundRecoveryKey(orderId, checkId);
  const savePendingRefund = usePosWorkspaceStore((state) => state.savePendingRefund);
  const removePendingRefund = usePosWorkspaceStore((state) => state.removePendingRefund);
  const storedRefund = usePosWorkspaceStore((state) =>
    state.workspace?.merchantId === merchantId && state.workspace.employeeId === employeeId
      ? (state.workspace.pendingRefunds[recoveryKey] ?? null)
      : null,
  );
  const [pendingCommand, setPendingCommand] = useState<PendingPosRefund | null>(storedRefund);
  const [reason, setReason] = useState(storedRefund?.request.reason ?? '');
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      storedRefund?.request.allocations.map((allocation) => [
        allocation.paymentId,
        allocation.amount,
      ]) ?? [],
    ),
  );
  const [terminalReferences, setTerminalReferences] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      storedRefund?.request.allocations.map((allocation) => [
        allocation.paymentId,
        allocation.terminalReference ?? '',
      ]) ?? [],
    ),
  );
  const [approvalUsername, setApprovalUsername] = useState('');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [saveError, setSaveError] = useState('');
  const [receipt, setReceipt] = useState<PosRefundReceipt | null>(null);
  const [printError, setPrintError] = useState(false);

  useEffect(() => {
    if (!storedRefund || pendingCommand) return;
    setPendingCommand(storedRefund);
    setReason(storedRefund.request.reason);
    setAmounts(
      Object.fromEntries(
        storedRefund.request.allocations.map((allocation) => [
          allocation.paymentId,
          allocation.amount,
        ]),
      ),
    );
    setTerminalReferences(
      Object.fromEntries(
        storedRefund.request.allocations.map((allocation) => [
          allocation.paymentId,
          allocation.terminalReference ?? '',
        ]),
      ),
    );
  }, [pendingCommand, storedRefund]);

  const paymentQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPosOrderPaymentState(orderId, signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const paymentState = paymentQuery.data;
  const check = paymentState?.checks.find((candidate) => candidate.id === checkId);
  useEffect(() => {
    if (
      receipt ||
      !pendingCommand ||
      !check?.refunds?.some((refund) => refund.requestId === pendingCommand.request.requestId)
    )
      return;
    removePendingRefund(merchantId, employeeId, orderId, checkId, pendingCommand.request.requestId);
    setPendingCommand(null);
    setReceipt(null);
  }, [
    check?.refunds,
    checkId,
    employeeId,
    merchantId,
    orderId,
    pendingCommand,
    receipt,
    removePendingRefund,
  ]);
  const refundablePayments = useMemo(
    () =>
      check?.payments.filter(
        (payment) => (parseMoneyCents(payment.refundableAmount ?? payment.amount) ?? 0n) > 0n,
      ) ?? [],
    [check?.payments],
  );
  const totalCents = refundablePayments.reduce(
    (sum, payment) => sum + (parseMoneyCents(amounts[payment.id] ?? '') ?? 0n),
    0n,
  );
  const mutation = useMutation({
    mutationFn: ({
      command,
      approval,
    }: {
      command: PendingPosRefund;
      approval?: { username: string; password: string };
    }) =>
      recordPosCheckRefund(orderId, checkId, {
        ...command.request,
        ...(approval ? { approval } : {}),
      }),
    onSuccess: async (response, { command }) => {
      const cleared = removePendingRefund(
        merchantId,
        employeeId,
        orderId,
        checkId,
        command.request.requestId,
      );
      setPendingCommand(cleared ? null : command);
      setApprovalPassword('');
      setReceipt(response.refund);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: async (error, { command }) => {
      setApprovalPassword('');
      if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
        removePendingRefund(merchantId, employeeId, orderId, checkId, command.request.requestId);
        setPendingCommand(null);
        await queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  function buildCommand(): PendingPosRefund | null {
    if (!paymentState || !check || !refundShiftId || !reason.trim()) return null;
    const allocations: PendingPosRefund['request']['allocations'] = [];
    for (const payment of refundablePayments) {
      const rawAmount = amounts[payment.id]?.trim() ?? '';
      if (!rawAmount) continue;
      const cents = parseMoneyCents(rawAmount);
      const remaining = parseMoneyCents(payment.refundableAmount ?? payment.amount) ?? 0n;
      if (cents === null || cents <= 0n || cents > remaining) return null;
      const terminalReference = terminalReferences[payment.id]?.trim();
      if (payment.method === 'terminal' && !terminalReference) return null;
      allocations.push({
        paymentId: payment.id,
        amount: formatMoneyCents(cents),
        ...(terminalReference ? { terminalReference } : {}),
      });
    }
    if (!allocations.length) return null;
    return {
      branchId,
      request: {
        requestId: crypto.randomUUID(),
        revision: paymentState.revision,
        branchId,
        refundShiftId,
        reason: reason.trim(),
        allocations,
      },
    };
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const command = pendingCommand ?? buildCommand();
    if (!command) return;
    try {
      savePendingRefund(merchantId, employeeId, orderId, checkId, command);
      setPendingCommand(command);
      setSaveError('');
      mutation.mutate({
        command,
        ...(requiresApproval
          ? { approval: { username: approvalUsername.trim(), password: approvalPassword } }
          : {}),
      });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : t('Could not save this refund safely.'),
      );
    }
  }

  function showSavedReceipt(refund: PosRefundSummary) {
    setReceipt({
      ...refund,
      orderId,
      issuedBy: refund.issuedBy ?? refund.createdByEmployeeId,
      approvedBy: refund.approvedBy ?? null,
    });
    setPrintError(false);
  }

  function printReceipt() {
    setPrintError(false);
    try {
      if (typeof window.print !== 'function') throw new Error('Print is unavailable.');
      window.print();
    } catch {
      setPrintError(true);
    }
  }

  const formValid = Boolean(
    pendingCommand ||
    (reason.trim() &&
      totalCents > 0n &&
      refundablePayments.every((payment) => {
        const raw = amounts[payment.id]?.trim() ?? '';
        if (!raw) return true;
        const cents = parseMoneyCents(raw);
        const remaining = parseMoneyCents(payment.refundableAmount ?? payment.amount) ?? 0n;
        return (
          cents !== null &&
          cents > 0n &&
          cents <= remaining &&
          (payment.method !== 'terminal' || Boolean(terminalReferences[payment.id]?.trim()))
        );
      }) &&
      refundablePayments.some((payment) => Boolean(amounts[payment.id]?.trim()))),
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title={receipt ? t('Refund receipt') : t('Refund payment')}
      description={t('Refund only the amount already paid, back to its original payment method.')}
      closeLabel={t('Close')}
      className="flex max-h-[calc(100dvh-20px)] flex-col overflow-hidden"
    >
      {receipt ? (
        <div className="grid min-h-0 gap-4 overflow-y-auto p-4 text-sm sm:p-5">
          <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-3">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0">
              <p className="m-0 font-semibold">{t('Refund recorded')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <bdi dir="ltr">{receipt.receiptNumber}</bdi> · {formatDate(receipt.issuedAt, true)}
              </p>
            </div>
          </div>
          <article
            className="pos-receipt-document w-full max-w-96 justify-self-center rounded-xl border border-neutral-200 bg-white p-5 font-mono text-[0.72rem] leading-relaxed text-neutral-900 shadow-sm sm:p-6"
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            aria-label={t('Refund receipt')}
          >
            <header className="grid justify-items-center gap-1 border-b border-dashed border-neutral-300 pb-3 text-center">
              <ReceiptText size={20} aria-hidden="true" />
              <h2 className="m-0 text-base font-bold">{t('Refund receipt')}</h2>
              <strong className="mt-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[0.62rem]">
                {t('POS refund')}
              </strong>
            </header>
            <dl className="m-0 grid gap-2 border-b border-dashed border-neutral-300 py-3 text-xs">
              <ReceiptRow label={t('Receipt number')} value={receipt.receiptNumber} />
              <ReceiptRow
                label={t('Order')}
                value={
                  paymentState?.context?.order.orderReference ??
                  `ORD-${receipt.orderId.slice(0, 8).toUpperCase()}`
                }
              />
              <ReceiptRow label={t('Issued')} value={formatDate(receipt.issuedAt, true)} />
              <ReceiptRow label={t('Cashier')} value={receipt.issuedBy} />
              {receipt.approvedBy && (
                <ReceiptRow label={t('Approved by')} value={receipt.approvedBy} />
              )}
            </dl>
            <div className="grid gap-2 border-b border-dashed border-neutral-300 py-3">
              {receipt.tenders.map((tender) => (
                <div key={tender.originalPaymentId} className="grid gap-1 text-xs">
                  <div className="flex justify-between gap-3">
                    <span>
                      {t(tender.method === 'cash' ? 'Cash refund' : 'External terminal refund')}
                    </span>
                    <bdi dir="ltr">
                      {formatNumber(Number(tender.amount), {
                        style: 'currency',
                        currency: receipt.currency,
                      })}
                    </bdi>
                  </div>
                  {tender.terminalReference && (
                    <div className="text-muted-foreground">
                      {t('Terminal reference')}: <bdi dir="ltr">{tender.terminalReference}</bdi>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-3 border-b border-dashed border-neutral-300 py-3 font-bold">
              <span>{t('Refund total')}</span>
              <bdi dir="ltr">
                {formatNumber(Number(receipt.amount), {
                  style: 'currency',
                  currency: receipt.currency,
                })}
              </bdi>
            </div>
            <p className="mb-0 mt-3 break-words text-xs">
              {t('Reason')}: {receipt.reason}
            </p>
            <p className="mb-0 mt-5 text-center text-[0.65rem] text-neutral-600">
              {t('This is a refund receipt for the recorded amount.')}
            </p>
          </article>
          {printError && (
            <p className="m-0 text-sm text-destructive" role="alert">
              {t('Your refund receipt is saved. Retry printing or save it as a PDF.')}
            </p>
          )}
          <div className="pos-receipt-screen-actions flex flex-wrap justify-end gap-2">
            <PosButton type="button" variant="outline" onClick={onClose}>
              {t('Done')}
            </PosButton>
            <PosButton type="button" variant="solid" onClick={printReceipt}>
              <Printer size={16} aria-hidden="true" />
              {t('Print / Save PDF')}
            </PosButton>
          </div>
        </div>
      ) : (
        <form className="grid min-h-0 gap-4 overflow-y-auto p-5" onSubmit={submit}>
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
            <p className="m-0 flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {t(
                'This records money returned. It does not restore stock or change the original sale receipt.',
              )}
            </p>
            <p className="mb-0 mt-2">
              {t(
                'External terminal refunds must be completed on the terminal first. Enter its refund reference here.',
              )}
            </p>
          </div>
          {!refundShiftId && !pendingCommand && (
            <p className="m-0 rounded-lg border border-border p-3 text-sm" role="status">
              {t('Open a register shift at this branch before recording a refund.')}
            </p>
          )}
          {pendingCommand && (
            <p
              className="m-0 rounded-lg border border-info/40 bg-info/10 p-3 text-sm"
              role="status"
            >
              {t(
                'A refund request is saved. Retry the exact request; do not repeat an external terminal refund.',
              )}
            </p>
          )}
          {paymentQuery.isLoading ? (
            <p className="m-0 text-sm text-muted-foreground" role="status">
              {t('Loading current payment state...')}
            </p>
          ) : paymentQuery.isError || !check ? (
            <div className="grid gap-2" role="alert">
              <p className="m-0 text-sm text-destructive">
                {errorText(
                  paymentQuery.error instanceof Error
                    ? paymentQuery.error.message
                    : t('Payment status is unavailable.'),
                )}
              </p>
              <PosButton
                type="button"
                variant="outline"
                disabled={paymentQuery.isFetching}
                onClick={() => void paymentQuery.refetch()}
              >
                {t('Refresh payment state')}
              </PosButton>
            </div>
          ) : refundablePayments.length === 0 ? (
            <>
              {check.refunds?.map((refund) => (
                <PosButton
                  key={refund.id}
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => showSavedReceipt(refund)}
                >
                  <ReceiptText size={16} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {t('View refund receipt')} · {refund.receiptNumber}
                  </span>
                  <bdi dir="ltr">
                    {formatNumber(Number(refund.amount), {
                      style: 'currency',
                      currency: refund.currency,
                    })}
                  </bdi>
                </PosButton>
              ))}
              <p className="m-0 rounded-lg border border-border p-3 text-sm" role="status">
                {t('This check has no refundable balance.')}
              </p>
            </>
          ) : (
            <>
              {check.refunds?.map((refund) => (
                <PosButton
                  key={refund.id}
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => showSavedReceipt(refund)}
                >
                  <ReceiptText size={16} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {t('View refund receipt')} · {refund.receiptNumber}
                  </span>
                  <bdi dir="ltr">
                    {formatNumber(Number(refund.amount), {
                      style: 'currency',
                      currency: refund.currency,
                    })}
                  </bdi>
                </PosButton>
              ))}
              <div className="grid gap-2">
                <div className="grid grid-cols-[minmax(0,1fr)_7rem_6.5rem] gap-2 text-[11px] font-semibold text-muted-foreground">
                  <span>{t('Original payment')}</span>
                  <span className="text-end">{t('Remaining')}</span>
                  <span className="text-end">{t('Refund')}</span>
                </div>
                {refundablePayments.map((payment) => (
                  <div key={payment.id} className="grid gap-2 rounded-lg border border-border p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem_6.5rem] items-center gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium">
                        {t(payment.method === 'cash' ? 'Cash' : 'External terminal')}
                      </span>
                      <bdi className="text-end" dir="ltr">
                        {formatNumber(Number(payment.refundableAmount ?? payment.amount), {
                          style: 'currency',
                          currency: paymentState?.currency ?? 'EGP',
                        })}
                      </bdi>
                      <Input
                        aria-label={`${t('Refund')} ${t(payment.method)}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amounts[payment.id] ?? ''}
                        disabled={Boolean(pendingCommand) || mutation.isPending}
                        onChange={(event) =>
                          setAmounts((current) => ({
                            ...current,
                            [payment.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    {payment.method === 'terminal' && amounts[payment.id]?.trim() && (
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        {t('Terminal refund reference')}
                        <Input
                          required
                          value={terminalReferences[payment.id] ?? ''}
                          disabled={Boolean(pendingCommand) || mutation.isPending}
                          onChange={(event) =>
                            setTerminalReferences((current) => ({
                              ...current,
                              [payment.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}
                    <p className="m-0 text-[11px] text-muted-foreground">
                      {t('Previously refunded')}:{' '}
                      <bdi dir="ltr">
                        {formatNumber(Number(payment.refundedAmount ?? '0.00'), {
                          style: 'currency',
                          currency: paymentState?.currency ?? 'EGP',
                        })}
                      </bdi>
                    </p>
                  </div>
                ))}
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                {t('Refund reason')}
                <Input
                  required
                  maxLength={500}
                  value={reason}
                  disabled={Boolean(pendingCommand) || mutation.isPending}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <div className="flex justify-between border-t border-border pt-3 text-sm">
                <span>{t('Refund total')}</span>
                <strong>
                  {formatNumber(Number(formatMoneyCents(totalCents)), {
                    style: 'currency',
                    currency: paymentState?.currency ?? 'EGP',
                  })}
                </strong>
              </div>
              {requiresApproval && (
                <fieldset className="grid gap-3 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-semibold">{t('Supervisor approval')}</legend>
                  <label className="grid gap-1.5 text-sm">
                    {t('Supervisor username')}
                    <Input
                      autoComplete="username"
                      required
                      value={approvalUsername}
                      disabled={mutation.isPending}
                      onChange={(event) => setApprovalUsername(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    {t('Supervisor password')}
                    <Input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={approvalPassword}
                      disabled={mutation.isPending}
                      onChange={(event) => setApprovalPassword(event.target.value)}
                    />
                  </label>
                </fieldset>
              )}
              {saveError && (
                <p className="m-0 text-sm text-destructive" role="alert">
                  {t(saveError)}
                </p>
              )}
              {mutation.isError && (
                <p className="m-0 text-sm text-destructive" role="alert">
                  {errorText(
                    mutation.error instanceof Error
                      ? mutation.error.message
                      : t('The refund could not be recorded.'),
                  )}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <PosButton
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={onClose}
                >
                  {t('Close')}
                </PosButton>
                <PosButton
                  type="submit"
                  variant="solid"
                  disabled={
                    mutation.isPending ||
                    paymentQuery.isFetching ||
                    (!refundShiftId && !pendingCommand) ||
                    !formValid ||
                    (requiresApproval && (!approvalUsername.trim() || !approvalPassword))
                  }
                >
                  {mutation.isPending
                    ? t('Recording refund...')
                    : pendingCommand
                      ? t('Retry saved refund')
                      : t('Record refund')}
                </PosButton>
              </div>
            </>
          )}
        </form>
      )}
    </Dialog>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="m-0 break-all text-end">{value}</dd>
    </div>
  );
}
