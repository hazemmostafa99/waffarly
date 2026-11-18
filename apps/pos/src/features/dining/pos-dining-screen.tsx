import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PosDiningSessionSummary, PosEmployeeSession } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { LayoutGrid, Plus, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { usePosWorkspaceStore } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { PosCheckoutDialog } from '../payments/pos-checkout-dialog.js';
import { getPosOrderNumber } from '../orders/pos-order-number.js';
import {
  getPosDiningSessions,
  getPosDiningTables,
  movePosDiningSession,
  posDiningSessionsKey,
  posDiningTablesKey,
} from './pos-dining.api.js';

type LayoutContext = { employee: PosEmployeeSession };

export function PosDiningScreen() {
  const { employee } = useOutletContext<LayoutContext>();
  const { t, errorText, formatNumber } = useLocale();
  const queryClient = useQueryClient();
  const hydrate = usePosWorkspaceStore((state) => state.hydrate);
  const selectedBranchId = employee.branch.id;
  const [destinationBySession, setDestinationBySession] = useState<Record<string, string>>({});
  const [checkoutOrderId, setCheckoutOrderId] = useState('');

  useEffect(
    () => hydrate(employee.merchantId, employee.id),
    [employee.id, employee.merchantId, hydrate],
  );
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

  const activeBranch = employee.branch;
  const message = tablesQuery.error ?? sessionsQuery.error ?? moveMutation.error;

  return (
    <section
      aria-labelledby="pos-dining-heading"
      className="pos-dining-screen min-h-full space-y-4 p-3 md:p-4"
    >
      <h2 id="pos-dining-heading" className="sr-only">
        {t('Tables & open sessions')}
      </h2>

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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
          <PosButton
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10"
            onClick={() => void Promise.all([tablesQuery.refetch(), sessionsQuery.refetch()])}
            disabled={tablesQuery.isFetching || sessionsQuery.isFetching}
          >
            {t('Refresh')}
          </PosButton>
        </div>

        {tablesQuery.isLoading ? (
          <div
            aria-label={t('Loading tables...')}
            className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
            role="status"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="min-h-32 animate-pulse rounded-lg border border-border bg-card p-3"
              >
                <div className="h-4 w-20 rounded bg-muted" />
                <div className="mt-8 h-3 w-28 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : tablesQuery.isError ? null : tables.length === 0 ? (
          <div className="flex w-full items-start gap-2 rounded-lg border border-dashed border-border bg-card/60 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              <LayoutGrid aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 text-sm">
              <strong>{t('No active tables are configured.')}</strong>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('Ask the owner to add tables for this branch in POS settings.')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {tables.map((table) => {
              const isOccupied = table.occupancy === 'occupied';

              return (
                <article
                  key={table.id}
                  className={`min-h-32 rounded-lg border p-3 transition-colors ${isOccupied ? 'border-primary/45 bg-primary/[0.07]' : 'border-border bg-card hover:bg-muted/30'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] text-muted-foreground">{t('Table')}</p>
                      <h4 className="mt-0.5 text-sm font-bold leading-tight">{table.code}</h4>
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

                  <div className="mt-3 flex items-end justify-between gap-2 border-t border-border/70 pt-2">
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

      <section aria-labelledby="dining-sessions-title" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
          <p className="w-full rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
            {t('There are no open dining sessions at this branch.')}
          </p>
        ) : (
          <div className="grid gap-2 xl:grid-cols-2">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 p-2.5 sm:p-3">
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
                <div className="grid gap-1.5 p-2.5 sm:p-3">
                  {session.orders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-lg border border-border/80 bg-background/50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm">
                          {t('Order')} #{getPosOrderNumber(order)}
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
                      <div className="mt-3 border-t border-border pt-3">
                        <PosButton
                          className="w-full"
                          type="button"
                          size="sm"
                          variant="solid"
                          onClick={() => setCheckoutOrderId(order.id)}
                        >
                          {t('Take payment')}
                        </PosButton>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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
