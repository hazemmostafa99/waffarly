import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PosEmployeeSession,
  PosOrderPaymentStateResponse,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import { Dialog, Input, useLocale } from '@waffarly/ui';
import { ClipboardList, Printer, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PosButton } from '../../components/pos-button.js';
import { getPosOrderNumber } from '../orders/pos-order-number.js';
import { listPosSales, posOrderKeys, type PosSalesFilters } from '../orders/pos-orders.api.js';
import { getPosOrderPaymentState, posPaymentStateKey } from '../payments/pos-payments.api.js';
import { PosReceiptView } from './pos-receipt-view.js';
import { listPosReceipts, posReceiptHistoryKey } from './pos-receipts.api.js';

const orderStatuses: StorefrontOrderSummary['status'][] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'rejected',
  'cancelled',
];

export function PosOrdersScreen() {
  const { employee } = useOutletContext<{ employee: PosEmployeeSession }>();
  return employee.permissions.includes('sell') ? (
    <PosOrderHistoryScreen employee={employee} />
  ) : (
    <PosReceiptHistoryScreen employee={employee} />
  );
}

function PosOrderHistoryScreen({ employee }: { employee: PosEmployeeSession }) {
  const { t, errorText, formatNumber } = useLocale();
  const queryClient = useQueryClient();
  const selectedBranchId = employee.branch.id;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StorefrontOrderSummary['status'] | ''>('');
  const [fulfillmentType, setFulfillmentType] = useState<PosSalesFilters['fulfillmentType'] | ''>(
    '',
  );
  const [settlement, setSettlement] = useState<PosSalesFilters['settlement'] | ''>('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<StorefrontOrderSummary | null>(null);
  const [receiptLoadingOrderId, setReceiptLoadingOrderId] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<{ orderId: string; checkId: string } | null>(
    null,
  );
  const dateRangeInvalid = Boolean(createdFrom && createdTo && createdFrom > createdTo);
  const filters = useMemo<PosSalesFilters>(() => {
    const from = toLocalDateBoundary(createdFrom, false);
    const to = toLocalDateBoundary(createdTo, true);
    return {
      ...(status ? { status } : {}),
      ...(fulfillmentType ? { fulfillmentType } : {}),
      ...(settlement ? { settlement } : {}),
      ...(from ? { createdFrom: from } : {}),
      ...(to ? { createdTo: to } : {}),
    };
  }, [createdFrom, createdTo, fulfillmentType, settlement, status]);
  const ordersQuery = useInfiniteQuery({
    queryKey: [
      ...posOrderKeys.branch(employee.merchantId, selectedBranchId),
      'history',
      search.trim(),
      filters,
    ],
    queryFn: ({ pageParam, signal }) =>
      listPosSales(selectedBranchId, 'history', search.trim(), pageParam, signal, filters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(selectedBranchId) && !dateRangeInvalid,
    staleTime: 15_000,
  });
  const orders = useMemo(
    () => ordersQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [ordersQuery.data],
  );
  const dateLocale = document.documentElement.lang || undefined;
  const hasFilters = Boolean(
    search.trim() || status || fulfillmentType || settlement || createdFrom || createdTo,
  );

  function clearFilters() {
    setSearch('');
    setStatus('');
    setFulfillmentType('');
    setSettlement('');
    setCreatedFrom('');
    setCreatedTo('');
  }

  async function openLatestOrderReceipt(order: StorefrontOrderSummary) {
    setReceiptLoadingOrderId(order.id);
    try {
      const paymentState = await queryClient.fetchQuery({
        queryKey: posPaymentStateKey(employee.merchantId, order.id),
        queryFn: ({ signal }) => getPosOrderPaymentState(order.id, signal),
        staleTime: 15_000,
      });
      const receipts = paymentState.checks.filter((check) => check.receipt);
      if (receipts.length === 1) {
        setActiveReceipt({ orderId: order.id, checkId: receipts[0]!.id });
        return;
      }
      setSelectedOrder(order);
    } catch {
      setSelectedOrder(order);
    } finally {
      setReceiptLoadingOrderId(null);
    }
  }

  if (activeReceipt) {
    return (
      <PosReceiptView
        merchantId={employee.merchantId}
        employeeId={employee.id}
        branchId={selectedBranchId}
        requiresApproval={!employee.permissions.includes('approve_refunds')}
        canRecordItemReturn={employee.permissions.includes('sell')}
        orderId={activeReceipt.orderId}
        checkId={activeReceipt.checkId}
        backLabel="Back to orders"
        onBack={() => setActiveReceipt(null)}
      />
    );
  }

  return (
    <section
      aria-labelledby="pos-orders-history-heading"
      className="min-h-full space-y-3 p-3 md:p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id="pos-orders-history-heading" className="text-base font-semibold">
            {t('Orders')}
          </h2>
          <span className="text-[11px] text-muted-foreground">
            {t('Orders shown')}: {formatNumber(orders.length)}
          </span>
        </div>
        {hasFilters && (
          <PosButton type="button" size="sm" variant="outline" onClick={clearFilters}>
            {t('Clear filters')}
          </PosButton>
        )}
      </header>

      <div className="grid gap-2">
        <div className="flex min-w-0 gap-2">
          <label className="relative block min-w-0 flex-1">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Search order number, customer or table')}
              aria-label={t('Search order number, customer or table')}
              className="min-h-10 ps-9"
            />
          </label>
          <PosButton
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10 shrink-0 gap-2"
            onClick={() => void ordersQuery.refetch()}
            disabled={!selectedBranchId || ordersQuery.isFetching || dateRangeInvalid}
          >
            <RefreshCw
              aria-hidden="true"
              size={15}
              className={ordersQuery.isFetching ? 'animate-spin' : undefined}
            />
            {ordersQuery.isFetching ? t('Refreshing…') : t('Refresh')}
          </PosButton>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground">
            {t('Order status')}
            <select
              className="min-h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as StorefrontOrderSummary['status'] | '')
              }
            >
              <option value="">{t('All statuses')}</option>
              {orderStatuses.map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground">
            {t('Order type')}
            <select
              className="min-h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
              value={fulfillmentType}
              onChange={(event) =>
                setFulfillmentType(event.target.value as PosSalesFilters['fulfillmentType'] | '')
              }
            >
              <option value="">{t('All order types')}</option>
              <option value="dine_in">{t('Dine in')}</option>
              <option value="takeaway">{t('Takeaway')}</option>
              <option value="delivery">{t('Delivery')}</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground">
            {t('Settlement')}
            <select
              className="min-h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
              value={settlement}
              onChange={(event) =>
                setSettlement(event.target.value as PosSalesFilters['settlement'] | '')
              }
            >
              <option value="">{t('Any settlement')}</option>
              <option value="open">{t('Open balance')}</option>
              <option value="settled">{t('Settled')}</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground">
            {t('From date')}
            <Input
              type="date"
              value={createdFrom}
              max={createdTo || undefined}
              onChange={(event) => setCreatedFrom(event.target.value)}
              className="min-h-9 px-2 text-xs"
            />
          </label>
          <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground">
            {t('To date')}
            <Input
              type="date"
              value={createdTo}
              min={createdFrom || undefined}
              onChange={(event) => setCreatedTo(event.target.value)}
              className="min-h-9 px-2 text-xs"
            />
          </label>
        </div>
      </div>

      {dateRangeInvalid && (
        <p
          className="m-0 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
          role="alert"
        >
          {t('The end date must be on or after the start date.')}
        </p>
      )}

      {ordersQuery.error && (
        <p
          className="m-0 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
          role="alert"
        >
          {errorText(
            ordersQuery.error instanceof Error
              ? ordersQuery.error.message
              : t('Could not load orders.'),
          )}
        </p>
      )}

      {ordersQuery.isLoading ? (
        <div className="grid gap-1.5" role="status" aria-label={t('Loading orders…')}>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              aria-hidden="true"
              className="min-h-16 animate-pulse rounded-lg border border-border bg-card p-2"
            >
              <div className="h-3 w-36 rounded bg-muted" />
              <div className="mt-2 h-3 w-52 max-w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : !ordersQuery.error && orders.length === 0 ? (
        <div className="grid min-h-32 justify-items-center content-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-5 text-center">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <ClipboardList size={16} aria-hidden="true" />
          </span>
          <strong className="text-sm">
            {t(hasFilters ? 'No matching orders' : 'No orders yet')}
          </strong>
          <span className="text-xs text-muted-foreground">
            {t(
              hasFilters
                ? 'Try another order or adjust filters.'
                : 'Orders will appear here after they are confirmed.',
            )}
          </span>
        </div>
      ) : orders.length > 0 ? (
        <section aria-label={t('Order history')} className="grid gap-1.5">
          {orders.map((order) => (
            <article
              key={order.id}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 p-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:gap-3">
                <button
                  type="button"
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-start"
                  aria-haspopup="dialog"
                  aria-label={`${t('Order details')} #${getPosOrderNumber(order)}`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <span className="flex min-h-9 min-w-10 items-center justify-center rounded-md bg-secondary px-2 text-xs font-bold tabular-nums">
                    <bdi dir="ltr">#{getPosOrderNumber(order)}</bdi>
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-xs font-semibold">
                      {order.customerName || t(order.fulfillmentType)}
                      {order.tableCode ? ` · ${t('Table')} ${order.tableCode}` : ''}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {new Intl.DateTimeFormat(dateLocale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(order.createdAt))}
                    </span>
                  </span>
                </button>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    {t(order.status)}
                  </span>
                  <strong className="text-xs font-semibold tabular-nums">
                    {formatNumber(Number(order.total), {
                      style: 'currency',
                      currency: order.currency,
                    })}
                  </strong>
                </div>
                <PosButton
                  type="button"
                  size="sm"
                  variant="outline"
                  className="col-span-2 min-h-9 text-xs sm:col-span-1"
                  aria-haspopup="dialog"
                  onClick={() => setSelectedOrder(order)}
                >
                  {t('Show order details')}
                </PosButton>
                {employee.permissions.includes('view_receipts') && (
                  <PosButton
                    type="button"
                    size="sm"
                    variant="outline"
                    className="col-span-2 min-h-9 gap-1 text-xs sm:col-span-1"
                    aria-haspopup="dialog"
                    disabled={receiptLoadingOrderId !== null}
                    onClick={() => void openLatestOrderReceipt(order)}
                  >
                    <Printer aria-hidden="true" size={14} />
                    {receiptLoadingOrderId === order.id
                      ? t('Loading receipt…')
                      : t('View / print receipt')}
                  </PosButton>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {ordersQuery.hasNextPage && (
        <div className="flex justify-center pt-1">
          <PosButton
            type="button"
            variant="outline"
            onClick={() => void ordersQuery.fetchNextPage()}
            disabled={ordersQuery.isFetchingNextPage}
          >
            {ordersQuery.isFetchingNextPage ? t('Loading orders…') : t('Load more orders')}
          </PosButton>
        </div>
      )}
      {selectedOrder && (
        <PosOrderDetailsDialog
          merchantId={employee.merchantId}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOpenReceipt={(checkId) => setActiveReceipt({ orderId: selectedOrder.id, checkId })}
        />
      )}
    </section>
  );
}

function PosOrderDetailsDialog({
  merchantId,
  order,
  onClose,
  onOpenReceipt,
}: {
  merchantId: string;
  order: StorefrontOrderSummary;
  onClose: () => void;
  onOpenReceipt: (checkId: string) => void;
}) {
  const { formatNumber, t, errorText } = useLocale();
  const paymentQuery = useQuery({
    queryKey: posPaymentStateKey(merchantId, order.id),
    queryFn: ({ signal }) => getPosOrderPaymentState(order.id, signal),
    staleTime: 15_000,
  });
  const payment: PosOrderPaymentStateResponse | undefined = paymentQuery.data;
  const activeChecks = payment?.checks.filter((check) => check.status !== 'cancelled') ?? [];
  const paidAmount = activeChecks.reduce((total, check) => total + Number(check.paidAmount), 0);
  const balanceDue = activeChecks.reduce((total, check) => total + Number(check.balanceDue), 0);
  const receipts =
    payment?.checks.flatMap((check) =>
      check.receipt ? [{ checkId: check.id, receipt: check.receipt }] : [],
    ) ?? [];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${t('Order')} #${getDisplayOrderNumber(order)}`}
      description={order.customerName || t(order.fulfillmentType)}
      closeLabel={t('Close')}
      className="flex max-h-[calc(100dvh-20px)] flex-col overflow-hidden"
    >
      <div className="grid min-h-0 gap-3 overflow-y-auto p-3 text-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {t(order.status)}
          </span>
          <div className="grid justify-items-end gap-0.5">
            <span className="text-[10px] text-muted-foreground">{t('Order total')}</span>
            <strong className="text-sm tabular-nums">
              {formatNumber(Number(order.total), {
                style: 'currency',
                currency: order.currency,
              })}
            </strong>
          </div>
        </div>

        <section aria-label={t('Order items')} className="grid gap-1.5">
          <h3 className="m-0 text-xs font-semibold">{t('Order items')}</h3>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {order.lines.map((line) => (
              <li
                key={line.id}
                className="grid gap-1 rounded-lg border border-border bg-card px-2.5 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-xs">
                    <strong>
                      <bdi dir="ltr">{formatNumber(line.quantity)}</bdi> × {line.productName}
                    </strong>
                    {line.variantName && (
                      <span className="text-muted-foreground"> · {line.variantName}</span>
                    )}
                  </div>
                  <strong className="shrink-0 text-xs tabular-nums">
                    {formatNumber(Number(line.lineTotal), {
                      style: 'currency',
                      currency: order.currency,
                    })}
                  </strong>
                </div>
                {line.selections.length > 0 && (
                  <p className="m-0 text-[11px] text-muted-foreground">
                    {line.selections
                      .map((selection) =>
                        selection.quantity && selection.quantity > 1
                          ? `${formatNumber(selection.quantity)}× ${selection.optionName}`
                          : selection.optionName,
                      )
                      .join(' · ')}
                  </p>
                )}
                {line.note && (
                  <p className="m-0 text-[11px] text-muted-foreground">
                    {t('Item note')}: {line.note}
                  </p>
                )}
                {line.promotionDiscount && Number(line.promotionDiscount) > 0 && (
                  <p className="m-0 text-[11px] font-medium text-emerald-700">
                    {t('Product discount')}: −
                    {formatNumber(Number(line.promotionDiscount) * line.quantity, {
                      style: 'currency',
                      currency: order.currency,
                    })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {paymentQuery.isLoading ? (
          <p className="m-0 text-xs text-muted-foreground" role="status">
            {t('Loading order details…')}
          </p>
        ) : payment ? (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-0.5 rounded-lg border border-border bg-card px-2.5 py-2">
                <span className="text-[10px] text-muted-foreground">{t('Paid')}</span>
                <strong className="text-xs tabular-nums">
                  {formatNumber(paidAmount, {
                    style: 'currency',
                    currency: payment.currency,
                  })}
                </strong>
              </div>
              <div className="grid gap-0.5 rounded-lg border border-border bg-card px-2.5 py-2">
                <span className="text-[10px] text-muted-foreground">{t('Open balance')}</span>
                <strong className="text-xs tabular-nums">
                  {formatNumber(balanceDue, {
                    style: 'currency',
                    currency: payment.currency,
                  })}
                </strong>
              </div>
            </div>
            {receipts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {receipts.map(({ checkId, receipt }) => (
                  <PosButton
                    key={receipt.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-9 gap-1.5 text-xs"
                    onClick={() => onOpenReceipt(checkId)}
                  >
                    <Printer aria-hidden="true" size={14} />
                    {t('View / print receipt')}
                    <bdi dir="ltr">{receipt.receiptNumber}</bdi>
                  </PosButton>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {t('Receipt is available after settlement.')}
              </span>
            )}
          </div>
        ) : (
          <p className="m-0 text-xs text-destructive" role="alert">
            {errorText(
              paymentQuery.error instanceof Error
                ? paymentQuery.error.message
                : t('Could not load receipts.'),
            )}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function PosReceiptHistoryScreen({ employee }: { employee: PosEmployeeSession }) {
  const { t, errorText, formatNumber } = useLocale();
  const branchId = employee.branch.id;
  const [search, setSearch] = useState('');
  const [activeReceipt, setActiveReceipt] = useState<{ orderId: string; checkId: string } | null>(
    null,
  );
  const receiptsQuery = useInfiniteQuery({
    queryKey: posReceiptHistoryKey(employee.merchantId, branchId),
    queryFn: ({ pageParam, signal }) => listPosReceipts(branchId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(branchId),
    staleTime: 15_000,
  });
  const receipts = receiptsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const query = search.trim().toLocaleLowerCase();
  const visibleReceipts = receipts.filter(
    (receipt) =>
      !query ||
      receipt.receiptNumber.toLocaleLowerCase().includes(query) ||
      receipt.orderReference.toLocaleLowerCase().includes(query) ||
      (receipt.branchOrderNumber != null &&
        String(receipt.branchOrderNumber).includes(query.replace(/^#/, ''))),
  );
  const dateLocale = document.documentElement.lang || undefined;

  if (activeReceipt) {
    return (
      <PosReceiptView
        merchantId={employee.merchantId}
        employeeId={employee.id}
        branchId={branchId}
        requiresApproval={!employee.permissions.includes('approve_refunds')}
        canRecordItemReturn={employee.permissions.includes('sell')}
        orderId={activeReceipt.orderId}
        checkId={activeReceipt.checkId}
        backLabel="Back to receipts"
        onBack={() => setActiveReceipt(null)}
      />
    );
  }

  return (
    <section
      aria-labelledby="pos-receipt-history-heading"
      className="min-h-full space-y-3 p-3 md:p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pos-receipt-history-heading" className="text-base font-semibold">
          {t('Receipts')}
        </h2>
        <PosButton
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void receiptsQuery.refetch()}
          disabled={receiptsQuery.isFetching}
        >
          <RefreshCw
            aria-hidden="true"
            size={14}
            className={receiptsQuery.isFetching ? 'animate-spin' : undefined}
          />
          {t('Refresh')}
        </PosButton>
      </header>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('Search receipt or order number')}
        aria-label={t('Search receipt or order number')}
        className="min-h-10"
      />
      {receiptsQuery.error && (
        <p
          className="m-0 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
          role="alert"
        >
          {errorText(
            receiptsQuery.error instanceof Error
              ? receiptsQuery.error.message
              : t('Could not load receipts.'),
          )}
        </p>
      )}
      {receiptsQuery.isLoading ? (
        <p className="m-0 text-xs text-muted-foreground" role="status">
          {t('Loading receipts...')}
        </p>
      ) : visibleReceipts.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t(query ? 'No matching receipts' : 'No receipts yet')}
        </p>
      ) : (
        <div className="grid gap-1.5">
          {visibleReceipts.map((receipt) => (
            <article
              key={receipt.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card p-2.5"
            >
              <div className="min-w-0">
                <strong className="block truncate text-xs">{receipt.receiptNumber}</strong>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {receipt.source && (
                    <>
                      {t(
                        receipt.source === 'waffarly'
                          ? 'Wfarly'
                          : receipt.source === 'storefront'
                            ? 'Storefront'
                            : receipt.source === 'pos'
                              ? 'POS'
                              : receipt.source,
                      )}{' '}
                      <span aria-hidden="true">·</span>{' '}
                    </>
                  )}
                  #
                  {getPosOrderNumber({
                    id: receipt.orderId,
                    branchOrderNumber: receipt.branchOrderNumber,
                    orderReference: receipt.orderReference,
                  })}{' '}
                  <span aria-hidden="true">·</span>{' '}
                  {new Intl.DateTimeFormat(dateLocale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(receipt.issuedAt))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <strong className="text-xs tabular-nums">
                  {formatNumber(Number(receipt.amount), {
                    style: 'currency',
                    currency: receipt.currency,
                  })}
                </strong>
                <PosButton
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-9 gap-1 text-xs"
                  onClick={() =>
                    setActiveReceipt({ orderId: receipt.orderId, checkId: receipt.checkId })
                  }
                >
                  <Printer aria-hidden="true" size={14} />
                  {t('View / print receipt')}
                </PosButton>
              </div>
            </article>
          ))}
        </div>
      )}
      {receiptsQuery.hasNextPage && (
        <div className="flex justify-center">
          <PosButton
            type="button"
            variant="outline"
            onClick={() => void receiptsQuery.fetchNextPage()}
            disabled={receiptsQuery.isFetchingNextPage}
          >
            {receiptsQuery.isFetchingNextPage ? t('Loading receipts...') : t('Load more receipts')}
          </PosButton>
        </div>
      )}
    </section>
  );
}

function getDisplayOrderNumber(order: StorefrontOrderSummary): string {
  return getPosOrderNumber(order);
}

function toLocalDateBoundary(value: string, endOfDay: boolean): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
