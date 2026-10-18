import { useInfiniteQuery } from '@tanstack/react-query';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { Button, Input, useLocale } from '@waffarly/ui';
import { Printer, ReceiptText, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
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
      <section className="rounded-xl border border-border bg-card">
        <PosReceiptView
          merchantId={employee.merchantId}
          orderId={activeReceipt.orderId}
          checkId={activeReceipt.checkId}
          backLabel="Back to receipts"
          onBack={() => setActiveReceipt(null)}
        />
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold">{t('Receipts')}</h2>
          <p className="mb-0 mt-1 text-sm text-muted-foreground">
            {t('Find and reprint a completed check without collecting payment again.')}
          </p>
        </div>
        <label className="grid min-w-52 gap-1 text-xs font-medium text-muted-foreground">
          {t('Branch')}
          <select
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            value={selectedBranchId}
            onChange={(event) => selectBranch(employee.merchantId, employee.id, event.target.value)}
            disabled={branches.length < 2}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <label className="relative block max-w-lg">
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
          className="ps-9"
        />
      </label>

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
        <p className="m-0 py-6 text-center text-sm text-muted-foreground" role="status">
          {t('Loading receipts...')}
        </p>
      ) : visibleReceipts.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <ReceiptText size={22} aria-hidden="true" className="text-muted-foreground" />
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
      ) : (
        <div className="grid gap-2" aria-label={t('Recent receipts')}>
          {visibleReceipts.map((receipt) => (
            <article
              key={receipt.id}
              className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                  <span>{receipt.receiptNumber}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {t('Check')} {formatNumber(receipt.checkNumber)} · {receipt.orderReference}
                  </span>
                </div>
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
              <strong className="text-sm tabular-nums">
                {formatNumber(Number(receipt.amount), {
                  style: 'currency',
                  currency: receipt.currency,
                })}
              </strong>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setActiveReceipt({ orderId: receipt.orderId, checkId: receipt.checkId })
                }
              >
                <Printer size={15} aria-hidden="true" />
                {t('View / print receipt')}
              </Button>
            </article>
          ))}
        </div>
      )}

      {receiptsQuery.hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void receiptsQuery.fetchNextPage()}
            disabled={receiptsQuery.isFetchingNextPage}
          >
            {receiptsQuery.isFetchingNextPage ? t('Loading receipts...') : t('Load more receipts')}
          </Button>
        </div>
      )}
    </section>
  );
}
