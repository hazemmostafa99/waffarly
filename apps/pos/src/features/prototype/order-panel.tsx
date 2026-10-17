import { useMoney } from './use-money.js';
import { useLocale, cn } from '@waffarly/ui';
import {
  ArrowRight,
  ChefHat,
  Check,
  Edit3,
  Minus,
  Plus,
  ReceiptText,
  Split,
  Trash2,
  Users,
} from 'lucide-react';
import { extras, products } from './prototype-data.js';
import {
  draftUnitCents,
  orderDue,
  orderTotal,
  type DemoOrder,
  type DraftLine,
} from './prototype-model.js';
import { usePrototypeStore } from './prototype.store.js';
import { PreviewButton, StatusPill } from './prototype-ui.js';

export function OrderPanel({
  order,
  drafts,
  busy,
  onSend,
  onCheckout,
  onSplit,
  onEdit,
  onNew,
  onEditContext,
  contextEditable,
  onHandover,
}: {
  order: DemoOrder;
  drafts: DraftLine[];
  busy: boolean;
  onSend: () => void;
  onCheckout: () => void;
  onSplit: () => void;
  onEdit: (line: DraftLine) => void;
  onNew: () => void;
  onEditContext: () => void;
  contextEditable: boolean;
  onHandover: () => void;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const updateLine = usePrototypeStore((state) => state.updateLine);
  const draftTotal = drafts.reduce((sum, line) => sum + draftUnitCents(line) * line.quantity, 0);
  const total = orderTotal(order);
  const due = orderDue(order);
  const linesReady = order.lines.length > 0 && order.lines.every((line) => line.stage === 'ready');
  return (
    <aside
      aria-label={t('Current order')}
      className="prototype-cart flex min-h-0 min-w-0 flex-1 flex-col border-s border-border bg-card lg:w-[370px] xl:w-[390px]"
    >
      <div className="border-b border-border p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t('Current order')}
          </span>
          <span className="font-mono text-xs text-muted-foreground">#{order.number}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {order.fulfillment === 'dine-in'
                ? `${t('Table')} ${String(order.table).padStart(2, '0')}`
                : t(order.fulfillment === 'takeaway' ? 'Takeaway' : 'Delivery')}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users size={12} />
              {order.customerName ||
                (order.table ? t('2 guests · Main dining') : t('Walk-in customer'))}
            </p>
            {order.fulfillment === 'delivery' && (
              <p className="mt-1 max-w-64 text-xs leading-5 text-muted-foreground">
                {order.customerPhone && <span dir="ltr">{order.customerPhone} · </span>}
                {order.deliveryAddress}
              </p>
            )}
          </div>
          <PreviewButton size="icon" aria-label={t('New order')} onClick={onNew}>
            <Plus size={18} />
          </PreviewButton>
        </div>
        <PreviewButton
          size="sm"
          className="mt-3 w-full justify-start"
          disabled={!contextEditable}
          title={
            !contextEditable
              ? t('Order details lock after items are sent or payment begins.')
              : undefined
          }
          onClick={onEditContext}
        >
          <Edit3 size={14} />
          {t(contextEditable ? 'Edit order details' : 'Details locked after sending')}
        </PreviewButton>
        <div className="mt-4 flex items-center gap-2">
          <StatusPill>
            {order.complete ? (
              <Check size={12} />
            ) : (
              <span className="size-1.5 rounded-full bg-current" />
            )}
            {t(order.complete ? 'Completed' : 'Open order')}
          </StatusPill>
          <span className="text-xs text-muted-foreground">{t('Sample session')}</span>
        </div>
      </div>
      <div
        className="order-scroll min-h-48 flex-1 overflow-y-auto p-5 lg:min-h-0"
        data-testid="order-lines"
      >
        {drafts.length > 0 && (
          <section aria-label={t('New items')}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider">{t('New items')}</h3>
              <span className="text-[11px] text-muted-foreground">{t('Not sent yet')}</span>
            </div>
            <div className="space-y-4">
              {drafts.map((line) => {
                const product = products.find((item) => item.id === line.productId)!;
                return (
                  <div key={line.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onEdit(line)}
                          className="flex min-h-11 items-center gap-2 text-start text-sm font-semibold"
                        >
                          {t(product.name)}
                          <Edit3 size={12} className="shrink-0 text-muted-foreground" />
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {t(line.size === 'large' ? 'Large' : 'Regular')}
                          {line.extras
                            .map(
                              (id) =>
                                ` · ${t(extras.find((extra) => extra.id === id)?.name ?? '')}`,
                            )
                            .join('')}
                        </p>
                        {line.note && (
                          <p className="mt-1 text-xs text-[var(--pos-note-ink)]">{line.note}</p>
                        )}
                      </div>
                      <strong className="pt-3 text-sm tabular-nums">
                        {money(draftUnitCents(line) * line.quantity)}
                      </strong>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <PreviewButton
                        size="icon"
                        className="size-11"
                        aria-label={`${t('Decrease quantity')}: ${t(product.name)}`}
                        onClick={() => updateLine(line.id, line.quantity - 1)}
                      >
                        <Minus size={14} />
                      </PreviewButton>
                      <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                      <PreviewButton
                        size="icon"
                        className="size-11"
                        disabled={line.quantity >= 99}
                        aria-label={`${t('Increase quantity')}: ${t(product.name)}`}
                        onClick={() => updateLine(line.id, line.quantity + 1)}
                      >
                        <Plus size={14} />
                      </PreviewButton>
                      <button
                        type="button"
                        aria-label={`${t('Remove item')}: ${t(product.name)}`}
                        onClick={() => updateLine(line.id, 0)}
                        className="ms-auto flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {order.lines.length > 0 && (
          <section className={cn(drafts.length > 0 && 'mt-6')} aria-label={t('Sent to kitchen')}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                <ChefHat size={14} />
                {t('Sent to kitchen')}
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {order.lines.reduce((sum, line) => sum + line.quantity, 0)} {t('items')}
              </span>
            </div>
            <div className="space-y-4">
              {order.lines.map((line) => (
                <div key={line.id} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold">
                    {line.quantity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <span className="font-medium">
                        {t(products.find((item) => item.id === line.productId)!.name)}
                      </span>
                      <span className="tabular-nums">{money(line.quantity * line.unitCents)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {t(
                        line.stage === 'queued'
                          ? 'Queued'
                          : line.stage === 'preparing'
                            ? 'Preparing'
                            : 'Ready',
                      )}
                      {line.note && ` · ${line.note}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {!drafts.length && !order.lines.length && (
          <div className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground">
            <ReceiptText size={32} strokeWidth={1.25} />
            <p className="text-sm">{t('A fresh order starts here.')}</p>
            <p className="text-xs">{t('Choose something from the menu.')}</p>
          </div>
        )}
      </div>
      <div className="space-y-3 border-t border-border bg-card p-5">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t('Sent items')}</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
          {draftTotal > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t('New items')}</span>
              <span className="tabular-nums">{money(draftTotal)}</span>
            </div>
          )}
          {order.payments.length > 0 && (
            <div className="flex justify-between text-success">
              <span>{t('Collected')}</span>
              <span className="tabular-nums">−{money(total - due)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <span className="font-semibold">{t('Total to collect')}</span>
            <strong className="text-2xl tabular-nums tracking-tight">
              {money(due + draftTotal)}
            </strong>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {t('Sample prices · no tax or service charge configured')}
        </p>
        {drafts.length > 0 ? (
          <PreviewButton
            variant="solid"
            className="h-12 w-full"
            disabled={busy || order.complete}
            onClick={onSend}
          >
            <ChefHat size={17} />
            {t('Send new items')}
            <ArrowRight size={17} className="ms-auto rtl:rotate-180" />
          </PreviewButton>
        ) : (
          <PreviewButton
            variant="solid"
            className="h-12 w-full"
            disabled={!order.bills.length || busy}
            onClick={onCheckout}
          >
            <ReceiptText size={17} />
            {t(due > 0 ? 'Take payment' : 'View payment')}
            <ArrowRight size={17} className="ms-auto rtl:rotate-180" />
          </PreviewButton>
        )}
        <div className="grid grid-cols-2 gap-2">
          <PreviewButton
            disabled={!order.lines.length || !!order.payments.length || !!drafts.length || busy}
            onClick={onSplit}
          >
            <Split size={15} />
            {t('Split bill')}
          </PreviewButton>
          <PreviewButton
            disabled={!order.bills.length || !!drafts.length || busy}
            onClick={onCheckout}
          >
            {t('Payments')}
            <span className="rounded bg-secondary px-1.5 text-xs">{order.payments.length}</span>
          </PreviewButton>
        </div>
        {linesReady && due === 0 && !drafts.length && !order.complete && (
          <PreviewButton className="w-full" onClick={onHandover}>
            {t('Confirm handover')}
            <Check size={16} />
          </PreviewButton>
        )}
      </div>
    </aside>
  );
}
