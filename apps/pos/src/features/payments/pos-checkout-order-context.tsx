import { usePosText } from '../../lib/use-pos-text.js';
import { actorActivityFeatures } from '@waffarly/contracts';
import type { PosEmployeeSession, PosOrderPaymentStateResponse } from '@waffarly/contracts';
import { useOutletContext } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { PosButton } from '../../components/pos-button.js';

export function PosCheckoutOrderIdentity({ state }: { state: PosOrderPaymentStateResponse }) {
  const t = usePosText();
  const { employee } = useOutletContext<{ employee: PosEmployeeSession }>();
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
                : actorActivityFeatures(employee).kitchen
                  ? 'Takeaway'
                  : 'In-store sale',
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
  onRefresh,
}: {
  state: PosOrderPaymentStateResponse;
  onRefresh: () => void;
}) {
  const { formatNumber } = useLocale();
  const t = usePosText();
  const context = state.context;
  if (!context)
    return (
      <section
        className="grid gap-2 rounded-lg border border-border p-3 text-xs"
        aria-label={t('Order items')}
      >
        <p role="status" className="text-muted-foreground">
          {t('Order details are unavailable. Verify the order reference before collecting.')}
        </p>
        <PosButton type="button" size="sm" onClick={onRefresh}>
          {t('Refresh order details')}
        </PosButton>
      </section>
    );

  const lines = context.order.lines;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <section
      className="rounded-xl border border-border bg-card"
      aria-label={t('Order items')}
      data-testid="checkout-order-context"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <h3 className="m-0 text-xs font-semibold">{t('Order items')}</h3>
        <span className="text-xs text-muted-foreground">{formatNumber(itemCount)}</span>
      </div>
      <div className="divide-y divide-border px-3">
        {lines.map((line) => (
          <article key={line.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="m-0 break-words text-xs font-medium">{line.productName}</p>
              {line.variantName && (
                <p className="mb-0 mt-1 break-words text-xs text-muted-foreground">
                  {line.variantName}
                </p>
              )}
              {line.selections.map((selection, index) => (
                <p key={index} className="mb-0 mt-1 break-words text-xs text-muted-foreground">
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
                <p className="mb-0 mt-1 break-words text-xs text-muted-foreground">
                  <span className="font-medium">{t('Item note')}: </span>
                  {line.note}
                </p>
              )}
            </div>
            <div className="shrink-0 text-end">
              <p className="m-0 text-xs text-muted-foreground">
                <bdi>×{formatNumber(line.quantity)}</bdi>
              </p>
              <bdi className="mt-1 block whitespace-nowrap text-xs font-semibold tabular-nums">
                {formatNumber(Number(line.lineTotal), {
                  style: 'currency',
                  currency: state.currency,
                })}
              </bdi>
            </div>
          </article>
        ))}
        {lines.length === 0 && (
          <p className="py-3 text-xs text-muted-foreground">{t('No item details available.')}</p>
        )}
      </div>
    </section>
  );
}
