import { create } from 'zustand';
import type { CreatePosOrderRequest, RecordPosCheckPaymentRequest } from '@waffarly/contracts';

export type PendingPosAction =
  | { action: 'accept'; requestId: string; branchId: string }
  | { action: 'prepare'; requestId: string; branchId?: string };

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
  fulfillment: 'dine-in' | 'takeaway' | 'delivery';
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableId?: string;
  lines: PosDraftLine[];
}

export interface PendingPosShiftOpen {
  branchId: string;
  registerId: string;
  requestId: string;
  openingFloat: string;
}

export interface PendingPosSale {
  requestId: string;
  payload: CreatePosOrderRequest;
}

export interface PendingPosPayment {
  branchId: string;
  checkId: string;
  request: RecordPosCheckPaymentRequest;
}

export interface PosWorkspaceData {
  merchantId: string;
  employeeId: string;
  deviceId: string;
  selectedBranchId: string | null;
  drafts: Record<string, PosOrderDraft>;
  pendingActions: Record<string, PendingPosAction>;
  pendingShiftOpen: PendingPosShiftOpen | null;
  pendingSales: Record<string, PendingPosSale>;
  pendingPayments: Record<string, PendingPosPayment>;
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
}

const STORAGE_VERSION = 3;
const STORAGE_PREFIX = 'waffarly:pos:workspace:v1:';
const DEVICE_ID_KEY = 'waffarly:pos:device:v1';

export function posWorkspaceScope(merchantId: string, employeeId: string): string {
  return JSON.stringify([merchantId, employeeId]);
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
    pendingSales: {},
    pendingPayments: {},
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
  return action.action === 'prepare';
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
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(action.openingFloat)
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
      (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== STORAGE_VERSION) ||
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
    return {
      ...emptyWorkspace(merchantId, employeeId, deviceId),
      selectedBranchId: typeof value.selectedBranchId === 'string' ? value.selectedBranchId : null,
      drafts: drafts as Record<string, PosOrderDraft>,
      pendingActions,
      pendingShiftOpen: isPendingShiftOpen(value.pendingShiftOpen) ? value.pendingShiftOpen : null,
      pendingSales,
      pendingPayments,
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
    try {
      commitWorkspace({ ...current, selectedBranchId: branchId }, set);
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
  removeDraft: (merchantId, employeeId, draftId) => {
    const current = get().workspace;
    if (!current || current.merchantId !== merchantId || current.employeeId !== employeeId) return;
    const drafts = { ...current.drafts };
    delete drafts[draftId];
    commitWorkspace({ ...current, drafts }, set);
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
}));
