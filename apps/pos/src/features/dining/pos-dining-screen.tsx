import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PosDiningSessionSummary,
  PosEmployeeSession,
  SplitPosOrderChecksRequest,
} from '@waffarly/contracts';
import { Button, Dialog, Input, useLocale } from '@waffarly/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
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
    <section className="pos-dining-screen space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('Dining')}
          </p>
          <h2 className="text-2xl font-bold">{t('Tables & open sessions')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('See table occupancy, add a new round, split checks, or move a session.')}
          </p>
        </div>
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
      </header>

      {message && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
          role="alert"
        >
          {errorText(message instanceof Error ? message.message : t('Could not load dining data.'))}
        </p>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">
            {t('Table map')}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              · {activeBranch?.name}
            </span>
          </h3>
          <span className="text-xs text-muted-foreground">
            {formatNumber(tables.length)} {t('tables')}
          </span>
        </div>
        {tablesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('Loading tables...')}</p>
        ) : tables.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm">
            <strong>{t('No active tables are configured.')}</strong>
            <p className="mt-1 text-muted-foreground">
              {t('Ask the owner to add tables for this branch in POS settings.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
            {tables.map((table) => (
              <article
                key={table.id}
                className={`rounded-xl border p-3 ${table.occupancy === 'occupied' ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm">{table.code}</strong>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${table.occupancy === 'occupied' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}
                  >
                    {table.occupancy === 'occupied' ? t('Occupied') : t('Free')}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatNumber(table.capacity)} {t('seats')}
                </p>
                {table.occupancy === 'occupied' && (
                  <p className="mt-1 text-xs">
                    {formatNumber(table.orderCount)} {t('orders')} ·{' '}
                    {formatNumber(Number(table.outstandingTotal), {
                      style: 'currency',
                      currency: 'EGP',
                    })}
                  </p>
                )}
                <Link
                  className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground"
                  to={`/catalog?tableId=${encodeURIComponent(table.id)}`}
                >
                  {table.occupancy === 'occupied' ? t('Add round') : t('Start order')}
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{t('Open dining sessions')}</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void sessionsQuery.refetch()}
            disabled={sessionsQuery.isFetching}
          >
            {t('Refresh')}
          </Button>
        </div>
        {sessionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('Loading sessions...')}</p>
        ) : sessions.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            {t('There are no open dining sessions at this branch.')}
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="rounded-xl border border-border bg-card p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <strong className="text-base">
                      {t('Table')} {session.tableCode}
                    </strong>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(session.orderCount)} {t('orders')} ·{' '}
                      {formatNumber(Number(session.outstandingTotal), {
                        style: 'currency',
                        currency: 'EGP',
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={t('Move session to an available table')}
                      className="min-h-10 max-w-48 rounded-lg border border-border bg-background px-2 text-xs"
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
                    <Button
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
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {session.orders.map((order) => (
                    <div key={order.id} className="rounded-lg border border-border/80 p-3">
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
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                        <div className="flex flex-wrap gap-2">
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
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedOrder({ order, sessionTable: session.tableCode })
                          }
                        >
                          {t('Split check')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setCheckoutOrderId(order.id)}
                        >
                          {t('Take payment')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

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
            <Button
              key={value}
              type="button"
              variant={method === value ? 'default' : 'outline'}
              aria-pressed={method === value}
              onClick={() => setMethod(value)}
            >
              {t(value === 'items' ? 'By items' : value === 'equal' ? 'Equal' : 'Custom amounts')}
            </Button>
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
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('Saving...') : t('Save split')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
