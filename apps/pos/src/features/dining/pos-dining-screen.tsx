import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PosDiningSessionSummary,
  PosEmployeeSession,
  SplitPosOrderChecksRequest,
} from '@waffarly/contracts';
import { Dialog, Input, useLocale } from '@waffarly/ui';
import { LayoutGrid, Plus, UsersRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { PosCheckoutDialog } from '../payments/pos-checkout-dialog.js';
import {
  getPosDiningSessions,
  getPosDiningTables,
  movePosDiningSession,
  posDiningSessionsKey,
  posDiningTablesKey,
  splitPosOrderChecks,
} from './pos-dining.api.js';

type LayoutContext = { employee: PosEmployeeSession };

export function PosDiningScreen() {
  const { employee } = useOutletContext<LayoutContext>();
  const { t, errorText, formatNumber } = useLocale();
  const queryClient = useQueryClient();
  const workspace = usePosWorkspaceStore((state) => state.workspace);
  const hydrate = usePosWorkspaceStore((state) => state.hydrate);
  const selectBranch = usePosWorkspaceStore((state) => state.selectBranch);
  const branches = employee.branches.filter((branch) => branch.archivedAt === null);
  const selectedBranchId = branches.some((branch) => branch.id === workspace?.selectedBranchId)
    ? (workspace?.selectedBranchId ?? branches[0]?.id ?? '')
    : (branches[0]?.id ?? '');
  const [selectedOrder, setSelectedOrder] = useState<{
    order: PosDiningSessionSummary['orders'][number];
    sessionTable: string;
  } | null>(null);
  const [destinationBySession, setDestinationBySession] = useState<Record<string, string>>({});
  const [checkoutOrderId, setCheckoutOrderId] = useState('');

  useEffect(
    () => hydrate(employee.merchantId, employee.id),
    [employee.id, employee.merchantId, hydrate],
  );
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

  const tablesQuery = useQuery({
    queryKey: posDiningTablesKey(employee.merchantId, selectedBranchId),
    queryFn: ({ signal }) => getPosDiningTables(selectedBranchId, signal),
    enabled: Boolean(selectedBranchId),
    refetchOnWindowFocus: true,
  });
  const sessionsQuery = useQuery({
    queryKey: posDiningSessionsKey(employee.merchantId, selectedBranchId),
    queryFn: ({ signal }) => getPosDiningSessions(selectedBranchId, signal),
    enabled: Boolean(selectedBranchId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const tables = tablesQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const occupiedTables = tables.filter((table) => table.occupancy === 'occupied');
  const availableTables = tables.filter((table) => table.occupancy === 'available');
  const moveMutation = useMutation({
    mutationFn: ({ session, tableId }: { session: PosDiningSessionSummary; tableId: string }) =>
      movePosDiningSession(session.id, {
        requestId: crypto.randomUUID(),
        revision: session.revision,
        tableId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: posDiningTablesKey(employee.merchantId, selectedBranchId),
        }),
        queryClient.invalidateQueries({
          queryKey: posDiningSessionsKey(employee.merchantId, selectedBranchId),
        }),
      ]);
    },
  });

  const activeBranch = branches.find((branch) => branch.id === selectedBranchId);
  const message = tablesQuery.error ?? sessionsQuery.error ?? moveMutation.error;

  return (
    <section className="pos-dining-screen min-h-full space-y-6 p-4 md:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('Dining')}
          </p>
          <h2 className="text-xl font-bold sm:text-2xl">{t('Tables & open sessions')}</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {t('See table occupancy, add a new round, split checks, or move a session.')}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {branches.length > 1 && (
            <label className="grid min-w-52 gap-1 text-xs text-muted-foreground">
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
            onClick={() => void Promise.all([tablesQuery.refetch(), sessionsQuery.refetch()])}
            disabled={tablesQuery.isFetching || sessionsQuery.isFetching}
          >
            {t('Refresh')}
          </PosButton>
        </div>
      </header>

      {message && (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm"
          role="alert"
        >
          <p>
            {errorText(
              message instanceof Error ? message.message : t('Could not load dining data.'),
            )}
          </p>
        </div>
      )}

      <section aria-labelledby="dining-table-map-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="dining-table-map-title" className="text-base font-semibold">
              {t('Table map')}
              {activeBranch && (
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  · {activeBranch.name}
                </span>
              )}
            </h3>
            {!tablesQuery.isLoading && !tablesQuery.isError && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>
                  {formatNumber(tables.length)} {t('tables')}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {formatNumber(occupiedTables.length)} {t('Occupied')}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {formatNumber(availableTables.length)} {t('Free')}
                </span>
              </p>
            )}
          </div>
        </div>

        {tablesQuery.isLoading ? (
          <div
            aria-label={t('Loading tables...')}
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            role="status"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="min-h-36 animate-pulse rounded-xl border border-border bg-card p-4"
              >
                <div className="h-4 w-20 rounded bg-muted" />
                <div className="mt-8 h-3 w-28 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : tablesQuery.isError ? null : tables.length === 0 ? (
          <div className="flex max-w-2xl items-start gap-3 rounded-xl border border-dashed border-border bg-card/60 p-4 sm:p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <LayoutGrid aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 text-sm">
              <strong>{t('No active tables are configured.')}</strong>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {t('Ask the owner to add tables for this branch in POS settings.')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tables.map((table) => {
              const isOccupied = table.occupancy === 'occupied';

              return (
                <article
                  key={table.id}
                  className={`min-h-36 rounded-xl border p-3.5 transition-colors ${isOccupied ? 'border-primary/45 bg-primary/[0.07]' : 'border-border bg-card hover:bg-muted/30'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] text-muted-foreground">{t('Table')}</p>
                      <h4 className="mt-0.5 text-lg font-bold leading-tight">{table.code}</h4>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${isOccupied ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}
                    >
                      {isOccupied ? (
                        <UsersRound aria-hidden="true" className="size-3.5" />
                      ) : (
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                      )}
                      {isOccupied ? t('Occupied') : t('Free')}
                    </span>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/70 pt-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(table.capacity)} {t('seats')}
                      </p>
                      {isOccupied && (
                        <>
                          <p className="mt-1 text-sm font-semibold">
                            {formatNumber(Number(table.outstandingTotal), {
                              style: 'currency',
                              currency: 'EGP',
                            })}
                          </p>
                          <p className="text-[0.68rem] text-muted-foreground">
                            {formatNumber(table.orderCount)}{' '}
                            {table.orderCount === 1 ? t('Order') : t('orders')}
                          </p>
                        </>
                      )}
                    </div>
                    <Link
                      aria-label={`${isOccupied ? t('Add round') : t('Start order')}: ${t('Table')} ${table.code}`}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      to={`/catalog?tableId=${encodeURIComponent(table.id)}`}
                    >
                      <Plus aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="dining-sessions-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 id="dining-sessions-title" className="text-base font-semibold">
              {t('Open dining sessions')}
            </h3>
            {!sessionsQuery.isLoading && !sessionsQuery.isError && (
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                {formatNumber(sessions.length)}
              </span>
            )}
          </div>
        </div>
        {sessionsQuery.isLoading ? (
          <div
            aria-label={t('Loading sessions...')}
            className="grid gap-3 xl:grid-cols-2"
            role="status"
          >
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        ) : sessionsQuery.isError ? null : sessions.length === 0 ? (
          <p className="max-w-2xl rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground sm:p-5">
            {t('There are no open dining sessions at this branch.')}
          </p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 p-3 sm:p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      <UsersRound aria-hidden="true" className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold">
                        {t('Table')} {session.tableCode}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(session.orderCount)}{' '}
                        {session.orderCount === 1 ? t('Order') : t('orders')}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <strong className="me-auto text-sm sm:me-1">
                      {formatNumber(Number(session.outstandingTotal), {
                        style: 'currency',
                        currency: 'EGP',
                      })}
                    </strong>
                    <select
                      aria-label={t('Move session to an available table')}
                      className="min-h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs sm:w-40 sm:flex-none"
                      value={destinationBySession[session.id] ?? ''}
                      onChange={(event) =>
                        setDestinationBySession((current) => ({
                          ...current,
                          [session.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">{t('Move to table...')}</option>
                      {availableTables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.code}
                        </option>
                      ))}
                    </select>
                    <PosButton
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!destinationBySession[session.id] || moveMutation.isPending}
                      onClick={() => {
                        const tableId = destinationBySession[session.id];
                        if (tableId) moveMutation.mutate({ session, tableId });
                      }}
                    >
                      {t('Move')}
                    </PosButton>
                  </div>
                </header>
                <div className="grid gap-2 p-3 sm:p-4">
                  {session.orders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-lg border border-border/80 bg-background/50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm">
                          {t('Order')} #{order.id.slice(0, 8)}
                        </strong>
                        <span className="text-sm font-semibold">
                          {formatNumber(Number(order.total), {
                            style: 'currency',
                            currency: order.currency,
                          })}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {order.lines.map((line) => (
                          <li key={line.id}>
                            {formatNumber(line.quantity)} × {line.productName}
                            {line.variantName ? ` · ${line.variantName}` : ''}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                        <div className="flex flex-wrap gap-1.5">
                          {order.checks.map((check) => (
                            <span
                              className="rounded-md bg-secondary px-2 py-1 text-[0.68rem]"
                              key={check.id}
                            >
                              {t('Check')} {check.position + 1} ·{' '}
                              {formatNumber(Number(check.amount), {
                                style: 'currency',
                                currency: order.currency,
                              })}
                            </span>
                          ))}
                        </div>
                        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                          <PosButton
                            className="flex-1 sm:flex-none"
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSelectedOrder({ order, sessionTable: session.tableCode })
                            }
                          >
                            {t('Split check')}
                          </PosButton>
                          <PosButton
                            className="flex-1 sm:flex-none"
                            type="button"
                            size="sm"
                            variant="solid"
                            onClick={() => setCheckoutOrderId(order.id)}
                          >
                            {t('Take payment')}
                          </PosButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedOrder && (
        <SplitOrderDialog
          order={selectedOrder.order}
          tableCode={selectedOrder.sessionTable}
          onClose={() => setSelectedOrder(null)}
          onSaved={async () => {
            await queryClient.invalidateQueries({
              queryKey: posDiningSessionsKey(employee.merchantId, selectedBranchId),
            });
            setSelectedOrder(null);
          }}
        />
      )}
      {checkoutOrderId && (
        <PosCheckoutDialog
          merchantId={employee.merchantId}
          employeeId={employee.id}
          branchId={selectedBranchId}
          requiresRefundApproval={!employee.permissions.includes('approve_refunds')}
          orderId={checkoutOrderId}
          onClose={() => setCheckoutOrderId('')}
        />
      )}
    </section>
  );
}

function SplitOrderDialog({
  order,
  tableCode,
  onClose,
  onSaved,
}: {
  order: PosDiningSessionSummary['orders'][number];
  tableCode: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t, errorText, formatNumber } = useLocale();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<'items' | 'equal' | 'custom'>('items');
  const [checkCount, setCheckCount] = useState(2);
  const [allocations, setAllocations] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(
      order.lines.map((line) => [line.id, [line.quantity, ...Array.from({ length: 19 }, () => 0)]]),
    ),
  );
  const [amounts, setAmounts] = useState<string[]>(['', '']);
  const [requestError, setRequestError] = useState('');
  const mutation = useMutation({
    mutationFn: (input: SplitPosOrderChecksRequest) => splitPosOrderChecks(order.id, input),
    onSuccess: async () => {
      await onSaved();
      await queryClient.invalidateQueries({ queryKey: ['pos', 'orders'] });
    },
    onError: (error) =>
      setRequestError(
        errorText(error instanceof Error ? error.message : t('Could not split this check.')),
      ),
  });

  useEffect(() => {
    setAmounts(Array.from({ length: checkCount }, () => ''));
    setAllocations(
      Object.fromEntries(
        order.lines.map((line) => [
          line.id,
          [line.quantity, ...Array.from({ length: 19 }, () => 0)],
        ]),
      ),
    );
  }, [checkCount, order]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError('');
    const envelope = { requestId: crypto.randomUUID(), revision: order.revision };
    const input: SplitPosOrderChecksRequest =
      method === 'equal'
        ? { ...envelope, method, checkCount }
        : method === 'custom'
          ? { ...envelope, method, amounts }
          : {
              ...envelope,
              method,
              checks: Array.from({ length: checkCount }, (_, index) => ({
                lines: order.lines.flatMap((line) => {
                  const quantity = allocations[line.id]?.[index] ?? 0;
                  return quantity ? [{ orderLineId: line.id, quantity }] : [];
                }),
              })),
            };
    mutation.mutate(input);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${t('Split check')} · ${t('Table')} ${tableCode}`}
      description={t(
        'Choose how to allocate this order. The total and whole item quantities must be conserved.',
      )}
      closeLabel={t('Close')}
      className="max-w-2xl"
    >
      <form className="space-y-4 p-4 sm:p-6" onSubmit={submit}>
        <p className="text-sm font-semibold">
          {t('Order total')}:{' '}
          {formatNumber(Number(order.total), { style: 'currency', currency: order.currency })}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(['items', 'equal', 'custom'] as const).map((value) => (
            <PosButton
              key={value}
              type="button"
              variant={method === value ? 'solid' : 'outline'}
              aria-pressed={method === value}
              onClick={() => setMethod(value)}
            >
              {t(value === 'items' ? 'By items' : value === 'equal' ? 'Equal' : 'Custom amounts')}
            </PosButton>
          ))}
        </div>
        <label className="grid max-w-48 gap-1 text-xs text-muted-foreground">
          {t('Number of checks')}
          <Input
            type="number"
            min="2"
            max="20"
            value={checkCount}
            onChange={(event) =>
              setCheckCount(Math.max(2, Math.min(20, Number(event.target.value) || 2)))
            }
          />
        </label>
        {method === 'items' && (
          <div className="max-h-64 space-y-2 overflow-auto rounded-lg border border-border p-3">
            {order.lines.map((line) => (
              <div
                className="grid min-w-max items-center gap-2 border-b border-border/70 pb-2 last:border-0"
                style={{
                  gridTemplateColumns: `minmax(160px, 1fr) repeat(${checkCount}, minmax(76px, 88px))`,
                }}
                key={line.id}
              >
                <span className="text-xs">
                  {line.productName}
                  {line.variantName ? ` · ${line.variantName}` : ''}{' '}
                  <span className="text-muted-foreground">× {line.quantity}</span>
                </span>
                {Array.from({ length: checkCount }, (_, index) => (
                  <label key={index} className="grid gap-1 text-[0.65rem] text-muted-foreground">
                    {t('Check')} {index + 1}
                    <Input
                      aria-label={`${t('Check')} ${index + 1} · ${line.productName}`}
                      type="number"
                      min="0"
                      max={line.quantity}
                      step="1"
                      value={allocations[line.id]?.[index] ?? 0}
                      onChange={(event) => {
                        const next = Array.from(
                          { length: checkCount },
                          (_, item) => allocations[line.id]?.[item] ?? 0,
                        );
                        const others = next.reduce(
                          (sum, quantity, item) => (item === index ? sum : sum + quantity),
                          0,
                        );
                        next[index] = Math.max(
                          0,
                          Math.min(line.quantity - others, Number(event.target.value) || 0),
                        );
                        setAllocations((current) => ({ ...current, [line.id]: next }));
                      }}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
        {method === 'equal' && (
          <p className="text-sm text-muted-foreground">
            {t(
              'The saved total will be split in exact cents; any remainder goes to the first checks.',
            )}
          </p>
        )}
        {method === 'custom' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {amounts.map((amount, index) => (
              <label key={index} className="grid gap-1 text-xs text-muted-foreground">
                {t('Check')} {index + 1} {t('amount')}
                <Input
                  inputMode="decimal"
                  value={amount}
                  placeholder="0.00"
                  onChange={(event) =>
                    setAmounts((current) =>
                      current.map((value, item) => (item === index ? event.target.value : value)),
                    )
                  }
                />
              </label>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {t('Custom amounts must add up to the full order total.')}
            </p>
          </div>
        )}
        {requestError && (
          <p className="text-sm text-destructive" role="alert">
            {requestError}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <PosButton type="button" variant="outline" onClick={onClose}>
            {t('Cancel')}
          </PosButton>
          <PosButton type="submit" variant="solid" disabled={mutation.isPending}>
            {mutation.isPending ? t('Saving...') : t('Save split')}
          </PosButton>
        </div>
      </form>
    </Dialog>
  );
}
