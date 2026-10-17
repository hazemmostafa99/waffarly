import { useMoney } from './use-money.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Input, Textarea, useLocale, cn } from '@waffarly/ui';
import {
  Banknote,
  CreditCard,
  Check,
  CheckCheck,
  Plus,
  Minus,
  Printer,
  AlertCircle,
  ArrowRight,
  Split,
} from 'lucide-react';
import { useState } from 'react';
import { extras, products, prototypeKeys, type Product } from './prototype-data.js';
import {
  draftLine,
  draftUnitCents,
  orderTotal,
  orderDue,
  parseAmount,
  splitEqual,
  type DraftLine,
  type DemoOrder,
} from './prototype-model.js';
import { recordPayment, recoverPayment, splitOrder, type PaymentCommand } from './prototype-api.js';
import { FoodArt } from './food-art.js';
import { PreviewButton } from './prototype-ui.js';
import { SampleReceiptDocument } from './components/sample-receipt-document.js';

function useSaveOrder() {
  const client = useQueryClient();
  return (order: DemoOrder) =>
    client.setQueryData<DemoOrder[]>(prototypeKeys.orders, (current) =>
      current?.map((item) => (item.id === order.id ? order : item)),
    );
}

export function ConfigureDialog({
  product,
  initial,
  onClose,
  onAdd,
}: {
  product: Product;
  initial?: DraftLine;
  onClose: () => void;
  onAdd: (line: DraftLine) => void;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const [line, setLine] = useState(() => initial ?? draftLine(product.id));
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={t(product.name)}
      description={t('Make it just right.')}
      closeLabel={t('Close')}
    >
      <div className="space-y-5 p-6">
        <div
          className="h-32 rounded-xl text-[var(--pos-art-ink)]"
          style={{ background: `var(--pos-${product.tone})` }}
        >
          <FoodArt kind={product.kind} chocolate={product.id === 'chocolate'} />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            {t('Size')}{' '}
            <span className="font-normal text-muted-foreground">· {t('Choose one')}</span>
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {(['regular', 'large'] as const).map((size) => (
              <button
                type="button"
                key={size}
                aria-pressed={line.size === size}
                onClick={() => setLine({ ...line, size })}
                className={cn(
                  'flex min-h-14 items-center justify-between rounded-lg border px-4 text-sm',
                  line.size === size ? 'border-primary bg-accent font-semibold' : 'border-border',
                )}
              >
                <span>{t(size === 'regular' ? 'Regular' : 'Large')}</span>
                <span>{size === 'large' ? `+${money(3000)}` : t('Included')}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {product.category !== 'Coffee' && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              {t('A little extra')}{' '}
              <span className="font-normal text-muted-foreground">· {t('Optional')}</span>
            </legend>
            {extras.map((extra) => (
              <label
                key={extra.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-border text-sm"
              >
                <input
                  type="checkbox"
                  checked={line.extras.includes(extra.id)}
                  onChange={(event) =>
                    setLine({
                      ...line,
                      extras: event.target.checked
                        ? [...line.extras, extra.id]
                        : line.extras.filter((id) => id !== extra.id),
                    })
                  }
                  className="size-4 accent-primary"
                />
                <span className="flex-1">{t(extra.name)}</span>
                <span className="text-muted-foreground">+{money(extra.cents)}</span>
              </label>
            ))}
          </fieldset>
        )}
        <label className="block text-sm font-semibold">
          {t('Kitchen note')}
          <Textarea
            value={line.note}
            onChange={(event) => setLine({ ...line, note: event.target.value.slice(0, 200) })}
            placeholder={t('e.g. sauce on the side')}
            className="mt-2 min-h-20 bg-background font-normal"
          />
        </label>
        <div className="flex items-center gap-3">
          <PreviewButton
            size="icon"
            aria-label={t('Decrease quantity')}
            disabled={line.quantity <= 1}
            onClick={() => setLine({ ...line, quantity: line.quantity - 1 })}
          >
            <Minus size={16} />
          </PreviewButton>
          <span className="w-7 text-center font-semibold">{line.quantity}</span>
          <PreviewButton
            size="icon"
            aria-label={t('Increase quantity')}
            disabled={line.quantity >= 99}
            onClick={() => setLine({ ...line, quantity: line.quantity + 1 })}
          >
            <Plus size={16} />
          </PreviewButton>
          <PreviewButton
            variant="solid"
            className="ms-auto"
            onClick={() => {
              onAdd(line);
              onClose();
            }}
          >
            {t(initial ? 'Update item' : 'Add to order')}{' '}
            <span className="ms-3 tabular-nums">{money(draftUnitCents(line) * line.quantity)}</span>
          </PreviewButton>
        </div>
      </div>
    </Dialog>
  );
}

export function SplitDialog({ order, onClose }: { order: DemoOrder; onClose: () => void }) {
  const { t } = useLocale();
  const money = useMoney();
  const saveOrder = useSaveOrder();
  const [mode, setMode] = useState<'equal' | 'items' | 'custom'>('equal');
  const [shares, setShares] = useState(2);
  const [custom, setCustom] = useState((orderTotal(order) / 200).toFixed(2));
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const total = orderTotal(order);
  const selectedTotal = order.lines.reduce(
    (sum, line) => sum + line.unitCents * (quantities[line.id] ?? 0),
    0,
  );
  const firstCustom = parseAmount(custom) ?? 0;
  const amounts =
    mode === 'equal'
      ? splitEqual(total, shares)
      : mode === 'items'
        ? [total - selectedTotal, selectedTotal]
        : [firstCustom, total - firstCustom];
  const split = useMutation({
    mutationFn: () => splitOrder(order.id, amounts),
    onSuccess: (result) => {
      saveOrder(result);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={t('Split the bill')}
      description={t('One order. Separate checks. No duplicate items.')}
      closeLabel={t('Close')}
      className="w-[min(680px,calc(100%-24px))]"
    >
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-3 rounded-xl bg-secondary p-1">
          {(['equal', 'items', 'custom'] as const).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setMode(item)}
              aria-pressed={mode === item}
              className={cn(
                'min-h-11 rounded-lg text-sm font-medium',
                mode === item && 'bg-card shadow-sm',
              )}
            >
              {t(
                item === 'equal' ? 'Equal shares' : item === 'items' ? 'By items' : 'Custom amount',
              )}
            </button>
          ))}
        </div>
        {mode === 'equal' && (
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <span className="text-sm font-medium">{t('Number of checks')}</span>
            <div className="flex items-center gap-4">
              <PreviewButton
                size="icon"
                disabled={shares <= 2}
                aria-label={t('Fewer checks')}
                onClick={() => setShares(shares - 1)}
              >
                <Minus size={16} />
              </PreviewButton>
              <strong>{shares}</strong>
              <PreviewButton
                size="icon"
                disabled={shares >= 6}
                aria-label={t('More checks')}
                onClick={() => setShares(shares + 1)}
              >
                <Plus size={16} />
              </PreviewButton>
            </div>
          </div>
        )}
        {mode === 'custom' && (
          <label className="block text-sm font-medium">
            {t('Amount for check 1')}
            <Input
              inputMode="decimal"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              className="mt-2"
            />
          </label>
        )}
        {mode === 'items' && (
          <fieldset>
            <legend className="mb-3 text-sm text-muted-foreground">
              {t('Choose quantities to move to check 2.')}
            </legend>
            {order.lines.map((line) => (
              <label
                key={line.id}
                className="flex min-h-14 items-center justify-between gap-3 border-b border-border text-sm"
              >
                <span>
                  {t(products.find((product) => product.id === line.productId)!.name)}{' '}
                  <span className="text-muted-foreground">×{line.quantity}</span>
                </span>
                <input
                  aria-label={`${t('Quantity for check 2')}: ${t(products.find((product) => product.id === line.productId)!.name)}`}
                  type="number"
                  min={0}
                  max={line.quantity}
                  value={quantities[line.id] ?? 0}
                  onChange={(event) =>
                    setQuantities({
                      ...quantities,
                      [line.id]: Math.min(
                        line.quantity,
                        Math.max(0, Math.trunc(Number(event.target.value))),
                      ),
                    })
                  }
                  className="h-11 w-20 rounded-lg border border-border bg-background px-3"
                />
              </label>
            ))}
          </fieldset>
        )}
        <div className="space-y-2 rounded-xl bg-background p-4">
          {amounts.map((amount, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span>
                {t('Check')} {index + 1}
              </span>
              <strong className="tabular-nums">{money(Math.max(0, amount))}</strong>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-3 text-sm">
            <span>{t('Order total')}</span>
            <strong>{money(total)}</strong>
          </div>
        </div>
        {split.error && (
          <p role="alert" className="text-sm text-destructive">
            {t(split.error.message)}
          </p>
        )}
        <PreviewButton
          variant="solid"
          disabled={amounts.some((amount) => amount <= 0) || split.isPending}
          className="w-full"
          onClick={() => split.mutate()}
        >
          <Split size={16} />
          {t('Confirm split')}
        </PreviewButton>
      </div>
    </Dialog>
  );
}

export function CheckoutDialog({
  order,
  open,
  onClose,
}: {
  order: DemoOrder;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const saveOrder = useSaveOrder();
  const [billId, setBillId] = useState(
    order.bills.find((bill) => bill.amountCents > bill.paidCents)?.id ?? '',
  );
  const bill =
    order.bills.find((item) => item.id === billId) ??
    order.bills.find((item) => item.amountCents > item.paidCents) ??
    order.bills[0];
  const remaining = bill ? bill.amountCents - bill.paidCents : 0;
  const [method, setMethod] = useState<'cash' | 'terminal'>('cash');
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState('');
  const [interrupted, setInterrupted] = useState(false);
  const [uncertain, setUncertain] = useState<string | null>(null);
  const [receipt, setReceipt] = useState(false);
  const applied = amount === '' ? remaining : parseAmount(amount);
  const cash = received === '' ? applied : parseAmount(received);
  const update = (result: DemoOrder) => {
    saveOrder(result);
    setAmount('');
    setReceived('');
    setUncertain(null);
  };
  const payment = useMutation({
    mutationFn: (command: PaymentCommand) => recordPayment(command, interrupted),
    onSuccess: update,
    onError: (_, command) => {
      if (interrupted) setUncertain(command.requestId);
    },
  });
  const recovery = useMutation({
    mutationFn: () => recoverPayment(uncertain!),
    onSuccess: (result) => {
      update(result);
      payment.reset();
    },
  });
  const due = orderDue(order);
  return (
    <Dialog
      open={open}
      onOpenChange={onClose}
      title={t(receipt ? 'Sample receipt' : 'Take payment')}
      description={`${t('Order')} #${order.number} · ${t('Design preview — no money is collected.')}`}
      closeLabel={t('Close')}
      {...(receipt ? { className: 'receipt-dialog' } : {})}
    >
      <div className="space-y-5 p-6">
        {receipt ? (
          <>
            <SampleReceiptDocument order={order} />
            <p data-print-hidden className="text-xs text-muted-foreground">
              {t(
                'This sample summarizes the order. Production receipts are issued per settled check.',
              )}
            </p>
            <PreviewButton data-print-hidden className="w-full" onClick={() => window.print()}>
              <Printer size={16} />
              {t('Print 80 mm / save as PDF')}
            </PreviewButton>
            <PreviewButton
              data-print-hidden
              variant="solid"
              className="w-full"
              onClick={() => setReceipt(false)}
            >
              {t('Back to payment')}
            </PreviewButton>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-accent p-5">
              <p className="text-sm text-muted-foreground">{t('Remaining balance')}</p>
              <div className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">
                {money(due)}
              </div>
            </div>
            {order.bills.length > 1 && (
              <div className="flex flex-wrap gap-2" aria-label={t('Checks')}>
                {order.bills.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    disabled={!!uncertain}
                    onClick={() => {
                      setBillId(item.id);
                      setAmount('');
                      setReceived('');
                      payment.reset();
                    }}
                    className={cn(
                      'min-h-11 rounded-lg border px-3 text-sm',
                      item.id === bill?.id
                        ? 'border-primary bg-accent font-semibold'
                        : 'border-border',
                    )}
                  >
                    {t('Check')} {index + 1} ·{' '}
                    {item.paidCents === item.amountCents ? (
                      <Check size={14} className="inline" />
                    ) : (
                      money(item.amountCents - item.paidCents)
                    )}
                  </button>
                ))}
              </div>
            )}
            {uncertain ? (
              <div
                role="alert"
                className="space-y-3 rounded-xl border border-warning bg-[var(--pos-note)] p-4 text-[var(--pos-note-ink)]"
              >
                <AlertCircle size={24} />
                <h3 className="font-semibold">{t('Check the payment result')}</h3>
                <p className="text-sm">
                  {t('The reply was interrupted. Do not collect this payment again.')}
                </p>
                <PreviewButton disabled={recovery.isPending} onClick={() => recovery.mutate()}>
                  {t('Check saved result')}
                  <ArrowRight size={16} />
                </PreviewButton>
                {recovery.error && <p>{t(recovery.error.message)}</p>}
              </div>
            ) : due === 0 ? (
              <div role="status" className="space-y-2 py-3 text-center">
                <CheckCheck size={36} className="mx-auto text-success" />
                <h3 className="text-xl font-semibold">{t('All checks are paid')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('Kitchen progress and handover stay separate.')}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(['cash', 'terminal'] as const).map((item) => (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={method === item}
                      onClick={() => {
                        setMethod(item);
                        payment.reset();
                      }}
                      className={cn(
                        'flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-sm font-medium',
                        method === item ? 'border-primary bg-accent' : 'border-border',
                      )}
                    >
                      {item === 'cash' ? <Banknote size={24} /> : <CreditCard size={24} />}
                      {t(item === 'cash' ? 'Cash' : 'External terminal')}
                    </button>
                  ))}
                </div>
                <label className="block text-sm font-medium">
                  {t('Payment amount')}
                  <Input
                    aria-label={t('Payment amount')}
                    inputMode="decimal"
                    placeholder={(remaining / 100).toFixed(2)}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="mt-2 h-12 text-lg"
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t('Use a smaller amount to split payment methods.')}
                  </span>
                </label>
                {method === 'cash' ? (
                  <>
                    <label className="block text-sm font-medium">
                      {t('Cash received')}
                      <Input
                        aria-label={t('Cash received')}
                        inputMode="decimal"
                        placeholder={((applied ?? 0) / 100).toFixed(2)}
                        value={received}
                        onChange={(event) => setReceived(event.target.value)}
                        className="mt-2 h-12 text-lg"
                      />
                    </label>
                    <div className="flex justify-between rounded-lg bg-secondary px-4 py-3 text-sm">
                      <span>{t('Change to return')}</span>
                      <strong>{money(Math.max(0, (cash ?? 0) - (applied ?? 0)))}</strong>
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
                    {t('Only record this after the external terminal confirms payment.')}
                  </p>
                )}
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={interrupted}
                    onChange={(event) => setInterrupted(event.target.checked)}
                    className="accent-primary"
                  />
                  {t('Preview an interrupted payment reply')}
                </label>
                {payment.error && !uncertain && (
                  <p role="alert" className="text-sm text-destructive">
                    {t(payment.error.message)}
                  </p>
                )}
                <PreviewButton
                  variant="solid"
                  className="w-full"
                  disabled={
                    payment.isPending ||
                    !applied ||
                    applied > remaining ||
                    cash === null ||
                    (method === 'cash' && cash < applied)
                  }
                  onClick={() => {
                    if (bill && applied)
                      payment.mutate({
                        requestId: crypto.randomUUID(),
                        orderId: order.id,
                        billId: bill.id,
                        method,
                        cents: applied,
                        receivedCents: method === 'cash' ? cash! : applied,
                      });
                  }}
                >
                  {t(
                    method === 'cash' ? 'Record cash payment' : 'Record confirmed terminal payment',
                  )}
                  <span className="ms-auto">{money(applied ?? 0)}</span>
                </PreviewButton>
              </>
            )}
            {order.payments.length > 0 && !uncertain && (
              <PreviewButton className="w-full" onClick={() => setReceipt(true)}>
                <Printer size={16} />
                {t('View sample receipt')}
              </PreviewButton>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
