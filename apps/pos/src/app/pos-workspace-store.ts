import { create } from 'zustand';
import type {
  AddPosKitchenItemsRequest,
  CreatePosOrderRequest,
  ClosePosShiftRequest,
  RecordPosShiftCashMovementRequest,
  RecordPosCheckPaymentRequest,
  RecordPosCheckRefundRequest,
  RecordPosItemReturnRequest,
} from '@waffarly/contracts';

export type PendingPosAction =
  | { action: 'accept'; requestId: string; branchId: string }
  | { action: 'cancel_ack'; requestId: string }
  | { action: 'prepare' | 'ready' | 'handover'; requestId: string; branchId?: string }
  | { action: 'item_ready'; requestId: string; lineId: string; branchId?: string };

export interface PosDraftLine {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  selections: Array<{
    groupId: string;
    options: Array<{ optionId: string; quantity: number }>;
  }>;
  note: string;
}

export interface PosOrderDraft {
  id: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  fulfillment: 'dine-in' | 'takeaway' | 'delivery';
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableId?: string;
  lines: PosDraftLine[];
}

export interface PendingPosShiftOpen {
  sourceShiftId?: string | undefined;
  branchId: string;
  registerId: string;
  requestId: string;
  openingFloat: string;
}

export interface PendingPosShiftCashMovement {
  branchId: string;
  registerId: string;
  shiftId: string;
  request: Omit<RecordPosShiftCashMovementRequest, 'approval'>;
}

export interface PendingPosShiftClose {
  branchId: string;
  registerId: string;
  shiftId: string;
  request: Omit<ClosePosShiftRequest, 'approval'>;
}

export interface PendingPosSale {
  requestId: string;
  payload: CreatePosOrderRequest;
}

export interface PendingPosKitchenAmendment {
  requestId: string;
  draftId: string;
  payload: AddPosKitchenItemsRequest;
}

export interface PendingPosCancellation {
  requestId: string;
  branchId: string;
  reason: string;
}

export interface PendingPosPayment {
  branchId: string;
  checkId: string;
  request: RecordPosCheckPaymentRequest;
}

export interface PendingPosRefund {
  branchId: string;
  request: Omit<RecordPosCheckRefundRequest, 'approval'>;
}

export interface PendingPosItemReturn {
  branchId: string;
  request: Omit<RecordPosItemReturnRequest, 'approval'>;
}

export interface PosConfirmedOrderReference {
  orderId: string;
  branchId: string;
  createdAt: string;
  lastOpenedAt?: string;
}

export interface PosWorkspaceData {
  merchantId: string;
  employeeId: string;
  deviceId: string;
  selectedBranchId: string | null;
  drafts: Record<string, PosOrderDraft>;
  pendingActions: Record<string, PendingPosAction>;
  pendingShiftOpen: PendingPosShiftOpen | null;
  pendingShiftCashMovement: PendingPosShiftCashMovement | null;
  pendingShiftClose: PendingPosShiftClose | null;
  pendingSales: Record<string, PendingPosSale>;
  pendingPayments: Record<string, PendingPosPayment>;
  pendingRefunds: Record<string, PendingPosRefund>;
  pendingItemReturns: Record<string, PendingPosItemReturn>;
  pendingKitchenAmendments: Record<string, PendingPosKitchenAmendment>;
  pendingCancellations: Record<string, PendingPosCancellation>;
  confirmedOrders: Record<string, PosConfirmedOrderReference>;
  selectedConfirmedOrderId: string | null;
  selectedDraftId: string | null;
}

interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface WorkspaceState {
  activeScope: string | null;
  workspace: PosWorkspaceData | null;
  hydratedScope: string | null;
  persistenceError: string | null;
  hydrate: (merchantId: string, employeeId: string) => void;
  selectBranch: (merchantId: string, employeeId: string, branchId: string) => void;
  saveDraft: (merchantId: string, employeeId: string, draft: PosOrderDraft) => void;
  removeDraft: (merchantId: string, employeeId: string, draftId: string) => void;
  selectDraft: (merchantId: string, employeeId: string, draftId: string) => void;
  startDraft: (merchantId: string, employeeId: string) => string;
  discardEmptyDrafts: (merchantId: string, employeeId: string) => void;
  completeSale: (
    merchantId: string,
    employeeId: string,
    draftId: string,
    requestId: string,
    order: { id: string; createdAt: string },
  ) => void;
  completeKitchenAmendment: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    requestId: string,
    draftId: string,
  ) => void;
  selectConfirmedOrder: (merchantId: string, employeeId: string, orderId: string | null) => void;
  savePendingAction: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    action: PendingPosAction,
  ) => void;
  removePendingAction: (merchantId: string, employeeId: string, orderId: string) => void;
  savePendingShiftOpen: (
    merchantId: string,
    employeeId: string,
    action: PendingPosShiftOpen,
  ) => void;
  removePendingShiftOpen: (merchantId: string, employeeId: string, requestId: string) => void;
  savePendingShiftCashMovement: (
    merchantId: string,
    employeeId: string,
    command: PendingPosShiftCashMovement,
  ) => void;
  removePendingShiftCashMovement: (
    merchantId: string,
    employeeId: string,
    requestId: string,
  ) => void;
  savePendingShiftClose: (
    merchantId: string,
    employeeId: string,
    command: PendingPosShiftClose,
  ) => void;
  removePendingShiftClose: (merchantId: string, employeeId: string, requestId: string) => void;
  savePendingSale: (
    merchantId: string,
    employeeId: string,
    draftId: string,
    action: PendingPosSale,
  ) => void;
  removePendingSale: (
    merchantId: string,
    employeeId: string,
    draftId: string,
    requestId: string,
  ) => void;
  savePendingKitchenAmendment: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    amendment: PendingPosKitchenAmendment,
  ) => void;
  removePendingKitchenAmendment: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    requestId: string,
  ) => void;
  savePendingCancellation: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    cancellation: PendingPosCancellation,
  ) => void;
  removePendingCancellation: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    requestId: string,
  ) => void;
  savePendingPayment: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    payment: PendingPosPayment,
  ) => void;
  removePendingPayment: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    requestId: string,
  ) => boolean;
  savePendingRefund: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    checkId: string,
    refund: PendingPosRefund,
  ) => void;
  removePendingRefund: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    checkId: string,
    requestId: string,
  ) => boolean;
  savePendingItemReturn: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    itemReturn: PendingPosItemReturn,
  ) => void;
  removePendingItemReturn: (
    merchantId: string,
    employeeId: string,
    orderId: string,
    requestId: string,
  ) => boolean;
}

const STORAGE_VERSION = 10;
const STORAGE_PREFIX = 'waffarly:pos:workspace:v1:';
const DEVICE_ID_KEY = 'waffarly:pos:device:v1';

export function posWorkspaceScope(merchantId: string, employeeId: string): string {
  return JSON.stringify([merchantId, employeeId]);
}

export function posRefundRecoveryKey(orderId: string, checkId: string): string {
  return `${orderId}:${checkId}`;
}

export function posWorkspaceStorageKey(
  merchantId: string,
  employeeId: string,
  deviceId: string,
): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(merchantId)}:${encodeURIComponent(employeeId)}:${encodeURIComponent(deviceId)}`;
}

function emptyWorkspace(
  merchantId: string,
  employeeId: string,
  deviceId: string,
): PosWorkspaceData {
  return {
    merchantId,
    employeeId,
    deviceId,
    selectedBranchId: null,
    drafts: {},
    pendingActions: {},
    pendingShiftOpen: null,
    pendingShiftCashMovement: null,
    pendingShiftClose: null,
    pendingSales: {},
    pendingPayments: {},
    pendingRefunds: {},
    pendingItemReturns: {},
    pendingKitchenAmendments: {},
    pendingCancellations: {},
    confirmedOrders: {},
    selectedConfirmedOrderId: null,
    selectedDraftId: null,
  };
}

function getDeviceId(storage: StorageLike): string {
  const current = storage.getItem(DEVICE_ID_KEY);
  if (current) return current;
  const deviceId = crypto.randomUUID();
  storage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function getBrowserStorage(name: 'localStorage' | 'sessionStorage'): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window[name];
  } catch {
    return null;
  }
}

function isPendingAction(value: unknown): value is PendingPosAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Record<string, unknown>;
  if (typeof action.requestId !== 'string' || action.requestId.length === 0) return false;
  if (action.action === 'accept') {
    return typeof action.branchId === 'string' && action.branchId.length > 0;
  }
  if (action.action === 'item_ready')
    return typeof action.lineId === 'string' && action.lineId.length > 0;
  return (
    action.action === 'prepare' ||
    action.action === 'ready' ||
    action.action === 'handover' ||
    action.action === 'cancel_ack'
  );
}

function isPendingShiftOpen(value: unknown): value is PendingPosShiftOpen {
  if (!value || typeof value !== 'object') return false;
  const action = value as Record<string, unknown>;
  return (
    typeof action.branchId === 'string' &&
    action.branchId.length > 0 &&
    typeof action.registerId === 'string' &&
    action.registerId.length > 0 &&
    typeof action.requestId === 'string' &&
    action.requestId.length > 0 &&
    typeof action.openingFloat === 'string' &&
    (action.sourceShiftId === undefined || typeof action.sourceShiftId === 'string') &&
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(action.openingFloat)
  );
}

function isPendingShiftCashMovement(value: unknown): value is PendingPosShiftCashMovement {
  if (!value || typeof value !== 'object') return false;
  const command = value as Record<string, unknown>;
  if (
    typeof command.branchId !== 'string' ||
    !command.branchId ||
    typeof command.registerId !== 'string' ||
    !command.registerId ||
    typeof command.shiftId !== 'string' ||
    !command.shiftId ||
    !command.request ||
    typeof command.request !== 'object'
  )
    return false;
  const request = command.request as Record<string, unknown>;
  return (
    !Object.hasOwn(request, 'approval') &&
    (request.safeId === undefined || typeof request.safeId === 'string') &&
    typeof request.requestId === 'string' &&
    Boolean(request.requestId) &&
    (request.kind === 'cash_in' || request.kind === 'cash_out' || request.kind === 'cash_drop') &&
    isPersistedMoney(request.amount) &&
    persistedCents(request.amount) > 0n &&
    typeof request.reason === 'string' &&
    Boolean(request.reason.trim()) &&
    request.reason.length <= 500 &&
    (request.kind === 'cash_drop'
      ? typeof request.dropReference === 'string' &&
        Boolean(request.dropReference.trim()) &&
        request.dropReference.length <= 80
      : request.dropReference === undefined)
  );
}

function isPendingShiftClose(value: unknown): value is PendingPosShiftClose {
  if (!value || typeof value !== 'object') return false;
  const command = value as Record<string, unknown>;
  if (
    typeof command.branchId !== 'string' ||
    !command.branchId ||
    typeof command.registerId !== 'string' ||
    !command.registerId ||
    typeof command.shiftId !== 'string' ||
    !command.shiftId ||
    !command.request ||
    typeof command.request !== 'object'
  )
    return false;
  const request = command.request as Record<string, unknown>;
  return (
    !Object.hasOwn(request, 'approval') &&
    typeof request.requestId === 'string' &&
    Boolean(request.requestId) &&
    isPersistedMoney(request.countedCash) &&
    (request.deliveryHandover === undefined ||
      (request.deliveryHandover !== null &&
        typeof request.deliveryHandover === 'object' &&
        Object.keys(request.deliveryHandover).length === 1 &&
        typeof (request.deliveryHandover as Record<string, unknown>).recipientUsername ===
          'string' &&
        Boolean(
          (
            (request.deliveryHandover as Record<string, unknown>).recipientUsername as string
          ).trim(),
        ) &&
        ((request.deliveryHandover as Record<string, unknown>).recipientUsername as string)
          .length <= 80)) &&
    (request.reason === undefined ||
      (typeof request.reason === 'string' && request.reason.length <= 500))
  );
}

function isPendingPosSale(value: unknown): value is PendingPosSale {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.requestId !== 'string' || !candidate.payload) return false;
  const payload = candidate.payload as Record<string, unknown>;
  if (
    payload.requestId !== candidate.requestId ||
    typeof payload.registerId !== 'string' ||
    !['dine_in', 'takeaway', 'delivery'].includes(String(payload.fulfillmentType)) ||
    !Array.isArray(payload.items) ||
    payload.items.length === 0
  )
    return false;
  return payload.items.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const line = item as Record<string, unknown>;
    return (
      typeof line.lineId === 'string' &&
      typeof line.productId === 'string' &&
      Number.isSafeInteger(line.quantity) &&
      Number.isSafeInteger(line.expectedProductRevision) &&
      Array.isArray(line.selections)
    );
  });
}

function isPendingKitchenAmendment(value: unknown): value is PendingPosKitchenAmendment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.requestId !== 'string' ||
    !candidate.requestId ||
    typeof candidate.draftId !== 'string' ||
    !candidate.draftId ||
    !candidate.payload ||
    typeof candidate.payload !== 'object'
  )
    return false;
  const payload = candidate.payload as Record<string, unknown>;
  if (
    payload.requestId !== candidate.requestId ||
    !Number.isSafeInteger(payload.revision) ||
    Number(payload.revision) < 1 ||
    !Array.isArray(payload.items) ||
    payload.items.length === 0 ||
    payload.items.length > 30
  )
    return false;
  return payload.items.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const line = item as Record<string, unknown>;
    return (
      typeof line.lineId === 'string' &&
      typeof line.productId === 'string' &&
      Number.isSafeInteger(line.quantity) &&
      Number(line.quantity) >= 1 &&
      Number(line.quantity) <= 99 &&
      Number.isSafeInteger(line.expectedProductRevision) &&
      Number(line.expectedProductRevision) >= 1 &&
      Array.isArray(line.selections)
    );
  });
}

function isPendingPosCancellation(value: unknown): value is PendingPosCancellation {
  if (!value || typeof value !== 'object') return false;
  const cancellation = value as Record<string, unknown>;
  return (
    typeof cancellation.requestId === 'string' &&
    cancellation.requestId.length > 0 &&
    typeof cancellation.branchId === 'string' &&
    cancellation.branchId.length > 0 &&
    typeof cancellation.reason === 'string' &&
    cancellation.reason.trim().length > 0 &&
    cancellation.reason.length <= 500
  );
}

function isPersistedMoney(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value);
}

function persistedCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function isPendingPosPayment(value: unknown): value is PendingPosPayment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.branchId !== 'string' ||
    !candidate.branchId ||
    typeof candidate.checkId !== 'string' ||
    !candidate.checkId ||
    !candidate.request ||
    typeof candidate.request !== 'object'
  )
    return false;
  const request = candidate.request as Record<string, unknown>;
  if (
    typeof request.requestId !== 'string' ||
    !request.requestId ||
    !Number.isSafeInteger(request.revision) ||
    Number(request.revision) < 0 ||
    !Array.isArray(request.tenders) ||
    request.tenders.length === 0 ||
    request.tenders.length > 4
  )
    return false;
  return request.tenders.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const tender = value as Record<string, unknown>;
    if (!isPersistedMoney(tender.amount) || persistedCents(tender.amount) <= 0n) return false;
    if (tender.method === 'terminal') {
      return tender.terminalReference === undefined || typeof tender.terminalReference === 'string';
    }
    if (tender.method !== 'cash' || !isPersistedMoney(tender.receivedAmount)) return false;
    return persistedCents(tender.receivedAmount) >= persistedCents(tender.amount);
  });
}

function isPendingPosRefund(value: unknown): value is PendingPosRefund {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.branchId !== 'string' ||
    !candidate.branchId ||
    !candidate.request ||
    typeof candidate.request !== 'object'
  )
    return false;
  const request = candidate.request as Record<string, unknown>;
  if (
    Object.hasOwn(request, 'approval') ||
    typeof request.requestId !== 'string' ||
    !request.requestId ||
    !Number.isSafeInteger(request.revision) ||
    Number(request.revision) < 1 ||
    typeof request.branchId !== 'string' ||
    !request.branchId ||
    typeof request.refundShiftId !== 'string' ||
    !request.refundShiftId ||
    typeof request.reason !== 'string' ||
    !request.reason.trim() ||
    !Array.isArray(request.allocations) ||
    request.allocations.length === 0 ||
    request.allocations.length > 20
  )
    return false;
  return request.allocations.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const allocation = value as Record<string, unknown>;
    return (
      typeof allocation.paymentId === 'string' &&
      Boolean(allocation.paymentId) &&
      isPersistedMoney(allocation.amount) &&
      persistedCents(allocation.amount) > 0n &&
      (allocation.terminalReference === undefined ||
        typeof allocation.terminalReference === 'string')
    );
  });
}

function isPendingPosItemReturn(value: unknown): value is PendingPosItemReturn {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.branchId !== 'string' ||
    !candidate.branchId ||
    !candidate.request ||
    typeof candidate.request !== 'object'
  )
    return false;
  const request = candidate.request as Record<string, unknown>;
  if (
    Object.hasOwn(request, 'approval') ||
    typeof request.requestId !== 'string' ||
    !request.requestId ||
    typeof request.branchId !== 'string' ||
    request.branchId !== candidate.branchId ||
    typeof request.reason !== 'string' ||
    !request.reason.trim() ||
    request.reason.length > 500 ||
    !Array.isArray(request.lines) ||
    request.lines.length === 0 ||
    request.lines.length > 30
  )
    return false;
  return request.lines.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const line = value as Record<string, unknown>;
    return (
      typeof line.orderLineId === 'string' &&
      Boolean(line.orderLineId) &&
      Number.isSafeInteger(line.quantity) &&
      Number(line.quantity) > 0 &&
      Number(line.quantity) <= 99
    );
  });
}

function parseWorkspace(
  raw: string | null,
  merchantId: string,
  employeeId: string,
  deviceId: string,
): PosWorkspaceData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      workspace?: unknown;
    };
    if (
      ![1, 2, 3, 4, 5, 6, 7, 8, 9, STORAGE_VERSION].includes(parsed.version as number) ||
      !parsed.workspace ||
      typeof parsed.workspace !== 'object'
    )
      return null;
    const value = parsed.workspace as Record<string, unknown>;
    if (
      value.merchantId !== merchantId ||
      value.employeeId !== employeeId ||
      value.deviceId !== deviceId
    )
      return null;

    const pendingActions: Record<string, PendingPosAction> = {};
    if (value.pendingActions && typeof value.pendingActions === 'object') {
      for (const [orderId, action] of Object.entries(value.pendingActions)) {
        if (isPendingAction(action)) pendingActions[orderId] = action;
      }
    }

    const drafts = value.drafts && typeof value.drafts === 'object' ? value.drafts : {};
    const pendingSales: Record<string, PendingPosSale> = {};
    if (value.pendingSales && typeof value.pendingSales === 'object') {
      for (const [draftId, sale] of Object.entries(value.pendingSales)) {
        if (isPendingPosSale(sale)) pendingSales[draftId] = sale;
      }
    }
    const pendingPayments: Record<string, PendingPosPayment> = {};
    if (value.pendingPayments && typeof value.pendingPayments === 'object') {
      for (const [orderId, payment] of Object.entries(value.pendingPayments)) {
        if (isPendingPosPayment(payment)) pendingPayments[orderId] = payment;
      }
    }
    const pendingRefunds: Record<string, PendingPosRefund> = {};
    if (value.pendingRefunds && typeof value.pendingRefunds === 'object') {
      for (const [key, refund] of Object.entries(value.pendingRefunds)) {
        if (!isPendingPosRefund(refund)) continue;
        const command = refund.request;
        pendingRefunds[key] = {
          branchId: refund.branchId,
          request: {
            requestId: command.requestId,
            revision: command.revision,
            branchId: command.branchId,
            refundShiftId: command.refundShiftId,
            reason: command.reason,
            allocations: command.allocations.map((allocation) => ({
              paymentId: allocation.paymentId as string,
              amount: allocation.amount as string,
              ...(typeof allocation.terminalReference === 'string'
                ? { terminalReference: allocation.terminalReference }
                : {}),
            })),
          },
        };
      }
    }
    const pendingKitchenAmendments: Record<string, PendingPosKitchenAmendment> = {};
    if (value.pendingKitchenAmendments && typeof value.pendingKitchenAmendments === 'object') {
      for (const [orderId, amendment] of Object.entries(value.pendingKitchenAmendments)) {
        if (isPendingKitchenAmendment(amendment)) pendingKitchenAmendments[orderId] = amendment;
      }
    }
    const pendingItemReturns: Record<string, PendingPosItemReturn> = {};
    if (value.pendingItemReturns && typeof value.pendingItemReturns === 'object') {
      for (const [orderId, itemReturn] of Object.entries(value.pendingItemReturns)) {
        if (!isPendingPosItemReturn(itemReturn)) continue;
        pendingItemReturns[orderId] = {
          branchId: itemReturn.branchId,
          request: {
            requestId: itemReturn.request.requestId,
            branchId: itemReturn.request.branchId,
            reason: itemReturn.request.reason,
            lines: itemReturn.request.lines.map((line) => ({
              orderLineId: line.orderLineId,
              quantity: line.quantity,
            })),
          },
        };
      }
    }
    const pendingCancellations: Record<string, PendingPosCancellation> = {};
    if (value.pendingCancellations && typeof value.pendingCancellations === 'object') {
      for (const [orderId, cancellation] of Object.entries(value.pendingCancellations)) {
        if (isPendingPosCancellation(cancellation))
          pendingCancellations[orderId] = {
            requestId: cancellation.requestId,
            branchId: cancellation.branchId,
            reason: cancellation.reason,
          };
      }
    }
    const confirmedOrders: Record<string, PosConfirmedOrderReference> = {};
    if (value.confirmedOrders && typeof value.confirmedOrders === 'object') {
      for (const [id, reference] of Object.entries(value.confirmedOrders)) {
        if (!reference || typeof reference !== 'object') continue;
        const ref = reference as Record<string, unknown>;
        if (
          ref.orderId === id &&
          typeof ref.branchId === 'string' &&
          ref.branchId.length > 0 &&
          typeof ref.createdAt === 'string' &&
          Number.isFinite(Date.parse(ref.createdAt))
        )
          confirmedOrders[id] = ref as unknown as PosConfirmedOrderReference;
      }
    }
    return {
      ...emptyWorkspace(merchantId, employeeId, deviceId),
      selectedBranchId: typeof value.selectedBranchId === 'string' ? value.selectedBranchId : null,
      drafts: drafts as Record<string, PosOrderDraft>,
      pendingActions,
      pendingShiftOpen: isPendingShiftOpen(value.pendingShiftOpen) ? value.pendingShiftOpen : null,
      pendingShiftCashMovement: isPendingShiftCashMovement(value.pendingShiftCashMovement)
        ? {
            branchId: value.pendingShiftCashMovement.branchId,
            registerId: value.pendingShiftCashMovement.registerId,
            shiftId: value.pendingShiftCashMovement.shiftId,
            request: {
              requestId: value.pendingShiftCashMovement.request.requestId,
              kind: value.pendingShiftCashMovement.request.kind,
              amount: value.pendingShiftCashMovement.request.amount,
              reason: value.pendingShiftCashMovement.request.reason,
              ...(value.pendingShiftCashMovement.request.dropReference
                ? { dropReference: value.pendingShiftCashMovement.request.dropReference }
                : {}),
              ...(value.pendingShiftCashMovement.request.safeId
                ? { safeId: value.pendingShiftCashMovement.request.safeId }
                : {}),
            },
          }
        : null,
      pendingShiftClose: isPendingShiftClose(value.pendingShiftClose)
        ? {
            branchId: value.pendingShiftClose.branchId,
            registerId: value.pendingShiftClose.registerId,
            shiftId: value.pendingShiftClose.shiftId,
            request: {
              requestId: value.pendingShiftClose.request.requestId,
              countedCash: value.pendingShiftClose.request.countedCash,
              ...(typeof value.pendingShiftClose.request.reason === 'string'
                ? { reason: value.pendingShiftClose.request.reason }
                : {}),
              ...(value.pendingShiftClose.request.deliveryHandover
                ? {
                    deliveryHandover: {
                      recipientUsername:
                        value.pendingShiftClose.request.deliveryHandover.recipientUsername,
                    },
                  }
                : {}),
            },
          }
        : null,
      pendingSales,
      pendingPayments,
      pendingRefunds,
      pendingItemReturns,
      pendingKitchenAmendments,
      pendingCancellations,
      confirmedOrders,
      selectedDraftId:
        typeof value.selectedDraftId === 'string' && Object.hasOwn(drafts, value.selectedDraftId)
          ? value.selectedDraftId
          : null,
      selectedConfirmedOrderId:
        typeof value.selectedConfirmedOrderId === 'string' &&
        confirmedOrders[value.selectedConfirmedOrderId]
          ? value.selectedConfirmedOrderId
          : null,
    };
  } catch {
    return null;
  }
}

function readLegacyActions(
  merchantId: string,
  employeeId: string,
  storage: StorageLike | null,
): { actions: Record<string, PendingPosAction>; keys: string[] } {
  const actions: Record<string, PendingPosAction> = {};
  const keys: string[] = [];
  if (!storage) return { actions, keys };
  const prefix = `waffarly:pos:${merchantId}:${employeeId}:`;
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const orderId = key.slice(prefix.length);
      const raw = storage.getItem(key);
      if (!raw) continue;
      const value: unknown = JSON.parse(raw);
      if (!isPendingAction(value)) continue;
      actions[orderId] = value;
      keys.push(key);
    }
  } catch {
    return { actions: {}, keys: [] };
  }
  return { actions, keys };
}

export function readPosWorkspace(
  merchantId: string,
  employeeId: string,
  deviceId: string,
  storage: StorageLike | null,
  legacyStorage: StorageLike | null,
): PosWorkspaceData {
  const workspace = parseWorkspace(
    storage?.getItem(posWorkspaceStorageKey(merchantId, employeeId, deviceId)) ?? null,
    merchantId,
    employeeId,
    deviceId,
  );
  if (workspace) return workspace;

  const legacy = readLegacyActions(merchantId, employeeId, legacyStorage);
  return {
    ...emptyWorkspace(merchantId, employeeId, deviceId),
    pendingActions: legacy.actions,
  };
}

function persistWorkspace(workspace: PosWorkspaceData): void {
  const storage = getBrowserStorage('localStorage');
  if (!storage) throw new Error('Durable POS storage is unavailable.');
  storage.setItem(
    posWorkspaceStorageKey(workspace.merchantId, workspace.employeeId, workspace.deviceId),
    JSON.stringify({ version: STORAGE_VERSION, workspace }),
  );
}

function commitWorkspace(
  workspace: PosWorkspaceData,
  set: (partial: Partial<WorkspaceState>) => void,
): void {
  persistWorkspace(workspace);
  set({ workspace, persistenceError: null });
}

export function isBlankPosDraft(draft: PosOrderDraft): boolean {
  return (
    draft.fulfillment === 'takeaway' &&
    draft.lines.length === 0 &&
    !draft.customerName?.trim() &&
    !draft.customerPhone?.trim() &&
    !draft.deliveryAddress?.trim() &&
    !draft.tableId
  );
}

export const usePosWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeScope: null,
  workspace: null,
  hydratedScope: null,
  persistenceError: null,
  hydrate: (merchantId, employeeId) => {
    const scope = posWorkspaceScope(merchantId, employeeId);
    if (get().hydratedScope === scope) return;
    const storage = getBrowserStorage('localStorage');
    const legacyStorage = getBrowserStorage('sessionStorage');
    try {
      if (!storage) throw new Error('Durable POS storage is unavailable.');
      const deviceId = getDeviceId(storage);
      const workspace = readPosWorkspace(merchantId, employeeId, deviceId, storage, legacyStorage);
      const legacy = readLegacyActions(merchantId, employeeId, legacyStorage);
      if (legacy.keys.length > 0 && Object.keys(legacy.actions).length > 0) {
        const merged = {
          ...workspace,
          pendingActions: { ...workspace.pendingActions, ...legacy.actions },
        };
        persistWorkspace(merged);
        for (const key of legacy.keys) legacyStorage?.removeItem(key);
        set({
          activeScope: scope,
          workspace: merged,
          hydratedScope: scope,
          persistenceError: null,
        });
        return;
      }
      set({ activeScope: scope, workspace, hydratedScope: scope, persistenceError: null });
    } catch {
      const legacy = readLegacyActions(merchantId, employeeId, legacyStorage);
      const deviceId = 'unavailable';
      set({
        activeScope: scope,
        workspace: {
          ...emptyWorkspace(merchantId, employeeId, deviceId),
          pendingActions: legacy.actions,
        },
        hydratedScope: scope,
        persistenceError: 'Durable POS storage is unavailable.',
      });
    }
  },
  selectBranch: (merchantId, employeeId, branchId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    if (current.selectedBranchId === branchId) return;
    try {
      commitWorkspace(
        {
          ...current,
          selectedBranchId: branchId,
          selectedConfirmedOrderId: null,
          selectedDraftId: null,
        },
        set,
      );
    } catch {
      set({
        persistenceError: 'Could not save this POS workspace. Check browser storage settings.',
      });
      throw new Error('Could not save the selected POS branch.');
    }
  },
  saveDraft: (merchantId, employeeId, draft) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    if (!current.selectedBranchId || draft.branchId !== current.selectedBranchId) {
      throw new Error('A POS draft must remain with its selected branch.');
    }
    commitWorkspace({ ...current, drafts: { ...current.drafts, [draft.id]: draft } }, set);
  },
  selectDraft: (merchantId, employeeId, draftId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      throw new Error('The POS workspace changed.');
    const draft = current.drafts[draftId];
    if (!draft || draft.branchId !== current.selectedBranchId)
      throw new Error('A POS draft must remain with its selected branch.');
    if (current.selectedDraftId === draftId && !current.selectedConfirmedOrderId) return;
    commitWorkspace(
      {
        ...current,
        selectedDraftId: draftId,
        selectedConfirmedOrderId: null,
        drafts: {
          ...current.drafts,
          [draftId]: { ...draft, lastOpenedAt: new Date().toISOString() },
        },
      },
      set,
    );
  },
  startDraft: (merchantId, employeeId) => {
    const current = get().workspace;
    if (
      !current ||
      current.merchantId !== merchantId ||
      current.employeeId !== employeeId ||
      !current.selectedBranchId
    )
      throw new Error('The POS workspace changed.');
    const reusable = Object.values(current.drafts)
      .filter(
        (draft) =>
          draft.branchId === current.selectedBranchId &&
          isBlankPosDraft(draft) &&
          !current.pendingSales[draft.id] &&
          !Object.values(current.pendingKitchenAmendments).some(
            (amendment) => amendment.draftId === draft.id,
          ),
      )
      .sort(
        (a, b) =>
          Number(b.id === current.selectedDraftId) - Number(a.id === current.selectedDraftId) ||
          b.updatedAt.localeCompare(a.updatedAt),
      )[0];
    if (reusable) {
      get().selectDraft(merchantId, employeeId, reusable.id);
      return reusable.id;
    }
    const now = new Date().toISOString();
    const draft: PosOrderDraft = {
      id: crypto.randomUUID(),
      branchId: current.selectedBranchId,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      fulfillment: 'takeaway',
      lines: [],
    };
    commitWorkspace(
      {
        ...current,
        selectedDraftId: draft.id,
        selectedConfirmedOrderId: null,
        drafts: { ...current.drafts, [draft.id]: draft },
      },
      set,
    );
    return draft.id;
  },
  discardEmptyDrafts: (merchantId, employeeId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      throw new Error('The POS workspace changed.');
    const amendmentDraftIds = new Set(
      Object.values(current.pendingKitchenAmendments).map((amendment) => amendment.draftId),
    );
    const drafts = Object.fromEntries(
      Object.entries(current.drafts).filter(
        ([id, draft]) =>
          draft.branchId !== current.selectedBranchId ||
          id === current.selectedDraftId ||
          !isBlankPosDraft(draft) ||
          Boolean(current.pendingSales[id]) ||
          amendmentDraftIds.has(id),
      ),
    );
    commitWorkspace({ ...current, drafts }, set);
  },
  completeSale: (merchantId, employeeId, draftId, requestId, order) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      throw new Error(
        'The POS workspace changed. Reopen the saved sale with its original cashier.',
      );
    const draft = current.drafts[draftId];
    if (!draft || current.pendingSales[draftId]?.requestId !== requestId)
      throw new Error('The saved sale request does not match this order.');
    const drafts = { ...current.drafts };
    const pendingSales = { ...current.pendingSales };
    delete drafts[draftId];
    delete pendingSales[draftId];
    // One durable write: the original retry is retained if saving the server reference fails.
    commitWorkspace(
      {
        ...current,
        drafts,
        pendingSales,
        confirmedOrders: {
          ...current.confirmedOrders,
          [order.id]: { orderId: order.id, branchId: draft.branchId, createdAt: order.createdAt },
        },
        selectedConfirmedOrderId: draft.branchId === current.selectedBranchId ? order.id : null,
        selectedDraftId: current.selectedDraftId === draftId ? null : current.selectedDraftId,
      },
      set,
    );
  },
  completeKitchenAmendment: (merchantId, employeeId, orderId, requestId, draftId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      throw new Error('The POS workspace changed. Reopen the order with its original cashier.');
    const pending = current.pendingKitchenAmendments[orderId];
    if (!pending || pending.requestId !== requestId || pending.draftId !== draftId)
      throw new Error('The saved kitchen addition does not match this order.');
    const drafts = { ...current.drafts };
    const pendingKitchenAmendments = { ...current.pendingKitchenAmendments };
    delete drafts[draftId];
    delete pendingKitchenAmendments[orderId];
    commitWorkspace(
      {
        ...current,
        drafts,
        pendingKitchenAmendments,
        selectedDraftId: current.selectedDraftId === draftId ? null : current.selectedDraftId,
        selectedConfirmedOrderId: orderId,
      },
      set,
    );
  },
  selectConfirmedOrder: (merchantId, employeeId, orderId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    if (orderId && current.confirmedOrders[orderId]?.branchId !== current.selectedBranchId)
      throw new Error('The confirmed order belongs to another branch.');
    commitWorkspace(
      {
        ...current,
        selectedConfirmedOrderId: orderId,
        confirmedOrders: orderId
          ? {
              ...current.confirmedOrders,
              [orderId]: {
                ...current.confirmedOrders[orderId]!,
                lastOpenedAt: new Date().toISOString(),
              },
            }
          : current.confirmedOrders,
      },
      set,
    );
  },
  removeDraft: (merchantId, employeeId, draftId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    const draft = current.drafts[draftId];
    if (!draft || draft.branchId !== current.selectedBranchId)
      throw new Error('A POS draft must remain with its selected branch.');
    if (current.pendingSales[draftId])
      throw new Error('Resolve the saved sale request before deleting this draft.');
    if (
      Object.values(current.pendingKitchenAmendments).some(
        (amendment) => amendment.draftId === draftId,
      )
    )
      throw new Error('Resolve the saved kitchen addition before deleting this draft.');
    const drafts = { ...current.drafts };
    delete drafts[draftId];
    commitWorkspace(
      {
        ...current,
        drafts,
        selectedDraftId: current.selectedDraftId === draftId ? null : current.selectedDraftId,
      },
      set,
    );
  },
  savePendingAction: (merchantId, employeeId, orderId, action) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    const existing = current.pendingActions[orderId];
    try {
      commitWorkspace(
        { ...current, pendingActions: { ...current.pendingActions, [orderId]: action } },
        set,
      );
    } catch {
      // An already-persisted request can still be replayed with its exact identity.
      if (existing && JSON.stringify(existing) === JSON.stringify(action)) {
        set({
          persistenceError: 'Could not refresh POS storage; saved requests can still be retried.',
        });
        return;
      }
      set({
        persistenceError: 'Could not save this action safely. Check browser storage settings.',
      });
      throw new Error('Could not save this action safely.');
    }
  },
  removePendingAction: (merchantId, employeeId, orderId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    const pendingActions = { ...current.pendingActions };
    delete pendingActions[orderId];
    const next = { ...current, pendingActions };
    try {
      commitWorkspace(next, set);
    } catch {
      // A definitive API result resolves the command; clear its legacy session record too.
      try {
        getBrowserStorage('sessionStorage')?.removeItem(
          `waffarly:pos:${merchantId}:${employeeId}:${orderId}`,
        );
      } catch {
        // Keep the resolved command out of the active view even if browser storage is locked.
      }
      set({
        workspace: next,
        persistenceError: 'Could not clear the resolved POS recovery record.',
      });
    }
  },
  savePendingShiftOpen: (merchantId, employeeId, action) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    if (current.selectedBranchId !== action.branchId) {
      throw new Error('A shift opening must stay with its selected branch.');
    }
    const existing = current.pendingShiftOpen;
    if (existing && JSON.stringify(existing) !== JSON.stringify(action)) {
      throw new Error('Resolve the pending shift opening before starting another.');
    }
    try {
      commitWorkspace({ ...current, pendingShiftOpen: action }, set);
    } catch {
      if (existing && JSON.stringify(existing) === JSON.stringify(action)) {
        set({
          persistenceError:
            'Could not refresh POS storage; the saved shift opening can still be retried.',
        });
        return;
      }
      set({
        persistenceError:
          'Could not save this shift opening safely. Check browser storage settings.',
      });
      throw new Error('Could not save this shift opening safely.');
    }
  },
  removePendingShiftOpen: (merchantId, employeeId, requestId) => {
    const current = get().workspace;
    if (
      !current ||
      current.merchantId !== merchantId ||
      current.employeeId !== employeeId ||
      current.pendingShiftOpen?.requestId !== requestId
    ) {
      return;
    }
    const next = { ...current, pendingShiftOpen: null };
    try {
      commitWorkspace(next, set);
    } catch {
      set({
        workspace: next,
        persistenceError: 'Could not clear the resolved shift opening recovery record.',
      });
    }
  },
  savePendingShiftCashMovement: (merchantId, employeeId, command) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    if (current.selectedBranchId !== command.branchId)
      throw new Error('A cash movement must stay with its selected branch.');
    if (current.pendingShiftClose)
      throw new Error('Resolve the pending shift close before recording another cash movement.');
    const existing = current.pendingShiftCashMovement;
    if (existing && JSON.stringify(existing) !== JSON.stringify(command))
      throw new Error('Resolve the pending cash movement before starting another.');
    try {
      commitWorkspace({ ...current, pendingShiftCashMovement: command }, set);
    } catch {
      if (existing && JSON.stringify(existing) === JSON.stringify(command)) {
        set({ persistenceError: 'Could not refresh POS storage; retry the saved cash movement.' });
        return;
      }
      set({ persistenceError: 'Could not save this cash movement safely.' });
      throw new Error('Could not save this cash movement safely.');
    }
  },
  removePendingShiftCashMovement: (merchantId, employeeId, requestId) => {
    const current = get().workspace;
    if (
      !current ||
      current.merchantId !== merchantId ||
      current.employeeId !== employeeId ||
      current.pendingShiftCashMovement?.request.requestId !== requestId
    )
      return;
    const next = { ...current, pendingShiftCashMovement: null };
    try {
      commitWorkspace(next, set);
    } catch {
      set({
        workspace: next,
        persistenceError: 'Could not clear the resolved cash movement request.',
      });
    }
  },
  savePendingShiftClose: (merchantId, employeeId, command) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    if (current.selectedBranchId !== command.branchId)
      throw new Error('A shift close must stay with its selected branch.');
    if (current.pendingShiftCashMovement)
      throw new Error('Resolve the pending cash movement before closing this shift.');
    const existing = current.pendingShiftClose;
    if (existing && JSON.stringify(existing) !== JSON.stringify(command))
      throw new Error('Resolve the pending shift close before starting another.');
    try {
      commitWorkspace({ ...current, pendingShiftClose: command }, set);
    } catch {
      if (existing && JSON.stringify(existing) === JSON.stringify(command)) {
        set({ persistenceError: 'Could not refresh POS storage; retry the saved shift close.' });
        return;
      }
      set({ persistenceError: 'Could not save this shift close safely.' });
      throw new Error('Could not save this shift close safely.');
    }
  },
  removePendingShiftClose: (merchantId, employeeId, requestId) => {
    const current = get().workspace;
    if (
      !current ||
      current.merchantId !== merchantId ||
      current.employeeId !== employeeId ||
      current.pendingShiftClose?.request.requestId !== requestId
    )
      return;
    const next = { ...current, pendingShiftClose: null };
    try {
      commitWorkspace(next, set);
    } catch {
      set({
        workspace: next,
        persistenceError: 'Could not clear the resolved shift close request.',
      });
    }
  },
  savePendingSale: (merchantId, employeeId, draftId, action) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    const existing = current.pendingSales[draftId];
    if (existing && JSON.stringify(existing) !== JSON.stringify(action)) {
      throw new Error('Resolve the pending sale request before editing this order.');
    }
    try {
      commitWorkspace(
        { ...current, pendingSales: { ...current.pendingSales, [draftId]: action } },
        set,
      );
    } catch {
      if (existing && JSON.stringify(existing) === JSON.stringify(action)) {
        set({
          persistenceError: 'Could not refresh POS storage; the saved sale can still be retried.',
        });
        return;
      }
      set({ persistenceError: 'Could not save this sale safely. Check browser storage settings.' });
      throw new Error('Could not save this sale safely.');
    }
  },
  removePendingSale: (merchantId, employeeId, draftId, requestId) => {
    const current = get().workspace;
    if (
      !current ||
      current.merchantId !== merchantId ||
      current.employeeId !== employeeId ||
      current.pendingSales[draftId]?.requestId !== requestId
    )
      return;
    const pendingSales = { ...current.pendingSales };
    delete pendingSales[draftId];
    try {
      commitWorkspace({ ...current, pendingSales }, set);
    } catch {
      set({
        workspace: { ...current, pendingSales },
        persistenceError: 'Could not clear the resolved sale recovery record.',
      });
    }
  },
  savePendingKitchenAmendment: (merchantId, employeeId, orderId, amendment) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      throw new Error(
        'Could not save this kitchen addition safely. Check browser storage settings.',
      );
    if (
      !current.confirmedOrders[orderId] ||
      current.confirmedOrders[orderId].branchId !== current.selectedBranchId
    )
      throw new Error('A kitchen addition must stay with its selected branch.');
    const existing = current.pendingKitchenAmendments[orderId];
    const isExactRetry = Boolean(
      existing && JSON.stringify(existing) === JSON.stringify(amendment),
    );
    if (existing && !isExactRetry)
      throw new Error('Resolve the saved kitchen addition before changing this order.');
    try {
      commitWorkspace(
        {
          ...current,
          pendingKitchenAmendments: {
            ...current.pendingKitchenAmendments,
            [orderId]: amendment,
          },
        },
        set,
      );
    } catch {
      if (isExactRetry) {
        set({
          persistenceError:
            'Could not refresh POS storage; the saved kitchen addition can still be retried.',
        });
        return;
      }
      set({
        persistenceError:
          'Could not save this kitchen addition safely. Check browser storage settings.',
      });
      throw new Error('Could not save this kitchen addition safely.');
    }
  },
  removePendingKitchenAmendment: (merchantId, employeeId, orderId, requestId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    const existing = current.pendingKitchenAmendments[orderId];
    if (!existing || existing.requestId !== requestId) return;
    const pendingKitchenAmendments = { ...current.pendingKitchenAmendments };
    delete pendingKitchenAmendments[orderId];
    try {
      commitWorkspace({ ...current, pendingKitchenAmendments }, set);
    } catch {
      set({
        workspace: { ...current, pendingKitchenAmendments },
        persistenceError:
          'Could not clear the resolved kitchen addition. Retry its saved result before starting another.',
      });
    }
  },
  savePendingCancellation: (merchantId, employeeId, orderId, cancellation) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      throw new Error('Could not save this cancellation safely. Check browser storage settings.');
    if (current.confirmedOrders[orderId]?.branchId !== cancellation.branchId)
      throw new Error('A cancellation recovery record must stay with its original branch.');
    const safeCancellation = {
      requestId: cancellation.requestId,
      branchId: cancellation.branchId,
      reason: cancellation.reason,
    };
    const existing = current.pendingCancellations[orderId];
    const isExactRetry = Boolean(
      existing && JSON.stringify(existing) === JSON.stringify(safeCancellation),
    );
    if (existing && !isExactRetry)
      throw new Error('Resolve the saved cancellation before changing its reason or request.');
    try {
      commitWorkspace(
        {
          ...current,
          pendingCancellations: {
            ...current.pendingCancellations,
            [orderId]: safeCancellation,
          },
        },
        set,
      );
    } catch {
      if (isExactRetry) {
        set({
          persistenceError:
            'Could not refresh POS storage; the saved cancellation can still be retried.',
        });
        return;
      }
      set({
        persistenceError:
          'Could not save this cancellation safely. Check browser storage settings.',
      });
      throw new Error('Could not save this cancellation safely.');
    }
  },
  removePendingCancellation: (merchantId, employeeId, orderId, requestId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    if (current.pendingCancellations[orderId]?.requestId !== requestId) return;
    const pendingCancellations = { ...current.pendingCancellations };
    delete pendingCancellations[orderId];
    try {
      commitWorkspace({ ...current, pendingCancellations }, set);
    } catch {
      set({
        workspace: { ...current, pendingCancellations },
        persistenceError: 'Could not clear the completed cancellation recovery record.',
      });
    }
  },
  savePendingPayment: (merchantId, employeeId, orderId, payment) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) {
      throw new Error('Could not save this payment safely. Check browser storage settings.');
    }
    const existing = current.pendingPayments[orderId];
    const isExactRetry = Boolean(existing && JSON.stringify(existing) === JSON.stringify(payment));
    if (existing && !isExactRetry) {
      throw new Error(
        'Resolve the pending payment before starting another payment for this order.',
      );
    }
    if (!existing && current.selectedBranchId !== payment.branchId) {
      throw new Error('A payment recovery record must stay with its selected branch.');
    }
    try {
      commitWorkspace(
        { ...current, pendingPayments: { ...current.pendingPayments, [orderId]: payment } },
        set,
      );
    } catch {
      if (isExactRetry) {
        set({
          persistenceError:
            'Could not refresh POS storage; the saved payment can still be retried.',
        });
        return;
      }
      set({
        persistenceError: 'Could not save this payment safely. Check browser storage settings.',
      });
      throw new Error('Could not save this payment safely.');
    }
  },
  removePendingPayment: (merchantId, employeeId, orderId, requestId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      return false;
    const existing = current.pendingPayments[orderId];
    if (!existing) return true;
    if (existing.request.requestId !== requestId) return false;
    const pendingPayments = { ...current.pendingPayments };
    delete pendingPayments[orderId];
    try {
      commitWorkspace({ ...current, pendingPayments }, set);
      return true;
    } catch {
      set({
        persistenceError:
          'Could not clear the resolved payment recovery record. Retry its saved result.',
      });
      return false;
    }
  },
  savePendingRefund: (merchantId, employeeId, orderId, checkId, refund) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      throw new Error('Could not save this refund safely. Check browser storage settings.');
    const key = posRefundRecoveryKey(orderId, checkId);
    if (
      current.confirmedOrders[orderId]?.branchId !== refund.branchId ||
      refund.request.branchId !== refund.branchId ||
      current.selectedBranchId !== refund.branchId
    )
      throw new Error('A refund recovery record must stay with its original branch.');
    const safeRefund: PendingPosRefund = {
      branchId: refund.branchId,
      request: {
        requestId: refund.request.requestId,
        revision: refund.request.revision,
        branchId: refund.request.branchId,
        refundShiftId: refund.request.refundShiftId,
        reason: refund.request.reason,
        allocations: refund.request.allocations.map((allocation) => ({
          paymentId: allocation.paymentId,
          amount: allocation.amount,
          ...(allocation.terminalReference
            ? { terminalReference: allocation.terminalReference }
            : {}),
        })),
      },
    };
    const existing = current.pendingRefunds[key];
    const isExactRetry = Boolean(
      existing && JSON.stringify(existing) === JSON.stringify(safeRefund),
    );
    if (existing && !isExactRetry)
      throw new Error('Resolve the saved refund before changing its amount, reason, or request.');
    try {
      commitWorkspace(
        { ...current, pendingRefunds: { ...current.pendingRefunds, [key]: safeRefund } },
        set,
      );
    } catch {
      if (isExactRetry) {
        set({
          persistenceError: 'Could not refresh POS storage; the saved refund can still be retried.',
        });
        return;
      }
      set({
        persistenceError: 'Could not save this refund safely. Check browser storage settings.',
      });
      throw new Error('Could not save this refund safely.');
    }
  },
  removePendingRefund: (merchantId, employeeId, orderId, checkId, requestId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      return false;
    const key = posRefundRecoveryKey(orderId, checkId);
    const existing = current.pendingRefunds[key];
    if (!existing) return true;
    if (existing.request.requestId !== requestId) return false;
    const pendingRefunds = { ...current.pendingRefunds };
    delete pendingRefunds[key];
    try {
      commitWorkspace({ ...current, pendingRefunds }, set);
      return true;
    } catch {
      set({
        persistenceError:
          'Could not clear the resolved refund recovery record. Retry its saved result.',
      });
      return false;
    }
  },
  savePendingItemReturn: (merchantId, employeeId, orderId, itemReturn) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      throw new Error('Could not save this item return safely. Check browser storage settings.');
    if (
      current.selectedBranchId !== itemReturn.branchId ||
      itemReturn.request.branchId !== itemReturn.branchId
    )
      throw new Error('An item return recovery record must stay with its original branch.');
    const safeItemReturn: PendingPosItemReturn = {
      branchId: itemReturn.branchId,
      request: {
        requestId: itemReturn.request.requestId,
        branchId: itemReturn.request.branchId,
        reason: itemReturn.request.reason,
        lines: itemReturn.request.lines.map((line) => ({
          orderLineId: line.orderLineId,
          quantity: line.quantity,
        })),
      },
    };
    const existing = current.pendingItemReturns[orderId];
    const isExactRetry = Boolean(
      existing && JSON.stringify(existing) === JSON.stringify(safeItemReturn),
    );
    if (existing && !isExactRetry)
      throw new Error(
        'Resolve the saved item return before changing its quantity, reason, or request.',
      );
    try {
      commitWorkspace(
        {
          ...current,
          pendingItemReturns: { ...current.pendingItemReturns, [orderId]: safeItemReturn },
        },
        set,
      );
    } catch {
      if (isExactRetry) {
        set({ persistenceError: 'Could not refresh POS storage; retry the saved item return.' });
        return;
      }
      set({
        persistenceError: 'Could not save this item return safely. Check browser storage settings.',
      });
      throw new Error('Could not save this item return safely.');
    }
  },
  removePendingItemReturn: (merchantId, employeeId, orderId, requestId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId)
      return false;
    const existing = current.pendingItemReturns[orderId];
    if (!existing) return true;
    if (existing.request.requestId !== requestId) return false;
    const pendingItemReturns = { ...current.pendingItemReturns };
    delete pendingItemReturns[orderId];
    try {
      commitWorkspace({ ...current, pendingItemReturns }, set);
      return true;
    } catch {
      set({
        persistenceError:
          'Could not clear the resolved item return request. Retry its saved result.',
      });
      return false;
    }
  },
}));
