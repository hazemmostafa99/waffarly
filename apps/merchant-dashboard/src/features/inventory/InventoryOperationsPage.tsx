import { InventoryCard } from './InventoryCard.js';
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
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, DataTable, Input, useLocale, type DataTableColumn } from '@waffarly/ui';
import type {
  CreateStockOpeningRequest,
  InventoryWarehouseSummary,
  InventoryPolicy,
  InventoryHealthPage as HealthPageData,
  StockBalance,
  StockCondition,
  StockItem,
  StockMovement,
  StockMovementBatchResult,
} from '@waffarly/contracts';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { ApiError, apiRequest, apiRequestPage, apiRequestSingle } from '../../lib/api-client.js';
import { InventoryHeader } from './InventoryHeader.js';
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

const movementLabels: Record<string, string> = {
  opening_balance: 'Opening balance',
  purchase_receipt: 'Purchase receipt',
  sale_consumption: 'Sale consumption',
  sale_restoration: 'Sale restoration',
  recipe_consumption: 'Recipe consumption',
  recipe_restoration: 'Recipe restoration',
  adjustment: 'Adjustment',
};

export function InventoryOperationsPage({
  view = 'overview',
}: {
  view?: 'overview' | 'history' | 'opening' | 'settings';
}) {
  const { locale, t, errorText, formatDigits } = useLocale();
  const text = (value: string) => inventoryCopy(value, locale, t);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const routeState = location.state as { inventorySetupWarehouseId?: unknown } | null;
  const preferredWarehouseId =
    typeof routeState?.inventorySetupWarehouseId === 'string'
      ? routeState.inventorySetupWarehouseId
      : '';
  const requestId = useRef(loadOrCreateOpeningRequestId());
  const [warehouseCache, setWarehouseCache] = useState<InventoryWarehouseSummary[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [policy, setPolicy] = useState<InventoryPolicy | null>(null);
  const [policyChoice, setPolicyChoice] = useState<'allow' | 'prevent'>('allow');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pendingOpening, setPendingOpening] = useState<CreateStockOpeningRequest | null>(null);
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<OpeningLineDraft[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [condition, setCondition] = useState('');
  const [movementItemId, setMovementItemId] = useState(searchParams.get('stockItemId') ?? '');
  const [movementKind, setMovementKind] = useState('');
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
  const [balanceListError, setBalanceListError] = useState('');
  const [movementListError, setMovementListError] = useState('');
  const [setup, setSetup] = useState<{
    warehouse: InventoryWarehouseSummary | null;
    hasItems: boolean;
    onlyOneWarehouse: boolean;
  } | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupError, setSetupError] = useState('');
  const [healthSummary, setHealthSummary] = useState<HealthPageData['summary'] | null>(null);
  const [healthSummaryLoading, setHealthSummaryLoading] = useState(true);
  const [healthSummaryError, setHealthSummaryError] = useState('');
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
    if (view !== 'opening' && view !== 'settings') return;
    setLoadError('');
    const savedOpening = view === 'opening' ? loadPendingOpening() : null;
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
        setPolicyChoice(currentPolicy.negativeStockPolicy);
        if (savedOpening) {
          setItems(itemRows);
          setWarehouseCache(warehouseRows);
          setPendingOpening(savedOpening);
          setReason(savedOpening.reason);
          setLines(savedOpening.lines.map((line) => ({ ...line, key: crypto.randomUUID() })));
          setReviewing(true);
        } else {
          setLines((existing) =>
            existing.length ? existing : [{ ...emptyLine(), warehouseId: preferredWarehouseId }],
          );
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
  }, [errorText, preferredWarehouseId, refreshKey, view]);

  useEffect(() => {
    let current = true;
    if (view !== 'overview') return;
    setSetupLoading(true);
    setSetupError('');
    const warehouseQuery = new URLSearchParams({ limit: '2', status: 'active' });
    const itemQuery = new URLSearchParams({ limit: '1', status: 'active' });
    void Promise.all([
      apiRequestPage<InventoryWarehouseSummary>(
        `/owner/inventory/warehouses?${warehouseQuery.toString()}`,
      ),
      apiRequestPage<StockItem>(`/owner/inventory/items?${itemQuery.toString()}`),
    ])
      .then(([warehousePage, itemPage]) => {
        if (!current) return;
        setSetup({
          warehouse: warehousePage.items[0] ?? null,
          hasItems: itemPage.items.length > 0,
          onlyOneWarehouse: warehousePage.items.length === 1 && !warehousePage.nextCursor,
        });
      })
      .catch((cause: unknown) => {
        if (current)
          setSetupError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not check your inventory setup.'),
          );
      })
      .finally(() => {
        if (current) setSetupLoading(false);
      });
    return () => {
      current = false;
    };
  }, [errorText, refreshKey, view]);

  useEffect(() => {
    let current = true;
    if (view !== 'overview') return;
    setHealthSummaryLoading(true);
    setHealthSummaryError('');
    void apiRequestSingle<HealthPageData>('/owner/inventory/health?limit=1')
      .then((health) => {
        if (current) setHealthSummary(health.summary);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setHealthSummaryError(
          cause instanceof Error
            ? errorText(cause.message)
            : inventoryCopy('Could not load stock health.', locale, t),
        );
      })
      .finally(() => {
        if (current) setHealthSummaryLoading(false);
      });
    return () => {
      current = false;
    };
  }, [errorText, locale, refreshKey, t, view]);

  useEffect(() => {
    let current = true;
    if (view !== 'overview') return;
    setBalancesLoading(true);
    setBalanceListError('');
    const query = new URLSearchParams({ limit: '25' });
    if (search) query.set('search', search);
    if (warehouseId) query.set('warehouseId', warehouseId);
    if (condition) query.set('condition', condition);
    if (balancePage.cursor) query.set('cursor', balancePage.cursor);
    void apiRequestPage<StockBalance>(`/owner/inventory/balances?${query.toString()}`)
      .then((page) => {
        if (current) {
          setBalances(page.items);
          setBalanceNext(page.nextCursor);
        }
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setBalanceListError(
          cause instanceof Error ? errorText(cause.message) : text('Could not load balances.'),
        );
        setBalances([]);
        setBalanceNext(null);
      })
      .finally(() => {
        if (current) setBalancesLoading(false);
      });
    return () => {
      current = false;
    };
  }, [balancePage, errorText, refreshKey, search, warehouseId, condition, view]);

  useEffect(() => {
    let current = true;
    if (view !== 'history') return;
    setMovementsLoading(true);
    setMovementListError('');
    const query = new URLSearchParams({ limit: '25' });
    if (warehouseId) query.set('warehouseId', warehouseId);
    if (movementItemId) query.set('stockItemId', movementItemId);
    if (movementKind) query.set('kind', movementKind);
    if (condition) query.set('condition', condition);
    if (movementPage.cursor) query.set('cursor', movementPage.cursor);
    void apiRequestPage<StockMovement>(`/owner/inventory/movements?${query.toString()}`)
      .then((page) => {
        if (current) {
          setMovements(page.items);
          setMovementNext(page.nextCursor);
        }
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setMovementListError(
          cause instanceof Error
            ? errorText(cause.message)
            : text('Could not load movement history.'),
        );
        setMovements([]);
        setMovementNext(null);
      })
      .finally(() => {
        if (current) setMovementsLoading(false);
      });
    return () => {
      current = false;
    };
  }, [
    movementPage,
    errorText,
    refreshKey,
    warehouseId,
    movementItemId,
    movementKind,
    condition,
    view,
  ]);

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
      cell: (row) => (
        <Badge variant={row.condition === 'available' ? 'success' : 'warning'}>
          {text(row.condition === 'available' ? 'Available' : 'Non-Sellable')}
        </Badge>
      ),
    },
    {
      id: 'quantity',
      header: text('Quantity'),
      cell: (row) => (
        <span className="inventory-quantity" dir="ltr">
          {formatDigits(`${row.quantity} ${row.baseUnit}`)}
        </span>
      ),
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
      cell: (row) => (
        <div className="inventory-table-name">
          <strong>{text(movementLabels[row.kind] ?? 'Other movement')}</strong>
          <small>{formatDigits(row.reason)}</small>
        </div>
      ),
    },
    {
      id: 'delta',
      header: text('Change'),
      cell: (row) => (
        <span className="inventory-quantity" dir="ltr">
          {formatDigits(
            `${row.baseDelta.startsWith('-') ? '' : '+'}${row.baseDelta} ${row.baseUnit}`,
          )}
        </span>
      ),
    },
    { id: 'actor', header: text('Recorded by'), cell: (row) => formatDigits(row.actor) },
    {
      id: 'detail',
      header: text('Details'),
      cell: (row) => (
        <Link className="inventory-detail-link" to={`/inventory/movements/${row.id}`}>
          {text('View movement')}
        </Link>
      ),
    },
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
    if (!policy || busy || policyChoice === policy.negativeStockPolicy) return;
    setBusy(true);
    setLoadError('');
    try {
      const updated = await apiRequest<InventoryPolicy>('/owner/inventory/policy', {
        method: 'PATCH',
        body: JSON.stringify({
          revision: policy.revision,
          negativeStockPolicy: policyChoice,
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

  const hasOverviewFilters = Boolean(search || searchDraft || warehouseId || condition);

  return (
    <div className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader
        title={
          view === 'overview'
            ? 'Stock overview'
            : view === 'history'
              ? 'Movement history'
              : view === 'opening'
                ? 'Opening stock'
                : 'Inventory settings'
        }
        description={
          view === 'overview'
            ? 'See what is in stock and record incoming purchases.'
            : view === 'history'
              ? 'Follow every stock change, its reason, and who recorded it.'
              : view === 'opening'
                ? 'Enter the quantities already in your warehouse before you start recording purchases.'
                : 'Choose how stock availability works for your business.'
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/inventory/items?new=1')}
            >
              {text('Add item')}
            </Button>
            <Button type="button" onClick={() => navigate('/inventory/purchases/new')}>
              {text('Record purchase')}
            </Button>
          </>
        }
      />
      {notice && (
        <p className="inventory-notice" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <div className="inventory-error" role="alert">
          <span>{loadError}</span>
          <span className="inventory-error-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLoadError('');
                setRefreshKey((key) => key + 1);
              }}
            >
              {text('Reload data')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setLoadError('')}>
              {text('Close')}
            </Button>
          </span>
        </div>
      )}

      {view === 'settings' && (
        <InventoryCard
          title={text('Negative stock policy')}
          description={text(
            'This policy affects Available stock debits. Non-Sellable stock remains separate from sale and recipe consumption.',
          )}
        >
          <fieldset className="inventory-policy-options" disabled={!policy || busy}>
            <legend>{text('Choose your stock policy')}</legend>
            {(['allow', 'prevent'] as const).map((choice) => (
              <label key={choice}>
                <input
                  type="radio"
                  name="negative-stock-policy"
                  value={choice}
                  checked={policyChoice === choice}
                  onChange={() => setPolicyChoice(choice)}
                />
                <span>
                  <strong>
                    {text(choice === 'allow' ? 'Allow negative stock' : 'Prevent negative stock')}
                  </strong>
                  <small>
                    {text(
                      choice === 'allow'
                        ? 'Stock consumption can continue below zero. Negative balances need follow-up.'
                        : 'Stock consumption is blocked when the available quantity is insufficient.',
                    )}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="inventory-note">
            {text(
              'This policy applies to all branches and warehouses. Non-sellable stock is never used for sales or recipes.',
            )}
          </p>
          <Button
            type="button"
            disabled={!policy || busy || policyChoice === policy.negativeStockPolicy}
            onClick={() => void updateNegativePolicy()}
          >
            {text(busy ? 'Saving…' : 'Save policy')}
          </Button>
        </InventoryCard>
      )}

      {view === 'overview' && (
        <InventoryCard
          title={text('Stock health summary')}
          description={text(
            'Counts cover configured item and warehouse pairs across the selected merchant scope.',
          )}
          action={
            <Button type="button" variant="outline" onClick={() => navigate('/inventory/health')}>
              {text('View stock health')}
            </Button>
          }
        >
          {healthSummaryError ? (
            <div className="inventory-error" role="alert">
              <span>{healthSummaryError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRefreshKey((key) => key + 1)}
              >
                {text('Retry')}
              </Button>
            </div>
          ) : healthSummaryLoading ? (
            <p role="status">{text('Loading stock health…')}</p>
          ) : (
            <div className="inventory-health-summary" aria-live="polite">
              <div>
                <strong>{formatDigits(String(healthSummary?.lowStockItemLocations ?? 0))}</strong>
                <span>{text('Low stock item locations')}</span>
              </div>
              <div>
                <strong>{formatDigits(String(healthSummary?.healthyItemLocations ?? 0))}</strong>
                <span>{text('Healthy item locations')}</span>
              </div>
              <div>
                <strong>{formatDigits(String(healthSummary?.configuredItemLocations ?? 0))}</strong>
                <span>{text('Configured item locations')}</span>
              </div>
            </div>
          )}
          <p className="inventory-note inventory-health-note">
            {text('Health uses Available stock only. Non-Sellable quantities are excluded.')}
          </p>
        </InventoryCard>
      )}

      {view === 'opening' && (
        <InventoryCard
          title={text('Opening stock')}
          description={text(
            'Enter your starting quantities, then review before posting. Use purchase invoices for new deliveries.',
          )}
        >
          <form className="inventory-editor" onSubmit={startReview}>
            <p className="inventory-note">
              {text('Opening entries add to existing balances. They do not replace stock counts.')}
            </p>
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
                      allowCreate
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
        </InventoryCard>
      )}

      {(view === 'overview' || view === 'history') && (
        <div className="inventory-filters inventory-overview-filters">
          {view === 'overview' && (
            <form
              className="inventory-search"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchDraft.trim());
                setBalancePage({});
                setBalanceHistory([]);
              }}
            >
              <label htmlFor="stock-search">{text('Search stock items')}</label>
              <div>
                <Input
                  id="stock-search"
                  type="search"
                  value={searchDraft}
                  maxLength={160}
                  placeholder={text('Search by item name')}
                  onChange={(event) => setSearchDraft(event.target.value)}
                />
                <Button type="submit" variant="outline">
                  {text('Search')}
                </Button>
              </div>
            </form>
          )}
          <div className="inventory-picker-field">
            <span>{text('Filter by warehouse')}</span>
            <WarehousePicker
              value={warehouseId}
              label={text('Filter by warehouse')}
              searchMode="combobox"
              required={false}
              emptyLabel={text('All warehouses')}
              onSelect={(warehouse) => {
                setWarehouseId(warehouse?.id ?? '');
                setBalancePage({});
                setBalanceHistory([]);
                setMovementPage({});
                setMovementHistory([]);
              }}
            />
          </div>
          {view === 'history' && (
            <>
              <div className="inventory-picker-field">
                <span>{text('Filter by item')}</span>
                <StockItemPicker
                  value={movementItemId}
                  label={text('Filter by item')}
                  onSelect={(item) => {
                    setMovementItemId(item?.id ?? '');
                    setMovementPage({});
                    setMovementHistory([]);
                  }}
                />
              </div>
              <label className="inventory-filter-status">
                {text('Movement type')}
                <select
                  value={movementKind}
                  onChange={(event) => {
                    setMovementKind(event.target.value);
                    setMovementPage({});
                    setMovementHistory([]);
                  }}
                >
                  <option value="">{text('All')}</option>
                  {Object.entries(movementLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {text(label)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {
            <label className="inventory-filter-status">
              {text('Condition')}
              <select
                value={condition}
                onChange={(event) => {
                  setCondition(event.target.value);
                  setBalancePage({});
                  setBalanceHistory([]);
                  setMovementPage({});
                  setMovementHistory([]);
                }}
              >
                <option value="">{text('All')}</option>
                <option value="available">{text('Available')}</option>
                <option value="non_sellable">{text('Non-Sellable')}</option>
              </select>
            </label>
          }
          {(warehouseId ||
            search ||
            condition ||
            searchDraft ||
            movementItemId ||
            movementKind) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setSearchDraft('');
                setWarehouseId('');
                setCondition('');
                setMovementItemId('');
                setMovementKind('');
                setBalancePage({});
                setBalanceHistory([]);
                setMovementPage({});
                setMovementHistory([]);
              }}
            >
              {text('Clear filters')}
            </Button>
          )}
        </div>
      )}
      {view === 'overview' && (
        <InventoryCard
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
            loading={balancesLoading || (!hasOverviewFilters && setupLoading)}
            loadingState={text('Loading inventory setup…')}
            emptyState={
              <div className="inventory-empty">
                {balanceListError ? (
                  <>
                    <h3>{text('Could not load balances.')}</h3>
                    <p>{balanceListError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRefreshKey((key) => key + 1)}
                    >
                      {text('Retry')}
                    </Button>
                  </>
                ) : hasOverviewFilters ? (
                  <>
                    <h3>{text('No matching stock')}</h3>
                    <p>{text('Try another search or clear the filters.')}</p>
                  </>
                ) : setupError ? (
                  <>
                    <h3>{text('Could not check your inventory setup.')}</h3>
                    <p>{setupError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSetupError('');
                        setRefreshKey((key) => key + 1);
                      }}
                    >
                      {text('Reload setup')}
                    </Button>
                  </>
                ) : !setup?.warehouse ? (
                  <>
                    <h3>{text('Set up a branch and warehouse')}</h3>
                    <p>
                      {text(
                        setup?.hasItems
                          ? 'Your stock items are ready. Add an active branch and warehouse before entering stock or receiving purchases.'
                          : 'Add a branch and warehouse first. Then create stock items and enter the quantities you already have.',
                      )}
                    </p>
                    <div className="inventory-empty-actions">
                      <Button type="button" onClick={() => navigate('/branches')}>
                        {text('Set up branch and warehouse')}
                      </Button>
                      {!setup?.hasItems && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate('/inventory/items')}
                        >
                          {text('Add stock items')}
                        </Button>
                      )}
                    </div>
                  </>
                ) : !setup.hasItems ? (
                  <>
                    <h3>{text('Your warehouse is ready')}</h3>
                    <p>
                      {text('Add your first stock item before recording a balance or purchase.')}{' '}
                      <strong>
                        {formatDigits(`${setup.warehouse.branchName} · ${setup.warehouse.name}`)}
                      </strong>
                    </p>
                    <Button type="button" onClick={() => navigate('/inventory/items')}>
                      {text('Add first stock item')}
                    </Button>
                  </>
                ) : (
                  <>
                    <h3>{text('Start tracking your stock')}</h3>
                    <p>
                      {setup.onlyOneWarehouse ? (
                        <>
                          {text('Your only active warehouse will be preselected:')}{' '}
                          <strong>
                            {formatDigits(
                              `${setup.warehouse.branchName} · ${setup.warehouse.name}`,
                            )}
                          </strong>
                        </>
                      ) : (
                        text('Choose the destination warehouse when you enter starting stock.')
                      )}
                    </p>
                    <div className="inventory-empty-actions">
                      <Button
                        type="button"
                        onClick={() =>
                          navigate('/inventory/opening', {
                            state: setup.onlyOneWarehouse
                              ? { inventorySetupWarehouseId: setup.warehouse?.id }
                              : undefined,
                          })
                        }
                      >
                        {text('Add starting stock')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/inventory/purchases/new')}
                      >
                        {text('Record purchase')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            }
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
        </InventoryCard>
      )}

      {view === 'history' && (
        <InventoryCard
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
            emptyState={
              movementListError ? (
                <div className="inventory-empty">
                  <h3>{text('Could not load movement history.')}</h3>
                  <p>{movementListError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRefreshKey((key) => key + 1)}
                  >
                    {text('Retry')}
                  </Button>
                </div>
              ) : (
                text('No stock movements have been posted yet.')
              )
            }
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
        </InventoryCard>
      )}

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
    </div>
  );
}
