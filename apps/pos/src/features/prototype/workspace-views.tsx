import { useMoney } from './use-money.js';
import { useLocale, cn } from '@waffarly/ui';
import { ChefHat, Clock3, Plus, Users, CheckCheck, ArrowRight } from 'lucide-react';
import { products } from './prototype-data.js';
import { orderDue, type DemoOrder } from './prototype-model.js';
import { PreviewButton, StatusPill } from './prototype-ui.js';

export function TablesView({
  orders,
  onSelect,
}: {
  orders: DemoOrder[];
  onSelect: (table: number) => void;
}) {
  const { t } = useLocale();
  const money = useMoney();
  return (
    <section aria-labelledby="tables-title" className="p-5 xl:p-7">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <span className="text-xs text-muted-foreground">{t('Main dining')}</span>
          <h1 id="tables-title" className="mt-1">
            {t('Tables & sessions')}
          </h1>
        </div>
        <StatusPill>
          {orders.filter((order) => order.table && !order.complete).length} {t('occupied')}
        </StatusPill>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((table) => {
          const order = orders.find((item) => item.table === table && !item.complete);
          return (
            <button
              type="button"
              key={table}
              onClick={() => onSelect(table)}
              aria-label={`${t('Table')} ${table} · ${t(order ? 'Occupied' : 'Available')}`}
              className={cn(
                'flex min-h-40 flex-col items-start gap-4 rounded-2xl border p-5 text-start transition-colors hover:border-primary',
                order ? 'border-primary/30 bg-accent' : 'border-border bg-card',
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-lg font-semibold">
                  {String(table).padStart(2, '0')}
                </span>
                {order ? (
                  <Users size={19} className="text-primary" />
                ) : (
                  <Plus size={18} className="text-muted-foreground" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold">
                  {t('Table')} {String(table).padStart(2, '0')}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order
                    ? `${t('Order')} #${order.number} · ${money(orderDue(order))}`
                    : t('Available · 2–4 guests')}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function KitchenView({
  orders,
  onAdvance,
  busy,
}: {
  orders: DemoOrder[];
  onAdvance: (id: string) => void;
  busy: boolean;
}) {
  const { t } = useLocale();
  const active = orders.filter((order) => !order.complete && order.lines.length > 0);
  return (
    <section className="p-5 xl:p-7" aria-labelledby="kitchen-title">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="text-xs text-muted-foreground">{t('All stations')}</span>
          <h1 id="kitchen-title" className="mt-1">
            {t('Kitchen queue')}
          </h1>
        </div>
        <StatusPill>
          <ChefHat size={13} />
          {active.length} {t('orders')}
        </StatusPill>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {active.map((order) => {
          const ready = order.lines.every((line) => line.stage === 'ready');
          const queued = order.lines.some((line) => line.stage === 'queued');
          return (
            <article
              key={order.id}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <header className="flex items-center justify-between border-b border-border bg-secondary/50 p-4">
                <div>
                  <h2 className="font-semibold">
                    {order.table ? `${t('Table')} ${order.table}` : t('Takeaway')}
                  </h2>
                  <span className="text-xs text-muted-foreground">#{order.number}</span>
                </div>
                <StatusPill warning={!ready}>
                  <Clock3 size={12} />
                  {t(ready ? 'Ready' : queued ? 'New round' : 'Preparing')}
                </StatusPill>
              </header>
              <div className="space-y-4 p-4">
                {order.lines.map((line) => (
                  <div key={line.id} className="flex items-start gap-3">
                    <strong className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-sm">
                      {line.quantity}
                    </strong>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {t(products.find((product) => product.id === line.productId)!.name)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(line.size === 'large' ? 'Large' : 'Regular')} ·{' '}
                        {t(
                          line.stage === 'ready'
                            ? 'Ready'
                            : line.stage === 'queued'
                              ? 'Queued'
                              : 'Preparing',
                        )}
                      </p>
                      {line.note && (
                        <p className="mt-2 rounded bg-[var(--pos-note)] p-2 text-sm text-[var(--pos-note-ink)]">
                          {line.note}
                        </p>
                      )}
                    </div>
                    {line.stage === 'ready' && <CheckCheck size={17} className="text-success" />}
                  </div>
                ))}
                <PreviewButton
                  variant={ready ? 'outline' : 'solid'}
                  className="w-full"
                  disabled={ready || busy}
                  onClick={() => onAdvance(order.id)}
                >
                  {t(
                    ready ? 'Ready for handover' : queued ? 'Start new items' : 'Mark order ready',
                  )}
                  <ArrowRight size={16} />
                </PreviewButton>
              </div>
            </article>
          );
        })}
      </div>
      {!active.length && (
        <p className="py-16 text-center text-muted-foreground">
          {t('The kitchen is all caught up.')}
        </p>
      )}
    </section>
  );
}

export function OrdersView({
  orders,
  onSelect,
}: {
  orders: DemoOrder[];
  onSelect: (order: DemoOrder) => void;
}) {
  const { t } = useLocale();
  const money = useMoney();
  return (
    <section className="p-5 xl:p-7">
      <div className="mb-6">
        <span className="text-xs text-muted-foreground">{t('Sample order history')}</span>
        <h1 className="mt-1">{t('Order history')}</h1>
      </div>
      <div className="space-y-3">
        {orders.map((order) => (
          <button
            type="button"
            key={order.id}
            onClick={() => onSelect(order)}
            className="flex min-h-24 w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-start hover:border-primary"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-sm font-semibold">
              #{order.number}
            </span>
            <div className="flex-1">
              <strong className="text-sm">
                {order.table ? `${t('Table')} ${order.table}` : t('Takeaway')}
              </strong>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.lines.length} {t('items')} · {t(order.complete ? 'Completed' : 'Open order')}
              </p>
            </div>
            <div className="text-end">
              <strong className="text-sm tabular-nums">{money(orderDue(order))}</strong>
              <p className="mt-1 text-xs text-muted-foreground">{t('Remaining balance')}</p>
            </div>
            <ArrowRight size={17} className="rtl:rotate-180" />
          </button>
        ))}
      </div>
    </section>
  );
}
