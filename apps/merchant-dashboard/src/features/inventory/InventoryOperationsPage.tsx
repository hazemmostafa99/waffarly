import {
  loadPendingOpening,
  loadOrCreateOpeningRequestId,
  rotateOpeningRequestId,
  savePendingOpening,
  clearPendingOpening,
} from './opening-retry.js';
import {
  CursorPageControls as PageControls,
  type CursorPageState as PageState,
} from '../../components/CursorPageControls.js';
import { cacheStockItem, stockUnitOptions } from './stock-unit-options.js';
import { StockItemPicker, WarehousePicker } from './components/InventoryPickers.js';
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
  InventoryWarehouseSummary,
  InventoryPolicy,
  StockBalance,
  StockCondition,
  StockItem,
  StockMovement,
  StockMovementBatchResult,
} from '@waffarly/contracts';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { ApiError, apiRequest, apiRequestPage } from '../../lib/api-client.js';
import { inventoryCopy } from './inventory-copy.js';

type OpeningLineDraft = {
  key: string;
  warehouseId: string;
  stockItemId: string;
  condition: StockCondition;
  quantity: string;
  unitCode: string;
};

function emptyLine(): OpeningLineDraft {
  return {
    key: crypto.randomUUID(),
    warehouseId: '',
    stockItemId: '',
    condition: 'available',
    quantity: '1',
    unitCode: '',
  };
}

export function InventoryOperationsPage() {
  const { locale, t, errorText, formatDigits } = useLocale();
  const text = (value: string) => inventoryCopy(value, locale, t);
  const navigate = useNavigate();
  const requestId = useRef(loadOrCreateOpeningRequestId());
  const [warehouseCache, setWarehouseCache] = useState<InventoryWarehouseSummary[]>([]);
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
  const openingWarehouses = warehouseCache;
  const openingItems = items;
  function rememberWarehouse(warehouse: InventoryWarehouseSummary) {
    setWarehouseCache((current) => [
      ...current.filter((item) => item.id !== warehouse.id),
      warehouse,
    ]);
  }

  useEffect(() => {
    let current = true;
    setLoadError('');
    const savedOpening = loadPendingOpening();
    const loadReferences = async () => {
      if (!savedOpening)
        return { itemRows: [] as StockItem[], warehouseRows: [] as InventoryWarehouseSummary[] };
      const [itemRows, warehouseRows] = await Promise.all([
        Promise.all(
          [...new Set(savedOpening.lines.map((line) => line.stockItemId))].map((id) =>
            apiRequest<StockItem>(`/owner/inventory/items/${id}`),
          ),
        ),
        Promise.all(
          [...new Set(savedOpening.lines.map((line) => line.warehouseId))].map((id) =>
            apiRequest<InventoryWarehouseSummary>(`/owner/inventory/warehouses/${id}`),
          ),
        ),
      ]);
      return { itemRows, warehouseRows };
    };
    void Promise.all([apiRequest<InventoryPolicy>('/owner/inventory/policy'), loadReferences()])
      .then(([currentPolicy, { itemRows, warehouseRows }]) => {
        if (!current) return;
        setPolicy(currentPolicy);
        if (savedOpening) {
          setItems(itemRows);
          setWarehouseCache(warehouseRows);
          setPendingOpening(savedOpening);
          setReason(savedOpening.reason);
          setLines(savedOpening.lines.map((line) => ({ ...line, key: crypto.randomUUID() })));
          setReviewing(true);
        } else {
          setLines((existing) => (existing.length ? existing : [emptyLine()]));
        }
      })
      .catch((cause: unknown) => {
        if (!current) return;
        if (savedOpening && cause instanceof ApiError && cause.statusCode === 404) {
          clearPendingOpening();
          setPendingOpening(null);
          setReviewing(false);
          requestId.current = rotateOpeningRequestId();
          setReason('');
          setLines([emptyLine()]);
          setLoadError(text('Saved opening retry belongs to another merchant and was cleared.'));
        } else {
          setLoadError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load inventory operations.'),
          );
        }
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
        return next;
      }),
    );
  }

  function startReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadError('');
    if (
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
      setLines([emptyLine()]);
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
            const options = stockUnitOptions(selectedItem);
            return (
              <fieldset
                className="inventory-opening-line"
                key={line.key}
                disabled={Boolean(pendingOpening)}
              >
                <legend>
                  {text('Opening line')} {formatDigits(String(index + 1))}
                </legend>
                <div className="inventory-picker-field">
                  {text('Warehouse')}
                  <WarehousePicker
                    value={line.warehouseId}
                    label={text('Warehouse')}
                    disabled={Boolean(pendingOpening)}
                    onResolve={rememberWarehouse}
                    onSelect={(warehouse) => {
                      if (warehouse) rememberWarehouse(warehouse);
                      updateLine(line.key, { warehouseId: warehouse?.id ?? '' });
                    }}
                  />
                </div>
                <div className="inventory-picker-field">
                  {text('Stock item')}
                  <StockItemPicker
                    value={line.stockItemId}
                    label={text('Stock item')}
                    disabled={Boolean(pendingOpening)}
                    onResolve={(item) => setItems((current) => cacheStockItem(current, item))}
                    onSelect={(item) => {
                      if (item) setItems((current) => cacheStockItem(current, item));
                      updateLine(line.key, {
                        stockItemId: item?.id ?? '',
                        unitCode: item?.baseUnit ?? '',
                      });
                    }}
                  />
                </div>
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
              disabled={Boolean(pendingOpening) || lines.length >= 100}
              onClick={() => setLines((previous) => [...previous, emptyLine()])}
            >
              {text('Add line')}
            </Button>
            <Button type="submit" disabled={Boolean(pendingOpening)}>
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
                return (
                  <li key={line.key}>
                    <strong>{formatDigits(item?.name ?? '')}</strong>
                    <span>
                      {formatDigits(
                        `${line.quantity} ${line.unitCode} · ${line.condition === 'available' ? text('Available') : text('Non-Sellable')}`,
                      )}
                    </span>
                    <small>
                      {formatDigits(`${warehouse?.branchName ?? ''} · ${warehouse?.name ?? ''}`)}
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
