import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PosOrderPaymentStateResponse,
  RecordPosCheckPaymentResponse,
} from '@waffarly/contracts';
import { Dialog, Input, cn, useLocale } from '@waffarly/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePosWorkspaceStore, type PendingPosPayment } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { ApiError } from '../../lib/api-client.js';
import { usePosViewport } from '../../lib/use-pos-viewport.js';
import { PosReceiptView } from '../receipts/pos-receipt-view.js';
import { PosCheckoutOrderContext, PosCheckoutOrderIdentity } from './pos-checkout-order-context.js';
import {
  formatMoneyCents,
  parseMoneyCents,
  previewPosTenders,
  type PosTenderDraft,
} from './payment-form-model.js';
import {
  getPosOrderPaymentState,
  posPaymentStateKey,
  recordPosCheckPayment,
} from './pos-payments.api.js';

export function PosCheckoutDialog({
  merchantId,
  employeeId,
  branchId,
  orderId,
  onClose,
}: {
  merchantId: string;
  employeeId: string;
  branchId: string;
  orderId: string;
  onClose: () => void;
}) {
  const { t, errorText, formatNumber } = useLocale();
  const formId = useId();
  const viewport = usePosViewport();
  const formRef = useRef<HTMLFormElement>(null);
  function keepFocusedFieldVisible() {
    if (!viewport.compact) return;
    const focused = document.activeElement;
    const scrollArea = formRef.current?.querySelector<HTMLElement>('[data-checkout-scroll]');
    if (!(focused instanceof HTMLElement) || !scrollArea?.contains(focused)) return;
    const field = focused.getBoundingClientRect();
    const area = scrollArea.getBoundingClientRect();
    if (field.bottom > area.bottom - 6) scrollArea.scrollTop += field.bottom - area.bottom + 6;
    else if (field.top < area.top + 6) scrollArea.scrollTop -= area.top + 6 - field.top;
  }
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
  const [selectedCheckId, setSelectedCheckId] = useState(initialPayment?.checkId ?? '');
  const [tenders, setTenders] = useState<PosTenderDraft[]>([]);
  const [pendingCommand, setPendingCommand] = useState<PendingPosPayment | null>(initialPayment);
  const [recoveredPayment, setRecoveredPayment] = useState(Boolean(initialPayment));
  const [submissionError, setSubmissionError] = useState('');
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [receiptCheckId, setReceiptCheckId] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (!storedPayment || pendingCommand) return;
    setPendingCommand(storedPayment);
    setSelectedCheckId(storedPayment.checkId);
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
  const activeCheck = useMemo(
    () =>
      paymentState?.checks.find((check) => check.id === selectedCheckId) ?? paymentState?.checks[0],
    [paymentState?.checks, selectedCheckId],
  );

  useEffect(() => {
    if (!paymentState?.checks.length) return;
    if (!paymentState.checks.some((check) => check.id === selectedCheckId)) {
      const next =
        paymentState.checks.find((check) => check.status === 'open') ?? paymentState.checks[0]!;
      setSelectedCheckId(next.id);
    }
  }, [paymentState?.checks, selectedCheckId]);

  useEffect(() => {
    if (pendingCommand || !activeCheck || tenders.length > 0 || activeCheck.status !== 'open')
      return;
    setTenders([
      {
        id: crypto.randomUUID(),
        method: 'cash',
        amount: activeCheck.balanceDue,
        receivedAmount: activeCheck.balanceDue,
      },
    ]);
  }, [activeCheck, pendingCommand, tenders.length]);

  const previewResult = activeCheck ? previewPosTenders(tenders, activeCheck.balanceDue) : null;
  const preview = previewResult?.preview ?? null;
  const showValidation =
    !pendingCommand && activeCheck?.status === 'open' && paymentState?.status !== 'cancelled';
  const validationError = showValidation ? previewResult?.error : null;
  const fieldErrors = showValidation ? (previewResult?.fieldErrors ?? {}) : {};
  useEffect(() => {
    const frame = requestAnimationFrame(keepFocusedFieldVisible);
    return () => cancelAnimationFrame(frame);
  }, [viewport.height, viewport.top, viewport.compact, tenders, validationError]);
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
      const remaining = parseMoneyCents(response.check.balanceDue) ?? 0n;
      setTenders(
        remaining > 0n
          ? [
              {
                id: crypto.randomUUID(),
                method: 'cash',
                amount: formatMoneyCents(remaining),
                receivedAmount: formatMoneyCents(remaining),
              },
            ]
          : [],
      );
      await queryClient.invalidateQueries({ queryKey: ['pos', 'payments', merchantId] });
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
    const result = previewPosTenders(tenders, activeCheck.balanceDue);
    if (!result.preview) {
      setSubmissionError(t(result.error ?? 'Enter a valid payment amount.'));
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
        tenders: result.preview.tenders,
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

  function updateTender(id: string, update: (tender: PosTenderDraft) => PosTenderDraft) {
    if (pendingCommand || mutation.isPending) return;
    setSubmissionError('');
    setPaymentSaved(false);
    setTenders((current) => current.map((tender) => (tender.id === id ? update(tender) : tender)));
  }

  function changeCheck(checkId: string) {
    if (pendingCommand || mutation.isPending) return;
    setSelectedCheckId(checkId);
    setTenders([]);
    setSubmissionError('');
    setPaymentSaved(false);
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
      title={t(receiptCheckId ? 'POS receipt' : 'Take payment')}
      description={t(
        receiptCheckId
          ? 'Review, print, or save this settled check receipt.'
          : 'Review the check balance and record cash or a confirmed terminal payment.',
      )}
      closeLabel={t('Close')}
      style={viewport.dialogStyle}
      className={cn(
        'fixed inset-x-0 top-[var(--pos-visible-top)] bottom-auto my-2 flex w-[min(620px,calc(100%-20px))] max-h-[calc(var(--pos-visible-height)-16px)] flex-col overflow-hidden rounded-xl sm:rounded-2xl lg:inset-y-0 lg:m-auto',
        viewport.compact &&
          '[&_[data-slot=dialog-header]]:p-3 [&_[data-slot=dialog-header]_h2]:text-base [&_[data-slot=dialog-header]_p]:hidden',
      )}
    >
      {receiptCheckId ? (
        <PosReceiptView
          merchantId={merchantId}
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
          ref={formRef}
          onFocusCapture={() => requestAnimationFrame(keepFocusedFieldVisible)}
          className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
          onSubmit={submitPayment}
        >
          <div
            className={cn(
              'grid shrink-0 gap-3 border-b border-border bg-card px-4 py-3 sm:px-6',
              viewport.compact && 'gap-2 px-3 py-2',
            )}
          >
            {activeCheck && (
              <section
                className={cn(
                  'rounded-xl border border-border bg-secondary/60 p-3 sm:p-4',
                  viewport.compact && 'p-2 sm:p-2',
                )}
                aria-label={t('Check balance')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs text-muted-foreground">
                      <bdi dir="ltr">ORD-{orderId.slice(0, 8).toUpperCase()}</bdi>
                    </p>
                    <div className={cn(viewport.compact && 'hidden')}>
                      <PosCheckoutOrderIdentity state={paymentState} />
                    </div>
                    <details
                      className={cn(
                        'mt-2 text-xs text-muted-foreground',
                        viewport.compact && 'hidden',
                      )}
                    >
                      <summary className="cursor-pointer rounded-sm py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {t('Balance details')}
                      </summary>
                      <p className="mt-2">
                        {t('Order total')}:{' '}
                        <span className="font-medium tabular-nums text-foreground">
                          {formatNumber(Number(paymentState.total), {
                            style: 'currency',
                            currency: paymentState.currency,
                          })}
                        </span>
                      </p>
                      <p className="mt-1">
                        {t('Check amount')}:{' '}
                        {formatNumber(Number(activeCheck.amount), {
                          style: 'currency',
                          currency: paymentState.currency,
                        })}
                      </p>
                      <p className="mt-1">
                        {t('Collected')}:{' '}
                        {formatNumber(Number(activeCheck.paidAmount), {
                          style: 'currency',
                          currency: paymentState.currency,
                        })}
                      </p>
                    </details>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="m-0 text-xs text-muted-foreground">{t('Remaining balance')}</p>
                    <strong className="mt-0.5 block text-xl font-bold tabular-nums sm:text-2xl">
                      {formatNumber(Number(activeCheck.balanceDue), {
                        style: 'currency',
                        currency: paymentState.currency,
                      })}
                    </strong>
                  </div>
                </div>
                <div
                  className={cn(
                    'mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground',
                    viewport.compact && 'hidden',
                  )}
                >
                  <span>
                    {t('Check')} {formatNumber(activeCheck.position + 1)} ·{' '}
                    {t(activeCheck.status === 'settled' ? 'Settled' : 'Open balance')}
                  </span>
                </div>
                {activeCheck.receipt && (
                  <PosButton
                    type="button"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => setReceiptCheckId(activeCheck.id)}
                  >
                    {t('View / print receipt')} · {activeCheck.receipt.receiptNumber}
                  </PosButton>
                )}
              </section>
            )}

            {paymentState.checks.length > 1 && (
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                {t('Choose check')}
                <select
                  className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  value={activeCheck?.id ?? ''}
                  onChange={(event) => changeCheck(event.target.value)}
                  disabled={Boolean(pendingCommand) || mutation.isPending}
                >
                  {paymentState.checks.map((check) => (
                    <option key={check.id} value={check.id}>
                      {t('Check')} {formatNumber(check.position + 1)} ·{' '}
                      {formatNumber(Number(check.balanceDue), {
                        style: 'currency',
                        currency: paymentState.currency,
                      })}{' '}
                      {t(check.status === 'settled' ? 'Settled' : 'Due')}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div
            data-checkout-scroll
            className={cn(
              'grid min-h-0 gap-4 overflow-y-auto p-4 sm:p-6',
              viewport.compact && 'gap-3 p-3 sm:p-3',
            )}
          >
            {activeCheck && (
              <PosCheckoutOrderContext
                state={paymentState}
                check={activeCheck}
                onRefresh={() => void paymentStateQuery.refetch()}
              />
            )}
            {activeCheck && activeCheck.payments.length > 0 && (
              <section className="grid gap-2" aria-label={t('Recorded payments')}>
                <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('Recorded payments')}
                </h3>
                {activeCheck.payments.map((payment) => (
                  <div className="flex items-center justify-between gap-3 text-sm" key={payment.id}>
                    <span>{t(payment.method === 'cash' ? 'Cash' : 'External terminal')}</span>
                    <span className="tabular-nums">
                      {formatNumber(Number(payment.amount), {
                        style: 'currency',
                        currency: paymentState.currency,
                      })}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {activeCheck?.status === 'open' &&
              paymentState.status !== 'cancelled' &&
              !pendingCommand && (
                <section className="grid gap-3" aria-label={t('Payment methods')}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="m-0 text-sm font-semibold">{t('Payment methods')}</h3>
                    {tenders.length < 4 && (
                      <PosButton
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setTenders((current) => [
                            ...current,
                            {
                              id: crypto.randomUUID(),
                              method: 'terminal',
                              amount: '',
                              receivedAmount: '',
                            },
                          ])
                        }
                      >
                        <Plus size={15} aria-hidden="true" />
                        {t('Add payment method')}
                      </PosButton>
                    )}
                  </div>
                  {tenders.map((tender, index) => (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(110px,0.8fr)_minmax(100px,1fr)_minmax(100px,1fr)_auto] sm:items-start"
                      key={tender.id}
                    >
                      <label className="col-span-full grid gap-1 text-xs text-muted-foreground sm:col-span-1">
                        {t('Method')}
                        <select
                          className="min-h-10 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
                          value={tender.method}
                          aria-label={t('Method for payment {{number}}', { number: index + 1 })}
                          onChange={(event) =>
                            updateTender(tender.id, (current) => {
                              const method = event.target.value as PosTenderDraft['method'];
                              return {
                                ...current,
                                method,
                                receivedAmount: method === 'cash' ? current.amount : '',
                              };
                            })
                          }
                          disabled={mutation.isPending}
                        >
                          <option value="cash">{t('Cash')}</option>
                          <option value="terminal">{t('External terminal')}</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        {t('Amount to apply')}
                        <Input
                          inputMode="decimal"
                          dir="ltr"
                          autoComplete="off"
                          value={tender.amount}
                          aria-invalid={Boolean(fieldErrors[tender.id]?.amount)}
                          aria-describedby={
                            fieldErrors[tender.id]?.amount
                              ? `${formId}-${tender.id}-amount`
                              : undefined
                          }
                          className="aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive"
                          aria-label={t('Amount for payment {{number}}', { number: index + 1 })}
                          onChange={(event) =>
                            updateTender(tender.id, (current) => ({
                              ...current,
                              amount: event.target.value,
                              ...(current.method === 'cash' &&
                              current.receivedAmount === current.amount
                                ? { receivedAmount: event.target.value }
                                : {}),
                            }))
                          }
                          disabled={mutation.isPending}
                        />
                        {fieldErrors[tender.id]?.amount && (
                          <span
                            id={`${formId}-${tender.id}-amount`}
                            className="text-xs text-destructive"
                          >
                            {t(fieldErrors[tender.id]!.amount!)}
                          </span>
                        )}
                      </label>
                      {tender.method === 'cash' ? (
                        <label className="grid gap-1 text-xs text-muted-foreground">
                          {t('Cash received')}
                          <Input
                            inputMode="decimal"
                            dir="ltr"
                            autoComplete="off"
                            value={tender.receivedAmount}
                            aria-invalid={Boolean(fieldErrors[tender.id]?.receivedAmount)}
                            aria-describedby={
                              fieldErrors[tender.id]?.receivedAmount
                                ? `${formId}-${tender.id}-received`
                                : undefined
                            }
                            className="aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive"
                            aria-label={t('Cash received for payment {{number}}', {
                              number: index + 1,
                            })}
                            onChange={(event) =>
                              updateTender(tender.id, (current) => ({
                                ...current,
                                receivedAmount: event.target.value,
                              }))
                            }
                            disabled={mutation.isPending}
                          />
                          {fieldErrors[tender.id]?.receivedAmount && (
                            <span
                              id={`${formId}-${tender.id}-received`}
                              className="text-xs text-destructive"
                            >
                              {t(fieldErrors[tender.id]!.receivedAmount!)}
                            </span>
                          )}
                        </label>
                      ) : (
                        <p className="m-0 self-center text-xs text-muted-foreground">
                          {t('Record only after the terminal confirms payment.')}
                        </p>
                      )}
                      {tenders.length > 1 && (
                        <PosButton
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={t('Remove payment method {{number}}', { number: index + 1 })}
                          onClick={() =>
                            setTenders((current) => current.filter((item) => item.id !== tender.id))
                          }
                          disabled={mutation.isPending}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </PosButton>
                      )}
                    </div>
                  ))}
                </section>
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
              'grid shrink-0 gap-3 border-t border-border bg-card p-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-6',
              viewport.compact && 'gap-2 px-3 py-2 sm:px-3',
            )}
          >
            {validationError && (
              <p
                id={`${formId}-validation`}
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {t(
                  Object.keys(fieldErrors).length
                    ? 'Review the highlighted payment amounts.'
                    : validationError,
                )}
              </p>
            )}
            {!pendingCommand &&
              preview &&
              activeCheck?.status === 'open' &&
              paymentState.status !== 'cancelled' && (
                <div className="grid gap-1 rounded-lg bg-secondary/60 px-3 py-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <span>{t('Payment total')}</span>
                    <strong className="tabular-nums">
                      {formatNumber(Number(formatMoneyCents(preview.appliedCents)), {
                        style: 'currency',
                        currency: paymentState.currency,
                      })}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3 text-muted-foreground">
                    <span>{t('Balance after payment')}</span>
                    <strong className="tabular-nums">
                      {formatNumber(Number(formatMoneyCents(preview.balanceAfterCents)), {
                        style: 'currency',
                        currency: paymentState.currency,
                      })}
                    </strong>
                  </div>
                  {preview.changeCents > 0n && (
                    <div className="flex justify-between gap-3 text-muted-foreground">
                      <span>{t('Change to return')}</span>
                      <strong className="tabular-nums">
                        {formatNumber(Number(formatMoneyCents(preview.changeCents)), {
                          style: 'currency',
                          currency: paymentState.currency,
                        })}
                      </strong>
                    </div>
                  )}
                </div>
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
              {pendingCommand ? (
                <PosButton type="submit" variant="solid" disabled={mutation.isPending || !online}>
                  {mutation.isPending
                    ? t('Recording payment...')
                    : recoveredPayment
                      ? t('Check saved result')
                      : t('Retry the same payment')}
                </PosButton>
              ) : activeCheck?.status === 'open' && paymentState.status !== 'cancelled' ? (
                <PosButton
                  type="submit"
                  variant="solid"
                  className="w-full"
                  aria-describedby={validationError ? `${formId}-validation` : undefined}
                  disabled={
                    mutation.isPending ||
                    !online ||
                    (!pendingCommand && (!preview || !paymentState.revision))
                  }
                >
                  {mutation.isPending
                    ? t('Recording payment...')
                    : pendingCommand
                      ? t('Retry the same payment')
                      : !preview
                        ? t('Review payment amounts')
                        : preview.balanceAfterCents === 0n
                          ? t('Settle check')
                          : t('Record partial payment')}
                </PosButton>
              ) : null}
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
