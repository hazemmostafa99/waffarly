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
import { Dialog, Input, Textarea, cn, useLocale } from '@waffarly/ui';
import {
  ArrowRight,
  LayoutGrid,
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  usePosWorkspaceStore,
  isBlankPosDraft,
  type PosDraftLine,
  type PosOrderDraft,
  type PendingPosSale,
} from '../../app/pos-workspace-store.js';
import { ApiError } from '../../lib/api-client.js';
import { posCatalogKey, getPosSellableCatalog } from './pos-catalog.api.js';
import { getPosDiningTables, posDiningTablesKey } from '../dining/pos-dining.api.js';
import {
  createPosOrder,
  posOrderKeys,
  posOrderDetailKey,
  quotePosOrder,
  getPosOrder,
} from '../orders/pos-orders.api.js';
import { PosConfirmedOrderPanel } from '../orders/pos-confirmed-order-panel.js';
import { PosOrderSwitcher, type PosSwitcherEntry } from '../orders/pos-order-switcher.js';
import { PosCheckoutDialog } from '../payments/pos-checkout-dialog.js';
import { PosButton } from '../../components/pos-button.js';
import {
  getCurrentPosShift,
  listPosRegisters,
  posCurrentShiftKey,
  posRegisterKey,
} from '../shifts/pos-shifts.api.js';

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
  const startDraft = usePosWorkspaceStore((state) => state.startDraft);
  const selectDraft = usePosWorkspaceStore((state) => state.selectDraft);
  const removeDraft = usePosWorkspaceStore((state) => state.removeDraft);
  const discardEmptyDrafts = usePosWorkspaceStore((state) => state.discardEmptyDrafts);
  const completeSale = usePosWorkspaceStore((state) => state.completeSale);
  const removePendingSale = usePosWorkspaceStore((state) => state.removePendingSale);
  const selectConfirmedOrder = usePosWorkspaceStore((state) => state.selectConfirmedOrder);
  const savePendingSale = usePosWorkspaceStore((state) => state.savePendingSale);
  const persistenceError = usePosWorkspaceStore((state) => state.persistenceError);
  const branches = useMemo(
    () => employee.branches.filter((branch) => branch.archivedAt === null),
    [employee.branches],
  );
  const selectedBranchId = branches.some((branch) => branch.id === workspace?.selectedBranchId)
    ? (workspace?.selectedBranchId ?? branches[0]?.id ?? '')
    : (branches[0]?.id ?? '');
  const [registerId, setRegisterId] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [configuringProduct, setConfiguringProduct] = useState<PublicStorefrontProduct | null>(
    null,
  );
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState('');
  const [operationError, setOperationError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [mobileView, setMobileView] = useState<'menu' | 'order'>('menu');
  const menuRef = useRef<HTMLElement>(null);
  const orderPaneRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef({ menu: 0, order: 0 });
  const focusChangedView = useRef(false);
  const canSell = employee.permissions.includes('sell');

  useEffect(() => {
    hydrate(employee.merchantId, employee.id);
  }, [employee.id, employee.merchantId, hydrate]);

  useEffect(() => {
    if (!workspace || !selectedBranchId || workspace.selectedBranchId === selectedBranchId) return;
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
  const activeDraft =
    drafts.find((draft) => draft.id === workspace?.selectedDraftId) ?? drafts[0] ?? null;
  const confirmedOrders = useMemo(
    () =>
      workspace?.merchantId === employee.merchantId && workspace.employeeId === employee.id
        ? Object.values(workspace.confirmedOrders)
            .filter((order) => order.branchId === selectedBranchId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [workspace, employee.merchantId, employee.id, selectedBranchId],
  );
  const confirmedOrder = confirmedOrders.find(
    (order) => order.orderId === workspace?.selectedConfirmedOrderId,
  );
  const confirmedSummaryQuery = useQuery<StorefrontOrderSummary>({
    queryKey: posOrderDetailKey(employee.merchantId, employee.id, confirmedOrder?.orderId ?? ''),
    queryFn: ({ signal }) => getPosOrder(confirmedOrder!.orderId, signal),
    enabled: false,
  });
  const confirmedSummary = confirmedSummaryQuery.isError ? undefined : confirmedSummaryQuery.data;
  useEffect(() => {
    if (confirmedOrder?.orderId) setMobileView('order');
  }, [confirmedOrder?.orderId]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const scroller =
        mobileView === 'menu'
          ? menuRef.current
          : orderPaneRef.current?.querySelector<HTMLElement>('[data-pos-order-scroll]');
      if (scroller) scroller.scrollTop = scrollPositions.current[mobileView];
      if (focusChangedView.current) {
        (mobileView === 'menu' ? menuRef.current : orderPaneRef.current)?.focus({
          preventScroll: true,
        });
        focusChangedView.current = false;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mobileView]);
  function changeMobileView(next: 'menu' | 'order') {
    if (mobileView === next) return;
    const scroller =
      mobileView === 'menu'
        ? menuRef.current
        : orderPaneRef.current?.querySelector<HTMLElement>('[data-pos-order-scroll]');
    if (scroller) scrollPositions.current[mobileView] = scroller.scrollTop;
    focusChangedView.current = true;
    setMobileView(next);
  }
  useEffect(() => {
    scrollPositions.current.order = 0;
    const frame = requestAnimationFrame(() => {
      const scroller = orderPaneRef.current?.querySelector<HTMLElement>('[data-pos-order-scroll]');
      if (scroller) scroller.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeDraft?.id, confirmedOrder?.orderId]);
  useEffect(() => {
    if (!workspace || !selectedBranchId || confirmedOrder) return;
    try {
      if (activeDraft) {
        if (workspace.selectedDraftId !== activeDraft.id)
          selectDraft(employee.merchantId, employee.id, activeDraft.id);
      } else startDraft(employee.merchantId, employee.id);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('Could not save this order.'));
    }
  }, [
    activeDraft,
    employee.id,
    employee.merchantId,
    startDraft,
    selectDraft,
    selectedBranchId,
    t,
    workspace,
    confirmedOrder,
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
    enabled: canSell && !confirmedOrder && quoteRequest.items.length > 0,
    staleTime: 5_000,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: ({ payload }: { draftId: string; payload: CreatePosOrderRequest }) =>
      createPosOrder(payload),
    onSuccess: async (order, variables) => {
      queryClient.setQueryData(
        posOrderDetailKey(employee.merchantId, employee.id, order.id),
        order,
      );
      try {
        completeSale(
          employee.merchantId,
          employee.id,
          variables.draftId,
          variables.payload.requestId,
          order,
        );
        setOperationError('');
      } catch {
        setOperationError(
          t(
            'Order confirmed, but its reference could not be saved. Restore browser storage and retry the saved sale; do not create it again.',
          ),
        );
      }
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

  function updateDraft(update: (draft: PosOrderDraft) => PosOrderDraft): boolean {
    if (!activeDraft) return false;
    const pending = workspace?.pendingSales[activeDraft.id];
    if (pending) {
      setOperationError(t('Resolve the saved sale request before editing this order.'));
      return false;
    }
    try {
      saveDraft(employee.merchantId, employee.id, {
        ...update(activeDraft),
        updatedAt: new Date().toISOString(),
      });
      setOperationError('');
      return true;
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('Could not save this order.'));
      return false;
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
    try {
      startDraft(employee.merchantId, employee.id);
      setMobileView('menu');
      scrollPositions.current.order = 0;
      setOperationError('');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('Could not save this order.'));
    }
  }

  function addConfiguredProduct(product: PublicStorefrontProduct, configured: ConfiguredProduct) {
    const selections = toDraftSelections(configured);
    const saved = updateDraft((draft) => {
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
    if (saved) closeConfigurator();
  }

  function updateConfiguredProduct(lineId: string, configured: ConfiguredProduct) {
    const selections = toDraftSelections(configured);
    const saved = updateDraft((draft) => ({
      ...draft,
      lines: draft.lines.map((line) => {
        if (line.id !== lineId) return line;
        const updatedLine: PosDraftLine = { ...line, selections };
        if (configured.variantId) updatedLine.variantId = configured.variantId;
        else delete updatedLine.variantId;
        return updatedLine;
      }),
    }));
    if (saved) closeConfigurator();
  }

  function closeConfigurator() {
    setConfiguringProduct(null);
    setEditingLineId(null);
  }

  function chooseProduct(product: PublicStorefrontProduct) {
    if (productHasChoices(product)) {
      setEditingLineId(null);
      setConfiguringProduct(product);
      return;
    }
    addConfiguredProduct(product, { selections: [] });
  }

  function editConfiguredProduct(line: PosDraftLine, product: PublicStorefrontProduct) {
    if (!productHasChoices(product)) return;
    setEditingLineId(line.id);
    setConfiguringProduct(product);
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
      <section
        className="m-5 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground"
        role="status"
      >
        {t('Ask the merchant owner to assign the cashier or supervisor role before selling.')}
      </section>
    );
  }

  const lineQuoteById = new Map((quoteQuery.data?.items ?? []).map((item) => [item.lineId, item]));
  const pendingSale = activeDraft ? workspace?.pendingSales[activeDraft.id] : undefined;
  const subtotal = quoteQuery.data?.subtotal ?? '0.00';
  const cartCount = activeDraft?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const catalogError = catalogQuery.error instanceof Error ? catalogQuery.error.message : '';
  const switcherEntries: PosSwitcherEntry[] = [
    ...drafts.map((draft): PosSwitcherEntry => {
      const table = diningTablesQuery.data?.find((entry) => entry.id === draft.tableId);
      const service = t(
        draft.fulfillment === 'dine-in'
          ? 'Dine in'
          : draft.fulfillment === 'delivery'
            ? 'Delivery'
            : 'Takeaway',
      );
      return {
        id: draft.id,
        kind: 'draft',
        reference: `DRAFT-${draft.id.slice(0, 6).toUpperCase()}`,
        title: draft.customerName?.trim() || (table ? `${t('Table')} ${table.code}` : service),
        subtitle: t('{{count}} items', {
          count: draft.lines.reduce((sum, line) => sum + line.quantity, 0),
        }),
        updatedAt: draft.updatedAt,
        lastOpenedAt: draft.lastOpenedAt ?? draft.updatedAt,
        empty: isBlankPosDraft(draft),
        protected: Boolean(workspace?.pendingSales[draft.id]),
      };
    }),
    ...confirmedOrders.map((order): PosSwitcherEntry => {
      const cached = queryClient.getQueryData<StorefrontOrderSummary>(
        posOrderDetailKey(employee.merchantId, employee.id, order.orderId),
      );
      return {
        id: order.orderId,
        kind: 'confirmed',
        reference: `ORD-${order.orderId.slice(0, 8).toUpperCase()}`,
        title: cached?.customerName || t('Confirmed order'),
        subtitle: t('Saved on this device'),
        updatedAt: order.createdAt,
        lastOpenedAt: order.lastOpenedAt ?? order.createdAt,
      };
    }),
  ];
  function runWorkspaceAction(action: () => void) {
    try {
      action();
      setOperationError('');
    } catch (error) {
      setOperationError(
        error instanceof Error ? errorText(error.message) : t('Could not save this order.'),
      );
    }
  }

  return (
    <section
      className="pos-catalog-workspace flex min-h-0 min-w-0 flex-1 flex-col"
      aria-labelledby="pos-catalog-heading"
    >
      <div className="flex min-h-0 min-w-0 flex-1 lg:flex-row">
        <main
          ref={menuRef}
          id="pos-product-menu-pane"
          tabIndex={-1}
          data-testid="pos-menu-pane"
          className={cn(
            'order-scroll min-h-0 min-w-0 flex-1 overflow-y-auto',
            mobileView === 'order' && 'hidden lg:block',
          )}
        >
          <div className="p-4 xl:p-5">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t('Live merchant menu')}
                </span>
                <h2 id="pos-catalog-heading" className="mt-1 text-xl font-semibold">
                  {t(confirmedOrder ? 'Menu' : 'New order')}
                </h2>
              </div>
              <PosButton
                type="button"
                variant="outline"
                className="pos-new-draft-button h-10"
                onClick={createDraft}
                disabled={Boolean(pendingSale)}
              >
                <Plus aria-hidden="true" size={16} />
                {t('New order')}
              </PosButton>
            </header>

            <div className="mb-3 grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="grid min-w-32 gap-1 text-[10px] text-muted-foreground">
                  <span>{t('Branch')}</span>
                  <select
                    className="min-h-9 rounded-lg border border-border bg-card px-3 text-[11px] text-foreground"
                    value={selectedBranchId}
                    disabled={!branches.length || Boolean(pendingSale)}
                    onChange={(event) => {
                      selectBranch(employee.merchantId, employee.id, event.target.value);
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
                <label className="grid min-w-32 gap-1 text-[10px] text-muted-foreground">
                  <span>{t('Register')}</span>
                  <select
                    className="min-h-9 rounded-lg border border-border bg-card px-3 text-[11px] text-foreground"
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
                <span
                  className={cn(
                    'inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold',
                    shiftQuery.data
                      ? 'bg-[var(--pos-active)] text-[var(--pos-active-ink)]'
                      : 'bg-[var(--pos-note)] text-[var(--pos-note-ink)]',
                  )}
                  role="status"
                >
                  {shiftQuery.data ? t('Shift open') : t('No open shift')}
                  {!shiftQuery.data && (
                    <Link className="underline" to="/shift">
                      {t('Open shift')}
                    </Link>
                  )}
                </span>
                <span
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-[10px] font-semibold text-muted-foreground"
                  role="status"
                >
                  <span
                    className={cn('size-1.5 rounded-full', online ? 'bg-success' : 'bg-warning')}
                  />
                  {online ? t('Online') : t('Offline - drafts saved')}
                </span>
              </div>
              <label className="relative flex min-h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground">
                <Search aria-hidden="true" size={17} />
                <span className="sr-only">{t('Search products')}</span>
                <Input
                  type="search"
                  value={search}
                  placeholder={t('Search products...')}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-11 min-w-0 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 lg:h-9 lg:text-xs"
                />
                <kbd className="hidden rounded border border-border px-1.5 text-[10px] sm:inline-flex">
                  /
                </kbd>
              </label>
            </div>

            {(persistenceError || operationError) && (
              <p
                className="mb-3 rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive"
                role="alert"
              >
                {errorText(persistenceError || operationError)}
              </p>
            )}

            <div
              className="mb-3 flex gap-1.5 overflow-x-auto pb-1"
              aria-label={t('Product categories')}
            >
              <button
                type="button"
                aria-pressed={categoryId === null}
                onClick={() => setCategoryId(null)}
                className={cn(
                  'flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium',
                  categoryId === null
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutGrid aria-hidden="true" size={14} />
                {t('All items')}
                <span className="text-[10px] opacity-60">{products.length}</span>
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                  className={cn(
                    'flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium',
                    categoryId === category.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {category.name}
                  <span className="text-[10px] opacity-60">
                    {
                      products.filter((product) =>
                        product.categories.some((item) => item.id === category.id),
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">
                {categoryId
                  ? (categories.find((category) => category.id === categoryId)?.name ?? '')
                  : t('All menu items')}
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {visibleProducts.length} {t('items')}
              </span>
            </div>
            {catalogError && (
              <p
                className="mb-3 rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive"
                role="alert"
              >
                {errorText(catalogError)}
              </p>
            )}
            {catalogQuery.isLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground" role="status">
                {t('Loading catalog...')}
              </p>
            ) : visibleProducts.length === 0 && !catalogError ? (
              <div
                className="rounded-lg border border-border bg-card py-16 text-center"
                role="status"
              >
                <Search
                  aria-hidden="true"
                  className="mx-auto mb-3 text-muted-foreground"
                  size={28}
                />
                <h3 className="font-medium">{t('No matching items')}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {normalizedSearch || categoryId
                    ? t('Try another name or category.')
                    : t('No products are available in the catalog.')}
                </p>
              </div>
            ) : (
              <div
                className="pos-live-product-grid grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2"
                data-testid="product-grid"
              >
                {visibleProducts.map((product) => (
                  <LiveProductCard
                    key={product.id}
                    product={product}
                    quantity={
                      activeDraft?.lines
                        .filter((line) => line.productId === product.id)
                        .reduce((sum, line) => sum + line.quantity, 0) ?? 0
                    }
                    formatNumber={formatNumber}
                    disabled={Boolean(confirmedOrder)}
                    onAdd={() => chooseProduct(product)}
                  />
                ))}
              </div>
            )}
            {catalogQuery.hasNextPage && (
              <div className="flex justify-center py-5">
                <PosButton
                  variant="outline"
                  type="button"
                  disabled={catalogQuery.isFetchingNextPage}
                  onClick={() => void catalogQuery.fetchNextPage()}
                >
                  {catalogQuery.isFetchingNextPage ? t('Loading...') : t('Load more products')}
                </PosButton>
              </div>
            )}
          </div>
        </main>

        <div
          ref={orderPaneRef}
          tabIndex={-1}
          id="pos-current-order-pane"
          data-testid="pos-order-pane"
          className={cn(
            'min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex lg:w-[370px] lg:shrink-0 lg:flex-none xl:w-[390px]',
            mobileView === 'menu' ? 'hidden' : 'flex',
          )}
        >
          {confirmedOrder ? (
            <PosConfirmedOrderPanel
              key={confirmedOrder.orderId}
              merchantId={employee.merchantId}
              employeeId={employee.id}
              orderId={confirmedOrder.orderId}
              online={online}
              onCheckout={() => setCheckoutOrderId(confirmedOrder.orderId)}
              onNewOrder={createDraft}
            />
          ) : (
            <aside
              className="pos-live-cart prototype-cart flex h-full min-h-0 w-full flex-col border-s border-border bg-card"
              aria-label={t('Current order')}
            >
              <div
                className="order-scroll flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden"
                data-pos-order-scroll
              >
                <div className="border-b border-border p-5 max-[767px]:p-4">
                  <div className="mb-4 flex items-center justify-between max-[767px]:mb-2">
                    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {t('Current order')}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      #{activeDraft?.id.slice(0, 6) ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold max-[767px]:text-base">
                        {activeDraft?.fulfillment === 'dine-in'
                          ? `${t('Table')} ${diningTablesQuery.data?.find((table) => table.id === activeDraft.tableId)?.code ?? ''}`
                          : t(activeDraft?.fulfillment === 'delivery' ? 'Delivery' : 'Takeaway')}
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {activeDraft?.customerName || t('Walk-in customer')}
                      </p>
                    </div>
                    <PosButton
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t('New order')}
                      disabled={Boolean(pendingSale)}
                      onClick={createDraft}
                      className="size-9 shrink-0"
                    >
                      <Plus aria-hidden="true" size={16} />
                    </PosButton>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 max-[767px]:mt-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--pos-active)] px-2 py-1 text-[11px] font-semibold text-[var(--pos-active-ink)]">
                      <span className="size-1.5 rounded-full bg-current" />
                      {t('Open order')}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {t('Saved draft')}
                    </span>
                  </div>
                </div>

                <div
                  className="grid grid-cols-3 gap-1 border-b border-border p-3 max-[767px]:p-2"
                  role="group"
                  aria-label={t('Fulfillment type')}
                >
                  {(
                    [
                      ['dine-in', 'Dine in'],
                      ['takeaway', 'Takeaway'],
                      ['delivery', 'Delivery'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={activeDraft?.fulfillment === value}
                      disabled={Boolean(pendingSale)}
                      onClick={() => updateDraft((draft) => ({ ...draft, fulfillment: value }))}
                      className={cn(
                        'flex min-h-11 items-center justify-center rounded-lg border px-2 text-[11px] font-semibold transition-colors',
                        activeDraft?.fulfillment === value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>

                {activeDraft?.fulfillment === 'dine-in' && (
                  <label className="grid gap-1 px-3 pt-2 text-[11px] text-muted-foreground">
                    <span>{t('Table')}</span>
                    <select
                      className="min-h-11 rounded-lg border border-border bg-card px-3 text-base text-foreground lg:min-h-9 lg:text-xs"
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
                          {table.occupancy === 'occupied'
                            ? t('Occupied · add round')
                            : t('Available')}
                        </option>
                      ))}
                    </select>
                    {diningTablesQuery.error && (
                      <small role="alert" className="text-destructive">
                        {errorText(
                          diningTablesQuery.error instanceof Error
                            ? diningTablesQuery.error.message
                            : t('Could not load tables.'),
                        )}
                      </small>
                    )}
                    {!diningTablesQuery.isLoading && diningTablesQuery.data?.length === 0 && (
                      <small>
                        {t('No active tables. Ask the owner to configure dining tables.')}
                      </small>
                    )}
                  </label>
                )}
                {activeDraft?.fulfillment === 'delivery' && (
                  <div className="grid gap-2 p-3">
                    <Input
                      aria-label={t('Customer name')}
                      placeholder={t('Customer name')}
                      value={activeDraft.customerName ?? ''}
                      disabled={Boolean(pendingSale)}
                      onChange={(event) =>
                        updateDraft((draft) => ({ ...draft, customerName: event.target.value }))
                      }
                      className="h-11 rounded-lg text-base lg:h-9 lg:text-xs"
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
                      className="h-11 rounded-lg text-base lg:h-9 lg:text-xs"
                    />
                    <Textarea
                      aria-label={t('Delivery address')}
                      placeholder={t('Delivery address')}
                      value={activeDraft.deliveryAddress ?? ''}
                      disabled={Boolean(pendingSale)}
                      onChange={(event) =>
                        updateDraft((draft) => ({ ...draft, deliveryAddress: event.target.value }))
                      }
                      className="min-h-14 rounded-lg text-base lg:text-xs"
                    />
                  </div>
                )}

                <div className="order-scroll shrink-0 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-5">
                  {activeDraft?.lines.length ? (
                    <section aria-label={t('New items')}>
                      <div className="mb-3 flex items-center justify-between max-[767px]:mb-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider">
                          {t('New items')}
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          {t('{{count}} items', { count: cartCount })}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {activeDraft.lines.map((line) => {
                          const quote = lineQuoteById.get(line.id);
                          const product = products.find((item) => item.id === line.productId);
                          const variant = product?.variants.find(
                            (item) => item.id === line.variantId,
                          );
                          const selectionSummary = summarizeSelections(product, line, t);
                          return (
                            <article
                              className="pos-live-cart-line rounded-xl border border-border px-1.5"
                              data-testid="order-draft-line"
                              key={line.id}
                            >
                              <div className="flex min-w-0 items-center gap-2 max-[767px]:gap-1">
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-h-9 items-center gap-2 text-start text-sm font-semibold max-[767px]:gap-1 max-[767px]:text-[11px]">
                                    <span className="min-w-0 flex-1 truncate">
                                      {product?.name ?? t('Product')}
                                    </span>
                                    {product && productHasChoices(product) && (
                                      <PosButton
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 shrink-0 gap-1 px-1.5 text-[10px] font-semibold"
                                        aria-label={`${t('Edit options')}: ${product.name}`}
                                        disabled={Boolean(pendingSale)}
                                        onClick={() => editConfiguredProduct(line, product)}
                                      >
                                        <Pencil aria-hidden="true" size={12} />
                                        {t('Edit')}
                                      </PosButton>
                                    )}
                                  </div>
                                  <div className="flex min-w-0 items-center justify-between gap-1 text-xs text-muted-foreground max-[767px]:text-[10px]">
                                    <p className="truncate">
                                      {[variant?.name, selectionSummary]
                                        .filter(Boolean)
                                        .join(' · ') || t('Regular')}
                                    </p>
                                    <strong className="shrink-0 text-sm tabular-nums text-foreground max-[767px]:text-[10px]">
                                      {quote
                                        ? formatNumber(Number(quote.lineTotal), {
                                            style: 'currency',
                                            currency: 'EGP',
                                          })
                                        : t('Updating...')}
                                    </strong>
                                  </div>
                                  <details className="pos-item-note-editor mt-1 text-[10px] text-muted-foreground">
                                    <summary className="cursor-pointer truncate">
                                      {line.note
                                        ? `${t('Item note')}: ${line.note}`
                                        : t('Item note')}
                                    </summary>
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
                                            item.id === line.id
                                              ? { ...item, note: event.target.value }
                                              : item,
                                          ),
                                        }))
                                      }
                                      className="mt-1 h-11 rounded-lg text-base lg:h-8 lg:text-xs"
                                    />
                                  </details>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 max-[767px]:gap-0">
                                  <PosButton
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-8 max-[767px]:size-11 max-[767px]:border-transparent max-[767px]:bg-transparent max-[767px]:p-0 max-[767px]:shadow-none"
                                    aria-label={`${t('Decrease quantity')}: ${product?.name ?? ''}`}
                                    disabled={Boolean(pendingSale)}
                                    onClick={() => changeLineQuantity(line.id, line.quantity - 1)}
                                  >
                                    <span className="flex size-7 items-center justify-center rounded-md max-[767px]:border max-[767px]:border-border max-[767px]:bg-card">
                                      <Minus size={14} />
                                    </span>
                                  </PosButton>
                                  <span className="w-5 text-center text-[11px] font-semibold tabular-nums">
                                    {formatNumber(line.quantity)}
                                  </span>
                                  <PosButton
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-8 max-[767px]:size-11 max-[767px]:border-transparent max-[767px]:bg-transparent max-[767px]:p-0 max-[767px]:shadow-none"
                                    aria-label={`${t('Increase quantity')}: ${product?.name ?? ''}`}
                                    disabled={Boolean(pendingSale)}
                                    onClick={() => changeLineQuantity(line.id, line.quantity + 1)}
                                  >
                                    <span className="flex size-7 items-center justify-center rounded-md max-[767px]:border max-[767px]:border-border max-[767px]:bg-card">
                                      <Plus size={14} />
                                    </span>
                                  </PosButton>
                                  <PosButton
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-8 max-[767px]:size-11"
                                    aria-label={`${t('Remove item')}: ${product?.name ?? ''}`}
                                    disabled={Boolean(pendingSale)}
                                    onClick={() => changeLineQuantity(line.id, 0)}
                                  >
                                    <Trash2 size={13} />
                                  </PosButton>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground">
                      <ReceiptText aria-hidden="true" size={32} strokeWidth={1.25} />
                      <p className="text-sm">{t('A fresh order starts here.')}</p>
                      <p className="text-xs">{t('Choose something from the menu.')}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 space-y-2 border-t border-border bg-card p-3 lg:space-y-3 lg:p-5">
                <div className="space-y-2 text-sm max-[767px]:space-y-1.5 max-[767px]:text-[13px]">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('Subtotal')}</span>
                    <span className="tabular-nums">
                      {formatNumber(Number(subtotal), { style: 'currency', currency: 'EGP' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[13px] font-semibold">{t('Total')}</span>
                    <strong className="text-2xl tabular-nums tracking-tight max-[767px]:text-xl">
                      {formatNumber(Number(subtotal), { style: 'currency', currency: 'EGP' })}
                    </strong>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t(
                    'Payment is recorded in the next checkout step. No payment has been collected yet.',
                  )}
                </p>
                {pendingSale && (
                  <p className="text-xs text-warning" role="status">
                    {t('A sale request is saved. Retry this exact request to check its result.')}
                  </p>
                )}
                {!shiftQuery.data && (
                  <Link className="block text-xs text-primary underline" to="/shift">
                    {t('Open a register shift before confirming')}
                  </Link>
                )}
                {!online && (
                  <span className="block text-xs text-warning">
                    {t('Orders can be drafted offline but must be confirmed online.')}
                  </span>
                )}
                {quoteQuery.error && !pendingSale && (
                  <p
                    className="rounded-lg border border-destructive/30 bg-card p-3 text-xs text-destructive"
                    role="alert"
                  >
                    {errorText(
                      quoteQuery.error instanceof Error
                        ? quoteQuery.error.message
                        : t('Could not quote this order.'),
                    )}
                  </p>
                )}
                <PosButton
                  type="button"
                  variant="solid"
                  className="h-11 w-full text-sm font-bold"
                  disabled={
                    !activeDraft?.lines.length ||
                    (activeDraft?.fulfillment === 'dine-in' &&
                      (!activeDraft.tableId ||
                        diningTablesQuery.isError ||
                        diningTablesQuery.isLoading)) ||
                    !shiftQuery.data ||
                    !online ||
                    createMutation.isPending ||
                    (!pendingSale &&
                      (!quoteQuery.data || quoteQuery.isFetching || quoteQuery.isError))
                  }
                  onClick={confirmOrder}
                >
                  {createMutation.isPending
                    ? t('Saving order...')
                    : pendingSale
                      ? t('Retry saved sale')
                      : t('Confirm order')}
                  <ArrowRight aria-hidden="true" className="ms-auto rtl:rotate-180" size={17} />
                </PosButton>
              </div>
            </aside>
          )}
        </div>
      </div>

      <div
        className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-border bg-card p-2 group-data-[input-mode=true]/pos:hidden lg:hidden"
        role="group"
        aria-label={t('Menu and order')}
        data-testid="pos-mobile-navigation"
      >
        <PosButton
          type="button"
          className="min-h-11 gap-2 px-3"
          aria-pressed={mobileView === 'menu'}
          aria-controls="pos-product-menu-pane"
          onClick={() => changeMobileView('menu')}
        >
          <LayoutGrid size={16} aria-hidden="true" />
          {t('Menu')}
        </PosButton>
        <PosButton
          type="button"
          variant={mobileView === 'order' ? 'outline' : 'solid'}
          className="min-h-11 min-w-0 gap-2 px-3"
          aria-pressed={mobileView === 'order'}
          onClick={() => changeMobileView('order')}
          aria-controls="pos-current-order-pane"
        >
          <ShoppingBag size={17} className="shrink-0" aria-hidden="true" />
          <span className="truncate">
            {t('View order')}{' '}
            <span className="rounded-md bg-background/20 px-1.5 py-0.5 text-[11px] tabular-nums">
              {confirmedOrder
                ? confirmedSummary
                  ? formatNumber(
                      confirmedSummary.lines.reduce((sum, line) => sum + line.quantity, 0),
                    )
                  : '—'
                : formatNumber(cartCount)}
            </span>
          </span>
          <bdi className="ms-auto shrink-0 text-xs font-semibold tabular-nums">
            {confirmedOrder
              ? confirmedSummary
                ? formatNumber(Number(confirmedSummary.total), {
                    style: 'currency',
                    currency: confirmedSummary.currency,
                  })
                : t(confirmedSummaryQuery.isError ? 'Total unavailable' : 'Loading…')
              : !cartCount
                ? formatNumber(0, { style: 'currency', currency: 'EGP' })
                : quoteQuery.isError
                  ? t('Total unavailable')
                  : quoteQuery.isFetching
                    ? t('Updating...')
                    : quoteQuery.data
                      ? formatNumber(Number(quoteQuery.data.total), {
                          style: 'currency',
                          currency: quoteQuery.data.currency,
                        })
                      : t('Updating...')}
          </bdi>
        </PosButton>
      </div>

      <PosOrderSwitcher
        entries={switcherEntries}
        selectedId={confirmedOrder?.orderId ?? activeDraft?.id ?? ''}
        emptyCount={
          drafts.filter(
            (draft) =>
              draft.id !== workspace?.selectedDraftId &&
              isBlankPosDraft(draft) &&
              !workspace?.pendingSales[draft.id],
          ).length
        }
        onSelect={(entry) => {
          runWorkspaceAction(() => {
            if (entry.kind === 'draft') selectDraft(employee.merchantId, employee.id, entry.id);
            else selectConfirmedOrder(employee.merchantId, employee.id, entry.id);
            setMobileView('order');
            scrollPositions.current.order = 0;
          });
        }}
        onDelete={(id) =>
          runWorkspaceAction(() => removeDraft(employee.merchantId, employee.id, id))
        }
        onCleanEmpty={() =>
          runWorkspaceAction(() => discardEmptyDrafts(employee.merchantId, employee.id))
        }
      />

      {configuringProduct && (
        <ProductConfigurator
          key={`${configuringProduct.id}:${editingLineId ?? 'new'}`}
          product={configuringProduct}
          initialConfiguration={
            editingLineId
              ? draftLineConfiguration(activeDraft?.lines.find((line) => line.id === editingLineId))
              : undefined
          }
          submitLabel={t(editingLineId ? 'Save changes' : 'Add item')}
          onClose={closeConfigurator}
          onSubmit={(configured) => {
            if (editingLineId) updateConfiguredProduct(editingLineId, configured);
            else addConfiguredProduct(configuringProduct, configured);
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

function LiveProductCard({
  product,
  quantity,
  formatNumber,
  onAdd,
  disabled,
}: {
  product: PublicStorefrontProduct;
  quantity: number;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  onAdd: () => void;
  disabled: boolean;
}) {
  const image = product.images.find((candidate) => candidate.isPrimary) ?? product.images[0];
  const { t } = useLocale();
  const configurable = productHasChoices(product);
  return (
    <button
      type="button"
      aria-label={`${t(configurable ? 'Customize item' : 'Add item')}: ${product.name}`}
      onClick={onAdd}
      disabled={disabled}
      title={disabled ? t('Start another order to add items.') : undefined}
      className={cn(
        'pos-live-product-card product-card relative overflow-hidden rounded-xl border border-border bg-card text-start transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary active:translate-y-0',
        quantity > 0 && 'border-primary',
      )}
    >
      <div className="relative h-[76px] bg-secondary p-1 text-[var(--pos-art-ink)]">
        {image ? (
          <img
            className="h-full w-full rounded-lg object-cover"
            src={image.publicUrl}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg bg-[var(--pos-active)] text-2xl font-bold text-[var(--pos-active-ink)]">
            {product.name.slice(0, 1)}
          </div>
        )}
        {configurable && (
          <span className="absolute start-2 top-2 rounded-md border border-border/70 bg-card/95 px-1.5 py-1 text-[9px] font-medium text-foreground shadow-sm">
            {t('Customizable')}
          </span>
        )}
        {quantity > 0 && (
          <span className="absolute end-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {quantity}
          </span>
        )}
      </div>
      <div className="p-2">
        <h3 className="line-clamp-1 text-xs font-semibold leading-4">{product.name}</h3>
        <p className="mt-1 min-h-7 line-clamp-2 text-[9px] leading-[13px] text-muted-foreground">
          {product.description ||
            (product.variants.length > 0 || product.modifierGroups.length > 0
              ? [
                  product.variants.length > 0 &&
                    t('{{count}} sizes', { count: product.variants.length }),
                  product.modifierGroups.length > 0 &&
                    t('{{count}} option groups', { count: product.modifierGroups.length }),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : t('Available now'))}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <strong className="text-xs tabular-nums">
            {formatNumber(Number(product.basePrice), {
              style: 'currency',
              currency: product.currency,
            })}
          </strong>
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              quantity > 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary',
            )}
          >
            <Plus aria-hidden="true" size={17} />
          </span>
        </div>
      </div>
    </button>
  );
}

function ProductConfigurator({
  product,
  initialConfiguration,
  submitLabel,
  onClose,
  onSubmit,
}: {
  product: PublicStorefrontProduct;
  initialConfiguration?: ConfiguredProduct | undefined;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (configured: ConfiguredProduct) => void;
}) {
  const { t, formatNumber } = useLocale();
  const firstAvailableVariantId =
    product.variants.find((variant) => variant.availability === 'available')?.id ?? '';
  const initialVariantId = product.variants.some(
    (variant) =>
      variant.id === initialConfiguration?.variantId && variant.availability === 'available',
  )
    ? (initialConfiguration?.variantId ?? firstAvailableVariantId)
    : firstAvailableVariantId;
  const retainInitialSelections = (initialConfiguration?.variantId ?? '') === initialVariantId;
  const [variantId, setVariantId] = useState(initialVariantId);
  const [options, setOptions] = useState<Record<string, Record<string, number>>>(() =>
    configuredSelections(
      product,
      initialVariantId,
      retainInitialSelections ? initialConfiguration : undefined,
    ),
  );
  const [selectionError, setSelectionError] = useState('');
  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const unavailable = product.variants.length > 0 && !selectedVariant;
  const availableVariants = product.variants.filter(
    (variant) => variant.availability === 'available',
  );
  const visibleGroups = product.modifierGroups.filter(
    (group) =>
      group.variantOverrides?.find((override) => override.variantId === variantId)?.available !==
      false,
  );
  const basePriceCents = Math.round(Number(selectedVariant?.price ?? product.basePrice) * 100);
  const modifierPriceCents = visibleGroups.reduce(
    (total, group) =>
      total +
      group.options.reduce((groupTotal, option) => {
        const quantity = options[group.id]?.[option.id] ?? 0;
        const override = option.variantOverrides?.find(
          (candidate) => candidate.variantId === variantId,
        );
        if (override?.available === false) return groupTotal;
        const unitPrice = override?.priceAdjustment ?? option.priceAdjustment;
        return groupTotal + Math.round(Number(unitPrice) * 100) * quantity;
      }, 0),
    0,
  );

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
    for (const group of visibleGroups) {
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
    onSubmit({
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
      className="flex max-h-[min(86dvh,760px)] flex-col overflow-hidden text-sm"
    >
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
        data-testid="pos-product-configurator"
      >
        {product.variants.length > 0 && (
          <fieldset className="grid gap-2 rounded-xl border border-border bg-background p-3">
            <legend className="px-1 text-xs font-bold">{t('Choose a size')}</legend>
            {availableVariants.length === 0 ? (
              <p
                className="rounded-lg border border-destructive/30 bg-card p-3 text-xs text-destructive"
                role="status"
              >
                {t('No variants are currently available.')}
              </p>
            ) : (
              availableVariants.map((variant) => (
                <label
                  className={cn(
                    'grid min-h-11 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                    variantId === variant.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-secondary',
                  )}
                  key={variant.id}
                >
                  <input
                    type="radio"
                    name={`variant-${product.id}`}
                    checked={variantId === variant.id}
                    onChange={() => changeVariant(variant.id)}
                    className="accent-primary"
                  />
                  <span>{variant.name}</span>
                  <strong className="text-xs tabular-nums">
                    {formatNumber(Number(variant.price), {
                      style: 'currency',
                      currency: product.currency,
                    })}
                  </strong>
                </label>
              ))
            )}
          </fieldset>
        )}
        {visibleGroups.map((group) => {
          const selectedCount = Object.values(options[group.id] ?? {}).filter(
            (quantity) => quantity > 0,
          ).length;
          const availableOptions = group.options.filter(
            (option) =>
              option.variantOverrides?.find((override) => override.variantId === variantId)
                ?.available !== false,
          );
          return (
            <fieldset
              className="grid gap-2 rounded-xl border border-border bg-background p-3"
              key={group.id}
            >
              <legend className="px-1 text-xs font-bold">{group.name}</legend>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  {group.description || (group.minSelections > 0 ? t('Required') : t('Optional'))}
                </span>
                <span className="tabular-nums">
                  {selectedCount}/{group.maxSelections}
                </span>
              </div>
              {availableOptions.length === 0 ? (
                <p
                  className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground"
                  role="status"
                >
                  {t('No options are available for this selection.')}
                </p>
              ) : (
                availableOptions.map((option) => {
                  const quantity = options[group.id]?.[option.id] ?? 0;
                  const inputType = group.selectionMode === 'single' ? 'radio' : 'checkbox';
                  const override = option.variantOverrides?.find(
                    (candidate) => candidate.variantId === variantId,
                  );
                  const priceAdjustment = override?.priceAdjustment ?? option.priceAdjustment;
                  return (
                    <div
                      className={cn(
                        'grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
                        quantity > 0
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:bg-secondary',
                      )}
                      key={option.id}
                    >
                      <input
                        id={`modifier-${group.id}-${option.id}`}
                        type={inputType}
                        name={`modifier-${product.id}-${group.id}`}
                        checked={quantity > 0}
                        className="size-4 accent-primary"
                        onChange={(event) =>
                          setOption(group.id, option.id, event.target.checked ? 1 : 0)
                        }
                      />
                      <label
                        htmlFor={`modifier-${group.id}-${option.id}`}
                        className="flex min-w-0 cursor-pointer flex-col text-xs"
                      >
                        <span className="font-medium">{option.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {Number(priceAdjustment) > 0
                            ? `+${formatNumber(Number(priceAdjustment), { style: 'currency', currency: product.currency })}`
                            : t('Included')}
                        </span>
                      </label>
                      {quantity > 0 && (option.maxQuantity ?? 1) > 1 ? (
                        <div
                          className="flex h-8 items-center gap-2 rounded-md border border-border px-1"
                          aria-label={t('Quantity for {{option}}', { option: option.name })}
                        >
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
                            aria-label={t('Remove one {{option}}', { option: option.name })}
                            onClick={() =>
                              setOption(group.id, option.id, Math.max(1, quantity - 1))
                            }
                          >
                            <Minus aria-hidden="true" size={14} />
                          </button>
                          <span className="min-w-4 text-center text-xs tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
                            aria-label={t('Add one {{option}}', { option: option.name })}
                            disabled={quantity >= (option.maxQuantity ?? 1)}
                            onClick={() =>
                              setOption(
                                group.id,
                                option.id,
                                Math.min(option.maxQuantity ?? 1, quantity + 1),
                              )
                            }
                          >
                            <Plus aria-hidden="true" size={14} />
                          </button>
                        </div>
                      ) : (
                        <strong className="text-xs tabular-nums">
                          {Number(priceAdjustment) > 0
                            ? `+${formatNumber(Number(priceAdjustment), { style: 'currency', currency: product.currency })}`
                            : ''}
                        </strong>
                      )}
                    </div>
                  );
                })
              )}
              <small className="text-[11px] text-muted-foreground" aria-live="polite">
                {t('Choose {{minimum}} to {{maximum}}', {
                  minimum: group.minSelections,
                  maximum: group.maxSelections,
                })}
              </small>
            </fieldset>
          );
        })}
        {selectionError && (
          <p
            className="rounded-lg border border-destructive/30 bg-card p-3 text-xs text-destructive"
            role="alert"
          >
            {selectionError}
          </p>
        )}
      </div>
      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{t('Estimated item total')}</span>
          <strong data-testid="pos-configured-item-total" className="text-base tabular-nums">
            {formatNumber((basePriceCents + modifierPriceCents) / 100, {
              style: 'currency',
              currency: product.currency,
            })}
          </strong>
        </div>
        <div className="flex gap-2">
          <PosButton type="button" className="flex-1" variant="outline" onClick={onClose}>
            {t('Cancel')}
          </PosButton>
          <PosButton
            type="button"
            className="flex-[2]"
            variant="solid"
            disabled={unavailable}
            onClick={submit}
          >
            {submitLabel} ·{' '}
            {formatNumber((basePriceCents + modifierPriceCents) / 100, {
              style: 'currency',
              currency: product.currency,
            })}
          </PosButton>
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

function toDraftSelections(configured: ConfiguredProduct): PosDraftLine['selections'] {
  return configured.selections.map((selection) => ({
    groupId: selection.groupId,
    options: (selection.optionQuantities?.length
      ? selection.optionQuantities
      : selection.optionIds.map((optionId) => ({ optionId, quantity: 1 }))
    ).map((option) => ({ optionId: option.optionId, quantity: option.quantity })),
  }));
}

function draftLineConfiguration(line: PosDraftLine | undefined): ConfiguredProduct | undefined {
  if (!line) return undefined;
  return {
    ...(line.variantId ? { variantId: line.variantId } : {}),
    selections: line.selections.map((selection) => ({
      groupId: selection.groupId,
      optionIds: selection.options.map((option) => option.optionId),
      optionQuantities: selection.options,
    })),
  };
}

function configuredSelections(
  product: PublicStorefrontProduct,
  variantId: string,
  initialConfiguration: ConfiguredProduct | undefined,
): Record<string, Record<string, number>> {
  const selections = defaultSelections(product, variantId);
  if (!initialConfiguration) return selections;

  for (const saved of initialConfiguration.selections) {
    const group = product.modifierGroups.find((item) => item.id === saved.groupId);
    const groupAvailable =
      group?.variantOverrides?.find((override) => override.variantId === variantId)?.available !==
      false;
    if (!group || !groupAvailable) continue;
    const availableOptions = new Map(
      group.options
        .filter(
          (option) =>
            option.variantOverrides?.find((override) => override.variantId === variantId)
              ?.available !== false,
        )
        .map((option) => [option.id, option.maxQuantity ?? 1]),
    );
    const savedOptions = saved.optionQuantities?.length
      ? saved.optionQuantities
      : saved.optionIds.map((optionId) => ({ optionId, quantity: 1 }));
    selections[group.id] = Object.fromEntries(
      savedOptions.flatMap((option) => {
        const maximum = availableOptions.get(option.optionId);
        return maximum === undefined || option.quantity <= 0
          ? []
          : [[option.optionId, Math.min(option.quantity, maximum)]];
      }),
    );
  }
  return selections;
}

function productHasChoices(product: PublicStorefrontProduct): boolean {
  return product.variants.length > 0 || product.modifierGroups.length > 0;
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
