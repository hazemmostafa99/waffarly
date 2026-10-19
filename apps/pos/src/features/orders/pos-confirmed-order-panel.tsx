import { useQuery } from '@tanstack/react-query';
import { Dialog, useLocale } from '@waffarly/ui';
import { CheckCircle2, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { PosButton } from '../../components/pos-button.js';
import { formatMoneyCents, parseMoneyCents } from '../payments/payment-form-model.js';
import { getPosOrderPaymentState, posPaymentStateKey } from '../payments/pos-payments.api.js';
import { PosReceiptView } from '../receipts/pos-receipt-view.js';
import { getPosOrder, posOrderDetailKey } from './pos-orders.api.js';

export function PosConfirmedOrderPanel({
  merchantId,
  employeeId,
  orderId,
  online,
  onCheckout,
  onNewOrder,
}: {
  merchantId: string;
  employeeId: string;
  orderId: string;
  online: boolean;
  onCheckout: () => void;
  onNewOrder: () => void;
}) {
  const { t, errorText, formatNumber } = useLocale();
  const [receiptCheckId, setReceiptCheckId] = useState<string | null>(null);
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
  const order = orderQuery.data;
  const payment = paymentQuery.data;
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
    !orderQuery.isError;
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

  return (
    <aside
      className="pos-live-cart flex h-full min-h-0 w-full flex-col border-s border-border bg-card"
      aria-label={t('Current order')}
      data-testid="confirmed-order-panel"
    >
      <header className="space-y-3 border-b border-border p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">{t('Current order')}</span>
          <bdi className="text-xs font-semibold tabular-nums">
            ORD-{orderId.slice(0, 8).toUpperCase()}
          </bdi>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="shrink-0 text-success" size={18} aria-hidden="true" />
          {t('Order confirmed')}
        </div>
        {order && !orderQuery.isError && (
          <p className="text-xs text-muted-foreground">
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
        <span
          className="inline-flex rounded-md border border-border bg-secondary px-2 py-1 text-xs font-semibold"
          role="status"
        >
          {t(status)}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" data-pos-order-scroll>
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
          <section aria-label={t('Confirmed items')} className="grid gap-3">
            <h3 className="text-xs font-semibold text-muted-foreground">{t('Confirmed items')}</h3>
            {order.lines.map((line) => (
              <article key={line.id} className="rounded-lg border border-border p-3">
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

      <footer className="grid gap-3 border-t border-border p-4 sm:p-5">
        {order && !orderQuery.isError && (
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>{t('Order total')}</span>
              <span className="tabular-nums">{money(order.total)}</span>
            </div>
            {payment && !paymentQuery.isError && (
              <>
                <div className="flex justify-between gap-3 text-muted-foreground">
                  <span>{t('Collected')}</span>
                  <span className="tabular-nums">{money(formatMoneyCents(paidCents))}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <strong>{t('Remaining balance')}</strong>
                  <strong className="text-xl tabular-nums">
                    {money(formatMoneyCents(dueCents))}
                  </strong>
                </div>
              </>
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
        {settled &&
          verified &&
          payment?.checks
            .filter((check) => check.receipt)
            .map((check) => (
              <PosButton
                key={check.id}
                type="button"
                variant="solid"
                className="w-full"
                onClick={() => setReceiptCheckId(check.id)}
              >
                <ReceiptText size={16} aria-hidden="true" />
                {t('View / print receipt')}
                {payment.checks.length > 1
                  ? ` · ${t('Check')} ${formatNumber(check.position + 1)}`
                  : ''}
              </PosButton>
            ))}
        {!settled && !cancelled && (
          <PosButton
            type="button"
            variant="solid"
            className="w-full"
            disabled={!verified || !online}
            onClick={onCheckout}
          >
            {t('Take payment')}
          </PosButton>
        )}
        <PosButton type="button" variant="outline" className="w-full" onClick={onNewOrder}>
          {t('Start another order')}
        </PosButton>
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
            orderId={orderId}
            checkId={receiptCheckId}
            backLabel="Done"
            onBack={() => setReceiptCheckId(null)}
          />
        </Dialog>
      )}
    </aside>
  );
}
