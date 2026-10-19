import type { PosOrderPaymentStateResponse } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { PosButton } from '../../components/pos-button.js';

type Check = PosOrderPaymentStateResponse['checks'][number];

export function PosCheckoutOrderIdentity({ state }: { state: PosOrderPaymentStateResponse }) {
  const { t } = useLocale();
  const context = state.context;
  if (!context) return null;
  return (
    <div className="mt-1 space-y-1 text-xs" data-testid="checkout-order-identity">
      <p className="break-words font-medium text-foreground">
        {context.order.customerName || t('Walk-in customer')}
      </p>
      <p className="flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
        <span>
          {t(
            context.order.fulfillmentType === 'dine_in'
              ? 'Dine in'
              : context.order.fulfillmentType === 'delivery'
                ? 'Delivery'
                : 'Takeaway',
          )}
        </span>
        {context.tableCode && (
          <span>
            {t('Table')} <bdi>{context.tableCode}</bdi>
          </span>
        )}
      </p>
    </div>
  );
}

export function PosCheckoutOrderContext({
  state,
  check,
  onRefresh,
}: {
  state: PosOrderPaymentStateResponse;
  check: Check;
  onRefresh: () => void;
}) {
  const { t, formatNumber } = useLocale();
  const context = state.context;
  if (!context)
    return (
      <section
        className="grid gap-2 rounded-lg border border-border p-3 text-xs"
        aria-label={t('Order details')}
      >
        <p role="status" className="text-muted-foreground">
          {t('Order details are unavailable. Verify the order reference before collecting.')}
        </p>
        <PosButton type="button" size="sm" onClick={onRefresh}>
          {t('Refresh order details')}
        </PosButton>
      </section>
    );
  const byItems = check.splitMethod === 'items' && Array.isArray(check.allocations);
  const whole = check.splitMethod === 'whole';
  const lines = byItems
    ? (check.allocations ?? []).map((allocation) => {
        const original = context.order.lines.find((line) => line.id === allocation.orderLineId);
        return {
          ...original,
          id: allocation.orderLineId,
          productName: allocation.productName,
          variantName: allocation.variantName,
          quantity: allocation.quantity,
          lineTotal: allocation.amount,
          selections: original?.selections ?? [],
          note: original?.note ?? null,
        };
      })
    : context.order.lines;
  const mode = whole
    ? 'Whole order'
    : byItems
      ? 'Split by items'
      : check.splitMethod === 'equal'
        ? 'Equal share'
        : check.splitMethod === 'custom'
          ? 'Custom amount'
          : 'Check allocation unavailable';
  const allocated = whole || byItems;
  return (
    <section
      className="rounded-xl border border-border bg-card"
      aria-label={t('Order details')}
      data-testid="checkout-order-context"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
        <span className="font-semibold">
          {t('Check')} <bdi>{formatNumber(check.position + 1)}</bdi>
        </span>
        <span className="rounded-md bg-secondary px-2 py-1 text-muted-foreground">{t(mode)}</span>
      </div>
      {!allocated && (
        <p className="px-3 pt-3 text-xs text-muted-foreground">
          {t(
            check.splitMethod === 'equal' || check.splitMethod === 'custom'
              ? 'This check collects a share of the order total. Items below are order reference only.'
              : 'Item allocation is unavailable. Items below are order reference only.',
          )}
        </p>
      )}
      <details key={check.id} className="group p-3">
        <summary className="min-h-8 cursor-pointer rounded-sm text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t(allocated ? 'Review check items' : 'Review order items')}{' '}
          <span className="ms-1 font-normal text-muted-foreground">
            ({formatNumber(lines.reduce((sum, line) => sum + line.quantity, 0))})
          </span>
        </summary>
        <div className="mt-2 divide-y divide-border">
          {lines.map((line) => (
            <article key={line.id} className="py-3 first:pt-1 last:pb-0">
              <div className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">{line.productName}</p>
                  {line.variantName && (
                    <p className="mt-1 break-words text-muted-foreground">{line.variantName}</p>
                  )}
                </div>
                <bdi className="shrink-0 tabular-nums">×{formatNumber(line.quantity)}</bdi>
                {allocated && (
                  <bdi className="shrink-0 whitespace-nowrap font-semibold tabular-nums">
                    {formatNumber(Number(line.lineTotal), {
                      style: 'currency',
                      currency: state.currency,
                    })}
                  </bdi>
                )}
              </div>
              {line.selections.map((selection, index) => (
                <p key={index} className="mt-1 break-words text-xs text-muted-foreground">
                  {selection.groupName}: {selection.optionName}
                  {(selection.quantity ?? 1) > 1 && (
                    <>
                      {' '}
                      <bdi>×{formatNumber(selection.quantity!)}</bdi>
                    </>
                  )}
                </p>
              ))}
              {line.note && (
                <p className="mt-2 break-words rounded-md bg-secondary px-2 py-1.5 text-xs text-muted-foreground">
                  <span className="font-medium">{t('Item note')}: </span>
                  {line.note}
                </p>
              )}
            </article>
          ))}
          {lines.length === 0 && (
            <p className="py-2 text-xs text-muted-foreground">{t('No item details available.')}</p>
          )}
        </div>
      </details>
    </section>
  );
}
