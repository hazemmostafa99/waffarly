import type { PosOrderPaymentStateResponse } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { PosButton } from '../../components/pos-button.js';

/** Customer, order type and table on one line beside the order number. */
export function PosCheckoutOrderIdentity({ state }: { state: PosOrderPaymentStateResponse }) {
  const { t } = useLocale();
  const context = state.context;
  if (!context) return null;
  return (
    <p className="m-0 min-w-0 truncate text-xs" data-testid="checkout-order-identity">
      <span className="font-semibold text-foreground">
        {context.order.customerName || t('Walk-in customer')}
      </span>
      <span className="text-muted-foreground">
        {' · '}
        {t(
          context.order.fulfillmentType === 'dine_in'
            ? 'Dine in'
            : context.order.fulfillmentType === 'delivery'
              ? 'Delivery'
              : 'Takeaway',
        )}
        {context.tableCode && (
          <>
            {' · '}
            {t('Table')} <bdi>{context.tableCode}</bdi>
          </>
        )}
      </span>
    </p>
  );
}

/** Up to this many lines stay open; longer orders start collapsed behind their count. */
const OPEN_ITEM_LINE_LIMIT = 3;

export function PosCheckoutOrderContext({
  state,
  onRefresh,
}: {
  state: PosOrderPaymentStateResponse;
  onRefresh: () => void;
}) {
  const { t, formatNumber } = useLocale();
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
    <section aria-label={t('Order items')} data-testid="checkout-order-context">
      <details open={lines.length <= OPEN_ITEM_LINE_LIMIT} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1 text-xs font-semibold text-muted-foreground">
          <span>
            {t('Order items')} ({formatNumber(itemCount)})
          </span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="divide-y divide-border/70">
          {lines.map((line) => (
            <article key={line.id} className="flex items-start gap-2 py-1.5 text-xs">
              <bdi className="shrink-0 tabular-nums text-muted-foreground">
                ×{formatNumber(line.quantity)}
              </bdi>
              <div className="min-w-0 flex-1">
                <p className="m-0 break-words font-medium">{line.productName}</p>
                {line.variantName && (
                  <p className="m-0 break-words text-muted-foreground">{line.variantName}</p>
                )}
                {line.selections.map((selection, index) => (
                  <p key={index} className="m-0 break-words text-muted-foreground">
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
                  <p className="m-0 break-words text-muted-foreground">
                    <span className="font-medium">{t('Item note')}: </span>
                    {line.note}
                  </p>
                )}
              </div>
              <bdi className="shrink-0 whitespace-nowrap font-semibold tabular-nums">
                {formatNumber(Number(line.lineTotal), {
                  style: 'currency',
                  currency: state.currency,
                })}
              </bdi>
            </article>
          ))}
          {lines.length === 0 && (
            <p className="m-0 py-1.5 text-xs text-muted-foreground">
              {t('No item details available.')}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
