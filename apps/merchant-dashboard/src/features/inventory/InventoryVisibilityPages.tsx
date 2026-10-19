import { CursorPageControls, type CursorPageState } from '../../components/CursorPageControls.js';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { apiRequest, apiRequestPage, apiRequestSingle } from '../../lib/api-client.js';
import type {
  InventoryHealthPage as HealthPageData,
  InventoryReorderThreshold,
  InventoryStockHealth,
  StockBalance,
  StockItem,
  StockMovement,
} from '@waffarly/contracts';
import { Badge, Button, DataTable, Input, useLocale, type DataTableColumn } from '@waffarly/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryCard } from './InventoryCard.js';
import { InventoryHeader } from './InventoryHeader.js';
import { StockItemPicker, WarehousePicker } from './components/InventoryPickers.js';
import { stockUnitLabel } from './stock-unit-options.js';
import { inventoryCopy } from './inventory-copy.js';

type ThresholdEditorState = { row: InventoryStockHealth | null; key: string };
const movementLabels: Record<string, string> = {
  opening_balance: 'Opening balance',
  purchase_receipt: 'Purchase receipt',
  sale_consumption: 'Sale consumption',
  sale_restoration: 'Sale restoration',
  recipe_consumption: 'Recipe consumption',
  recipe_restoration: 'Recipe restoration',
  adjustment: 'Adjustment',
};
const sourceLabels: Record<string, string> = {
  opening_balance: 'Opening balance',
  purchase_invoice: 'Purchase receipt',
  recipe_order: 'Related recipe order',
  recipe_cancel: 'Recipe restoration',
  pos_sale: 'POS sale',
  pos_sale_cancel: 'Sale restoration',
};

export function InventoryHealthPage() {
  const { locale, t, errorText, formatDigits } = useLocale();
  const text = useCallback((value: string) => inventoryCopy(value, locale, t), [locale, t]);
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedStockItemId = searchParams.get('stockItemId') ?? '';
  const [focusedItem, setFocusedItem] = useState<StockItem | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<CursorPageState>({});
  const [history, setHistory] = useState<CursorPageState[]>([]);
  const [data, setData] = useState<HealthPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editor, setEditor] = useState<ThresholdEditorState | null>(null);
  const [draftWarehouseId, setDraftWarehouseId] = useState('');
  const [draftStockItemId, setDraftStockItemId] = useState('');
  const [draftQuantity, setDraftQuantity] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!focusedStockItemId) {
      setFocusedItem(null);
      return;
    }
    let current = true;
    void apiRequest<StockItem>(`/owner/inventory/items/${focusedStockItemId}`)
      .then((item) => current && setFocusedItem(item))
      .catch(() => current && setFocusedItem(null));
    return () => {
      current = false;
    };
  }, [focusedStockItemId]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ limit: '25' });
    if (warehouseId) query.set('warehouseId', warehouseId);
    if (focusedStockItemId) query.set('stockItemId', focusedStockItemId);
    if (search) query.set('search', search);
    if (page.cursor) query.set('cursor', page.cursor);
    void apiRequestSingle<HealthPageData>(`/owner/inventory/health?${query.toString()}`)
      .then((result) => current && setData(result))
      .catch((cause: unknown) => {
        if (!current) return;
        setData(null);
        setError(
          cause instanceof Error ? errorText(cause.message) : text('Could not load stock health.'),
        );
      })
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [errorText, focusedStockItemId, page, refreshKey, search, text, warehouseId]);

  function openEditor(row: InventoryStockHealth | null) {
    setActionError('');
    setDraftWarehouseId(row?.warehouseId ?? '');
    setDraftStockItemId(row?.stockItemId ?? focusedStockItemId);
    setDraftQuantity(row?.minimumAvailableQuantity ?? '');
    setEditor({ row, key: crypto.randomUUID() });
  }

  function clearFilters() {
    setWarehouseId('');
    setSearch('');
    setSearchDraft('');
    setPage({});
    setHistory([]);
    if (focusedStockItemId) setSearchParams({}, { replace: true });
  }

  async function saveThreshold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    if (!draftWarehouseId || !draftStockItemId || !/^\d+(?:\.\d{1,6})?$/.test(draftQuantity)) {
      setActionError(text('Enter a location, stock item, and non-negative threshold.'));
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      await apiRequest<InventoryReorderThreshold>(
        `/owner/inventory/warehouses/${draftWarehouseId}/items/${draftStockItemId}/reorder-threshold`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            revision: editor.row?.revision ?? null,
            minimumAvailableQuantity: draftQuantity,
          }),
        },
      );
      setEditor(null);
      setPage({});
      setHistory([]);
      setRefreshKey((key) => key + 1);
      setActionError('');
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save the reorder threshold.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function clearThreshold() {
    if (!editor?.row || busy) return;
    setBusy(true);
    setActionError('');
    try {
      await apiRequest<{ cleared: true }>(
        `/owner/inventory/warehouses/${editor.row.warehouseId}/items/${editor.row.stockItemId}/reorder-threshold`,
        { method: 'DELETE', body: JSON.stringify({ revision: editor.row.revision }) },
      );
      setEditor(null);
      setPage({});
      setHistory([]);
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not clear the reorder threshold.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<InventoryStockHealth>[] = [
    {
      id: 'state',
      header: text('Status'),
      cell: (row) => (
        <Badge variant={row.state === 'low' ? 'warning' : 'success'}>
          {text(row.state === 'low' ? 'Low stock' : 'Healthy')}
        </Badge>
      ),
    },
    {
      id: 'item',
      header: text('Stock item'),
      cell: (row) => (
        <Link className="inventory-detail-link" to={`/inventory/items/${row.stockItemId}`}>
          {formatDigits(row.stockItemName)}
        </Link>
      ),
    },
    {
      id: 'location',
      header: text('Warehouse'),
      cell: (row) => formatDigits(`${row.branchName} · ${row.warehouseName}`),
    },
    {
      id: 'available',
      header: text('Available / reorder point'),
      cell: (row) => (
        <span className="inventory-quantity" dir="ltr">
          {formatDigits(
            `${row.availableQuantity} / ${row.minimumAvailableQuantity} ${row.baseUnit}`,
          )}
        </span>
      ),
    },
    {
      id: 'action',
      header: text('Action'),
      cell: (row) => (
        <Button type="button" variant="outline" size="sm" onClick={() => openEditor(row)}>
          {text('Edit threshold')}
        </Button>
      ),
    },
  ];

  return (
    <main className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader
        title={focusedItem ? focusedItem.name : 'Stock health'}
        description={
          focusedItem
            ? 'Review this item by location and update its reorder points.'
            : 'Review configured reorder points against Available stock at each warehouse.'
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => openEditor(null)}>
              {text('Add reorder point')}
            </Button>
            {focusedItem && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/inventory/items/${focusedItem.id}`)}
              >
                {text('Back to stock item')}
              </Button>
            )}
          </>
        }
      />
      {error && (
        <div className="inventory-error" role="alert">
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            {text('Retry')}
          </Button>
        </div>
      )}
      <InventoryCard
        title={text('Stock health summary')}
        description={text(
          'Counts cover all configured item and warehouse pairs in this filter, not just this page.',
        )}
      >
        {loading ? (
          <p role="status">{text('Loading stock health…')}</p>
        ) : data ? (
          <div className="inventory-health-summary" aria-live="polite">
            <div>
              <strong>{formatDigits(String(data.summary.lowStockItemLocations))}</strong>
              <span>{text('Low stock item locations')}</span>
            </div>
            <div>
              <strong>{formatDigits(String(data.summary.healthyItemLocations))}</strong>
              <span>{text('Healthy item locations')}</span>
            </div>
            <div>
              <strong>{formatDigits(String(data.summary.configuredItemLocations))}</strong>
              <span>{text('Configured item locations')}</span>
            </div>
          </div>
        ) : null}
        <p className="inventory-note inventory-health-note">
          {text(
            'Health uses Available stock only. Non-Sellable quantities are excluded, and thresholds use the item base unit.',
          )}
        </p>
      </InventoryCard>
      <InventoryCard
        title={text('Reorder points')}
        description={text('A reorder point is configured per stock item and warehouse.')}
      >
        <div className="inventory-filters">
          <form
            className="inventory-search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchDraft.trim());
              setPage({});
              setHistory([]);
            }}
          >
            <label htmlFor="health-search">{text('Search stock health')}</label>
            <div>
              <Input
                id="health-search"
                value={searchDraft}
                maxLength={160}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={text('Search by item or location')}
              />
              <Button type="submit" variant="outline">
                {text('Search')}
              </Button>
            </div>
          </form>
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
                setPage({});
                setHistory([]);
              }}
            />
          </div>
          {(search || searchDraft || warehouseId || focusedStockItemId) && (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              {text('Clear filters')}
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.thresholdId}
          caption={text('Reorder points')}
          loading={loading}
          loadingState={text('Loading stock health…')}
          emptyState={
            error ? (
              text('Could not load stock health.')
            ) : (
              <div className="inventory-empty">
                <h3>
                  {text(
                    focusedStockItemId
                      ? 'No reorder points for this item'
                      : 'No reorder points configured',
                  )}
                </h3>
                <p>
                  {text(
                    'Add a reorder point for a stock item and warehouse to start monitoring low stock.',
                  )}
                </p>
                <Button onClick={() => openEditor(null)}>{text('Add reorder point')}</Button>
              </div>
            )
          }
        />
        <CursorPageControls
          page={page}
          history={history}
          next={data?.nextCursor ?? null}
          loading={loading}
          onChange={setPage}
          onHistoryChange={setHistory}
          copy={text}
        />
      </InventoryCard>
      {editor && (
        <DashboardDialog
          title={text(editor.row ? 'Edit reorder point' : 'Add reorder point')}
          closeLabel={text('Close')}
          onClose={() => !busy && setEditor(null)}
          busy={busy}
        >
          <form className="inventory-editor" onSubmit={(event) => void saveThreshold(event)}>
            {actionError && (
              <p className="inventory-error" role="alert">
                {actionError}
              </p>
            )}
            <div className="inventory-picker-field">
              <span>{text('Warehouse')}</span>
              <WarehousePicker
                value={draftWarehouseId}
                label={text('Warehouse')}
                required
                onSelect={(warehouse) => setDraftWarehouseId(warehouse?.id ?? '')}
              />
            </div>
            <div className="inventory-picker-field">
              <span>{text('Stock item')}</span>
              <StockItemPicker
                value={draftStockItemId}
                label={text('Stock item')}
                onSelect={(item) => setDraftStockItemId(item?.id ?? '')}
              />
            </div>
            <label>
              {text('Minimum Available quantity')}{' '}
              <small>{text('Enter the item base unit.')}</small>
              <Input
                required
                inputMode="decimal"
                value={draftQuantity}
                onChange={(event) => setDraftQuantity(event.target.value)}
                placeholder="0"
              />
            </label>
            <p className="inventory-note">
              {text(
                'When Available stock is at or below this amount, the location is marked low stock. A zero threshold alerts at zero or below.',
              )}
            </p>
            <div className="products-dialog-footer">
              {editor.row && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void clearThreshold()}
                >
                  {text('Clear threshold')}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                {text('Cancel')}
              </Button>
              <Button type="submit" disabled={busy}>
                {text(busy ? 'Saving…' : 'Save threshold')}
              </Button>
            </div>
          </form>
        </DashboardDialog>
      )}
    </main>
  );
}

export function StockItemDetailPage() {
  const { itemId = '' } = useParams();
  const { locale, t, errorText, formatDigits } = useLocale();
  const text = useCallback((value: string) => inventoryCopy(value, locale, t), [locale, t]);
  const navigate = useNavigate();
  const [item, setItem] = useState<StockItem | null>(null);
  const [health, setHealth] = useState<HealthPageData | null>(null);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [balancePage, setBalancePage] = useState<CursorPageState>({});
  const [balanceHistory, setBalanceHistory] = useState<CursorPageState[]>([]);
  const [balanceNext, setBalanceNext] = useState<string | null>(null);
  const [movementPage, setMovementPage] = useState<CursorPageState>({});
  const [movementHistory, setMovementHistory] = useState<CursorPageState[]>([]);
  const [movementNext, setMovementNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const balanceQuery = new URLSearchParams({ limit: '25', stockItemId: itemId });
    if (balancePage.cursor) balanceQuery.set('cursor', balancePage.cursor);
    const movementQuery = new URLSearchParams({ limit: '10', stockItemId: itemId });
    if (movementPage.cursor) movementQuery.set('cursor', movementPage.cursor);
    void Promise.all([
      apiRequest<StockItem>(`/owner/inventory/items/${itemId}`),
      apiRequestPage<StockBalance>(`/owner/inventory/balances?${balanceQuery.toString()}`),
      apiRequestPage<StockMovement>(`/owner/inventory/movements?${movementQuery.toString()}`),
      apiRequestSingle<HealthPageData>(
        `/owner/inventory/health?limit=25&stockItemId=${encodeURIComponent(itemId)}`,
      ),
    ])
      .then(([stockItem, balancePageResult, movementPageResult, healthResult]) => {
        if (!current) return;
        setItem(stockItem);
        setBalances(balancePageResult.items);
        setBalanceNext(balancePageResult.nextCursor);
        setMovements(movementPageResult.items);
        setMovementNext(movementPageResult.nextCursor);
        setHealth(healthResult);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setError(
          cause instanceof Error
            ? errorText(cause.message)
            : text('Could not load stock item details.'),
        );
      })
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [balancePage, errorText, itemId, movementPage, refreshKey, text]);

  const balanceColumns: DataTableColumn<StockBalance>[] = [
    {
      id: 'location',
      header: text('Warehouse'),
      cell: (row) => formatDigits(`${row.branchName} · ${row.warehouseName}`),
    },
    {
      id: 'condition',
      header: text('Condition'),
      cell: (row) => text(row.condition === 'available' ? 'Available' : 'Non-Sellable'),
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
      id: 'date',
      header: text('Date'),
      cell: (row) => formatDigits(new Date(row.createdAt).toLocaleString(locale)),
    },
    {
      id: 'type',
      header: text('Movement'),
      cell: (row) => text(movementLabels[row.kind] ?? 'Other movement'),
    },
    {
      id: 'change',
      header: text('Change'),
      cell: (row) => (
        <span className="inventory-quantity" dir="ltr">
          {formatDigits(
            `${row.baseDelta.startsWith('-') ? '' : '+'}${row.baseDelta} ${row.baseUnit}`,
          )}
        </span>
      ),
    },
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

  return (
    <main className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader
        title={item?.name ?? 'Stock item details'}
        description={
          item?.description ||
          'Review this stock item across warehouses and its latest movement history.'
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/inventory/items')}>
              {text('Back to items')}
            </Button>
            <Button
              type="button"
              onClick={() =>
                navigate(`/inventory/health?stockItemId=${encodeURIComponent(itemId)}`)
              }
            >
              {text('Manage reorder points')}
            </Button>
          </>
        }
      />
      {error && (
        <div className="inventory-error" role="alert">
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            {text('Retry')}
          </Button>
        </div>
      )}
      <InventoryCard
        title={text('Stock health summary')}
        description={text('Only configured location thresholds are counted.')}
      >
        {loading ? (
          <p role="status">{text('Loading stock health…')}</p>
        ) : health ? (
          <div className="inventory-health-summary">
            <div>
              <strong>{formatDigits(String(health.summary.lowStockItemLocations))}</strong>
              <span>{text('Low stock item locations')}</span>
            </div>
            <div>
              <strong>{formatDigits(String(health.summary.healthyItemLocations))}</strong>
              <span>{text('Healthy item locations')}</span>
            </div>
            <div>
              <strong>{formatDigits(String(health.summary.configuredItemLocations))}</strong>
              <span>{text('Configured item locations')}</span>
            </div>
          </div>
        ) : null}
        {item && (
          <p className="inventory-note">
            {text('Base unit')}: {text(item.baseUnit)} ·{' '}
            {text('Thresholds compare Available stock in this base unit.')}
          </p>
        )}
      </InventoryCard>
      <InventoryCard
        title={text('Current stock by location')}
        description={text('Balances are separated by stock condition and warehouse.')}
      >
        <DataTable
          columns={balanceColumns}
          rows={balances}
          rowKey={(row) => row.id}
          caption={text('Current stock by location')}
          loading={loading}
          loadingState={text('Loading stock balances…')}
          emptyState={text('No stock balance has been posted for this item yet.')}
        />
        <CursorPageControls
          page={balancePage}
          history={balanceHistory}
          next={balanceNext}
          loading={loading}
          onChange={setBalancePage}
          onHistoryChange={setBalanceHistory}
          copy={text}
        />
      </InventoryCard>
      <InventoryCard
        title={text('Recent movements')}
        description={text('Open a movement to see its source, reason, and full posting details.')}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/inventory/history?stockItemId=${encodeURIComponent(itemId)}`)}
          >
            {text('View movement history')}
          </Button>
        }
      >
        <DataTable
          columns={movementColumns}
          rows={movements}
          rowKey={(row) => row.id}
          caption={text('Recent movements')}
          loading={loading}
          loadingState={text('Loading movement history…')}
          emptyState={text('No stock movements have been posted yet.')}
        />
        <CursorPageControls
          page={movementPage}
          history={movementHistory}
          next={movementNext}
          loading={loading}
          onChange={setMovementPage}
          onHistoryChange={setMovementHistory}
          copy={text}
        />
      </InventoryCard>
    </main>
  );
}

export function StockMovementDetailPage() {
  const { movementId = '' } = useParams();
  const { locale, t, errorText, formatDigits } = useLocale();
  const text = useCallback((value: string) => inventoryCopy(value, locale, t), [locale, t]);
  const navigate = useNavigate();
  const [movement, setMovement] = useState<StockMovement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    void apiRequest<StockMovement>(`/owner/inventory/movements/${movementId}`)
      .then((result) => current && setMovement(result))
      .catch(
        (cause: unknown) =>
          current &&
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load movement details.'),
          ),
      )
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [errorText, movementId, refreshKey, text]);

  const orderSourceTypes = new Set(['recipe_order', 'recipe_cancel']);
  const linkedOrderId =
    movement && orderSourceTypes.has(movement.sourceType) ? movement.sourceId.split(':')[0] : '';
  const sourceHref =
    movement?.sourceType === 'purchase_invoice'
      ? `/inventory/purchases/${movement.sourceId}`
      : linkedOrderId
        ? `/orders?orderId=${encodeURIComponent(linkedOrderId)}`
        : null;

  return (
    <main className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader
        title="Movement details"
        description="Review the immutable quantity change and follow its recorded source."
        actions={
          <Button type="button" variant="outline" onClick={() => navigate('/inventory/history')}>
            {text('Back to movement history')}
          </Button>
        }
      />
      {error && (
        <div className="inventory-error" role="alert">
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            {text('Retry')}
          </Button>
        </div>
      )}
      <InventoryCard title={text('Movement summary')}>
        {loading ? (
          <p role="status">{text('Loading movement details…')}</p>
        ) : movement ? (
          <div className="inventory-movement-detail">
            <section className="inventory-movement-hero" aria-label={text('Movement summary')}>
              <div className="inventory-movement-primary">
                <div className="inventory-movement-meta">
                  <span>{text(movementLabels[movement.kind] ?? 'Other movement')}</span>
                  <Badge variant={movement.condition === 'available' ? 'success' : 'warning'}>
                    {text(movement.condition === 'available' ? 'Available' : 'Non-Sellable')}
                  </Badge>
                </div>
                <Link
                  className="inventory-movement-item"
                  to={`/inventory/items/${movement.stockItemId}`}
                >
                  {formatDigits(movement.stockItemName)}
                </Link>
                <div className="inventory-movement-location">
                  <span>{formatDigits(movement.warehouseName)}</span>
                  <small>{formatDigits(movement.branchName)}</small>
                </div>
              </div>
              <div className="inventory-movement-change">
                <span>{text('Change')}</span>
                <strong
                  className={
                    movement.baseDelta.startsWith('-') ? 'is-negative' : 'is-positive'
                  }
                  dir="ltr"
                >
                  {formatDigits(
                    `${movement.baseDelta.startsWith('-') ? '' : '+'}${movement.baseDelta} ${stockUnitLabel(movement.baseUnit, locale)}`,
                  )}
                </strong>
              </div>
            </section>

            <dl className="inventory-movement-facts">
              {movement.sourceType !== 'purchase_invoice' && (
                <div>
                  <dt>{text('Reason')}</dt>
                  <dd>{formatDigits(movement.reason)}</dd>
                </div>
              )}
              <div>
                <dt>{text('Entered quantity')}</dt>
                <dd dir="ltr">
                  {formatDigits(
                    `${movement.enteredQuantity} ${stockUnitLabel(movement.unitCode, locale)}`,
                  )}
                </dd>
              </div>
              <div>
                <dt>{text('Recorded by')}</dt>
                <dd>{formatDigits(movement.actor)}</dd>
              </div>
              <div>
                <dt>{text('Date')}</dt>
                <dd>
                  <time dateTime={movement.createdAt}>
                    {formatDigits(new Date(movement.createdAt).toLocaleString(locale))}
                  </time>
                </dd>
              </div>
              <div>
                <dt>{text('Source')}</dt>
                <dd>
                  {sourceHref ? (
                    <Link className="inventory-detail-link" to={sourceHref}>
                      {text(
                        movement.sourceType === 'purchase_invoice'
                          ? 'View purchase invoice'
                          : 'View related order',
                      )}
                    </Link>
                  ) : (
                    text(sourceLabels[movement.sourceType] ?? 'Source reference')
                  )}
                </dd>
              </div>
            </dl>

            <details className="inventory-movement-references">
              <summary>{text('Technical references')}</summary>
              <dl>
                <div>
                  <dt>{text('Source reference')}</dt>
                  <dd>
                    <code dir="ltr">{formatDigits(movement.sourceId)}</code>
                  </dd>
                </div>
                <div>
                  <dt>{text('Movement batch')}</dt>
                  <dd>
                    <code dir="ltr">{formatDigits(movement.batchId)}</code>
                  </dd>
                </div>
              </dl>
            </details>
          </div>
        ) : !error ? (
          <p>{text('Movement was not found.')}</p>
        ) : null}
      </InventoryCard>
    </main>
  );
}
