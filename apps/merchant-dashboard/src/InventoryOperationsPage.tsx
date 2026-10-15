import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DashboardCard,
  DataTable,
  Input,
  useLocale,
  type DataTableColumn,
} from '@waffarly/ui';
import type {
  CreateStockOpeningRequest,
  InventoryBranch,
  InventoryPolicy,
  StockBalance,
  StockCondition,
  StockItem,
  StockItemUnitFields,
  StockMovement,
  StockMovementBatchResult,
} from '@waffarly/contracts';
import { DashboardDialog } from './components/DashboardDialog.js';
import { apiRequest, apiRequestPage } from './lib/api-client.js';
import { inventoryCopy } from './inventory-copy.js';

type OpeningLineDraft = {
  key: string;
  warehouseId: string;
  stockItemId: string;
  condition: StockCondition;
  quantity: string;
  unitCode: string;
};
type PageState = { cursor?: string };
const openingRequestKey = 'waffarly-opening-stock-request';
const pendingOpeningKey = 'waffarly-opening-stock-pending';

const dimensions = {
  piece: 'count',
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  l: 'volume',
} as const;

function unitOptions(item: StockItem | undefined): Array<{ code: string; name: string }> {
  if (!item) return [];
  const standards = Object.keys(dimensions).filter(
    (unit) => dimensions[unit as keyof typeof dimensions] === dimensions[item.baseUnit],
  );
  const packs = item.units.map((unit: StockItemUnitFields) => ({
    code: unit.code,
    name: unit.name,
  }));
  return [...standards.map((unit) => ({ code: unit, name: unit })), ...packs];
}

function emptyLine(items: StockItem[], warehouses: Array<{ id: string }>): OpeningLineDraft {
  const item = items[0];
  return {
    key: crypto.randomUUID(),
    warehouseId: warehouses[0]?.id ?? '',
    stockItemId: item?.id ?? '',
    condition: 'available',
    quantity: '1',
    unitCode: item ? (unitOptions(item)[0]?.code ?? item.baseUnit) : '',
  };
}

export function InventoryOperationsPage() {
  const { locale, t, errorText, formatDigits } = useLocale();
  const text = (value: string) => inventoryCopy(value, locale, t);
  const navigate = useNavigate();
  const requestId = useRef(loadOrCreateOpeningRequestId());
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [policy, setPolicy] = useState<InventoryPolicy | null>(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pendingOpening, setPendingOpening] = useState<CreateStockOpeningRequest | null>(null);
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<OpeningLineDraft[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [balancePage, setBalancePage] = useState<PageState>({});
  const [movementPage, setMovementPage] = useState<PageState>({});
  const [balanceHistory, setBalanceHistory] = useState<PageState[]>([]);
  const [movementHistory, setMovementHistory] = useState<PageState[]>([]);
  const [balanceNext, setBalanceNext] = useState<string | null>(null);
  const [movementNext, setMovementNext] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const allWarehouses = branches.flatMap((branch) =>
    branch.warehouses.map((warehouse) => ({ ...warehouse, branchName: branch.name })),
  );
  const warehouses = allWarehouses.filter((warehouse) => {
    const branch = branches.find((candidate) => candidate.id === warehouse.branchId);
    return !branch?.archivedAt && !warehouse.archivedAt;
  });
  const selectableItems = items.filter((item) => !item.archivedAt);
  const openingWarehouses = pendingOpening ? allWarehouses : warehouses;
  const openingItems = pendingOpening ? items : selectableItems;

  useEffect(() => {
    let current = true;
    setLoadError('');
    void Promise.all([
      apiRequest<InventoryBranch[]>('/owner/inventory/branches?status=all&limit=100'),
      apiRequest<StockItem[]>('/owner/inventory/items?status=all&limit=100'),
      apiRequest<InventoryPolicy>('/owner/inventory/policy'),
    ])
      .then(([branchRows, itemRows, currentPolicy]) => {
        if (!current) return;
        setBranches(branchRows);
        setItems(itemRows);
        setPolicy(currentPolicy);
        const savedOpening = loadPendingOpening();
        if (
          savedOpening &&
          savedOpening.lines.some(
            (line) =>
              !itemRows.some((item) => item.id === line.stockItemId) ||
              !branchRows.some((branch) =>
                branch.warehouses.some((warehouse) => warehouse.id === line.warehouseId),
              ),
          )
        ) {
          clearPendingOpening();
          setPendingOpening(null);
          setReviewing(false);
          requestId.current = rotateOpeningRequestId();
          setReason('');
          setLines([
            emptyLine(
              itemRows.filter((item) => !item.archivedAt),
              branchRows.flatMap((branch) =>
                branch.warehouses.filter(
                  (warehouse) => !branch.archivedAt && !warehouse.archivedAt,
                ),
              ),
            ),
          ]);
          setLoadError(text('Saved opening retry belongs to another merchant and was cleared.'));
          return;
        }
        if (savedOpening) {
          setPendingOpening(savedOpening);
          setReason(savedOpening.reason);
          setLines(savedOpening.lines.map((line) => ({ ...line, key: crypto.randomUUID() })));
          setReviewing(true);
          return;
        }
        setLines((existing) =>
          existing.length
            ? existing
            : [
                emptyLine(
                  itemRows.filter((item) => !item.archivedAt),
                  branchRows.flatMap((branch) =>
                    branch.warehouses.filter(
                      (warehouse) => !branch.archivedAt && !warehouse.archivedAt,
                    ),
                  ),
                ),
              ],
        );
      })
      .catch((cause: unknown) => {
        if (current)
          setLoadError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load inventory operations.'),
          );
      });
    return () => {
      current = false;
    };
  }, [errorText, refreshKey]);

  useEffect(() => {
    let current = true;
    setBalancesLoading(true);
    const query = new URLSearchParams({ limit: '25' });
    if (balancePage.cursor) query.set('cursor', balancePage.cursor);
    void apiRequestPage<StockBalance>(`/owner/inventory/balances?${query.toString()}`)
      .then((page) => {
        if (current) {
          setBalances(page.items);
          setBalanceNext(page.nextCursor);
        }
      })
      .catch((cause: unknown) => {
        if (current)
          setLoadError(
            cause instanceof Error ? errorText(cause.message) : text('Could not load balances.'),
          );
      })
      .finally(() => {
        if (current) setBalancesLoading(false);
      });
    return () => {
      current = false;
    };
  }, [balancePage, errorText, refreshKey]);

  useEffect(() => {
    let current = true;
    setMovementsLoading(true);
    const query = new URLSearchParams({ limit: '25' });
    if (movementPage.cursor) query.set('cursor', movementPage.cursor);
    void apiRequestPage<StockMovement>(`/owner/inventory/movements?${query.toString()}`)
      .then((page) => {
        if (current) {
          setMovements(page.items);
          setMovementNext(page.nextCursor);
        }
      })
      .catch((cause: unknown) => {
        if (current)
          setLoadError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load movement history.'),
          );
      })
      .finally(() => {
        if (current) setMovementsLoading(false);
      });
    return () => {
      current = false;
    };
  }, [movementPage, errorText, refreshKey]);

  const balanceColumns: DataTableColumn<StockBalance>[] = [
    {
      id: 'item',
      header: text('Stock item'),
      cell: (row) => (
        <div className="inventory-table-name">
          <strong>{formatDigits(row.stockItemName)}</strong>
          <small>
            {formatDigits(row.branchName)} · {formatDigits(row.warehouseName)}
          </small>
        </div>
      ),
    },
    {
      id: 'condition',
      header: text('Condition'),
      cell: (row) => text(row.condition === 'available' ? 'Available' : 'Non-Sellable'),
    },
    {
      id: 'quantity',
      header: text('Quantity'),
      cell: (row) => <span dir="ltr">{formatDigits(`${row.quantity} ${row.baseUnit}`)}</span>,
    },
    {
      id: 'updatedAt',
      header: text('Last updated'),
      cell: (row) => formatDigits(new Date(row.updatedAt).toLocaleString(locale)),
    },
  ];
  const movementColumns: DataTableColumn<StockMovement>[] = [
    {
      id: 'createdAt',
      header: text('Date'),
      cell: (row) => formatDigits(new Date(row.createdAt).toLocaleString(locale)),
    },
    {
      id: 'item',
      header: text('Stock item'),
      cell: (row) => (
        <div className="inventory-table-name">
          <strong>{formatDigits(row.stockItemName)}</strong>
          <small>
            {formatDigits(row.branchName)} · {formatDigits(row.warehouseName)}
          </small>
        </div>
      ),
    },
    {
      id: 'movement',
      header: text('Movement'),
      cell: (row) => text(row.kind === 'opening_balance' ? 'Opening balance' : row.kind),
    },
    {
      id: 'delta',
      header: text('Change'),
      cell: (row) => <span dir="ltr">{formatDigits(`${row.baseDelta} ${row.baseUnit}`)}</span>,
    },
    { id: 'actor', header: text('Recorded by'), cell: (row) => formatDigits(row.actor) },
  ];

  function updateLine(key: string, change: Partial<OpeningLineDraft>) {
    setLines((previous) =>
      previous.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...change };
        if (change.stockItemId) {
          const item = items.find((candidate) => candidate.id === change.stockItemId);
          next.unitCode = item ? (unitOptions(item)[0]?.code ?? item.baseUnit) : '';
        }
        return next;
      }),
    );
  }

  function startReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadError('');
    if (
      !warehouses.length ||
      !selectableItems.length ||
      !reason.trim() ||
      lines.some(
        (line) => !line.warehouseId || !line.stockItemId || !line.quantity || !line.unitCode,
      )
    ) {
      setLoadError(text('Complete the opening balance fields before review.'));
      return;
    }
    if (
      new Set(lines.map((line) => `${line.warehouseId}:${line.stockItemId}:${line.condition}`))
        .size !== lines.length
    ) {
      setLoadError(text('Opening lines cannot repeat an item, warehouse, and condition.'));
      return;
    }
    setReviewing(true);
  }

  async function postOpening() {
    if (busy) return;
    setBusy(true);
    setLoadError('');
    const body: CreateStockOpeningRequest = pendingOpening ?? {
      requestId: requestId.current,
      reason: reason.trim(),
      lines: lines.map(({ warehouseId, stockItemId, condition, quantity, unitCode }) => ({
        warehouseId,
        stockItemId,
        condition,
        quantity: quantity.trim(),
        unitCode,
      })),
    };
    setPendingOpening(body);
    savePendingOpening(body);
    try {
      const result = await apiRequest<StockMovementBatchResult>(
        '/owner/inventory/opening-balances',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
      setReviewing(false);
      setNotice(
        result.replayed
          ? text('Opening balance was already posted; no duplicate stock was added.')
          : text('Opening balance posted.'),
      );
      setReason('');
      setPendingOpening(null);
      clearPendingOpening();
      requestId.current = rotateOpeningRequestId();
      setLines([emptyLine(items, warehouses)]);
      setBalancePage({});
      setMovementPage({});
      setBalanceHistory([]);
      setMovementHistory([]);
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not post the opening balance.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateNegativePolicy() {
    if (!policy || busy) return;
    setBusy(true);
    setLoadError('');
    try {
      const updated = await apiRequest<InventoryPolicy>('/owner/inventory/policy', {
        method: 'PATCH',
        body: JSON.stringify({
          revision: policy.revision,
          negativeStockPolicy: policy.negativeStockPolicy === 'allow' ? 'prevent' : 'allow',
        }),
      });
      setPolicy(updated);
      setNotice(text('Inventory policy saved.'));
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not update the inventory policy.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <section className="inventory-intro">
        <div>
          <span className="inventory-eyebrow">{text('Inventory operations')}</span>
          <h2>{text('Balances and movements')}</h2>
          <p>
            {text(
              'Review stock by warehouse and record opening quantities with an attributable reason.',
            )}
          </p>
        </div>
        <div className="inventory-row-actions">
          <Button type="button" variant="outline" onClick={() => navigate('/inventory')}>
            {text('Stock items')}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/inventory/purchases')}>
            {text('Purchase invoices')}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/branches')}>
            {text('Branches and warehouses')}
          </Button>
        </div>
      </section>
      {notice && (
        <p className="inventory-notice" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <div className="inventory-error" role="alert">
          <span>{loadError}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setLoadError('')}>
            {text('Close')}
          </Button>
        </div>
      )}

      <DashboardCard
        title={text('Negative stock policy')}
        description={text(
          'This policy affects Available stock debits. Non-Sellable stock remains separate from sale and recipe consumption.',
        )}
      >
        <div className="inventory-pack-heading">
          <p>
            {text(
              policy?.negativeStockPolicy === 'allow'
                ? 'Negative Available balances are allowed.'
                : 'Available balances cannot go below zero.',
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!policy || busy}
            onClick={() => void updateNegativePolicy()}
          >
            {text(
              policy?.negativeStockPolicy === 'allow'
                ? 'Prevent negative stock'
                : 'Allow negative stock',
            )}
          </Button>
        </div>
      </DashboardCard>

      <DashboardCard
        title={text('Opening stock')}
        description={text(
          'Add current stock once before purchase invoices are available. Review the lines before posting; posted movements cannot be edited.',
        )}
      >
        {!warehouses.length && (
          <p className="inventory-note">
            {text('Create an active branch and warehouse before entering opening stock.')}
          </p>
        )}
        {!selectableItems.length && (
          <p className="inventory-note">
            {text('Create a stock item before entering opening stock.')}
          </p>
        )}
        <form className="inventory-editor" onSubmit={startReview}>
          <label>
            {text('Reason')}
            <Input
              required
              minLength={3}
              maxLength={500}
              value={reason}
              disabled={Boolean(pendingOpening)}
              onChange={(event) => setReason(event.target.value)}
              placeholder={text('Opening count after stocktake')}
            />
          </label>
          {lines.map((line, index) => {
            const selectedItem = openingItems.find((item) => item.id === line.stockItemId);
            const options = unitOptions(selectedItem);
            return (
              <fieldset
                className="inventory-opening-line"
                key={line.key}
                disabled={Boolean(pendingOpening)}
              >
                <legend>
                  {text('Opening line')} {formatDigits(String(index + 1))}
                </legend>
                <label>
                  {text('Warehouse')}
                  <select
                    required
                    value={line.warehouseId}
                    onChange={(event) => updateLine(line.key, { warehouseId: event.target.value })}
                  >
                    <option value="">{text('Choose warehouse')}</option>
                    {openingWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {formatDigits(`${warehouse.branchName} · ${warehouse.name}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {text('Stock item')}
                  <select
                    required
                    value={line.stockItemId}
                    onChange={(event) => updateLine(line.key, { stockItemId: event.target.value })}
                  >
                    <option value="">{text('Choose stock item')}</option>
                    {openingItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatDigits(`${item.name} (${item.baseUnit})`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {text('Condition')}
                  <select
                    value={line.condition}
                    onChange={(event) =>
                      updateLine(line.key, { condition: event.target.value as StockCondition })
                    }
                  >
                    <option value="available">{text('Available')}</option>
                    <option value="non_sellable">{text('Non-Sellable')}</option>
                  </select>
                </label>
                <label>
                  {text('Quantity')}
                  <Input
                    required
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                  />
                </label>
                <label>
                  {text('Unit')}
                  <select
                    required
                    value={line.unitCode}
                    onChange={(event) => updateLine(line.key, { unitCode: event.target.value })}
                  >
                    {options.map((option) => (
                      <option key={option.code} value={option.code}>
                        {formatDigits(`${option.name} (${option.code})`)}
                      </option>
                    ))}
                  </select>
                </label>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setLines((previous) =>
                        previous.filter((candidate) => candidate.key !== line.key),
                      )
                    }
                  >
                    {text('Remove line')}
                  </Button>
                )}
              </fieldset>
            );
          })}
          <div className="inventory-row-actions">
            <Button
              type="button"
              variant="outline"
              disabled={
                Boolean(pendingOpening) ||
                lines.length >= 100 ||
                !selectableItems.length ||
                !warehouses.length
              }
              onClick={() =>
                setLines((previous) => [...previous, emptyLine(selectableItems, warehouses)])
              }
            >
              {text('Add line')}
            </Button>
            <Button
              type="submit"
              disabled={Boolean(pendingOpening) || !selectableItems.length || !warehouses.length}
            >
              {text('Review opening')}
            </Button>
          </div>
        </form>
      </DashboardCard>

      <DashboardCard
        title={text('Current balances')}
        description={text(
          'Quantities are shown in each stock item’s base unit, separated by condition.',
        )}
      >
        <DataTable
          columns={balanceColumns}
          rows={balances}
          rowKey={(row) => row.id}
          caption={text('Current balances')}
          loading={balancesLoading}
          loadingState={text('Loading balances…')}
          emptyState={text('No stock balances have been posted yet.')}
        />
        <PageControls
          page={balancePage}
          history={balanceHistory}
          next={balanceNext}
          loading={balancesLoading}
          onChange={setBalancePage}
          onHistoryChange={setBalanceHistory}
          copy={text}
        />
      </DashboardCard>

      <DashboardCard
        title={text('Movement history')}
        description={text(
          'Each posted change includes its source, reason, actor, location, and quantity snapshot.',
        )}
      >
        <DataTable
          columns={movementColumns}
          rows={movements}
          rowKey={(row) => row.id}
          caption={text('Movement history')}
          loading={movementsLoading}
          loadingState={text('Loading movement history…')}
          emptyState={text('No stock movements have been posted yet.')}
        />
        <PageControls
          page={movementPage}
          history={movementHistory}
          next={movementNext}
          loading={movementsLoading}
          onChange={setMovementPage}
          onHistoryChange={setMovementHistory}
          copy={text}
        />
      </DashboardCard>

      {reviewing && (
        <DashboardDialog
          title={text('Review opening balance')}
          closeLabel={text('Close')}
          onClose={() => !busy && !pendingOpening && setReviewing(false)}
          busy={busy || Boolean(pendingOpening)}
        >
          <div className="products-dialog-body inventory-review">
            <p>
              {text(
                'Confirm the counted quantities and their stock condition. Posting creates an immutable, attributable inventory movement.',
              )}
            </p>
            <p>
              <strong>{text('Reason')}:</strong> {formatDigits(reason.trim())}
            </p>
            <ul>
              {lines.map((line) => {
                const item = openingItems.find((candidate) => candidate.id === line.stockItemId);
                const warehouse = openingWarehouses.find(
                  (candidate) => candidate.id === line.warehouseId,
                );
                const branch = branches.find((candidate) =>
                  candidate.warehouses.some(
                    (candidateWarehouse) => candidateWarehouse.id === warehouse?.id,
                  ),
                );
                return (
                  <li key={line.key}>
                    <strong>{formatDigits(item?.name ?? '')}</strong>
                    <span>
                      {formatDigits(
                        `${line.quantity} ${line.unitCode} · ${line.condition === 'available' ? text('Available') : text('Non-Sellable')}`,
                      )}
                    </span>
                    <small>
                      {formatDigits(`${branch?.name ?? ''} · ${warehouse?.name ?? ''}`)}
                    </small>
                  </li>
                );
              })}
            </ul>
          </div>
          <footer className="products-dialog-footer">
            <Button
              type="button"
              variant="outline"
              disabled={busy || Boolean(pendingOpening)}
              onClick={() => setReviewing(false)}
            >
              {text('Back to edit')}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void postOpening()}>
              {busy
                ? text('Posting…')
                : text(pendingOpening ? 'Retry posting' : 'Post opening stock')}
            </Button>
          </footer>
        </DashboardDialog>
      )}
    </main>
  );
}

function PageControls({
  page,
  history,
  next,
  loading,
  onChange,
  onHistoryChange,
  copy,
}: {
  page: PageState;
  history: PageState[];
  next: string | null;
  loading: boolean;
  onChange: (page: PageState) => void;
  onHistoryChange: (history: PageState[]) => void;
  copy: (value: string) => string;
}) {
  return (
    <div className="inventory-pagination">
      <span>{copy('Use the page controls to browse the ledger.')}</span>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || history.length === 0}
          onClick={() => {
            const previous = history.at(-1);
            onHistoryChange(history.slice(0, -1));
            onChange(previous ?? {});
          }}
        >
          {copy('Previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || !next}
          onClick={() => {
            if (!next) return;
            onHistoryChange([...history, page]);
            onChange({ cursor: next });
          }}
        >
          {copy('Next')}
        </Button>
      </div>
    </div>
  );
}

function loadPendingOpening(): CreateStockOpeningRequest | null {
  try {
    const value = sessionStorage.getItem(pendingOpeningKey);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('requestId' in parsed) ||
      typeof parsed.requestId !== 'string' ||
      !('reason' in parsed) ||
      typeof parsed.reason !== 'string' ||
      !('lines' in parsed) ||
      !Array.isArray(parsed.lines)
    ) {
      sessionStorage.removeItem(pendingOpeningKey);
      return null;
    }
    const lines = parsed.lines.filter(
      (line): line is CreateStockOpeningRequest['lines'][number] =>
        typeof line === 'object' &&
        line !== null &&
        'warehouseId' in line &&
        typeof line.warehouseId === 'string' &&
        'stockItemId' in line &&
        typeof line.stockItemId === 'string' &&
        'condition' in line &&
        (line.condition === 'available' || line.condition === 'non_sellable') &&
        'quantity' in line &&
        typeof line.quantity === 'string' &&
        'unitCode' in line &&
        typeof line.unitCode === 'string',
    );
    if (lines.length !== parsed.lines.length) {
      sessionStorage.removeItem(pendingOpeningKey);
      return null;
    }
    return { requestId: parsed.requestId, reason: parsed.reason, lines };
  } catch {
    return null;
  }
}

function loadOrCreateOpeningRequestId(): string {
  try {
    const existing = sessionStorage.getItem(openingRequestKey);
    if (
      existing &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)
    ) {
      return existing;
    }
    const created = crypto.randomUUID();
    sessionStorage.setItem(openingRequestKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function rotateOpeningRequestId(): string {
  const created = crypto.randomUUID();
  try {
    sessionStorage.setItem(openingRequestKey, created);
  } catch {
    // Keep the in-memory idempotency key when storage is unavailable.
  }
  return created;
}

function savePendingOpening(opening: CreateStockOpeningRequest): void {
  try {
    sessionStorage.setItem(openingRequestKey, opening.requestId);
    sessionStorage.setItem(pendingOpeningKey, JSON.stringify(opening));
  } catch {
    // The in-memory request remains stable for retries in this page session.
  }
}

function clearPendingOpening(): void {
  try {
    sessionStorage.removeItem(pendingOpeningKey);
  } catch {
    // The server remains authoritative for request idempotency.
  }
}
