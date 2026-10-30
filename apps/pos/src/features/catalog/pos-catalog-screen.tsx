import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddPosKitchenItemsRequest,
  CatalogProductQuoteSelection,
  CreatePosOrderRequest,
  PosDiningTableOption,
  PosEmployeeSession,
  PosOrderQuoteRequest,
  PublicStorefrontProduct,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import { Dialog, Input, cn, useLocale } from '@waffarly/ui';
import {
  ArrowRight,
  LayoutGrid,
  Maximize2,
  Minimize2,
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
  type PendingPosKitchenAmendment,
} from '../../app/pos-workspace-store.js';
import { ApiError } from '../../lib/api-client.js';
import { PosDeliveryDetails } from './pos-delivery-details.js';
import {
  customerFields,
  customerErrorsFromIssues,
  validateDeliveryDetails,
  type CustomerErrors,
  type CustomerField,
} from './pos-customer-validation.js';
import { posCatalogKey, getPosSellableCatalog } from './pos-catalog.api.js';
import { getPosDiningTables, posDiningTablesKey } from '../dining/pos-dining.api.js';
import {
  addPosKitchenItems,
  createPosOrder,
  posOrderKeys,
  posOrderDetailKey,
  quotePosOrder,
  getPosOrder,
  listPosSales,
} from '../orders/pos-orders.api.js';
import { getPosOrderPaymentState, posPaymentStateKey } from '../payments/pos-payments.api.js';
import { formatMoneyCents, parseMoneyCents } from '../payments/payment-form-model.js';
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
  const completeKitchenAmendment = usePosWorkspaceStore((state) => state.completeKitchenAmendment);
  const removePendingSale = usePosWorkspaceStore((state) => state.removePendingSale);
  const savePendingKitchenAmendment = usePosWorkspaceStore(
    (state) => state.savePendingKitchenAmendment,
  );
  const removePendingKitchenAmendment = usePosWorkspaceStore(
    (state) => state.removePendingKitchenAmendment,
  );
  const selectConfirmedOrder = usePosWorkspaceStore((state) => state.selectConfirmedOrder);
  const openServerOrder = usePosWorkspaceStore((state) => state.openServerOrder);
  const pruneConfirmedOrders = usePosWorkspaceStore((state) => state.pruneConfirmedOrders);
  const closeConfirmedOrder = usePosWorkspaceStore((state) => state.closeConfirmedOrder);
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
  const [orderSearch, setOrderSearch] = useState('');
  const [orderMode, setOrderMode] = useState<'active' | 'history'>('active');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [configuringProduct, setConfiguringProduct] = useState<PublicStorefrontProduct | null>(
    null,
  );
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState('');
  const [amendingOrderId, setAmendingOrderId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState('');
  const [customerValidation, setCustomerValidation] = useState<{
    draftId: string;
    touched: CustomerField[];
    serverErrors: CustomerErrors;
  }>({ draftId: '', touched: [], serverErrors: {} });
  const [online, setOnline] = useState(() => navigator.onLine);
  const [mobileView, setMobileView] = useState<'menu' | 'order'>('menu');
  const [cartExpanded, setCartExpanded] = useState(false);
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
  useEffect(() => {
    if (!workspace || workspace.selectedBranchId !== selectedBranchId) return;
    const amendmentDrafts = new Set(
      Object.values(workspace.pendingKitchenAmendments).map((item) => item.draftId),
    );
    if (
      !drafts.some(
        (draft) =>
          draft.id !== workspace.selectedDraftId &&
          isBlankPosDraft(draft) &&
          !workspace.pendingSales[draft.id] &&
          !amendmentDrafts.has(draft.id),
      )
    )
      return;
    try {
      discardEmptyDrafts(employee.merchantId, employee.id);
    } catch {
      /* retain drafts if storage is unavailable */
    }
  }, [workspace, drafts, selectedBranchId, discardEmptyDrafts, employee.merchantId, employee.id]);
  const activeDraft =
    drafts.find((draft) => draft.id === workspace?.selectedDraftId) ?? drafts[0] ?? null;
  const localCustomerErrors =
    activeDraft?.fulfillment === 'delivery' ? validateDeliveryDetails(activeDraft) : {};
  const customerErrors: CustomerErrors = {};
  if (activeDraft?.id === customerValidation.draftId && activeDraft?.fulfillment === 'delivery') {
    for (const field of customerValidation.touched) {
      const message = customerValidation.serverErrors[field] ?? localCustomerErrors[field];
      if (message) customerErrors[field] = message;
    }
  }
  function focusCustomerError() {
    requestAnimationFrame(() => {
      orderPaneRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }
  function touchCustomerField(field: CustomerField, clearServerError = false) {
    if (!activeDraft) return;
    setCustomerValidation((previous) => {
      const current =
        previous.draftId === activeDraft.id
          ? previous
          : { draftId: activeDraft.id, touched: [], serverErrors: {} };
      return {
        ...current,
        touched: clearServerError ? current.touched : [...new Set([...current.touched, field])],
        serverErrors: clearServerError
          ? { ...current.serverErrors, [field]: undefined }
          : current.serverErrors,
      };
    });
  }
  const confirmedOrders = useMemo(
    () =>
      workspace?.merchantId === employee.merchantId && workspace.employeeId === employee.id
        ? Object.values(workspace.confirmedOrders)
            .filter((order) => order.branchId === selectedBranchId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [workspace, employee.merchantId, employee.id, selectedBranchId],
  );
  const salesQuery = useInfiniteQuery({
    queryKey: [
      'pos',
      'orders',
      'sales',
      employee.merchantId,
      employee.id,
      selectedBranchId,
      orderMode,
      orderSearch,
    ],
    queryFn: ({ pageParam, signal }) =>
      listPosSales(selectedBranchId, orderMode, orderSearch, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(selectedBranchId && canSell && online),
    staleTime: 5_000,
  });
  const serverOrders = salesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  useEffect(() => {
    if (!salesQuery.isSuccess) return;
    try {
      pruneConfirmedOrders(employee.merchantId, employee.id);
    } catch {
      /* retain references when storage is unavailable */
    }
  }, [
    salesQuery.isSuccess,
    employee.merchantId,
    employee.id,
    pruneConfirmedOrders,
    Object.keys(workspace?.confirmedOrders ?? {}).length,
  ]);
  const confirmedOrder = confirmedOrders.find(
    (order) => order.orderId === workspace?.selectedConfirmedOrderId,
  );
  const confirmedSummaryQuery = useQuery<StorefrontOrderSummary>({
    queryKey: posOrderDetailKey(employee.merchantId, employee.id, confirmedOrder?.orderId ?? ''),
    queryFn: ({ signal }) => getPosOrder(confirmedOrder!.orderId, signal),
    enabled: false,
  });
  const confirmedSummary = confirmedSummaryQuery.isError ? undefined : confirmedSummaryQuery.data;
  const amendmentOrderQuery = useQuery({
    queryKey: posOrderDetailKey(employee.merchantId, employee.id, amendingOrderId ?? ''),
    queryFn: ({ signal }) => getPosOrder(amendingOrderId!, signal),
    enabled: Boolean(amendingOrderId),
    retry: false,
  });
  const amendmentPaymentQuery = useQuery({
    queryKey: posPaymentStateKey(employee.merchantId, amendingOrderId ?? ''),
    queryFn: ({ signal }) => getPosOrderPaymentState(amendingOrderId!, signal),
    enabled: Boolean(amendingOrderId),
    retry: false,
  });
  const amendmentOrder = amendmentOrderQuery.data;
  const amendmentPayment = amendmentPaymentQuery.data;
  const amendmentAllowed = Boolean(
    amendmentOrder?.status === 'pending' &&
    amendmentOrder.kitchenTicket &&
    amendmentPayment?.status === 'pending' &&
    amendmentPayment.checks.length === 1 &&
    amendmentPayment.checks[0]?.splitMethod === 'whole' &&
    amendmentPayment.checks[0]?.status === 'open' &&
    amendmentPayment.checks[0]?.payments.length === 0,
  );
  const pendingKitchenAmendment =
    workspace?.pendingKitchenAmendments[amendingOrderId ?? confirmedOrder?.orderId ?? ''];
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
    if (next === 'menu') setCartExpanded(false);
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
    enabled:
      canSell && (!confirmedOrder || Boolean(amendingOrderId)) && quoteRequest.items.length > 0,
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
      if (
        error instanceof ApiError &&
        error.statusCode === 400 &&
        activeDraft?.id === variables.draftId &&
        activeDraft.fulfillment === 'delivery'
      ) {
        const serverErrors = customerErrorsFromIssues(error.issues);
        if (Object.keys(serverErrors).length) {
          setCustomerValidation({
            draftId: variables.draftId,
            touched: [...customerFields],
            serverErrors,
          });
          const otherIssues = error.issues.filter(
            (issue) =>
              !customerFields.some((field) => issue.path.length === 1 && issue.path[0] === field),
          );
          setOperationError(otherIssues.map((issue) => issue.message).join(', '));
          focusCustomerError();
          return;
        }
      }
      setOperationError(
        errorText(error instanceof Error ? error.message : t('Could not confirm this order.')),
      );
    },
  });

  const amendmentMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: AddPosKitchenItemsRequest }) =>
      addPosKitchenItems(orderId, payload),
    onSuccess: async (order, variables) => {
      queryClient.setQueryData(
        posOrderDetailKey(employee.merchantId, employee.id, variables.orderId),
        order,
      );
      try {
        const pending =
          usePosWorkspaceStore.getState().workspace?.pendingKitchenAmendments[variables.orderId];
        if (!pending) throw new Error(t('The saved kitchen addition could not be recovered.'));
        completeKitchenAmendment(
          employee.merchantId,
          employee.id,
          variables.orderId,
          variables.payload.requestId,
          pending.draftId,
        );
        setAmendingOrderId(null);
        setOperationError('');
      } catch {
        setOperationError(
          t(
            'Items were added, but the local order could not be updated. Retry the saved request; do not send it again with a new ID.',
          ),
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pos', 'orders'] }),
        queryClient.invalidateQueries({
          queryKey: posPaymentStateKey(employee.merchantId, variables.orderId),
        }),
      ]);
    },
    onError: (error, variables) => {
      if (error instanceof ApiError && [400, 401, 403, 404, 409].includes(error.statusCode)) {
        removePendingKitchenAmendment(
          employee.merchantId,
          employee.id,
          variables.orderId,
          variables.payload.requestId,
        );
        void Promise.all([
          queryClient.invalidateQueries({
            queryKey: posOrderDetailKey(employee.merchantId, employee.id, variables.orderId),
          }),
          queryClient.invalidateQueries({
            queryKey: posPaymentStateKey(employee.merchantId, variables.orderId),
          }),
        ]);
      }
      setOperationError(
        errorText(error instanceof Error ? error.message : t('Could not add items to the order.')),
      );
    },
  });

  function updateDraft(update: (draft: PosOrderDraft) => PosOrderDraft): boolean {
    if (!activeDraft) return false;
    if (amendingOrderId && pendingKitchenAmendment) {
      setOperationError(t('Retry the saved item addition before editing it.'));
      return false;
    }
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
      setAmendingOrderId(null);
      startDraft(employee.merchantId, employee.id);
      setMobileView('menu');
      scrollPositions.current.order = 0;
      setOperationError('');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('Could not save this order.'));
    }
  }

  function startKitchenAmendment(orderId: string) {
    try {
      startDraft(employee.merchantId, employee.id);
      setAmendingOrderId(orderId);
      setMobileView('menu');
      scrollPositions.current.order = 0;
      setOperationError('');
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : t('Could not start adding items to this order.'),
      );
    }
  }

  function leaveKitchenAmendment() {
    if (!amendingOrderId) return;
    selectConfirmedOrder(employee.merchantId, employee.id, amendingOrderId);
    setAmendingOrderId(null);
    setMobileView('order');
    setOperationError('');
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
    if (amendingOrderId) {
      const pendingAmendment = workspace?.pendingKitchenAmendments[amendingOrderId];
      if (pendingAmendment) {
        amendmentMutation.mutate({
          orderId: amendingOrderId,
          payload: pendingAmendment.payload,
        });
        return;
      }
      if (!amendmentAllowed || !amendmentPayment) {
        setOperationError(
          t(
            'The kitchen has accepted this order or payment has started. Refresh the order before adding items.',
          ),
        );
        return;
      }
      if (!quoteQuery.data || quoteQuery.isFetching || quoteQuery.isError) {
        setOperationError(t('Wait for a current server quote before adding items.'));
        return;
      }
      const quoteByLine = new Map(quoteQuery.data.items.map((item) => [item.lineId, item.quote]));
      const payload: AddPosKitchenItemsRequest = {
        requestId: crypto.randomUUID(),
        revision: amendmentPayment.revision,
        items: activeDraft.lines.map((line) => {
          const quote = quoteByLine.get(line.id);
          if (!quote) throw new Error(t('The server quote is missing an added item.'));
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
      const envelope: PendingPosKitchenAmendment = {
        requestId: payload.requestId,
        draftId: activeDraft.id,
        payload,
      };
      try {
        savePendingKitchenAmendment(employee.merchantId, employee.id, amendingOrderId, envelope);
        setOperationError('');
        amendmentMutation.mutate({ orderId: amendingOrderId, payload });
      } catch (error) {
        setOperationError(
          error instanceof Error ? error.message : t('Could not save this item addition safely.'),
        );
      }
      return;
    }
    const pending = workspace?.pendingSales[activeDraft.id];
    if (pending) {
      createMutation.mutate({ draftId: activeDraft.id, payload: pending.payload });
      return;
    }
    if (activeDraft.fulfillment === 'delivery' && Object.keys(localCustomerErrors).length) {
      setCustomerValidation({
        draftId: activeDraft.id,
        touched: [...customerFields],
        serverErrors: {},
      });
      setOperationError('');
      focusCustomerError();
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
  const amendedOrderTotal = formatMoneyCents(
    (parseMoneyCents(amendmentOrder?.total ?? '0.00') ?? 0n) + (parseMoneyCents(subtotal) ?? 0n),
  );
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
        subtitle: `${service} · ${t('{{count}} items', {
          count: draft.lines.reduce((sum, line) => sum + line.quantity, 0),
        })}`,
        total:
          draft.id === activeDraft?.id && quoteQuery.data && !quoteQuery.isFetching
            ? formatNumber(Number(subtotal), { style: 'currency', currency: 'EGP' })
            : undefined,
        updatedAt: draft.updatedAt,
        lastOpenedAt: draft.lastOpenedAt ?? draft.updatedAt,
        empty: isBlankPosDraft(draft),
        protected:
          Boolean(workspace?.pendingSales[draft.id]) ||
          Object.values(workspace?.pendingKitchenAmendments ?? {}).some(
            (amendment) => amendment.draftId === draft.id,
          ),
      };
    }),
    ...confirmedOrders.map((order): PosSwitcherEntry => {
      const cached = queryClient.getQueryData<StorefrontOrderSummary>(
        posOrderDetailKey(employee.merchantId, employee.id, order.orderId),
      );
      return {
        id: order.orderId,
        kind: 'confirmed',
        reference:
          cached?.orderReference ??
          order.orderReference ??
          `ORD-${order.orderId.slice(0, 8).toUpperCase()}`,
        title: cached?.customerName || t('Confirmed order'),
        subtitle: cached
          ? t('{{count}} items', {
              count: cached.lines.reduce((sum, line) => sum + line.quantity, 0),
            })
          : t('Saved on this device'),
        total: cached
          ? formatNumber(Number(cached.total), { style: 'currency', currency: cached.currency })
          : undefined,
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
            cartExpanded ? 'hidden' : mobileView === 'order' && 'hidden lg:block',
          )}
        >
          <div className="p-3">
            <div className="mb-2 grid gap-2 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
              <header className="flex flex-wrap items-center justify-between gap-3 lg:col-start-1 lg:row-start-1">
                <div>
                  <span className="sr-only">{t('Live merchant menu')}</span>
                  <h2 id="pos-catalog-heading" className="text-base font-semibold">
                    {amendingOrderId
                      ? t('Add items to order')
                      : t(confirmedOrder ? 'Menu' : 'New order')}
                  </h2>
                </div>
                <PosButton
                  type="button"
                  variant="outline"
                  className="pos-new-draft-button h-10"
                  onClick={amendingOrderId ? leaveKitchenAmendment : createDraft}
                  disabled={Boolean(pendingSale || pendingKitchenAmendment)}
                >
                  {amendingOrderId ? (
                    <ReceiptText aria-hidden="true" size={16} />
                  ) : (
                    <Plus aria-hidden="true" size={16} />
                  )}
                  {t(amendingOrderId ? 'Back to order' : 'New order')}
                </PosButton>
              </header>

              <div className="grid gap-2 lg:contents">
                <div className="flex flex-wrap items-center gap-2 lg:col-start-2 lg:row-start-1 lg:justify-end">
                  <label className="grid min-w-32 gap-1 text-[10px] text-muted-foreground">
                    <span>{t('Branch')}</span>
                    <select
                      className="min-h-9 rounded-lg border border-border bg-card px-3 text-[11px] text-foreground"
                      value={selectedBranchId}
                      disabled={!branches.length || Boolean(pendingSale || amendingOrderId)}
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
                      disabled={registers.length === 0 || Boolean(pendingSale || amendingOrderId)}
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
                <label className="relative flex min-h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground lg:col-span-2">
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
              className="mb-2 flex gap-1.5 overflow-x-auto pb-1"
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
                    disabled={
                      Boolean(confirmedOrder && !amendingOrderId) ||
                      Boolean(pendingKitchenAmendment) ||
                      Boolean(amendingOrderId && !amendmentAllowed)
                    }
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
          onKeyDown={(event) => {
            if (event.key === 'Escape' && cartExpanded && !event.defaultPrevented) {
              setCartExpanded(false);
              event.currentTarget.querySelector<HTMLButtonElement>('[aria-expanded]')?.focus();
            }
          }}
          className={cn(
            'relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex lg:shrink-0 [&>aside>header]:pe-14',
            cartExpanded ? 'flex' : 'lg:w-[360px] lg:flex-none xl:w-[400px]',
            !cartExpanded && (mobileView === 'menu' ? 'hidden' : 'flex'),
          )}
        >
          <PosButton
            type="button"
            variant="outline"
            size="icon"
            className="absolute end-3 top-2 z-10 size-9"
            aria-label={t(cartExpanded ? 'Restore menu and order' : 'Expand order')}
            title={t(cartExpanded ? 'Restore menu and order' : 'Expand order')}
            aria-expanded={cartExpanded}
            onClick={() => setCartExpanded((expanded) => !expanded)}
          >
            {cartExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </PosButton>
          {confirmedOrder ? (
            <PosConfirmedOrderPanel
              key={confirmedOrder.orderId}
              merchantId={employee.merchantId}
              employeeId={employee.id}
              branchId={confirmedOrder.branchId}
              requiresApproval={!employee.permissions.includes('approve_voids')}
              requiresRefundApproval={!employee.permissions.includes('approve_refunds')}
              refundShiftId={shiftQuery.data?.id ?? null}
              orderId={confirmedOrder.orderId}
              online={online}
              hasPendingAmendment={Boolean(
                workspace?.pendingKitchenAmendments[confirmedOrder.orderId],
              )}
              onAddItems={() => startKitchenAmendment(confirmedOrder.orderId)}
              onRetryPendingAmendment={() => {
                const pending =
                  usePosWorkspaceStore.getState().workspace?.pendingKitchenAmendments[
                    confirmedOrder.orderId
                  ];
                if (pending)
                  amendmentMutation.mutate({
                    orderId: confirmedOrder.orderId,
                    payload: pending.payload,
                  });
              }}
              onCheckout={() => setCheckoutOrderId(confirmedOrder.orderId)}
              onNewOrder={(closeSettled) => {
                if (closeSettled) {
                  try {
                    closeConfirmedOrder(employee.merchantId, employee.id, confirmedOrder.orderId);
                  } catch {
                    /* preserve any unresolved action */
                  }
                }
                createDraft();
              }}
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
                {amendingOrderId ? (
                  <div className="shrink-0 border-b border-border py-3 ps-4 pe-14">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                          {t('Add items to order')}
                        </span>
                        <h2 className="mt-1 truncate text-base font-semibold">
                          {amendmentOrder?.orderReference ??
                            `ORD-${amendingOrderId.slice(0, 8).toUpperCase()}`}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(
                            'Previously sent items stay unchanged. These additions will be sent as a new kitchen update.',
                          )}
                        </p>
                      </div>
                      {!pendingKitchenAmendment && (
                        <PosButton
                          type="button"
                          variant="outline"
                          className="min-h-9 shrink-0 px-3 text-xs"
                          onClick={leaveKitchenAmendment}
                        >
                          {t('Back to order')}
                        </PosButton>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="shrink-0 border-b border-border py-2 ps-3 pe-14">
                    <div className="flex min-h-9 items-center gap-3">
                      <span className="text-sm font-semibold">{t('Current order')}</span>
                      <span className="font-mono text-xs text-primary">
                        #{activeDraft?.id.slice(0, 6) ?? '—'}
                      </span>
                      <PosButton
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t('New order')}
                        disabled={Boolean(pendingSale)}
                        onClick={createDraft}
                        className="ms-auto size-9 shrink-0"
                      >
                        <Plus aria-hidden="true" size={16} />
                      </PosButton>
                    </div>
                    {activeDraft?.customerName && (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {activeDraft.customerName}
                      </p>
                    )}
                  </div>
                )}

                {!amendingOrderId && (
                  <>
                    <div
                      className={cn(
                        'grid shrink-0 items-start gap-2 border-b border-border p-2',
                        activeDraft?.fulfillment === 'dine-in' && 'sm:grid-cols-2',
                      )}
                    >
                      <div
                        className="grid shrink-0 grid-cols-3 gap-1"
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
                            onClick={() =>
                              updateDraft((draft) => ({ ...draft, fulfillment: value }))
                            }
                            className={cn(
                              'flex min-h-9 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors [@media(pointer:coarse)]:min-h-11',
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
                        <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground">
                          <span className="sr-only">{t('Table')}</span>
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
                    </div>
                    {activeDraft?.fulfillment === 'delivery' && (
                      <PosDeliveryDetails
                        values={activeDraft}
                        errors={customerErrors}
                        disabled={Boolean(pendingSale)}
                        onBlur={(field) => touchCustomerField(field)}
                        onChange={(field, value) => {
                          if (updateDraft((draft) => ({ ...draft, [field]: value })))
                            touchCustomerField(field, true);
                        }}
                      />
                    )}
                  </>
                )}

                <div
                  className="order-scroll shrink-0 px-3 py-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
                  data-testid="cart-items-scroll"
                >
                  {amendingOrderId && (
                    <section
                      aria-label={t('Previously sent items')}
                      className="mb-3 rounded-lg border border-border bg-secondary/40 p-3"
                      data-testid="kitchen-amendment-existing-items"
                    >
                      <h3 className="mb-2 text-xs font-semibold">{t('Previously sent items')}</h3>
                      {amendmentOrderQuery.isLoading ? (
                        <p className="m-0 text-xs text-muted-foreground" role="status">
                          {t('Loading order details...')}
                        </p>
                      ) : amendmentOrderQuery.isError || !amendmentOrder ? (
                        <p className="m-0 text-xs text-destructive" role="alert">
                          {errorText(t('Could not load the confirmed order.'))}
                        </p>
                      ) : (
                        <ul className="m-0 grid list-none gap-1 p-0 text-xs text-muted-foreground">
                          {amendmentOrder.lines.map((line) => (
                            <li key={line.id} className="flex items-start justify-between gap-2">
                              <span className="min-w-0 break-words">
                                {line.productName}
                                {line.variantName ? ` · ${line.variantName}` : ''}
                              </span>
                              <bdi className="shrink-0 tabular-nums">×{line.quantity}</bdi>
                            </li>
                          ))}
                        </ul>
                      )}
                      {amendmentPaymentQuery.isError && (
                        <p className="mt-2 text-xs text-destructive" role="alert">
                          {t('Could not verify payment status. Retry before collecting.')}
                        </p>
                      )}
                      {!amendmentPaymentQuery.isLoading && !amendmentAllowed && (
                        <p className="mt-2 text-xs text-warning" role="status">
                          {t(
                            'Additions are available only before kitchen acceptance and before any payment or check split.',
                          )}
                        </p>
                      )}
                    </section>
                  )}
                  {activeDraft?.lines.length ? (
                    <section aria-label={t('New items')}>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider">
                          {t('New items')}
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          {t('{{count}} items', { count: cartCount })}
                        </span>
                      </div>
                      <div className={cn('grid gap-2', cartExpanded && 'lg:grid-cols-2')}>
                        {activeDraft.lines.map((line) => {
                          const quote = lineQuoteById.get(line.id);
                          const product = products.find((item) => item.id === line.productId);
                          const variant = product?.variants.find(
                            (item) => item.id === line.variantId,
                          );
                          const selectionSummary = summarizeSelections(product, line, t);
                          return (
                            <article
                              className="pos-live-cart-line @container/item rounded-xl border border-border bg-background/40 px-3 py-1.5"
                              data-testid="order-draft-line"
                              key={line.id}
                            >
                              <div
                                className={cn(
                                  'min-w-0',
                                  cartExpanded
                                    ? '@[520px]/item:grid @[520px]/item:grid-cols-[minmax(0,1fr)_auto] @[520px]/item:items-center @[520px]/item:gap-3'
                                    : 'lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-2 lg:gap-y-0.5',
                                )}
                              >
                                <div
                                  className={cn('min-w-0 flex-1', !cartExpanded && 'lg:contents')}
                                >
                                  <div
                                    className={cn(
                                      'flex items-start justify-between gap-3 text-start text-sm font-semibold leading-5',
                                      !cartExpanded && 'lg:col-span-2',
                                    )}
                                  >
                                    <span
                                      className="min-w-0 flex-1 break-words"
                                      data-testid="cart-item-name"
                                    >
                                      {product?.name ?? t('Product')}
                                    </span>
                                    <strong className="shrink-0 text-sm tabular-nums text-primary">
                                      {quote
                                        ? formatNumber(Number(quote.lineTotal), {
                                            style: 'currency',
                                            currency: 'EGP',
                                          })
                                        : t('Updating...')}
                                    </strong>
                                  </div>
                                  <div
                                    className={cn(
                                      'mt-1 flex flex-wrap items-baseline gap-x-3 text-xs leading-5 text-muted-foreground',
                                      !cartExpanded && 'lg:contents',
                                    )}
                                  >
                                    <p
                                      className={cn(
                                        'max-w-full break-words',
                                        !cartExpanded &&
                                          'lg:col-start-1 lg:row-start-2 lg:min-w-0 lg:self-center',
                                      )}
                                      data-testid="cart-item-options"
                                    >
                                      {[variant?.name, selectionSummary]
                                        .filter(Boolean)
                                        .join(' · ') || t('Regular')}
                                    </p>
                                    <details
                                      className={cn(
                                        'pos-item-note-editor min-w-0 flex-1 open:basis-full',
                                        !cartExpanded && 'lg:col-span-2 lg:row-start-3',
                                      )}
                                    >
                                      <summary className="cursor-pointer break-words">
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
                                </div>
                                <div
                                  className={cn(
                                    'mt-2 flex items-center justify-between gap-2',
                                    cartExpanded
                                      ? '@[520px]/item:mt-0'
                                      : 'lg:col-start-2 lg:row-start-2 lg:mt-0',
                                  )}
                                >
                                  {product && productHasChoices(product) ? (
                                    <PosButton
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1 px-2 text-xs max-[767px]:min-h-11 [@media(pointer:coarse)]:min-h-11"
                                      aria-label={`${t('Edit options')}: ${product.name}`}
                                      disabled={Boolean(pendingSale)}
                                      onClick={() => editConfiguredProduct(line, product)}
                                    >
                                      <Pencil aria-hidden="true" size={12} />
                                      {t('Edit')}
                                    </PosButton>
                                  ) : (
                                    <span />
                                  )}
                                  <div className="flex shrink-0 items-center gap-1">
                                    <PosButton
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="size-8 max-[767px]:size-11 [@media(pointer:coarse)]:size-11"
                                      aria-label={`${t('Decrease quantity')}: ${product?.name ?? ''}`}
                                      disabled={Boolean(pendingSale)}
                                      onClick={() => changeLineQuantity(line.id, line.quantity - 1)}
                                    >
                                      <span className="flex size-7 items-center justify-center rounded-md max-[767px]:border max-[767px]:border-border max-[767px]:bg-card">
                                        <Minus size={14} />
                                      </span>
                                    </PosButton>
                                    <span className="min-w-7 text-center text-sm font-semibold tabular-nums text-primary">
                                      {formatNumber(line.quantity)}
                                    </span>
                                    <PosButton
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="size-8 max-[767px]:size-11 [@media(pointer:coarse)]:size-11"
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
                                      className="ms-2 size-8 max-[767px]:size-11 [@media(pointer:coarse)]:size-11"
                                      aria-label={`${t('Remove item')}: ${product?.name ?? ''}`}
                                      disabled={Boolean(pendingSale)}
                                      onClick={() => changeLineQuantity(line.id, 0)}
                                    >
                                      <Trash2 size={13} />
                                    </PosButton>
                                  </div>
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
              <div
                className={cn(
                  'shrink-0 gap-2 border-t border-border bg-card px-3 py-2',
                  amendingOrderId
                    ? 'grid'
                    : 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center [&>p]:col-span-2 [&>a]:col-span-2 [&>span]:col-span-2',
                )}
              >
                {amendingOrderId ? (
                  <div className="grid gap-1.5 text-sm">
                    <div className="flex items-center justify-between gap-3 text-muted-foreground">
                      <span>{t('Added items')}</span>
                      <bdi className="tabular-nums">
                        {formatNumber(Number(subtotal), { style: 'currency', currency: 'EGP' })}
                      </bdi>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                      <strong className="text-[13px]">{t('New order total')}</strong>
                      <strong className="text-xl tabular-nums tracking-tight text-primary">
                        {formatNumber(Number(amendedOrderTotal), {
                          style: 'currency',
                          currency: 'EGP',
                        })}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold">{t('Total')}</span>
                      <strong className="text-xl tabular-nums tracking-tight text-primary">
                        {formatNumber(Number(subtotal), { style: 'currency', currency: 'EGP' })}
                      </strong>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {amendingOrderId
                    ? t('The kitchen receives only these new items. No payment is collected here.')
                    : t(
                        'Payment is recorded in the next checkout step. No payment has been collected yet.',
                      )}
                </p>
                {pendingSale && (
                  <p className="text-xs text-warning" role="status">
                    {t('A sale request is saved. Retry this exact request to check its result.')}
                  </p>
                )}
                {pendingKitchenAmendment && (
                  <p className="text-xs text-warning" role="status">
                    {t(
                      'An added-items request is saved. Retry the exact request to check its result.',
                    )}
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
                {quoteQuery.error && !pendingSale && !pendingKitchenAmendment && (
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
                  className={cn(
                    'h-11 w-full text-sm font-bold',
                    !amendingOrderId && 'col-start-2 row-start-1',
                  )}
                  disabled={
                    !activeDraft?.lines.length ||
                    !shiftQuery.data ||
                    !online ||
                    (amendingOrderId
                      ? amendmentMutation.isPending ||
                        (!pendingKitchenAmendment &&
                          (!amendmentAllowed ||
                            !amendmentPayment ||
                            !quoteQuery.data ||
                            quoteQuery.isFetching ||
                            quoteQuery.isError))
                      : (activeDraft?.fulfillment === 'dine-in' &&
                          (!activeDraft.tableId ||
                            diningTablesQuery.isError ||
                            diningTablesQuery.isLoading)) ||
                        createMutation.isPending ||
                        (!pendingSale &&
                          (!quoteQuery.data || quoteQuery.isFetching || quoteQuery.isError)))
                  }
                  onClick={confirmOrder}
                >
                  {amendingOrderId
                    ? amendmentMutation.isPending
                      ? t('Sending added items...')
                      : pendingKitchenAmendment
                        ? t('Retry saved item addition')
                        : t('Send added items')
                    : createMutation.isPending
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
            {t(amendingOrderId ? 'Added items' : 'View order')}{' '}
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
            {amendingOrderId
              ? formatNumber(Number(amendedOrderTotal), {
                  style: 'currency',
                  currency: amendmentOrder?.currency ?? 'EGP',
                })
              : confirmedOrder
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
        serverEntries={
          !online || salesQuery.isError
            ? switcherEntries.filter((entry) => entry.kind === 'confirmed')
            : serverOrders.map((order) => ({
                id: order.id,
                kind: 'confirmed' as const,
                reference: order.orderReference ?? `ORD-${order.id.slice(0, 8).toUpperCase()}`,
                title:
                  order.customerName ||
                  (order.tableCode ? `${t('Table')} ${order.tableCode}` : t('Confirmed order')),
                subtitle: t('{{count}} items', {
                  count: order.lines.reduce((sum, line) => sum + line.quantity, 0),
                }),
                total: formatNumber(Number(order.total), {
                  style: 'currency',
                  currency: order.currency,
                }),
                updatedAt: order.createdAt,
                lastOpenedAt: order.createdAt,
              }))
        }
        onServerModeChange={setOrderMode}
        onSearchChange={setOrderSearch}
        hasMore={salesQuery.hasNextPage}
        loading={salesQuery.isFetching}
        failed={salesQuery.isError || !online}
        onLoadMore={() => {
          void salesQuery.fetchNextPage();
        }}
        selectedId={amendingOrderId ?? confirmedOrder?.orderId ?? activeDraft?.id ?? ''}
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
            setAmendingOrderId(null);
            if (entry.kind === 'draft') selectDraft(employee.merchantId, employee.id, entry.id);
            else {
              const remote = serverOrders.find((order) => order.id === entry.id);
              if (remote) {
                queryClient.setQueryData(
                  posOrderDetailKey(employee.merchantId, employee.id, remote.id),
                  remote,
                );
                openServerOrder(employee.merchantId, employee.id, {
                  orderId: remote.id,
                  branchId: selectedBranchId,
                  createdAt: remote.createdAt,
                  orderReference: remote.orderReference,
                });
              } else selectConfirmedOrder(employee.merchantId, employee.id, entry.id);
            }
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
        onCloseConfirmed={(id) =>
          runWorkspaceAction(() => closeConfirmedOrder(employee.merchantId, employee.id, id))
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
          requiresRefundApproval={!employee.permissions.includes('approve_refunds')}
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
