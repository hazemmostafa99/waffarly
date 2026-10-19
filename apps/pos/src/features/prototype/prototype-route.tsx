import { useMoney } from './use-money.js';
import '@waffarly/ui/pos-theme.css';
import './prototype.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, Input, Popover, useLocale, cn } from '@waffarly/ui';
import {
  ArrowUpRight,
  ChefHat,
  CircleHelp,
  Coffee,
  Grid2X2,
  LayoutGrid,
  Moon,
  Plus,
  Palette,
  ReceiptText,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sun,
  Wifi,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  categories,
  products,
  prototypeKeys,
  type Category,
  type Product,
} from './prototype-data.js';
import {
  advanceKitchen,
  confirmRound,
  createOrder,
  finishOrder,
  readCatalog,
  readOrders,
  updateOrderContext,
} from './prototype-api.js';
import { draftLine, type DemoOrder, type DraftLine, type OrderContext } from './prototype-model.js';
import { usePosAppearanceStore, type PosAccent } from '../../app/pos-appearance-store.js';
import { usePrototypeStore } from './prototype.store.js';
import { FoodArt } from './food-art.js';
import { CheckoutDialog, ConfigureDialog, SplitDialog } from './prototype-dialogs.js';
import { OrderPanel } from './order-panel.js';
import { KitchenView, OrdersView, TablesView } from './workspace-views.js';
import { PreviewButton } from './prototype-ui.js';
import { OrderContextPicker, type OrderContextMode } from './components/order-context-picker.js';

type View = 'sell' | 'tables' | 'orders' | 'kitchen';
type Command =
  | { type: 'new'; context: OrderContext }
  | { type: 'context'; orderId: string; context: OrderContext }
  | { type: 'table'; table: number }
  | { type: 'send'; orderId: string; lines: DraftLine[] }
  | { type: 'kitchen' | 'handover'; orderId: string };
const emptyDrafts: DraftLine[] = [];

export function Component() {
  const { t, locale, setLocale } = useLocale();
  const money = useMoney();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const requestedView = params.get('view') ?? 'sell';
  const view: View = ['sell', 'tables', 'orders', 'kitchen'].includes(requestedView)
    ? (requestedView as View)
    : 'sell';
  const search = params.get('search') ?? '';
  const requestedCategory = params.get('category') ?? 'All items';
  const category = categories.includes(requestedCategory as Category)
    ? (requestedCategory as Category)
    : 'All items';
  const setFilter = (name: string, value: string) =>
    setParams(
      (current) => {
        current.set(name, value);
        return current;
      },
      { replace: true },
    );
  const theme = usePosAppearanceStore((state) => state.theme);
  const setTheme = usePosAppearanceStore((state) => state.setTheme);
  const accent = usePosAppearanceStore((state) => state.accent);
  const setAccent = usePosAppearanceStore((state) => state.setAccent);
  const activeId = usePrototypeStore((state) => state.orderId);
  const selectOrder = usePrototypeStore((state) => state.selectOrder);
  const drafts = usePrototypeStore((state) => state.drafts[state.orderId] ?? emptyDrafts);
  const allDrafts = usePrototypeStore((state) => state.drafts);
  const addLine = usePrototypeStore((state) => state.addLine);
  const replaceLine = usePrototypeStore((state) => state.replaceLine);
  const clearDraft = usePrototypeStore((state) => state.clearDraft);
  const searchInput = useRef<HTMLInputElement>(null);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [configuration, setConfiguration] = useState<{
    product: Product;
    initial?: DraftLine;
  } | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [split, setSplit] = useState(false);
  const [help, setHelp] = useState(false);
  const [shift, setShift] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [mobileCart, setMobileCart] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(true);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextMode, setContextMode] = useState<OrderContextMode>('edit');
  const [accentOpen, setAccentOpen] = useState(false);
  const catalogQuery = useQuery({
    queryKey: prototypeKeys.catalog,
    queryFn: readCatalog,
    staleTime: Infinity,
  });
  const ordersQuery = useQuery({
    queryKey: prototypeKeys.orders,
    queryFn: readOrders,
    staleTime: Infinity,
  });
  const orders = ordersQuery.data ?? [];
  const order = orders.find((item) => item.id === activeId) ?? orders[0];
  const activeOrders = orders.filter((item) => !item.complete);
  const selectedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const title = document.title;
    document.title = 'Waffarly · POS design preview';
    return () => {
      document.title = title;
    };
  }, []);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        view === 'sell' &&
        !(
          event.target instanceof HTMLElement &&
          (event.target.closest('input,textarea,select,dialog') || event.target.isContentEditable)
        )
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [view]);

  const command = useMutation({
    mutationFn: async (action: Command) => {
      if (action.type === 'new') return createOrder(action.context);
      if (action.type === 'context') return updateOrderContext(action.orderId, action.context);
      if (action.type === 'table') return createOrder(action.table);
      if (action.type === 'send') return confirmRound(action.orderId, action.lines);
      if (action.type === 'kitchen') return advanceKitchen(action.orderId);
      return finishOrder(action.orderId);
    },
    onSuccess: (result, action) => {
      client.setQueryData<DemoOrder[]>(prototypeKeys.orders, (current = []) =>
        current.some((item) => item.id === result.id)
          ? current.map((item) => (item.id === result.id ? result : item))
          : [...current, result],
      );
      if (action.type === 'new' || action.type === 'table') {
        selectOrder(result.id);
        setFilter('view', 'sell');
        setMobileCart(false);
        setContextOpen(false);
        setContextMode('edit');
      }
      if (action.type === 'context') {
        setFeedback('Order details updated in this preview.');
        setContextOpen(false);
      }
      if (action.type === 'send') {
        clearDraft();
        setFeedback('New items sent to the sample kitchen.');
      }
      if (action.type === 'handover') setFeedback('Order completed. The table is available again.');
    },
  });
  const visibleProducts = (catalogQuery.data ?? []).filter(
    (product) =>
      (category === 'All items' || product.category === category) &&
      (!search ||
        `${product.name} ${t(product.name)}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())) &&
      (showUnavailable || !product.unavailable),
  );
  const nav = [
    { view: 'sell' as const, label: 'Sell', icon: ShoppingBag },
    { view: 'tables' as const, label: 'Tables', icon: Grid2X2 },
    { view: 'orders' as const, label: 'Orders', icon: ReceiptText },
    { view: 'kitchen' as const, label: 'Kitchen', icon: ChefHat },
  ];
  const openOrder = (next: DemoOrder) => {
    selectOrder(next.id);
    setFilter('view', 'sell');
    setMobileCart(false);
  };
  const openNewContext = () => {
    setContextMode('new');
    setContextOpen(true);
  };
  const openEditContext = () => {
    setContextMode('edit');
    setContextOpen(true);
  };
  const closeContext = () => {
    setContextOpen(false);
    setContextMode('edit');
  };

  return (
    <div className="pos-theme pos-prototype" data-theme={selectedTheme} data-accent={accent}>
      <a href="#prototype-main" className="skip-link">
        {t('Skip to content')}
      </a>
      <div
        className="flex h-[30px] items-center justify-center gap-2 border-b border-border bg-[var(--pos-note)] px-3 text-center text-[10px] font-medium tracking-wide text-[var(--pos-note-ink)]"
        data-print-hidden
      >
        <span className="size-1.5 shrink-0 rounded-full bg-current" />
        {t('DESIGN PREVIEW · Sample orders only. No real payments.')}
        <Link to="/" className="ms-3 hidden items-center gap-1 underline sm:inline-flex">
          {t('Live POS')}
          <ArrowUpRight size={10} />
        </Link>
      </div>
      <div className="prototype-body flex min-h-[calc(100dvh-30px)]" data-print-hidden>
        <nav
          aria-label={t('POS navigation')}
          className="flex w-[76px] shrink-0 flex-col items-center border-e border-border bg-[var(--pos-rail)] py-5 sm:w-[90px]"
          data-print-hidden
        >
          <Link
            to="/prototype"
            aria-label={t('Waffarly design preview')}
            className="mb-8 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          >
            <svg width="27" height="27" viewBox="0 0 28 28" aria-hidden="true">
              <rect
                x="2"
                y="2"
                width="24"
                height="24"
                rx="7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="M9 3v22m10-22v22M3 9h22M3 19h22" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Link>
          <div className="flex w-full flex-col gap-3 px-2">
            {nav.map((item) => (
              <button
                type="button"
                key={item.view}
                onClick={() => {
                  setFilter('view', item.view);
                  setMobileCart(false);
                  setFeedback('');
                }}
                aria-current={view === item.view ? 'page' : undefined}
                className={cn(
                  'flex min-h-[67px] flex-col items-center justify-center gap-2 rounded-xl px-1 text-[11px] font-medium transition-colors',
                  view === item.view
                    ? 'bg-[var(--pos-active)] text-[var(--pos-active-ink)]'
                    : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                <item.icon size={21} strokeWidth={1.6} />
                {t(item.label)}
              </button>
            ))}
          </div>
          <div className="mt-auto flex flex-col items-center gap-4 pt-8">
            <button
              type="button"
              aria-label={t('Preview help')}
              className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={21} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label={t('Sample shift')}
              onClick={() => setShift(true)}
              className="flex size-10 items-center justify-center rounded-full border-4 border-card bg-[var(--pos-peach)] text-xs font-semibold text-[var(--pos-art-ink)]"
            >
              HK
            </button>
            <span className="hidden text-[9px] uppercase tracking-wide text-muted-foreground sm:block">
              {t('Shift open')}
            </span>
          </div>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3 xl:px-7"
            data-print-hidden
          >
            <div className="flex items-center gap-3">
              <span className="hidden size-9 items-center justify-center rounded-lg border border-border sm:flex">
                <LayoutGrid size={17} strokeWidth={1.6} />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {t('Maadi branch')}{' '}
                  <span className="mx-2 font-normal text-muted-foreground">/</span>
                  <span className="font-normal text-muted-foreground">{t('Register 01')}</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t('Sample workspace · Hana K.')}
                </p>
              </div>
              <OrderContextPicker
                open={contextOpen}
                mode={contextMode}
                {...(order ? { order } : {})}
                orders={orders}
                busy={command.isPending}
                canEdit={
                  !!order && !order.complete && !order.lines.length && !order.payments.length
                }
                onOpenChange={(open) => (open ? setContextOpen(true) : closeContext())}
                onApply={(context) => {
                  if (contextMode === 'new') command.mutate({ type: 'new', context });
                  else if (order) command.mutate({ type: 'context', orderId: order.id, context });
                }}
                onResume={openOrder}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="me-3 hidden items-center gap-1.5 text-[11px] text-success xl:inline-flex">
                <Wifi size={13} />
                {t('Local preview')}
              </span>
              <div className="flex h-10 items-center gap-1 rounded-lg border border-border px-2">
                {selectedTheme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                <select
                  aria-label={t('Theme')}
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as 'light' | 'dark' | 'system')}
                  className="max-w-24 bg-transparent text-xs"
                >
                  <option value="light">{t('Light')}</option>
                  <option value="dark">{t('Dark')}</option>
                  <option value="system">{t('System')}</option>
                </select>
              </div>
              <Popover
                open={accentOpen}
                onOpenChange={setAccentOpen}
                label={t('POS accent preview')}
                className="w-[min(320px,calc(100vw-24px))]"
                trigger={(props) => (
                  <button
                    {...props}
                    aria-label={t('POS accent preview')}
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-secondary"
                  >
                    <Palette size={15} />
                    <span className="hidden sm:inline">{t('Accent')}</span>
                    <span className="size-3.5 rounded-full bg-primary ring-2 ring-background ring-offset-1 ring-offset-border" />
                  </button>
                )}
              >
                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="text-sm font-semibold">{t('Merchant accent')}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('Local appearance preview. This does not save merchant settings.')}
                    </p>
                  </div>
                  <div
                    role="group"
                    aria-label={t('Accent color')}
                    className="grid grid-cols-2 gap-2"
                  >
                    {(
                      [
                        ['orange', 'Orange', '#bf4c0d'],
                        ['plum', 'Plum', '#7939a4'],
                        ['teal', 'Teal', '#0d766c'],
                        ['blue', 'Blue', '#285fc1'],
                      ] as const
                    ).map(([id, label, color]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={accent === id}
                        onClick={() => setAccent(id as PosAccent)}
                        className={cn(
                          'flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm',
                          accent === id
                            ? 'border-primary bg-accent font-semibold'
                            : 'border-border',
                        )}
                      >
                        <span className="size-4 rounded-full" style={{ backgroundColor: color }} />
                        {t(label)}
                        {accent === id && (
                          <span aria-hidden="true" className="ms-auto text-primary">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </Popover>
              <button
                type="button"
                onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
                className="min-h-10 rounded-lg border border-border px-3 text-xs font-medium"
                aria-label={t('Switch language')}
              >
                {locale === 'en' ? 'العربية' : 'English'}
              </button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <main
              id="prototype-main"
              tabIndex={-1}
              className={cn(
                'order-scroll min-w-0 flex-1 overflow-y-auto pb-20 lg:pb-0',
                mobileCart && 'hidden lg:block',
              )}
              data-print-hidden
            >
              {command.error && (
                <p
                  role="alert"
                  className="m-5 rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive"
                >
                  {t(command.error.message)}
                </p>
              )}
              <div
                role="status"
                aria-live="polite"
                className={cn(
                  feedback
                    ? 'mx-5 mt-3 flex items-center justify-between rounded-lg bg-accent px-3 py-2 text-xs'
                    : 'sr-only',
                )}
              >
                {feedback && t(feedback)}
                {feedback && (
                  <button
                    type="button"
                    aria-label={t('Dismiss message')}
                    onClick={() => setFeedback('')}
                    className="flex size-8 items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {view === 'sell' && (
                <div className="p-5 xl:p-7">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1>{t('Menu')}</h1>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('Search, customize, and add to the current order.')}
                      </p>
                    </div>
                    <PreviewButton onClick={openNewContext} disabled={command.isPending}>
                      <Plus size={16} />
                      {t('New order')}
                    </PreviewButton>
                  </div>
                  <div className="mb-5 flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Search
                        size={17}
                        className="pointer-events-none absolute start-3 top-3.5 text-muted-foreground"
                      />
                      <Input
                        ref={searchInput}
                        aria-label={t('Search menu')}
                        placeholder={t('Search by item name')}
                        value={search}
                        onChange={(event) => setFilter('search', event.target.value)}
                        className="h-11 rounded-xl bg-card ps-10 pe-10"
                      />
                      <kbd className="absolute end-3 top-3 rounded border border-border px-1.5 text-xs text-muted-foreground">
                        /
                      </kbd>
                    </div>
                    <PreviewButton
                      size="icon"
                      aria-label={t('Toggle unavailable items')}
                      aria-pressed={!showUnavailable}
                      onClick={() => setShowUnavailable(!showUnavailable)}
                    >
                      <SlidersHorizontal size={17} />
                    </PreviewButton>
                  </div>
                  <div
                    className="category-scroll mb-4 flex gap-2 overflow-x-auto pb-1"
                    aria-label={t('Menu categories')}
                  >
                    {categories.map((item) => (
                      <button
                        type="button"
                        key={item}
                        aria-pressed={category === item}
                        onClick={() => setFilter('category', item)}
                        className={cn(
                          'flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-xs font-medium',
                          category === item
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {item === 'All items' ? (
                          <LayoutGrid size={14} />
                        ) : item === 'Coffee' ? (
                          <Coffee size={14} />
                        ) : null}
                        {t(item)}
                        <span className="text-[10px] opacity-60">
                          {item === 'All items'
                            ? products.length
                            : products.filter((product) => product.category === item).length}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                      {t(category === 'All items' ? 'All menu items' : category)}
                    </h2>
                    <span className="text-[11px] text-muted-foreground">
                      {visibleProducts.length} {t('items')}
                    </span>
                  </div>
                  {(catalogQuery.isPending || ordersQuery.isPending) && (
                    <p role="status" className="py-12 text-center text-sm text-muted-foreground">
                      {t('Loading sample workspace…')}
                    </p>
                  )}
                  {catalogQuery.error && <p role="alert">{t('Could not load sample items.')}</p>}
                  <div
                    data-testid="product-grid"
                    className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 min-[800px]:grid-cols-3 min-[1200px]:grid-cols-4 min-[1800px]:grid-cols-5"
                  >
                    {visibleProducts.map((product) => {
                      const quantity = drafts
                        .filter((line) => line.productId === product.id)
                        .reduce((sum, line) => sum + line.quantity, 0);
                      return (
                        <button
                          type="button"
                          key={product.id}
                          aria-label={`${t('Add item')}: ${t(product.name)}`}
                          disabled={product.unavailable || order?.complete}
                          onClick={() =>
                            product.configurable
                              ? setConfiguration({ product })
                              : addLine(draftLine(product.id))
                          }
                          className={cn(
                            'product-card relative overflow-hidden rounded-xl border border-border bg-card text-start disabled:opacity-55',
                            quantity > 0 && 'border-primary',
                          )}
                        >
                          <div
                            className="relative h-24 p-1 text-[var(--pos-art-ink)]"
                            style={{ background: `var(--pos-${product.tone})` }}
                          >
                            <FoodArt kind={product.kind} chocolate={product.id === 'chocolate'} />
                            {product.unavailable && (
                              <span className="absolute start-3 top-3 rounded-md bg-card/95 px-2 py-1 text-[10px] font-semibold text-foreground">
                                {t('Sold out')}
                              </span>
                            )}
                            {quantity > 0 && (
                              <span className="absolute end-3 top-3 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                {quantity}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="text-[13px] font-semibold leading-5">
                              {t(product.name)}
                            </h3>
                            <p className="mt-1 min-h-7 text-[10px] leading-[14px] text-muted-foreground">
                              {t(product.description)}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <strong className="text-[13px] tabular-nums">
                                {money(product.cents)}
                              </strong>
                              <span
                                className={cn(
                                  'flex size-9 items-center justify-center rounded-lg',
                                  quantity > 0
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary',
                                )}
                              >
                                <Plus size={17} />
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!visibleProducts.length && !catalogQuery.isPending && (
                    <div className="py-16 text-center">
                      <Search size={28} className="mx-auto mb-3 text-muted-foreground" />
                      <h2 className="font-medium">{t('No matching items')}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t('Try another name or category.')}
                      </p>
                      <PreviewButton
                        className="mt-4"
                        onClick={() => {
                          setParams({ view: 'sell' });
                        }}
                      >
                        {t('Clear filters')}
                      </PreviewButton>
                    </div>
                  )}
                </div>
              )}
              {view === 'tables' && (
                <TablesView
                  orders={orders}
                  onSelect={(table) => command.mutate({ type: 'table', table })}
                />
              )}
              {view === 'orders' && <OrdersView orders={orders} onSelect={openOrder} />}
              {view === 'kitchen' && (
                <KitchenView
                  orders={orders}
                  busy={command.isPending}
                  onAdvance={(orderId) => command.mutate({ type: 'kitchen', orderId })}
                />
              )}
            </main>
            {order && view === 'sell' && (
              <div
                className={cn('min-h-0 shrink-0 flex-col lg:flex', mobileCart ? 'flex' : 'hidden')}
              >
                <div className="p-3 lg:hidden">
                  <PreviewButton onClick={() => setMobileCart(false)}>
                    {t('Back to menu')}
                  </PreviewButton>
                </div>
                <OrderPanel
                  order={order}
                  drafts={drafts}
                  busy={command.isPending}
                  onSend={() => command.mutate({ type: 'send', orderId: order.id, lines: drafts })}
                  onCheckout={() => setCheckout(true)}
                  onSplit={() => setSplit(true)}
                  onEdit={(line) =>
                    setConfiguration({
                      product: products.find((product) => product.id === line.productId)!,
                      initial: line,
                    })
                  }
                  onNew={openNewContext}
                  onEditContext={openEditContext}
                  contextEditable={
                    !!order && !order.complete && !order.lines.length && !order.payments.length
                  }
                  onHandover={() => command.mutate({ type: 'handover', orderId: order.id })}
                />
              </div>
            )}
          </div>
          <footer
            className="category-scroll flex min-h-[61px] items-center gap-2 overflow-x-auto border-t border-border bg-card px-4 py-2"
            aria-label={t('Running orders')}
            data-print-hidden
          >
            <span className="me-2 hidden shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground xl:block">
              {t('Running orders')}
            </span>
            {activeOrders.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => openOrder(item)}
                className={cn(
                  'flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs',
                  item.id === order?.id ? 'border-primary bg-accent' : 'border-border',
                )}
              >
                <span className="flex size-6 items-center justify-center rounded bg-secondary text-[10px] font-semibold">
                  {item.table ? `T${item.table}` : <ShoppingBag size={12} />}
                </span>
                <span className="font-medium">
                  {item.table ? `${t('Table')} ${item.table}` : `${t('Draft')} #${item.number}`}
                </span>
                <span className="text-muted-foreground">
                  {(allDrafts[item.id] ?? []).length > 0 ? t('Unsent items') : t('In progress')}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMobileCart(!mobileCart)}
              className={cn(
                'fixed bottom-3 end-4 z-20 ms-auto min-h-11 shrink-0 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-lg lg:hidden',
                (mobileCart || view !== 'sell') && 'hidden',
              )}
            >
              {t(mobileCart ? 'Menu' : 'View order')} · {drafts.length + (order?.lines.length ?? 0)}
            </button>
          </footer>
        </div>
      </div>
      {configuration && (
        <ConfigureDialog
          key={configuration.initial?.id ?? configuration.product.id}
          product={configuration.product}
          {...(configuration.initial ? { initial: configuration.initial } : {})}
          onClose={() => setConfiguration(null)}
          onAdd={(line) => {
            if (configuration.initial) replaceLine(line);
            else addLine(line);
            setFeedback('Item added to the current draft.');
          }}
        />
      )}
      {split && order && <SplitDialog order={order} onClose={() => setSplit(false)} />}
      {order && (
        <CheckoutDialog
          key={order.id}
          order={order}
          open={checkout}
          onClose={() => setCheckout(false)}
        />
      )}
      <Dialog
        open={help}
        onOpenChange={setHelp}
        title={t('Try the workspace')}
        description={t('An isolated design preview. Reload resets all sample orders.')}
        closeLabel={t('Close')}
      >
        <div className="space-y-4 p-6 text-sm">
          <p>
            {t('Add an item, send a round, split the bill, then try cash and terminal payments.')}
          </p>
          <p>
            {t(
              'Open Kitchen to advance preparation. A table is released only after all checks are paid and handover is confirmed.',
            )}
          </p>
          <p>
            {t(
              'Use the checkout interruption option to preview payment-result recovery without collecting twice.',
            )}
          </p>
          <p className="rounded-lg bg-secondary p-3">
            {t('No live API, stock movements, fiscal invoices or payment providers are connected.')}
          </p>
          <PreviewButton variant="solid" className="w-full" onClick={() => setHelp(false)}>
            {t('Got it')}
          </PreviewButton>
        </div>
      </Dialog>
      <Dialog
        open={shift}
        onOpenChange={setShift}
        title={t('Sample shift')}
        description={t('Register 01 · Hana K. · Preview only')}
        closeLabel={t('Close')}
      >
        <div className="space-y-4 p-6 text-sm">
          <div className="flex justify-between">
            <span>{t('Opening float')}</span>
            <strong>{money(100000)}</strong>
          </div>
          <div className="flex justify-between">
            <span>{t('Sample cash collected')}</span>
            <strong>
              {money(
                orders
                  .flatMap((item) => item.payments)
                  .filter((item) => item.method === 'cash')
                  .reduce((sum, item) => sum + item.cents, 0),
              )}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>{t('Sample terminal collected')}</span>
            <strong>
              {money(
                orders
                  .flatMap((item) => item.payments)
                  .filter((item) => item.method === 'terminal')
                  .reduce((sum, item) => sum + item.cents, 0),
              )}
            </strong>
          </div>
          <p className="rounded-lg bg-secondary p-3 text-muted-foreground">
            {t(
              'Shift opening, closing and reconciliation will be connected in their implementation milestones.',
            )}
          </p>
        </div>
      </Dialog>
    </div>
  );
}
