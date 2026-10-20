import { useInfiniteQuery } from '@tanstack/react-query';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { Input, useLocale } from '@waffarly/ui';
import { Printer, ReceiptText, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { PosReceiptView } from './pos-receipt-view.js';
import { listPosReceipts, posReceiptHistoryKey } from './pos-receipts.api.js';

export function PosReceiptsScreen() {
  const { employee } = useOutletContext<{ employee: PosEmployeeSession }>();
  const { t, errorText, formatNumber } = useLocale();
  const workspace = usePosWorkspaceStore((state) => state.workspace);
  const selectBranch = usePosWorkspaceStore((state) => state.selectBranch);
  const branches = employee.branches;
  const selectedBranchId = branches.some((branch) => branch.id === workspace?.selectedBranchId)
    ? (workspace?.selectedBranchId ?? branches[0]?.id ?? '')
    : (branches[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [activeReceipt, setActiveReceipt] = useState<{
    orderId: string;
    checkId: string;
  } | null>(null);

  useEffect(() => {
    if (!selectedBranchId || workspace?.selectedBranchId === selectedBranchId) return;
    selectBranch(employee.merchantId, employee.id, selectedBranchId);
  }, [
    employee.id,
    employee.merchantId,
    selectBranch,
    selectedBranchId,
    workspace?.selectedBranchId,
  ]);

  const receiptsQuery = useInfiniteQuery({
    queryKey: posReceiptHistoryKey(employee.merchantId, selectedBranchId),
    queryFn: ({ pageParam, signal }) => listPosReceipts(selectedBranchId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(selectedBranchId),
    staleTime: 15_000,
  });
  const receipts = useMemo(
    () => receiptsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [receiptsQuery.data],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleReceipts = receipts.filter(
    (receipt) =>
      !normalizedSearch ||
      receipt.receiptNumber.toLocaleLowerCase().includes(normalizedSearch) ||
      receipt.orderReference.toLocaleLowerCase().includes(normalizedSearch),
  );
  const dateLocale = document.documentElement.lang || undefined;

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
        backLabel="Back to receipts"
        onBack={() => setActiveReceipt(null)}
      />
    );
  }

  return (
    <section className="min-h-full space-y-5 p-4 md:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('POS documents')}
          </p>
          <h2 className="text-xl font-bold sm:text-2xl">{t('Receipts')}</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {t('Find and reprint a completed check without collecting payment again.')}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:justify-end">
          {branches.length > 1 && (
            <label className="grid min-w-44 flex-1 gap-1 text-xs font-medium text-muted-foreground sm:flex-none">
              {t('Branch')}
              <select
                className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                value={selectedBranchId}
                onChange={(event) =>
                  selectBranch(employee.merchantId, employee.id, event.target.value)
                }
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <PosButton
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10 gap-2"
            onClick={() => void receiptsQuery.refetch()}
            disabled={!selectedBranchId || receiptsQuery.isFetching}
          >
            <RefreshCw
              aria-hidden="true"
              size={15}
              className={receiptsQuery.isFetching ? 'animate-spin' : undefined}
            />
            {receiptsQuery.isFetching ? t('Refreshing…') : t('Refresh')}
          </PosButton>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative block w-full max-w-xl">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Search receipt or order number')}
            aria-label={t('Search receipt or order number')}
            className="min-h-10 ps-9"
          />
        </label>
        {!receiptsQuery.isLoading && !receiptsQuery.error && selectedBranchId && (
          <span className="text-xs text-muted-foreground">
            {t('Receipts shown')}: {formatNumber(visibleReceipts.length)}
          </span>
        )}
      </div>

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

      {!selectedBranchId ? (
        <div className="flex max-w-2xl items-start gap-3 rounded-xl border border-dashed border-border bg-card/60 p-4 sm:p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <ReceiptText aria-hidden="true" size={20} />
          </span>
          <div className="text-sm">
            <strong>{t('No POS branches assigned')}</strong>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {t('Ask an owner to assign a branch before viewing receipts.')}
            </p>
          </div>
        </div>
      ) : receiptsQuery.isLoading ? (
        <div className="grid gap-2" role="status" aria-label={t('Loading receipts...')}>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              aria-hidden="true"
              className="min-h-20 animate-pulse rounded-xl border border-border bg-card p-3"
            >
              <div className="h-3 w-36 rounded bg-muted" />
              <div className="mt-3 h-3 w-52 max-w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : !receiptsQuery.error && visibleReceipts.length === 0 ? (
        <div className="grid min-h-40 justify-items-center content-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <ReceiptText size={20} aria-hidden="true" />
          </span>
          <strong className="text-sm">
            {t(search ? 'No matching receipts' : 'No receipts yet')}
          </strong>
          <span className="text-xs text-muted-foreground">
            {t(
              search
                ? 'Try another receipt or order number.'
                : 'Settled checks will appear here for reprinting.',
            )}
          </span>
        </div>
      ) : visibleReceipts.length > 0 ? (
        <section aria-labelledby="recent-receipts-heading" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id="recent-receipts-heading" className="text-sm font-semibold">
              {t('Recent receipts')}
            </h3>
            {receiptsQuery.isFetching && !receiptsQuery.isFetchingNextPage && (
              <span className="text-xs text-muted-foreground" role="status">
                {t('Refreshing…')}
              </span>
            )}
          </div>
          <div className="grid gap-2">
            {visibleReceipts.map((receipt) => (
              <article
                key={receipt.id}
                aria-label={receipt.receiptNumber}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <ReceiptText aria-hidden="true" size={19} />
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold leading-tight">
                      {receipt.receiptNumber}
                    </h4>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {t('Check')} {formatNumber(receipt.checkNumber)}
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      {receipt.orderReference}
                    </p>
                    <time
                      className="mt-1 block text-xs text-muted-foreground"
                      dateTime={receipt.issuedAt}
                    >
                      {new Intl.DateTimeFormat(dateLocale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(receipt.issuedAt))}
                    </time>
                  </div>
                </div>
                <strong className="justify-self-end text-sm font-semibold tabular-nums sm:min-w-28">
                  {formatNumber(Number(receipt.amount), {
                    style: 'currency',
                    currency: receipt.currency,
                  })}
                </strong>
                <PosButton
                  type="button"
                  size="sm"
                  variant="outline"
                  className="col-span-2 min-h-10 gap-2 sm:col-span-1"
                  onClick={() =>
                    setActiveReceipt({ orderId: receipt.orderId, checkId: receipt.checkId })
                  }
                >
                  <Printer aria-hidden="true" size={15} />
                  {t('View / print receipt')}
                </PosButton>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {receiptsQuery.hasNextPage && (
        <div className="flex justify-center pt-1">
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
