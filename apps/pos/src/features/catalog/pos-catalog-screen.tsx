import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CatalogProductQuoteSelection,
  CreatePosOrderRequest,
  PosDiningTableOption,
  PosEmployeeSession,
  PosOrderQuoteRequest,
  PublicStorefrontProduct,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import { Button, Dialog, Input, Textarea, useLocale } from '@waffarly/ui';
import { Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  usePosWorkspaceStore,
  type PosDraftLine,
  type PosOrderDraft,
  type PendingPosSale,
} from '../../app/pos-workspace-store.js';
import { ApiError } from '../../lib/api-client.js';
import { posCatalogKey, getPosSellableCatalog } from './pos-catalog.api.js';
import { getPosDiningTables, posDiningTablesKey } from '../dining/pos-dining.api.js';
import { createPosOrder, posOrderKeys, quotePosOrder } from '../orders/pos-orders.api.js';
import { PosCheckoutDialog } from '../payments/pos-checkout-dialog.js';
import {
  getCurrentPosShift,
  listPosRegisters,
  posCurrentShiftKey,
  posRegisterKey,
} from '../shifts/pos-shifts.api.js';
import './pos-catalog-screen.css';

type LayoutContext = { employee: PosEmployeeSession };
type ConfiguredProduct = {
  variantId?: string;
  selections: CatalogProductQuoteSelection[];
};

export function POSCatalogScreen() {
  const { employee } = useOutletContext<LayoutContext>();
  const [searchParams] = useSearchParams();
  const requestedTableId = searchParams.get('tableId');
  const { t, errorText, formatNumber } = useLocale();
  const queryClient = useQueryClient();
  const hydrate = usePosWorkspaceStore((state) => state.hydrate);
  const workspace = usePosWorkspaceStore((state) => state.workspace);
  const selectBranch = usePosWorkspaceStore((state) => state.selectBranch);
  const saveDraft = usePosWorkspaceStore((state) => state.saveDraft);
  const removeDraft = usePosWorkspaceStore((state) => state.removeDraft);
  const savePendingSale = usePosWorkspaceStore((state) => state.savePendingSale);
  const removePendingSale = usePosWorkspaceStore((state) => state.removePendingSale);
  const persistenceError = usePosWorkspaceStore((state) => state.persistenceError);
  const branches = useMemo(
    () => employee.branches.filter((branch) => branch.archivedAt === null),
    [employee.branches],
  );
  const selectedBranchId = branches.some((branch) => branch.id === workspace?.selectedBranchId)
    ? (workspace?.selectedBranchId ?? branches[0]?.id ?? '')
    : (branches[0]?.id ?? '');
  const [registerId, setRegisterId] = useState('');
  const [activeDraftId, setActiveDraftId] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [configuringProduct, setConfiguringProduct] = useState<PublicStorefrontProduct | null>(
    null,
  );
  const [saleComplete, setSaleComplete] = useState<StorefrontOrderSummary | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState('');
  const [operationError, setOperationError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const canSell = employee.permissions.includes('sell');

  useEffect(() => {
    hydrate(employee.merchantId, employee.id);
  }, [employee.id, employee.merchantId, hydrate]);

  useEffect(() => {
    if (!selectedBranchId || workspace?.selectedBranchId === selectedBranchId) return;
    try {
      selectBranch(employee.merchantId, employee.id, selectedBranchId);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('Could not save this branch.'));
    }
  }, [
    employee.id,
    employee.merchantId,
    selectBranch,
    selectedBranchId,
    t,
    workspace?.selectedBranchId,
  ]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const drafts = useMemo(
    () =>
      Object.values(workspace?.drafts ?? {}).filter((draft) => draft.branchId === selectedBranchId),
    [selectedBranchId, workspace?.drafts],
  );
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) ?? drafts[0] ?? null;

  useEffect(() => {
    if (!workspace || !selectedBranchId) return;
    if (activeDraft) {
      if (activeDraftId !== activeDraft.id) setActiveDraftId(activeDraft.id);
      return;
    }
    const now = new Date().toISOString();
    const draft: PosOrderDraft = {
      id: crypto.randomUUID(),
      branchId: selectedBranchId,
      createdAt: now,
      updatedAt: now,
      fulfillment: 'takeaway',
      lines: [],
    };
    try {
      saveDraft(employee.merchantId, employee.id, draft);
      setActiveDraftId(draft.id);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('Could not save this order.'));
    }
  }, [
    activeDraft,
    activeDraftId,
    employee.id,
    employee.merchantId,
    saveDraft,
    selectedBranchId,
    t,
    workspace,
  ]);

  const registersQuery = useQuery({
    queryKey: posRegisterKey(employee.merchantId, selectedBranchId),
    queryFn: ({ signal }) => listPosRegisters(selectedBranchId, signal),
    enabled: canSell && Boolean(selectedBranchId),
    staleTime: 30_000,
  });
  const registers = registersQuery.data ?? [];

  useEffect(() => {
    if (!registers.length) {
      setRegisterId('');
      return;
    }
    if (!registers.some((register) => register.id === registerId)) {
      setRegisterId(registers[0]!.id);
    }
  }, [registerId, registers]);

  const currentShiftKey = posCurrentShiftKey(employee.merchantId, selectedBranchId, registerId);
  const shiftQuery = useQuery({
    queryKey: currentShiftKey,
    queryFn: ({ signal }) => getCurrentPosShift(registerId, signal),
    enabled: canSell && Boolean(selectedBranchId && registerId),
    refetchOnWindowFocus: true,
  });
  const diningTablesQuery = useQuery({
    queryKey: posDiningTablesKey(employee.merchantId, selectedBranchId),
    queryFn: ({ signal }) => getPosDiningTables(selectedBranchId, signal),
    enabled: canSell && Boolean(selectedBranchId),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const catalogQuery = useInfiniteQuery({
    queryKey: posCatalogKey(employee.merchantId),
    queryFn: ({ pageParam, signal }) => getPosSellableCatalog(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.products.nextCursor ?? undefined,
    enabled: canSell,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const categories = catalogQuery.data?.pages[0]?.categories.items ?? [];
  const products = useMemo(
    () => catalogQuery.data?.pages.flatMap((page) => page.products.items) ?? [],
    [catalogQuery.data],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory =
          categoryId === null || product.categories.some((category) => category.id === categoryId);
        const searchable = [
          product.name,
          product.description ?? '',
          ...product.categories.map((category) => category.name),
          ...product.variants.map((variant) => variant.name),
        ]
          .join(' ')
          .toLocaleLowerCase();
        return matchesCategory && (!normalizedSearch || searchable.includes(normalizedSearch));
      }),
    [categoryId, normalizedSearch, products],
  );

  const quoteRequest = useMemo<PosOrderQuoteRequest>(
    () => ({
      items: (activeDraft?.lines ?? []).map((line) => ({
        lineId: line.id,
        productId: line.productId,
        ...(line.variantId ? { variantId: line.variantId } : {}),
        selections: line.selections.map((selection) => ({
          groupId: selection.groupId,
          optionIds: selection.options.map((option) => option.optionId),
          optionQuantities: selection.options.map((option) => ({
            optionId: option.optionId,
            quantity: option.quantity,
          })),
        })),
        quantity: line.quantity,
      })),
    }),
    [activeDraft?.lines],
  );
  const quoteQuery = useQuery({
    queryKey: posOrderKeys.quote(employee.merchantId, quoteRequest),
    queryFn: () => quotePosOrder(quoteRequest),
    enabled: canSell && quoteRequest.items.length > 0,
    staleTime: 5_000,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: ({ payload }: { draftId: string; payload: CreatePosOrderRequest }) =>
      createPosOrder(payload),
    onSuccess: async (order, variables) => {
      removePendingSale(
        employee.merchantId,
        employee.id,
        variables.draftId,
        variables.payload.requestId,
      );
      removeDraft(employee.merchantId, employee.id, variables.draftId);
      setActiveDraftId('');
      setSaleComplete(order);
      setOperationError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pos', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: ['pos', employee.merchantId, 'dining'] }),
      ]);
    },
    onError: (error, variables) => {
      if (error instanceof ApiError && [400, 401, 403, 404, 409].includes(error.statusCode)) {
        removePendingSale(
          employee.merchantId,
          employee.id,
          variables.draftId,
          variables.payload.requestId,
        );
        if (error.statusCode === 409) {
          void queryClient.invalidateQueries({
            queryKey: posOrderKeys.quote(employee.merchantId, quoteRequest),
          });
        }
      }
      setOperationError(
        errorText(error instanceof Error ? error.message : t('Could not confirm this order.')),
      );
    },
  });

  function updateDraft(update: (draft: PosOrderDraft) => PosOrderDraft) {
    if (!activeDraft) return;
    const pending = workspace?.pendingSales[activeDraft.id];
    if (pending) {
      setOperationError(t('Resolve the saved sale request before editing this order.'));
      return;
    }
    try {
      saveDraft(employee.merchantId, employee.id, {
        ...update(activeDraft),
        updatedAt: new Date().toISOString(),
      });
      setOperationError('');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('Could not save this order.'));
    }
  }

  useEffect(() => {
    if (!requestedTableId || !activeDraft || !diningTablesQuery.data) return;
    const table = diningTablesQuery.data.find(
      (item: PosDiningTableOption) => item.id === requestedTableId,
    );
    if (!table || (activeDraft.fulfillment === 'dine-in' && activeDraft.tableId === table.id))
      return;
    updateDraft((draft) => ({ ...draft, fulfillment: 'dine-in', tableId: table.id }));
  }, [activeDraft, diningTablesQuery.data, requestedTableId]);

  function createDraft() {
    if (!selectedBranchId) return;
    const now = new Date().toISOString();
    const draft: PosOrderDraft = {
      id: crypto.randomUUID(),
      branchId: selectedBranchId,
      createdAt: now,
      updatedAt: now,
      fulfillment: 'takeaway',
      lines: [],
    };
    try {
      saveDraft(employee.merchantId, employee.id, draft);
      setActiveDraftId(draft.id);
      setSaleComplete(null);
      setOperationError('');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('Could not save this order.'));
    }
  }

  function addConfiguredProduct(product: PublicStorefrontProduct, configured: ConfiguredProduct) {
    const selections = configured.selections.map((selection) => ({
      groupId: selection.groupId,
      options: (
        selection.optionQuantities ??
        selection.optionIds.map((optionId) => ({ optionId, quantity: 1 }))
      ).map((option) => ({ optionId: option.optionId, quantity: option.quantity })),
    }));
    updateDraft((draft) => {
      const key = JSON.stringify({
        productId: product.id,
        variantId: configured.variantId ?? null,
        selections,
      });
      const existing = draft.lines.find(
        (line) =>
          JSON.stringify({
            productId: line.productId,
            variantId: line.variantId ?? null,
            selections: line.selections,
          }) === key && !line.note,
      );
      if (existing) {
        return {
          ...draft,
          lines: draft.lines.map((line) =>
            line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line,
          ),
        };
      }
      const line: PosDraftLine = {
        id: crypto.randomUUID(),
        productId: product.id,
        ...(configured.variantId ? { variantId: configured.variantId } : {}),
        quantity: 1,
        selections,
        note: '',
      };
      return { ...draft, lines: [...draft.lines, line] };
    });
    setConfiguringProduct(null);
  }

  function changeLineQuantity(lineId: string, quantity: number) {
    if (quantity < 1) {
      updateDraft((draft) => ({
        ...draft,
        lines: draft.lines.filter((line) => line.id !== lineId),
      }));
      return;
    }
    updateDraft((draft) => ({
      ...draft,
      lines: draft.lines.map((line) => (line.id === lineId ? { ...line, quantity } : line)),
    }));
  }

  function confirmOrder() {
    if (!activeDraft || !registerId || !shiftQuery.data || !online) return;
    const pending = workspace?.pendingSales[activeDraft.id];
    if (pending) {
      createMutation.mutate({ draftId: activeDraft.id, payload: pending.payload });
      return;
    }
    if (!quoteQuery.data || quoteQuery.isFetching || quoteQuery.isError) {
      setOperationError(t('Wait for a current server quote before confirming.'));
      return;
    }
    const quoteByLine = new Map(quoteQuery.data.items.map((item) => [item.lineId, item.quote]));
    const payload: CreatePosOrderRequest = {
      requestId: crypto.randomUUID(),
      registerId,
      fulfillmentType:
        activeDraft.fulfillment === 'dine-in'
          ? 'dine_in'
          : activeDraft.fulfillment === 'takeaway'
            ? 'takeaway'
            : 'delivery',
      ...(activeDraft.fulfillment === 'dine-in' && activeDraft.tableId
        ? { tableId: activeDraft.tableId }
        : {}),
      ...(activeDraft.customerName?.trim()
        ? { customerName: activeDraft.customerName.trim() }
        : {}),
      ...(activeDraft.customerPhone?.trim()
        ? { customerPhone: activeDraft.customerPhone.trim() }
        : {}),
      ...(activeDraft.deliveryAddress?.trim()
        ? { deliveryAddress: activeDraft.deliveryAddress.trim() }
        : {}),
      items: activeDraft.lines.map((line) => {
        const quote = quoteByLine.get(line.id);
        if (!quote) throw new Error(t('The server quote is missing a cart item.'));
        return {
          lineId: line.id,
          productId: line.productId,
          ...(line.variantId ? { variantId: line.variantId } : {}),
          selections: line.selections.map((selection) => ({
            groupId: selection.groupId,
            optionIds: selection.options.map((option) => option.optionId),
            optionQuantities: selection.options.map((option) => ({
              optionId: option.optionId,
              quantity: option.quantity,
            })),
          })),
          quantity: line.quantity,
          expectedProductRevision: quote.productRevision,
          ...(line.note.trim() ? { note: line.note.trim() } : {}),
        };
      }),
    };
    const envelope: PendingPosSale = { requestId: payload.requestId, payload };
    try {
      savePendingSale(employee.merchantId, employee.id, activeDraft.id, envelope);
      setOperationError('');
      createMutation.mutate({ draftId: activeDraft.id, payload });
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : t('Could not save this sale safely.'),
      );
    }
  }

  if (!canSell) {
    return (
      <section className="pos-empty" role="status">
        {t('Ask the merchant owner to assign the cashier or supervisor role before selling.')}
      </section>
    );
  }

  const lineQuoteById = new Map((quoteQuery.data?.items ?? []).map((item) => [item.lineId, item]));
  const pendingSale = activeDraft ? workspace?.pendingSales[activeDraft.id] : undefined;
  const subtotal = quoteQuery.data?.subtotal ?? '0.00';
  const cartCount = activeDraft?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const catalogError = catalogQuery.error instanceof Error ? catalogQuery.error.message : '';

  return (
    <section className="pos-catalog-workspace" aria-labelledby="pos-catalog-heading">
      <header className="pos-catalog-header">
        <div>
          <span className="eyebrow">{t('Live merchant menu')}</span>
          <h2 id="pos-catalog-heading">{t('New order')}</h2>
        </div>
        <label className="pos-catalog-search">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">{t('Search products')}</span>
          <Input
            type="search"
            value={search}
            placeholder={t('Search products...')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </header>

      <div className="pos-sale-register-bar">
        <label>
          <span>{t('Branch')}</span>
          <select
            value={selectedBranchId}
            disabled={!branches.length || Boolean(pendingSale)}
            onChange={(event) => {
              selectBranch(employee.merchantId, employee.id, event.target.value);
              setActiveDraftId('');
              setRegisterId('');
            }}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('Register')}</span>
          <select
            value={registerId}
            disabled={registers.length === 0 || Boolean(pendingSale)}
            onChange={(event) => setRegisterId(event.target.value)}
          >
            {registers.map((register) => (
              <option key={register.id} value={register.id}>
                {register.name}
              </option>
            ))}
          </select>
        </label>
        <div className={`pos-shift-indicator ${shiftQuery.data ? 'is-open' : ''}`} role="status">
          {shiftQuery.data ? t('Shift open') : t('No open shift')}
          {!shiftQuery.data && <Link to="/shift">{t('Open shift')}</Link>}
        </div>
        <span
          className={`pos-online-indicator ${online ? 'is-online' : 'is-offline'}`}
          role="status"
        >
          {online ? t('Online') : t('Offline - drafts saved')}
        </span>
      </div>

      {persistenceError && (
        <p className="pos-error" role="alert">
          {errorText(persistenceError)}
        </p>
      )}
      {operationError && (
        <p className="pos-error" role="alert">
          {errorText(operationError)}
        </p>
      )}
      {saleComplete && (
        <div className="pos-sale-success" role="status">
          <div>
            <strong>{t('Order confirmed')}</strong>
            <span>
              {t('Order')} #{saleComplete.id.slice(0, 8)} ·{' '}
              {formatNumber(Number(saleComplete.total), {
                style: 'currency',
                currency: saleComplete.currency,
              })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setCheckoutOrderId(saleComplete.id)}>
              {t('Take payment')}
            </Button>
            <Button type="button" variant="outline" onClick={createDraft}>
              {t('Start another order')}
            </Button>
          </div>
        </div>
      )}

      <div className="pos-cashier-layout">
        <div className="pos-catalog-main">
          <p className="pos-scope-note">
            {t(
              'Prices are confirmed by the server. Orders are saved online and can be retried safely.',
            )}
          </p>
          <div className="pos-catalog-categories" aria-label={t('Product categories')}>
            <Button
              type="button"
              variant={categoryId === null ? 'default' : 'outline'}
              aria-pressed={categoryId === null}
              onClick={() => setCategoryId(null)}
            >
              {t('All items')}
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                type="button"
                variant={categoryId === category.id ? 'default' : 'outline'}
                aria-pressed={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
          {catalogError && (
            <p className="pos-error" role="alert">
              {errorText(catalogError)}
            </p>
          )}
          {catalogQuery.isLoading ? (
            <p role="status">{t('Loading catalog...')}</p>
          ) : visibleProducts.length === 0 && !catalogError ? (
            <div className="pos-empty" role="status">
              {normalizedSearch || categoryId
                ? t('No products match this search.')
                : t('No products are available in the catalog.')}
            </div>
          ) : (
            <div className="pos-live-product-grid">
              {visibleProducts.map((product) => (
                <LiveProductCard
                  key={product.id}
                  product={product}
                  formatNumber={formatNumber}
                  onAdd={() => setConfiguringProduct(product)}
                />
              ))}
            </div>
          )}
          {catalogQuery.hasNextPage && (
            <div className="pos-load-more">
              <Button
                variant="outline"
                type="button"
                disabled={catalogQuery.isFetchingNextPage}
                onClick={() => void catalogQuery.fetchNextPage()}
              >
                {catalogQuery.isFetchingNextPage ? t('Loading...') : t('Load more products')}
              </Button>
            </div>
          )}
        </div>

        <aside className="pos-live-cart" aria-label={t('Current order')}>
          <div className="pos-live-cart-heading">
            <div>
              <h3>{t('Current order')}</h3>
              <span>{t('{{count}} items', { count: cartCount })}</span>
            </div>
            <Button type="button" variant="outline" onClick={createDraft}>
              {t('New order')}
            </Button>
          </div>
          {drafts.length > 1 && (
            <label className="pos-draft-switcher">
              <span>{t('Suspended orders')}</span>
              <select
                value={activeDraft?.id ?? ''}
                onChange={(event) => setActiveDraftId(event.target.value)}
              >
                {drafts.map((draft, index) => (
                  <option key={draft.id} value={draft.id}>
                    {t('Order {{number}}', { number: index + 1 })} ·{' '}
                    {draft.lines.reduce((sum, line) => sum + line.quantity, 0)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="pos-fulfillment-switch" role="group" aria-label={t('Fulfillment type')}>
            {(
              [
                ['dine-in', 'Dine in'],
                ['takeaway', 'Takeaway'],
                ['delivery', 'Delivery'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={activeDraft?.fulfillment === value ? 'default' : 'outline'}
                aria-pressed={activeDraft?.fulfillment === value}
                disabled={Boolean(pendingSale)}
                onClick={() => updateDraft((draft) => ({ ...draft, fulfillment: value }))}
              >
                {t(label)}
              </Button>
            ))}
          </div>
          {activeDraft?.fulfillment === 'dine-in' && (
            <label className="pos-dining-table-select">
              <span>{t('Table')}</span>
              <select
                value={activeDraft.tableId ?? ''}
                disabled={Boolean(pendingSale) || diningTablesQuery.isLoading}
                onChange={(event) => {
                  const value = event.target.value;
                  updateDraft((draft) => {
                    const next = { ...draft };
                    if (value) next.tableId = value;
                    else delete next.tableId;
                    return next;
                  });
                }}
              >
                <option value="">{t('Select a table')}</option>
                {(diningTablesQuery.data ?? []).map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.code} ·{' '}
                    {table.occupancy === 'occupied' ? t('Occupied · add round') : t('Available')}
                  </option>
                ))}
              </select>
              {diningTablesQuery.error && (
                <small role="alert">
                  {errorText(
                    diningTablesQuery.error instanceof Error
                      ? diningTablesQuery.error.message
                      : t('Could not load tables.'),
                  )}
                </small>
              )}
              {!diningTablesQuery.isLoading && diningTablesQuery.data?.length === 0 && (
                <small>{t('No active tables. Ask the owner to configure dining tables.')}</small>
              )}
            </label>
          )}
          {activeDraft?.fulfillment === 'delivery' && (
            <div className="pos-delivery-fields">
              <Input
                aria-label={t('Customer name')}
                placeholder={t('Customer name')}
                value={activeDraft.customerName ?? ''}
                disabled={Boolean(pendingSale)}
                onChange={(event) =>
                  updateDraft((draft) => ({ ...draft, customerName: event.target.value }))
                }
              />
              <Input
                aria-label={t('Phone number')}
                placeholder={t('Phone number')}
                inputMode="tel"
                value={activeDraft.customerPhone ?? ''}
                disabled={Boolean(pendingSale)}
                onChange={(event) =>
                  updateDraft((draft) => ({ ...draft, customerPhone: event.target.value }))
                }
              />
              <Textarea
                aria-label={t('Delivery address')}
                placeholder={t('Delivery address')}
                value={activeDraft.deliveryAddress ?? ''}
                disabled={Boolean(pendingSale)}
                onChange={(event) =>
                  updateDraft((draft) => ({ ...draft, deliveryAddress: event.target.value }))
                }
              />
            </div>
          )}
          <div className="pos-live-cart-lines">
            {activeDraft?.lines.length ? (
              activeDraft.lines.map((line) => {
                const quote = lineQuoteById.get(line.id);
                const product = products.find((item) => item.id === line.productId);
                const variant = product?.variants.find((item) => item.id === line.variantId);
                const selectionSummary = summarizeSelections(product, line, t);
                return (
                  <article className="pos-live-cart-line" key={line.id}>
                    <div className="pos-live-cart-line-copy">
                      <strong>{product?.name ?? t('Product')}</strong>
                      {variant && <span>{variant.name}</span>}
                      {selectionSummary && <span>{selectionSummary}</span>}
                      <Input
                        aria-label={t('Item note for {{product}}', {
                          product: product?.name ?? '',
                        })}
                        placeholder={t('Item note')}
                        value={line.note}
                        disabled={Boolean(pendingSale)}
                        onChange={(event) =>
                          updateDraft((draft) => ({
                            ...draft,
                            lines: draft.lines.map((item) =>
                              item.id === line.id ? { ...item, note: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="pos-live-cart-line-controls">
                      <strong>
                        {quote
                          ? formatNumber(Number(quote.lineTotal), {
                              style: 'currency',
                              currency: 'EGP',
                            })
                          : t('Updating...')}
                      </strong>
                      <div className="pos-quantity-control">
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={t('Decrease quantity')}
                          disabled={Boolean(pendingSale)}
                          onClick={() => changeLineQuantity(line.id, line.quantity - 1)}
                        >
                          −
                        </Button>
                        <span>{formatNumber(line.quantity)}</span>
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={t('Increase quantity')}
                          disabled={Boolean(pendingSale)}
                          onClick={() => changeLineQuantity(line.id, line.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={t('Remove item')}
                        disabled={Boolean(pendingSale)}
                        onClick={() => changeLineQuantity(line.id, 0)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="pos-empty pos-cart-empty">{t('Add products to start an order.')}</div>
            )}
          </div>
          <div className="pos-live-cart-footer">
            <div className="pos-live-cart-total">
              <span>{t('Subtotal')}</span>
              <strong>
                {formatNumber(Number(subtotal), { style: 'currency', currency: 'EGP' })}
              </strong>
            </div>
            <p>
              {t(
                'Payment is recorded in the next checkout step. No payment has been collected yet.',
              )}
            </p>
            {pendingSale && (
              <p className="pos-pending-sale-note" role="status">
                {t('A sale request is saved. Retry this exact request to check its result.')}
              </p>
            )}
            {!shiftQuery.data && (
              <Link to="/shift">{t('Open a register shift before confirming')}</Link>
            )}
            {!online && (
              <span className="pos-offline-note">
                {t('Orders can be drafted offline but must be confirmed online.')}
              </span>
            )}
            {quoteQuery.error && !pendingSale && (
              <p className="pos-error" role="alert">
                {errorText(
                  quoteQuery.error instanceof Error
                    ? quoteQuery.error.message
                    : t('Could not quote this order.'),
                )}
              </p>
            )}
            <Button
              type="button"
              className="pos-confirm-order"
              disabled={
                !activeDraft?.lines.length ||
                (activeDraft?.fulfillment === 'dine-in' &&
                  (!activeDraft.tableId ||
                    diningTablesQuery.isError ||
                    diningTablesQuery.isLoading)) ||
                !shiftQuery.data ||
                !online ||
                createMutation.isPending ||
                (!pendingSale && (!quoteQuery.data || quoteQuery.isFetching || quoteQuery.isError))
              }
              onClick={confirmOrder}
            >
              {createMutation.isPending
                ? t('Saving order...')
                : pendingSale
                  ? t('Retry saved sale')
                  : t('Confirm order')}
            </Button>
          </div>
        </aside>
      </div>

      {configuringProduct && (
        <ProductConfigurator
          product={configuringProduct}
          onClose={() => setConfiguringProduct(null)}
          onAdd={(configured) => addConfiguredProduct(configuringProduct, configured)}
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

function LiveProductCard({
  product,
  formatNumber,
  onAdd,
}: {
  product: PublicStorefrontProduct;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  onAdd: () => void;
}) {
  const image = product.images.find((candidate) => candidate.isPrimary) ?? product.images[0];
  const { t } = useLocale();
  return (
    <article className="pos-live-product-card">
      {image ? (
        <img src={image.publicUrl} alt="" loading="lazy" />
      ) : (
        <div className="pos-live-product-placeholder" aria-hidden="true">
          {product.name.slice(0, 1)}
        </div>
      )}
      <div className="pos-live-product-copy">
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <div className="pos-live-product-meta">
          <strong>
            {formatNumber(Number(product.basePrice), {
              style: 'currency',
              currency: product.currency,
            })}
          </strong>
          {(product.variants.length > 0 || product.modifierGroups.length > 0) && (
            <span>
              {product.variants.length > 0 &&
                t('{{count}} sizes', { count: product.variants.length })}
              {product.variants.length > 0 && product.modifierGroups.length > 0 ? ' · ' : ''}
              {product.modifierGroups.length > 0 &&
                t('{{count}} option groups', { count: product.modifierGroups.length })}
            </span>
          )}
        </div>
        <Button className="pos-live-product-add" type="button" onClick={onAdd}>
          {t('Add to order')}
        </Button>
      </div>
    </article>
  );
}

function ProductConfigurator({
  product,
  onClose,
  onAdd,
}: {
  product: PublicStorefrontProduct;
  onClose: () => void;
  onAdd: (configured: ConfiguredProduct) => void;
}) {
  const { t, formatNumber } = useLocale();
  const [variantId, setVariantId] = useState(
    product.variants.find((variant) => variant.availability === 'available')?.id ?? '',
  );
  const [options, setOptions] = useState<Record<string, Record<string, number>>>(() =>
    defaultSelections(
      product,
      product.variants.find((variant) => variant.availability === 'available')?.id,
    ),
  );
  const [selectionError, setSelectionError] = useState('');
  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const unavailable = product.variants.length > 0 && !selectedVariant;

  function changeVariant(nextId: string) {
    setVariantId(nextId);
    setOptions(defaultSelections(product, nextId));
    setSelectionError('');
  }

  function setOption(groupId: string, optionId: string, quantity: number) {
    setOptions((current) => {
      const group = product.modifierGroups.find((item) => item.id === groupId);
      const next = { ...current[groupId] };
      if (quantity > 0) {
        if (group?.selectionMode === 'single') {
          for (const key of Object.keys(next)) delete next[key];
        }
        next[optionId] = quantity;
      } else {
        delete next[optionId];
      }
      return { ...current, [groupId]: next };
    });
    setSelectionError('');
  }

  function submit() {
    if (unavailable) return;
    for (const group of product.modifierGroups) {
      const count = Object.keys(options[group.id] ?? {}).length;
      if (count < group.minSelections || count > group.maxSelections) {
        setSelectionError(
          t('Choose {{minimum}} to {{maximum}} options for {{group}}.', {
            minimum: group.minSelections,
            maximum: group.maxSelections,
            group: group.name,
          }),
        );
        return;
      }
    }
    onAdd({
      ...(variantId ? { variantId } : {}),
      selections: product.modifierGroups.map((group) => {
        const selected = options[group.id] ?? {};
        const optionQuantities = Object.entries(selected).map(([optionId, quantity]) => ({
          optionId,
          quantity,
        }));
        return {
          groupId: group.id,
          optionIds: optionQuantities.map((option) => option.optionId),
          optionQuantities,
        };
      }),
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={product.name}
      description={t('Choose the size and options for this order item.')}
      closeLabel={t('Close')}
      className="pos-product-configurator"
    >
      <div className="pos-configurator-body">
        {product.variants.length > 0 && (
          <fieldset className="pos-configurator-group">
            <legend>{t('Size')}</legend>
            {product.variants
              .filter((variant) => variant.availability === 'available')
              .map((variant) => (
                <label className="pos-configurator-choice" key={variant.id}>
                  <input
                    type="radio"
                    name={`variant-${product.id}`}
                    checked={variantId === variant.id}
                    onChange={() => changeVariant(variant.id)}
                  />
                  <span>{variant.name}</span>
                  <strong>
                    {formatNumber(Number(variant.price), {
                      style: 'currency',
                      currency: product.currency,
                    })}
                  </strong>
                </label>
              ))}
          </fieldset>
        )}
        {product.modifierGroups.map((group) => {
          const groupAvailable =
            group.variantOverrides?.find((override) => override.variantId === variantId)
              ?.available !== false;
          if (!groupAvailable) return null;
          return (
            <fieldset className="pos-configurator-group" key={group.id}>
              <legend>{group.name}</legend>
              {group.description && <p>{group.description}</p>}
              {group.options
                .filter(
                  (option) =>
                    option.variantOverrides?.find((override) => override.variantId === variantId)
                      ?.available !== false,
                )
                .map((option) => {
                  const quantity = options[group.id]?.[option.id] ?? 0;
                  const inputType = group.selectionMode === 'single' ? 'radio' : 'checkbox';
                  return (
                    <label className="pos-configurator-choice" key={option.id}>
                      <input
                        type={inputType}
                        name={`modifier-${group.id}`}
                        checked={quantity > 0}
                        onChange={(event) =>
                          setOption(group.id, option.id, event.target.checked ? 1 : 0)
                        }
                      />
                      <span>{option.name}</span>
                      <strong>
                        {formatNumber(Number(option.priceAdjustment), {
                          style: 'currency',
                          currency: product.currency,
                        })}
                      </strong>
                      {quantity > 0 && (option.maxQuantity ?? 1) > 1 && (
                        <Input
                          aria-label={t('Quantity for {{option}}', { option: option.name })}
                          type="number"
                          min="1"
                          max={option.maxQuantity}
                          value={quantity}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setOption(
                              group.id,
                              option.id,
                              Math.max(
                                1,
                                Math.min(option.maxQuantity ?? 1, Number(event.target.value)),
                              ),
                            )
                          }
                        />
                      )}
                    </label>
                  );
                })}
              <small>
                {t('Choose {{minimum}} to {{maximum}}', {
                  minimum: group.minSelections,
                  maximum: group.maxSelections,
                })}
              </small>
            </fieldset>
          );
        })}
        {selectionError && (
          <p className="pos-error" role="alert">
            {selectionError}
          </p>
        )}
        <div className="pos-configurator-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="button" disabled={unavailable} onClick={submit}>
            {t('Add item')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function defaultSelections(
  product: PublicStorefrontProduct,
  variantId: string | undefined,
): Record<string, Record<string, number>> {
  return Object.fromEntries(
    product.modifierGroups.map((group) => {
      const groupAvailable =
        group.variantOverrides?.find((override) => override.variantId === variantId)?.available !==
        false;
      const defaults = groupAvailable
        ? group.options
            .filter(
              (option) =>
                option.defaultSelected &&
                option.variantOverrides?.find((override) => override.variantId === variantId)
                  ?.available !== false,
            )
            .map((option) => [option.id, 1] as const)
        : [];
      return [group.id, Object.fromEntries(defaults)];
    }),
  );
}

function summarizeSelections(
  product: PublicStorefrontProduct | undefined,
  line: PosDraftLine,
  t: ReturnType<typeof useLocale>['t'],
): string {
  if (!product) return '';
  return line.selections
    .flatMap((selection) => {
      const group = product.modifierGroups.find((item) => item.id === selection.groupId);
      return selection.options.map((selected) => {
        const option = group?.options.find((item) => item.id === selected.optionId);
        return option
          ? `${option.name}${selected.quantity > 1 ? ` ×${selected.quantity}` : ''}`
          : '';
      });
    })
    .filter(Boolean)
    .join(` ${t('·')} `);
}
