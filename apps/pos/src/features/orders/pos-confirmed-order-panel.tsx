import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, Input, useLocale } from '@waffarly/ui';
import { AlertTriangle, CheckCircle2, ReceiptText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { posWorkspaceScope, usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { getPosOrderNumber } from './pos-order-number.js';
import { formatMoneyCents, parseMoneyCents } from '../payments/payment-form-model.js';
import { getPosOrderPaymentState, posPaymentStateKey } from '../payments/pos-payments.api.js';
import { PosReceiptView } from '../receipts/pos-receipt-view.js';
import { PosRefundDialog } from '../payments/pos-refund-dialog.js';
import {
  dispatchPosKitchenOrder,
  cancelPosOrder,
  getPosOrder,
  posOrderDetailKey,
  posOrderKeys,
} from './pos-orders.api.js';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { posSessionKey } from '../auth/pos-session.api.js';
import { requirePairedRegister } from '../registers/register-pairing-prompt.js';

export function PosConfirmedOrderPanel({
  merchantId,
  employeeId,
  branchId,
  requiresApproval,
  requiresRefundApproval,
  refundShiftId,
  orderId,
  online,
  onCheckout,
  onNewOrder,
  hasPendingAmendment,
  onAddItems,
  onRetryPendingAmendment,
}: {
  merchantId: string;
  employeeId: string;
  branchId: string;
  requiresApproval: boolean;
  requiresRefundApproval: boolean;
  refundShiftId: string | null;
  orderId: string;
  online: boolean;
  onCheckout: () => void;
  onNewOrder: (closeSettled: boolean) => void;
  hasPendingAmendment: boolean;
  onAddItems: () => void;
  onRetryPendingAmendment: () => void;
}) {
  const { t, errorText, formatDate, formatNumber } = useLocale();
  const queryClient = useQueryClient();
  // Register actions ask for pairing first; the layout keeps the session cached.
  const hasRegisterForActions = () =>
    requirePairedRegister(queryClient.getQueryData<PosEmployeeSession>(posSessionKey));
  const scope = posWorkspaceScope(merchantId, employeeId);
  const workspace = usePosWorkspaceStore((state) =>
    state.activeScope === scope ? state.workspace : null,
  );
  const savedOrderReference = workspace?.confirmedOrders[orderId];
  const savePendingCancellation = usePosWorkspaceStore((state) => state.savePendingCancellation);
  const removePendingCancellation = usePosWorkspaceStore(
    (state) => state.removePendingCancellation,
  );
  const pendingCancellation = workspace?.pendingCancellations[orderId] ?? null;
  const [receiptCheckId, setReceiptCheckId] = useState<string | null>(null);
  const [refundCheckId, setRefundCheckId] = useState<string | null>(null);
  const [cancellationOpen, setCancellationOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [approvalUsername, setApprovalUsername] = useState('');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [cancellationSaveError, setCancellationSaveError] = useState('');
  const orderQuery = useQuery({
    queryKey: posOrderDetailKey(merchantId, employeeId, orderId),
    queryFn: ({ signal }) => getPosOrder(orderId, signal),
    retry: false,
    staleTime: 0,
  });
  const paymentQuery = useQuery({
    queryKey: posPaymentStateKey(merchantId, orderId),
    queryFn: ({ signal }) => getPosOrderPaymentState(orderId, signal),
    enabled: Boolean(orderQuery.data) && !orderQuery.isError,
    staleTime: 0,
    retry: false,
  });
  const dispatchMutation = useMutation({
    mutationFn: () => dispatchPosKitchenOrder(orderId, { requestId: crypto.randomUUID() }),
    onSuccess: async (updatedOrder) => {
      queryClient.setQueryData(posOrderDetailKey(merchantId, employeeId, orderId), updatedOrder);
      await queryClient.invalidateQueries({ queryKey: posOrderKeys.all });
    },
  });
  const cancellationMutation = useMutation({
    mutationFn: (request: Parameters<typeof cancelPosOrder>[1]) => cancelPosOrder(orderId, request),
    onSuccess: async (cancelledOrder, request) => {
      queryClient.setQueryData(posOrderDetailKey(merchantId, employeeId, orderId), cancelledOrder);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: posOrderKeys.all }),
        queryClient.invalidateQueries({ queryKey: posPaymentStateKey(merchantId, orderId) }),
      ]);
      removePendingCancellation(merchantId, employeeId, orderId, request.requestId);
      setCancellationOpen(false);
      setCancellationReason('');
      setApprovalUsername('');
      setApprovalPassword('');
      setCancellationSaveError('');
    },
    onError: () => setApprovalPassword(''),
  });
  const order = orderQuery.data;
  const payment = paymentQuery.data;
  useEffect(() => {
    if (order?.status === 'cancelled' && pendingCancellation)
      removePendingCancellation(merchantId, employeeId, orderId, pendingCancellation.requestId);
  }, [
    employeeId,
    merchantId,
    order?.status,
    orderId,
    pendingCancellation,
    removePendingCancellation,
  ]);
  const paidCents =
    payment?.checks.reduce((sum, check) => sum + (parseMoneyCents(check.paidAmount) ?? 0n), 0n) ??
    0n;
  const dueCents =
    payment?.checks.reduce((sum, check) => sum + (parseMoneyCents(check.balanceDue) ?? 0n), 0n) ??
    0n;
  const settled =
    Boolean(payment?.checks.length) && payment!.checks.every((check) => check.status === 'settled');
  const cancelled = ['cancelled', 'rejected'].includes(payment?.status ?? order?.status ?? '');
  const verified =
    Boolean(payment?.checks.length) &&
    !paymentQuery.isError &&
    !paymentQuery.isFetching &&
    !orderQuery.isFetching &&
    !orderQuery.isError;
  const canAddItems = Boolean(
    order?.kitchenTicket &&
    order.status === 'pending' &&
    payment?.checks.length === 1 &&
    payment.checks[0]?.splitMethod === 'whole' &&
    payment.checks[0]?.payments.length === 0 &&
    payment.checks[0]?.status === 'open',
  );
  const canCancel = Boolean(
    verified &&
    !hasPendingAmendment &&
    order &&
    ['pending', 'accepted'].includes(order.status) &&
    payment?.checks.length &&
    payment.checks.every((check) => check.payments.length === 0),
  );
  const status = cancelled
    ? 'Cancelled'
    : paymentQuery.isLoading || orderQuery.isLoading
      ? 'Loading payment details...'
      : !payment || paymentQuery.isError
        ? 'Payment status unavailable'
        : settled
          ? 'Paid'
          : paidCents > 0n
            ? 'Partially paid'
            : 'Unpaid';
  const money = (amount: string) =>
    formatNumber(Number(amount), { style: 'currency', currency: order?.currency ?? 'EGP' });

  function submitCancellation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCancel || !cancellationReason.trim() || cancellationMutation.isPending) return;
    const command = pendingCancellation ?? {
      requestId: crypto.randomUUID(),
      branchId,
      reason: cancellationReason.trim(),
    };
    try {
      savePendingCancellation(merchantId, employeeId, orderId, command);
      setCancellationSaveError('');
      cancellationMutation.mutate({
        ...command,
        ...(requiresApproval
          ? { approval: { username: approvalUsername.trim(), password: approvalPassword } }
          : {}),
      });
    } catch (cause) {
      setCancellationSaveError(
        cause instanceof Error ? cause.message : t('Could not save this cancellation safely.'),
      );
    }
  }

  function openCancellationDialog() {
    if (!hasRegisterForActions()) return;
    cancellationMutation.reset();
    setCancellationSaveError('');
    setCancellationReason(pendingCancellation?.reason ?? '');
    setApprovalUsername('');
    setApprovalPassword('');
    setCancellationOpen(true);
  }

  async function startNewCancellationRequest() {
    setCancellationSaveError('');
    const [freshOrder, freshPayment] = await Promise.all([
      orderQuery.refetch(),
      paymentQuery.refetch(),
    ]);
    const stillUnpaidAndCancelable =
      freshOrder.isSuccess &&
      ['pending', 'accepted'].includes(freshOrder.data.status) &&
      freshPayment.isSuccess &&
      freshPayment.data.checks.length > 0 &&
      freshPayment.data.checks.every((check) => check.payments.length === 0);
    if (!stillUnpaidAndCancelable) {
      setCancellationSaveError(
        t(
          'Refresh confirmed the order changed; review its current status before starting another cancellation.',
        ),
      );
      return;
    }
    if (pendingCancellation)
      removePendingCancellation(merchantId, employeeId, orderId, pendingCancellation.requestId);
    setCancellationReason('');
    setApprovalUsername('');
    setApprovalPassword('');
    cancellationMutation.reset();
  }

  return (
    <aside
      className="pos-live-cart flex h-full min-h-0 w-full flex-col border-s border-border bg-card"
      aria-label={t('Current order')}
      data-testid="confirmed-order-panel"
    >
      <header className="grid gap-1 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <bdi className="rounded bg-secondary px-1.5 py-0.5 text-xs font-bold tabular-nums">
            #
            {getPosOrderNumber(
              order ?? {
                id: orderId,
                orderReference: savedOrderReference?.orderReference ?? null,
                branchOrderNumber: savedOrderReference?.branchOrderNumber ?? null,
              },
            )}
          </bdi>
          <span className="flex min-w-0 items-center gap-1 text-sm font-semibold">
            <CheckCircle2 className="shrink-0 text-success" size={15} aria-hidden="true" />
            <span className="truncate">{t('Order confirmed')}</span>
          </span>
          <span
            className="ms-auto shrink-0 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold"
            role="status"
          >
            {t(status)}
          </span>
        </div>
        {order && !orderQuery.isError && (
          <p className="m-0 truncate text-xs text-muted-foreground">
            {t(
              order.fulfillmentType === 'dine_in'
                ? 'Dine in'
                : order.fulfillmentType === 'delivery'
                  ? 'Delivery'
                  : 'Takeaway',
            )}{' '}
            · {order.customerName || t('Walk-in customer')}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" data-pos-order-scroll>
        {orderQuery.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('Loading order details...')}
          </p>
        ) : orderQuery.isError || !order ? (
          <div className="grid gap-3">
            <p role="alert" className="text-sm text-destructive">
              {errorText(
                orderQuery.error instanceof Error
                  ? orderQuery.error.message
                  : t('Could not load the confirmed order.'),
              )}
            </p>
            <PosButton type="button" onClick={() => void orderQuery.refetch()}>
              {t('Retry')}
            </PosButton>
          </div>
        ) : (
          <section aria-label={t('Confirmed items')} className="grid gap-2">
            {order.fulfillmentType === 'dine_in' ? (
              <div className="grid gap-2 rounded-lg border border-border bg-secondary/40 p-2.5">
                {order.kitchenTicket ? (
                  <div className="grid gap-1" role="status">
                    <strong className="text-sm">{t('Sent to kitchen')}</strong>
                    <span className="text-xs text-muted-foreground">
                      {t('Station: {{station}}', { station: t(order.kitchenTicket.station.name) })} ·{' '}
                      {formatDate(order.kitchenTicket.dispatchedAt, true)}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="m-0 text-xs text-muted-foreground">
                      {t('This dine-in round stays off the kitchen screen until you send it.')}
                    </p>
                    <PosButton
                      type="button"
                      variant="solid"
                      disabled={!online || dispatchMutation.isPending || order.status !== 'pending'}
                      onClick={() => {
                        if (hasRegisterForActions()) dispatchMutation.mutate();
                      }}
                    >
                      {dispatchMutation.isPending ? t('Sending to kitchen…') : t('Send to kitchen')}
                    </PosButton>
                  </>
                )}
                {dispatchMutation.isError && (
                  <p className="m-0 text-xs text-destructive" role="alert">
                    {errorText(
                      dispatchMutation.error instanceof Error
                        ? dispatchMutation.error.message
                        : t('The order could not be sent to the kitchen.'),
                    )}
                  </p>
                )}
                {!online && !order.kitchenTicket && (
                  <p className="m-0 text-xs text-warning" role="status">
                    {t('Connect to the internet before sending this round.')}
                  </p>
                )}
              </div>
            ) : (
              // One quiet line: dispatch is automatic, so the cashier only needs confirmation.
              <p
                className="m-0 flex flex-wrap items-center gap-x-1.5 rounded-md bg-secondary/40 px-2.5 py-1.5 text-xs"
                role="status"
              >
                <strong className="font-semibold">
                  {order.kitchenTicket
                    ? t('Automatically sent to kitchen')
                    : t('Kitchen dispatch pending')}
                </strong>
                {order.kitchenTicket && (
                  <span className="text-muted-foreground">
                    · {t(order.kitchenTicket.station.name)} ·{' '}
                    {formatDate(order.kitchenTicket.dispatchedAt, true)}
                  </span>
                )}
              </p>
            )}
            <h3 className="m-0 mt-1 text-xs font-semibold text-muted-foreground">
              {t('Confirmed items')}
            </h3>
            {order.lines.map((line) => (
              <article key={line.id} className="rounded-lg border border-border px-2.5 py-2">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{line.productName}</p>
                    {line.variantName && (
                      <p className="mt-1 text-xs text-muted-foreground">{line.variantName}</p>
                    )}
                    {line.selections.map((selection, index) => (
                      <p key={index} className="mt-1 break-words text-xs text-muted-foreground">
                        {selection.optionName}
                        {(selection.quantity ?? 1) > 1 ? ` ×${selection.quantity}` : ''}
                      </p>
                    ))}
                    {line.note && (
                      <p className="mt-1 break-words text-xs text-muted-foreground">{line.note}</p>
                    )}
                    {line.promotionDiscount && Number(line.promotionDiscount) > 0 && (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        {t('Product discount')}: −{money(
                          (Number(line.promotionDiscount) * line.quantity).toFixed(2),
                        )}
                      </p>
                    )}
                  </div>
                  <bdi className="shrink-0 text-xs tabular-nums">
                    ×{formatNumber(line.quantity)}
                  </bdi>
                  <strong className="shrink-0 whitespace-nowrap text-xs tabular-nums">
                    {money(line.lineTotal)}
                  </strong>
                </div>
              </article>
            ))}
            {order.lines.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('No item details available.')}</p>
            )}
          </section>
        )}
      </div>

      <footer className="grid gap-2 border-t border-border p-3">
        {order && !orderQuery.isError && (
          <div className="grid gap-1 text-sm">
            <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
              <span>
                {t('Order total')}{' '}
                <span className="tabular-nums text-foreground">{money(order.total)}</span>
              </span>
              {payment && !paymentQuery.isError && (
                <span>
                  {t('Collected')}{' '}
                  <span className="tabular-nums text-foreground">
                    {money(formatMoneyCents(paidCents))}
                  </span>
                </span>
              )}
            </div>
            {payment && !paymentQuery.isError && (
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm">{t('Remaining balance')}</strong>
                <strong className="text-lg tabular-nums">{money(formatMoneyCents(dueCents))}</strong>
              </div>
            )}
          </div>
        )}
        {paymentQuery.isError && !orderQuery.isError && (
          <div className="grid gap-2">
            <p role="alert" className="text-xs text-destructive">
              {t('Could not verify payment status. Retry before collecting.')}
            </p>
            <PosButton type="button" onClick={() => void paymentQuery.refetch()}>
              {t('Retry')}
            </PosButton>
          </div>
        )}
        {!online && (
          <p role="status" className="text-xs text-warning">
            {t('Connect to the internet before recording a payment.')}
          </p>
        )}
        {hasPendingAmendment && (
          <div className="grid gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
            <p className="m-0 text-xs text-warning" role="status">
              {t('An added-items request is saved. Retry the exact request to check its result.')}
            </p>
            <PosButton
              type="button"
              variant="solid"
              size="sm"
              className="w-full"
              disabled={!online}
              onClick={onRetryPendingAmendment}
            >
              {t('Retry saved item addition')}
            </PosButton>
          </div>
        )}
        {!settled && !cancelled && (
          <PosButton
            type="button"
            variant="solid"
            className="w-full font-semibold"
            disabled={!verified || !online}
            onClick={onCheckout}
          >
            {t('Take payment')}
          </PosButton>
        )}
        {settled &&
          verified &&
          payment?.checks
            .filter((check) => check.receipt)
            .map((check) => (
              <PosButton
                key={check.id}
                type="button"
                variant="solid"
                size="sm"
                className="w-full"
                onClick={() => setReceiptCheckId(check.id)}
              >
                <ReceiptText size={15} aria-hidden="true" />
                {t('View / print receipt')}
                {payment.checks.length > 1
                  ? ` · ${t('Check')} ${formatNumber(check.position + 1)}`
                  : ''}
              </PosButton>
            ))}
        {verified &&
          !cancelled &&
          payment?.checks.map((check) => {
            const refundableCents = check.payments.reduce(
              (sum, tender) =>
                sum + (parseMoneyCents(tender.refundableAmount ?? tender.amount) ?? 0n),
              0n,
            );
            if (refundableCents <= 0n && !check.refunds?.length) return null;
            return (
              <PosButton
                key={`refund-${check.id}`}
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={!online || (refundableCents > 0n && !refundShiftId)}
                onClick={() => setRefundCheckId(check.id)}
              >
                <AlertTriangle size={15} aria-hidden="true" />
                {t(refundableCents > 0n ? 'Refund' : 'View refunds')}{' '}
                {payment.checks.length > 1
                  ? `· ${t('Check')} ${formatNumber(check.position + 1)}`
                  : ''}
                <bdi className="ms-auto" dir="ltr">
                  {money(formatMoneyCents(refundableCents))}
                </bdi>
              </PosButton>
            );
          })}
        {/* Secondary actions share one row so the confirmed items keep the space. */}
        <div className="flex gap-2">
          {!hasPendingAmendment && canAddItems && verified && (
            <PosButton
              type="button"
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 px-2 text-xs"
              disabled={!online}
              onClick={onAddItems}
            >
              <ReceiptText size={15} aria-hidden="true" />
              <span className="truncate">{t('Add items to this order')}</span>
            </PosButton>
          )}
          <PosButton
            type="button"
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 px-2 text-xs"
            onClick={() => onNewOrder(settled && verified)}
          >
            <span className="truncate">{t('Start another order')}</span>
          </PosButton>
        </div>
        {canCancel && (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 justify-self-center rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            disabled={!online || cancellationMutation.isPending}
            onClick={openCancellationDialog}
          >
            <AlertTriangle size={13} aria-hidden="true" />
            {t(pendingCancellation ? 'Retry saved cancellation' : 'Cancel unpaid order')}
          </button>
        )}
        {cancellationMutation.isError && (
          <div className="grid gap-2" role="alert">
            <p className="m-0 text-xs text-destructive">
              {errorText(
                cancellationMutation.error instanceof Error
                  ? cancellationMutation.error.message
                  : t('The order could not be cancelled.'),
              )}
            </p>
            <PosButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void Promise.all([orderQuery.refetch(), paymentQuery.refetch()])}
            >
              {t('Refresh order status')}
            </PosButton>
          </div>
        )}
      </footer>

      {receiptCheckId && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setReceiptCheckId(null);
          }}
          title={t('POS receipt')}
          closeLabel={t('Close')}
          className="flex max-h-[calc(100dvh-20px)] flex-col overflow-hidden"
        >
          <PosReceiptView
            merchantId={merchantId}
            employeeId={employeeId}
            branchId={branchId}
            requiresApproval={requiresRefundApproval}
            canRecordItemReturn
            orderId={orderId}
            checkId={receiptCheckId}
            backLabel="Done"
            onBack={() => setReceiptCheckId(null)}
          />
        </Dialog>
      )}

      {refundCheckId && (
        <PosRefundDialog
          merchantId={merchantId}
          employeeId={employeeId}
          branchId={branchId}
          orderId={orderId}
          checkId={refundCheckId}
          refundShiftId={refundShiftId}
          requiresApproval={requiresRefundApproval}
          onClose={() => setRefundCheckId(null)}
        />
      )}

      <Dialog
        open={cancellationOpen}
        onOpenChange={(open) => {
          if (!cancellationMutation.isPending) setCancellationOpen(open);
          if (!open && !cancellationMutation.isError) {
            setCancellationReason('');
            setApprovalUsername('');
            setApprovalPassword('');
          }
        }}
        title={t('Cancel unpaid order')}
        description={t(
          'This cancels the whole unpaid order, restores eligible stock, and sends a stop notice to the kitchen.',
        )}
        closeLabel={t('Close')}
      >
        <form className="grid gap-4 p-5" onSubmit={submitCancellation}>
          <p className="m-0 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            {t(
              'Orders with any payment, or orders already in preparation, cannot be cancelled here.',
            )}
          </p>
          {pendingCancellation && (
            <p
              className="m-0 rounded-lg border border-info/40 bg-info/10 p-3 text-sm text-foreground"
              role="status"
            >
              {t(
                'A cancellation request is saved. Retry the same request after an uncertain response; supervisor credentials are never saved.',
              )}
            </p>
          )}
          <label className="grid gap-1.5 text-sm font-medium">
            {t('Cancellation reason')}
            <Input
              required
              maxLength={500}
              value={cancellationReason}
              onChange={(event) => {
                setCancellationReason(event.target.value);
                cancellationMutation.reset();
              }}
              placeholder={t('For example: customer changed their mind')}
              disabled={Boolean(pendingCancellation) || cancellationMutation.isPending}
              autoFocus
            />
          </label>
          {requiresApproval && (
            <fieldset className="grid gap-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-semibold">{t('Supervisor approval')}</legend>
              <label className="grid gap-1.5 text-sm font-medium">
                {t('Supervisor username')}
                <Input
                  autoComplete="off"
                  required
                  value={approvalUsername}
                  onChange={(event) => setApprovalUsername(event.target.value)}
                  disabled={cancellationMutation.isPending}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {t('Supervisor password')}
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={approvalPassword}
                  onChange={(event) => setApprovalPassword(event.target.value)}
                  disabled={cancellationMutation.isPending}
                />
              </label>
              <p className="m-0 text-xs text-muted-foreground">
                {t('Credentials are checked for this action and are never saved on this device.')}
              </p>
            </fieldset>
          )}
          {cancellationMutation.isError && (
            <p className="m-0 text-sm text-destructive" role="alert">
              {errorText(
                cancellationMutation.error instanceof Error
                  ? cancellationMutation.error.message
                  : t('The order could not be cancelled.'),
              )}
            </p>
          )}
          {cancellationSaveError && (
            <p className="m-0 text-sm text-destructive" role="alert">
              {errorText(cancellationSaveError)}
            </p>
          )}
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <PosButton
              type="button"
              variant="outline"
              disabled={cancellationMutation.isPending}
              onClick={() => setCancellationOpen(false)}
            >
              {t('Keep order')}
            </PosButton>
            <PosButton
              type="submit"
              variant="solid"
              disabled={
                !online ||
                !cancellationReason.trim() ||
                (requiresApproval && (!approvalUsername.trim() || !approvalPassword)) ||
                cancellationMutation.isPending
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancellationMutation.isPending ? t('Cancelling...') : t('Confirm cancellation')}
            </PosButton>
          </div>
          {pendingCancellation && verified && online && !cancellationMutation.isPending && (
            <PosButton
              type="button"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => void startNewCancellationRequest()}
            >
              {t('Refresh order and replace the saved cancellation request')}
            </PosButton>
          )}
        </form>
      </Dialog>
    </aside>
  );
}
