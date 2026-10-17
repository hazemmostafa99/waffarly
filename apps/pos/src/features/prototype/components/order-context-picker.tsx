import { useEffect, useState, type FormEvent } from 'react';
import { Dialog, Input, Popover, Textarea, useLocale, cn } from '@waffarly/ui';
import { Check, ChevronDown, MapPin, ShoppingBag, Utensils, X } from 'lucide-react';
import type { DemoOrder, OrderContext } from '../prototype-model.js';
import type { PopoverTriggerProps } from '@waffarly/ui';
import { PreviewButton } from '../prototype-ui.js';

export type OrderContextMode = 'new' | 'edit';

const blankContext = (): OrderContext => ({
  fulfillment: 'takeaway',
  table: null,
  customerName: '',
  customerPhone: '',
  deliveryAddress: '',
  reference: '',
  deliveryFeeCents: 0,
});

function contextFromOrder(order: DemoOrder): OrderContext {
  return {
    fulfillment: order.fulfillment,
    table: order.table,
    customerName: order.customerName ?? '',
    customerPhone: order.customerPhone ?? '',
    deliveryAddress: order.deliveryAddress ?? '',
    reference: order.reference ?? '',
    deliveryFeeCents: order.deliveryFeeCents ?? 0,
  };
}

export function OrderContextPicker({
  open,
  mode,
  order,
  orders,
  busy,
  canEdit,
  onOpenChange,
  onApply,
  onResume,
}: {
  open: boolean;
  mode: OrderContextMode;
  order?: DemoOrder;
  orders: DemoOrder[];
  busy: boolean;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (context: OrderContext) => void;
  onResume: (order: DemoOrder) => void;
}) {
  const { t } = useLocale();
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [context, setContext] = useState<OrderContext>(blankContext);
  const [error, setError] = useState('');
  const [resumeId, setResumeId] = useState('');

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!open) return;
    setContext(mode === 'edit' && order ? contextFromOrder(order) : blankContext());
    setError('');
    setResumeId('');
  }, [open, mode, order?.id]);

  const title = t(mode === 'new' ? 'New order' : 'Order settings');
  const activeTables = new Map(
    orders
      .filter((item) => !item.complete && item.table !== null)
      .map((item) => [item.table!, item]),
  );
  const selectedExisting = resumeId ? orders.find((item) => item.id === resumeId) : undefined;

  const selectFulfillment = (fulfillment: OrderContext['fulfillment']) => {
    setContext((current) => ({
      ...current,
      fulfillment,
      table: fulfillment === 'dine-in' ? (current.table ?? null) : null,
    }));
    setResumeId('');
    setError('');
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (context.fulfillment === 'dine-in' && context.table === null) {
      setError('Choose a table to continue.');
      return;
    }
    if (context.fulfillment === 'delivery') {
      if (!context.customerName.trim()) return setError('Enter a customer name for delivery.');
      if (!context.customerPhone.trim()) return setError('Enter a phone number for delivery.');
      if (!context.deliveryAddress.trim()) return setError('Enter a delivery address.');
    }
    if (selectedExisting && mode === 'new') {
      onResume(selectedExisting);
      onOpenChange(false);
      return;
    }
    onApply({
      ...context,
      customerName: context.customerName.trim(),
      customerPhone: context.customerPhone.trim(),
      deliveryAddress: context.deliveryAddress.trim(),
      reference: context.reference.trim(),
    });
  };

  const content = (
    <ContextForm
      mode={mode}
      context={context}
      activeTables={activeTables}
      currentOrderId={order?.id}
      resumeId={resumeId}
      error={error}
      busy={busy}
      onChange={(next) => {
        setContext(next);
        setError('');
      }}
      onFulfillment={selectFulfillment}
      onTable={(table, occupied) => {
        setContext((current) => ({ ...current, fulfillment: 'dine-in', table }));
        setResumeId(occupied?.id ?? '');
        setError('');
      }}
      onSubmit={submit}
    />
  );

  return (
    <>
      <Popover
        open={open && !narrow}
        onOpenChange={onOpenChange}
        label={title}
        className="pos-context-popover"
        trigger={(props) => (
          <ContextTrigger
            {...props}
            expanded={open}
            disabled={mode === 'edit' && !canEdit}
            narrow={narrow}
            label={contextSummary(order, t)}
            onClick={() => onOpenChange(!open)}
          />
        )}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  mode === 'new'
                    ? 'Choose how this order will be served.'
                    : 'Draft changes apply to this order only.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t('Close')}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
            >
              <X size={17} />
            </button>
          </div>
        </div>
        {content}
      </Popover>
      <Dialog
        open={open && narrow}
        onOpenChange={onOpenChange}
        title={title}
        description={t(
          mode === 'new'
            ? 'Choose how this order will be served.'
            : 'Draft changes apply to this order only.',
        )}
        closeLabel={t('Close')}
        className="pos-context-dialog"
      >
        {content}
      </Dialog>
    </>
  );
}

function ContextTrigger({
  expanded,
  disabled,
  narrow,
  label,
  onClick,
  ...triggerProps
}: PopoverTriggerProps & {
  expanded: boolean;
  disabled: boolean;
  narrow: boolean;
  label: string;
}) {
  const { t } = useLocale();
  return (
    <button
      {...triggerProps}
      aria-label={`${t('Order type')}: ${label}`}
      aria-expanded={expanded}
      aria-controls={narrow ? undefined : triggerProps['aria-controls']}
      disabled={disabled}
      title={disabled ? t('Order details lock after items are sent or payment begins.') : undefined}
      onClick={onClick}
      className="flex min-h-11 items-center gap-2 rounded-xl border border-primary/25 bg-accent px-3 text-start text-xs font-semibold text-foreground hover:border-primary/50"
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        {label.startsWith(t('Dine in')) ? (
          <Utensils size={14} />
        ) : label.startsWith(t('Delivery')) ? (
          <MapPin size={14} />
        ) : (
          <ShoppingBag size={14} />
        )}
      </span>
      <span className="max-w-40 truncate">{label}</span>
      <ChevronDown
        size={14}
        className={cn('shrink-0 transition-transform', expanded && 'rotate-180')}
      />
    </button>
  );
}

function ContextForm({
  mode,
  context,
  activeTables,
  currentOrderId,
  resumeId,
  error,
  busy,
  onChange,
  onFulfillment,
  onTable,
  onSubmit,
}: {
  mode: OrderContextMode;
  context: OrderContext;
  activeTables: Map<number, DemoOrder>;
  currentOrderId: string | undefined;
  resumeId: string;
  error: string;
  busy: boolean;
  onChange: (context: OrderContext) => void;
  onFulfillment: (fulfillment: OrderContext['fulfillment']) => void;
  onTable: (table: number, occupied?: DemoOrder) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLocale();
  const modes = [
    { id: 'dine-in' as const, label: 'Dine in', icon: Utensils },
    { id: 'takeaway' as const, label: 'Takeaway', icon: ShoppingBag },
    { id: 'delivery' as const, label: 'Delivery', icon: MapPin },
  ];
  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('Fulfillment type')}>
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-pressed={context.fulfillment === id}
            onClick={() => onFulfillment(id)}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold',
              context.fulfillment === id
                ? 'border-primary bg-accent text-primary'
                : 'border-border hover:bg-secondary',
            )}
          >
            <Icon size={17} />
            {t(label)}
          </button>
        ))}
      </div>

      {context.fulfillment === 'dine-in' && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t('Choose a table')}</legend>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((table) => {
              const occupied = activeTables.get(table);
              const isCurrent = occupied?.id === currentOrderId;
              const isSelected = context.table === table;
              const isLocked = mode === 'edit' && occupied && !isCurrent;
              return (
                <button
                  type="button"
                  key={table}
                  disabled={!!isLocked}
                  aria-pressed={isSelected}
                  onClick={() => onTable(table, occupied)}
                  className={cn(
                    'flex min-h-12 items-center justify-between rounded-lg border px-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-secondary',
                  )}
                  title={
                    occupied && !isCurrent ? `${t('Open session')} #${occupied.number}` : undefined
                  }
                >
                  <span>#{String(table).padStart(2, '0')}</span>
                  {isSelected ? (
                    <Check size={14} />
                  ) : occupied && !isCurrent ? (
                    <span className="text-[9px]">{t('Open')}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {resumeId
              ? t('This table already has an open session. Continue that order.')
              : t('Occupied tables resume their existing session; they cannot be reassigned.')}
          </p>
        </fieldset>
      )}

      {context.fulfillment === 'takeaway' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            {t('Customer name')}{' '}
            <span className="font-normal text-muted-foreground">{t('Optional')}</span>
            <Input
              autoComplete="name"
              value={context.customerName}
              onChange={(event) => onChange({ ...context, customerName: event.target.value })}
              placeholder={t('Walk-in customer')}
              className="mt-1.5 h-11 bg-background"
            />
          </label>
          <label className="block text-sm font-medium">
            {t('Pickup reference')}{' '}
            <span className="font-normal text-muted-foreground">{t('Optional')}</span>
            <Input
              value={context.reference}
              onChange={(event) => onChange({ ...context, reference: event.target.value })}
              placeholder={t('e.g. order name or number')}
              className="mt-1.5 h-11 bg-background"
            />
          </label>
        </div>
      )}

      {context.fulfillment === 'delivery' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            {t('Customer name')}
            <Input
              autoComplete="name"
              required
              value={context.customerName}
              onChange={(event) => onChange({ ...context, customerName: event.target.value })}
              placeholder={t('Full name')}
              className="mt-1.5 h-11 bg-background"
            />
          </label>
          <label className="block text-sm font-medium">
            {t('Phone number')}
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={context.customerPhone}
              onChange={(event) => onChange({ ...context, customerPhone: event.target.value })}
              placeholder={t('Customer phone')}
              className="mt-1.5 h-11 bg-background"
            />
          </label>
          <label className="block text-sm font-medium">
            {t('Delivery address')}
            <Textarea
              required
              autoComplete="street-address"
              value={context.deliveryAddress}
              onChange={(event) => onChange({ ...context, deliveryAddress: event.target.value })}
              placeholder={t('Street, building, floor, and area')}
              className="mt-1.5 min-h-20 bg-background"
            />
          </label>
          <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5 text-xs">
            <span>{t('Delivery fee')}</span>
            <span className="font-medium">{t('Not configured in this preview')}</span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      )}
      <PreviewButton variant="solid" className="h-12 w-full" disabled={busy} type="submit">
        {resumeId
          ? t('Resume open table')
          : t(mode === 'new' ? 'Start order' : 'Apply order details')}
        <ChevronDown size={15} className="ms-auto -rotate-90 rtl:rotate-90" />
      </PreviewButton>
    </form>
  );
}

function contextSummary(order: DemoOrder | undefined, t: (key: string) => string) {
  if (!order) return t('New order');
  if (order.fulfillment === 'dine-in')
    return `${t('Dine in')} · #${String(order.table).padStart(2, '0')}`;
  if (order.fulfillment === 'delivery')
    return `${t('Delivery')} · ${order.customerName || t('Walk-in customer')}`;
  return `${t('Takeaway')}${order.customerName ? ` · ${order.customerName}` : ''}`;
}
