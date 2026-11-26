import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PosOrderPaymentStateResponse,
  RecordPosCheckPaymentResponse,
} from '@waffarly/contracts';
import { Dialog, cn, useLocale } from '@waffarly/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { usePosWorkspaceStore, type PendingPosPayment } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { ApiError } from '../../lib/api-client.js';
import { usePosViewport } from '../../lib/use-pos-viewport.js';
import { PosReceiptView } from '../receipts/pos-receipt-view.js';
import { getPosOrderNumber } from '../orders/pos-order-number.js';
import { PosCheckoutOrderContext, PosCheckoutOrderIdentity } from './pos-checkout-order-context.js';
import { parseMoneyCents } from './payment-form-model.js';
import {
  getPosOrderPaymentState,
  posPaymentStateKey,
  recordPosCheckPayment,
} from './pos-payments.api.js';

export function PosCheckoutDialog({
  merchantId,
  employeeId,
  branchId,
  requiresRefundApproval,
  orderId,
  onClose,
}: {
  merchantId: string;
  employeeId: string;
  branchId: string;
  requiresRefundApproval: boolean;
  orderId: string;
  onClose: () => void;
}) {
  const { t, errorText, formatNumber } = useLocale();
  const viewport = usePosViewport();
  const queryClient = useQueryClient();
  const queryKey = posPaymentStateKey(merchantId, orderId);
  const savePendingPayment = usePosWorkspaceStore((state) => state.savePendingPayment);
  const removePendingPayment = usePosWorkspaceStore((state) => state.removePendingPayment);
  const storedPayment = usePosWorkspaceStore((state) =>
    state.workspace?.merchantId === merchantId && state.workspace.employeeId === employeeId
      ? (state.workspace.pendingPayments[orderId] ?? null)
      : null,
  );
  const initialWorkspace = usePosWorkspaceStore.getState().workspace;
  const initialPayment =
    initialWorkspace?.merchantId === merchantId && initialWorkspace.employeeId === employeeId
      ? (initialWorkspace.pendingPayments[orderId] ?? null)
      : null;
  const [pendingCommand, setPendingCommand] = useState<PendingPosPayment | null>(initialPayment);
  const [recoveredPayment, setRecoveredPayment] = useState(Boolean(initialPayment));
  const [submissionError, setSubmissionError] = useState('');
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [receiptCheckId, setReceiptCheckId] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (!storedPayment || pendingCommand) return;
    setPendingCommand(storedPayment);
    setRecoveredPayment(true);
  }, [pendingCommand, storedPayment]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const paymentStateQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPosOrderPaymentState(orderId, signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const paymentState = paymentStateQuery.data;
  const onlyCheck =
    paymentState && paymentState.checks.length === 1 ? paymentState.checks[0] : undefined;
  const activeCheck = pendingCommand
    ? paymentState?.checks.find((check) => check.id === pendingCommand.checkId)
    : onlyCheck && (!onlyCheck.splitMethod || onlyCheck.splitMethod === 'whole')
      ? onlyCheck
      : undefined;
  const hasUnsupportedChecks = Boolean(
    paymentState &&
      !pendingCommand &&
      (paymentState.checks.length > 1 ||
        (onlyCheck?.splitMethod && onlyCheck.splitMethod !== 'whole')),
  );
  const hasNoChecks = Boolean(paymentState && paymentState.checks.length === 0 && !pendingCommand);
  const balanceDueCents = activeCheck ? parseMoneyCents(activeCheck.balanceDue) : null;
  const canCollectBalance = balanceDueCents !== null && balanceDueCents > 0n;
  const mutation = useMutation({
    mutationFn: (payment: PendingPosPayment) =>
      recordPosCheckPayment(orderId, payment.checkId, payment.request),
    onSuccess: async (response, command) => {
      const removed = removePendingPayment(
        merchantId,
        employeeId,
        orderId,
        command.request.requestId,
      );
      setPendingCommand(removed ? null : command);
      setRecoveredPayment(!removed);
      setSubmissionError(
        removed
          ? ''
          : t(
              'Payment was recorded, but its saved recovery record could not be cleared. Check the saved result before taking another payment.',
            ),
      );
      setPaymentSaved(true);
      setReceiptCheckId(response.receipt ? response.check.id : null);
      queryClient.setQueryData<PosOrderPaymentStateResponse>(queryKey, (current) =>
        current ? mergePaymentResult(current, response, command.checkId) : current,
      );
      await queryClient.invalidateQueries({ queryKey: ['pos', 'payments', merchantId] });
      await queryClient.invalidateQueries({ queryKey: ['pos', 'orders'] });
      await queryClient.invalidateQueries({ queryKey: ['pos', 'receipts', merchantId] });
      await queryClient.invalidateQueries({ queryKey: ['pos', merchantId, 'dining'] });
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error, command) => {
      setPaymentSaved(false);
      const definitiveRejection =
        error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.statusCode);
      if (!definitiveRejection) {
        setPendingCommand(command);
        setSubmissionError(
          t(
            'The payment result is not confirmed. Retry this exact payment; do not record it again.',
          ),
        );
        return;
      }
      const removed = removePendingPayment(
        merchantId,
        employeeId,
        orderId,
        command.request.requestId,
      );
      setPendingCommand(removed ? null : command);
      setRecoveredPayment(!removed);
      setSubmissionError(
        removed
          ? errorText(error.message)
          : t(
              'Could not clear the saved payment. Resolve browser storage before taking another payment.',
            ),
      );
      void paymentStateQuery.refetch();
    },
  });

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingCommand) {
      if (!online) return;
      mutation.mutate(pendingCommand);
      return;
    }
    if (!activeCheck || !paymentState || !online || paymentState.status === 'cancelled') return;
    const amountCents = parseMoneyCents(activeCheck.balanceDue);
    if (amountCents === null || amountCents <= 0n) {
      setSubmissionError(t('This check has no remaining balance.'));
      return;
    }
    setSubmissionError('');
    setPaymentSaved(false);
    const command: PendingPosPayment = {
      branchId,
      checkId: activeCheck.id,
      request: {
        requestId: crypto.randomUUID(),
        revision: paymentState.revision,
        tenders: [
          {
            method: 'cash',
            amount: activeCheck.balanceDue,
            receivedAmount: activeCheck.balanceDue,
          },
        ],
      },
    };
    try {
      savePendingPayment(merchantId, employeeId, orderId, command);
      setPendingCommand(command);
      setRecoveredPayment(false);
      mutation.mutate(command);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? errorText(error.message)
          : t('Could not save this payment safely. Check browser storage settings.'),
      );
    }
  }

  const close = () => {
    if (mutation.isPending) return;
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t(receiptCheckId ? 'POS receipt' : 'Collect order payment')}
      description={t(
        receiptCheckId
          ? 'Review, print, or save this settled check receipt.'
          : 'Confirm collection of the remaining order balance in cash.',
      )}
      closeLabel={t('Close')}
      style={viewport.dialogStyle}
      className={cn(
        'fixed inset-x-0 top-[var(--pos-visible-top)] bottom-auto my-2 flex max-h-[calc(var(--pos-visible-height)-16px)] flex-col overflow-hidden rounded-xl lg:inset-y-0 lg:m-auto',
        // Collecting one amount needs a narrow confirmation; the receipt keeps its paper width.
        receiptCheckId ? 'w-[min(560px,calc(100%-20px))]' : 'w-[min(420px,calc(100%-20px))]',
        '[&_[data-slot=dialog-header]]:items-center [&_[data-slot=dialog-header]]:px-4 [&_[data-slot=dialog-header]]:py-3',
        '[&_[data-slot=dialog-header]_h2]:text-base [&_[data-slot=dialog-header]_p]:mt-0.5 [&_[data-slot=dialog-header]_p]:text-xs',
        '[&_[data-slot=dialog-header]>button]:size-9 [&_[data-slot=dialog-header]>button]:text-lg',
        viewport.compact &&
          '[&_[data-slot=dialog-header]]:p-3 [&_[data-slot=dialog-header]_h2]:text-base [&_[data-slot=dialog-header]_p]:hidden',
      )}
    >
      {receiptCheckId ? (
        <PosReceiptView
          merchantId={merchantId}
          employeeId={employeeId}
          branchId={branchId}
          requiresApproval={requiresRefundApproval}
          canRecordItemReturn
          orderId={orderId}
          checkId={receiptCheckId}
          onBack={() => setReceiptCheckId(null)}
        />
      ) : paymentStateQuery.isLoading ? (
        <div className="p-6 text-sm text-muted-foreground" role="status">
          {t('Loading payment details...')}
        </div>
      ) : !paymentState ? (
        <div className="space-y-4 p-5 sm:p-6">
          <p
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
            role="alert"
          >
            {errorText(
              paymentStateQuery.error instanceof Error
                ? paymentStateQuery.error.message
                : t('Could not load payment details.'),
            )}
          </p>
          <div className="flex justify-end gap-2">
            <PosButton type="button" variant="outline" onClick={close}>
              {t('Close')}
            </PosButton>
            {pendingCommand && (
              <PosButton
                type="button"
                variant="solid"
                disabled={!online || mutation.isPending}
                onClick={() => mutation.mutate(pendingCommand)}
              >
                {mutation.isPending ? t('Recording payment...') : t('Check saved result')}
              </PosButton>
            )}
            <PosButton
              type="button"
              variant="solid"
              onClick={() => void paymentStateQuery.refetch()}
            >
              {t('Retry')}
            </PosButton>
          </div>
        </div>
      ) : (
        <form
          className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
          onSubmit={submitPayment}
        >
          <div
            className={cn(
              'grid shrink-0 gap-2 border-b border-border bg-card px-4 py-3',
              viewport.compact && 'px-3 py-2',
            )}
          >
            {activeCheck && paymentState && (
              <section className="grid gap-2" aria-label={t('Order balance')}>
                <div className="flex min-w-0 items-center gap-2">
                  <bdi
                    dir="ltr"
                    className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs font-bold tabular-nums"
                  >
                    #
                    {getPosOrderNumber(
                      paymentState.context?.order ?? {
                        id: orderId,
                        orderReference: null,
                        branchOrderNumber: null,
                      },
                    )}
                  </bdi>
                  <PosCheckoutOrderIdentity state={paymentState} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="m-0 text-[11px] text-muted-foreground">{t('Amount due')}</p>
                    <strong className="block text-xl font-bold tabular-nums">
                      {formatNumber(Number(activeCheck.balanceDue), {
                        style: 'currency',
                        currency: paymentState.currency,
                      })}
                    </strong>
                  </div>
                  <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-[11px] font-medium">
                    {t('Cash payment')}
                  </span>
                </div>
                {Number(activeCheck.paidAmount) > 0 && (
                  <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>{t('Previously collected')}</span>
                    <span className="tabular-nums">
                      {formatNumber(Number(activeCheck.paidAmount), {
                        style: 'currency',
                        currency: paymentState.currency,
                      })}
                    </span>
                  </div>
                )}
                {activeCheck.receipt && (
                  <PosButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setReceiptCheckId(activeCheck.id)}
                  >
                    {t('View / print receipt')} · {activeCheck.receipt.receiptNumber}
                  </PosButton>
                )}
              </section>
            )}
          </div>

          <div
            data-checkout-scroll
            className={cn(
              'grid min-h-0 content-start gap-2 overflow-y-auto px-4 py-3',
              viewport.compact && 'p-3',
            )}
          >
            {hasUnsupportedChecks && (
              <p
                className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
                role="alert"
              >
                {t('This order has multiple checks or a split balance. Review it before collecting payment.')}
              </p>
            )}
            {hasNoChecks && (
              <p
                className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
                role="status"
              >
                {t('This order has no bill to collect. Refresh order details before trying again.')}
              </p>
            )}
            {activeCheck && (
              <PosCheckoutOrderContext
                state={paymentState}
                onRefresh={() => void paymentStateQuery.refetch()}
              />
            )}

            {paymentState.status === 'cancelled' && (
              <p
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
                role="alert"
              >
                {t('A cancelled order cannot be paid.')}
              </p>
            )}
            {paymentStateQuery.error && (
              <p
                className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
                role="status"
              >
                {t(
                  'Payment status could not be refreshed. The latest saved balance is still shown.',
                )}
              </p>
            )}
            {!online && (
              <p
                className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
                role="status"
              >
                {t('Connect to the internet before recording a payment.')}
              </p>
            )}
            {pendingCommand && recoveredPayment && (
              <p
                className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
                role="status"
              >
                {t(
                  'This exact payment was saved on this device. Check its server result before recording another payment.',
                )}
              </p>
            )}
            {submissionError && (
              <p
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
                role="alert"
              >
                {submissionError}
              </p>
            )}
            {paymentSaved && (
              <p
                className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm"
                role="status"
              >
                {t('Payment recorded')}
              </p>
            )}
          </div>
          <footer
            className={cn(
              'grid shrink-0 gap-2 border-t border-border bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]',
              viewport.compact && 'px-3 py-2',
            )}
          >
            {activeCheck?.status === 'open' && !canCollectBalance && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {t('This check has no remaining balance.')}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {activeCheck?.status === 'settled' && (
                <PosButton
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={mutation.isPending}
                >
                  {t('Done')}
                </PosButton>
              )}
              {pendingCommand && (
                <PosButton type="submit" variant="solid" disabled={mutation.isPending || !online}>
                  {mutation.isPending
                    ? t('Recording payment...')
                    : recoveredPayment
                      ? t('Check saved result')
                      : t('Retry the same payment')}
                </PosButton>
              )}
              {!pendingCommand &&
                activeCheck?.status === 'open' &&
                paymentState.status !== 'cancelled' &&
                canCollectBalance && (
                  <PosButton
                    type="submit"
                    variant="solid"
                    className="w-full text-sm font-semibold"
                    disabled={mutation.isPending || !online || !paymentState.revision}
                  >
                    {mutation.isPending
                      ? t('Recording payment...')
                      : t('Collect {{amount}} cash', {
                          amount: formatNumber(Number(activeCheck.balanceDue), {
                            style: 'currency',
                            currency: paymentState.currency,
                          }),
                        })}
                  </PosButton>
                )}
            </div>
          </footer>
        </form>
      )}
    </Dialog>
  );
}

function mergePaymentResult(
  state: PosOrderPaymentStateResponse,
  response: RecordPosCheckPaymentResponse,
  checkId: string,
): PosOrderPaymentStateResponse {
  return {
    ...state,
    revision: response.orderRevision,
    checks: state.checks.map((check) => {
      if (check.id !== checkId) return check;
      const knownIds = new Set(check.payments.map((payment) => payment.id));
      return {
        ...check,
        amount: response.check.amount,
        paidAmount: response.check.paidAmount,
        balanceDue: response.check.balanceDue,
        revision: response.check.revision,
        status: response.check.status,
        settledAt: response.check.settledAt,
        receipt: response.check.receipt ?? check.receipt,
        payments: [
          ...check.payments,
          ...response.payments.filter((payment) => !knownIds.has(payment.id)),
        ],
      };
    }),
  };
}
