import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../lib/api-client.js';
import { isCorrectableShiftCloseRejection } from '../features/shifts/shift-close-recovery.js';
import {
  readPosWorkspace,
  posWorkspaceStorageKey,
  usePosWorkspaceStore,
  type PendingPosItemReturn,
  type PendingPosPayment,
  type PendingPosRefund,
  type PosOrderDraft,
} from './pos-workspace-store.js';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test('shift close unlocks only an explicit business rejection and preserves uncertain outcomes', () => {
  assert.equal(
    isCorrectableShiftCloseRejection(
      new ApiError('Choose a different active cashier or supervisor assigned to this branch.', 403),
    ),
    true,
  );
  assert.equal(
    isCorrectableShiftCloseRejection(new ApiError('Enter a reason for the cash variance.', 409)),
    true,
  );
  for (const error of [
    new TypeError('Failed to fetch'),
    new ApiError('Internal server error', 500),
    new ApiError('Supervisor approval credentials are invalid.', 401),
    new ApiError('The register shift is already closed.', 409),
  ])
    assert.equal(isCorrectableShiftCloseRejection(error), false);
});

test('cash-drop destination and carryover source survive persisted command recovery', () => {
  const storage = new MemoryStorage();
  const merchantId = 'treasury-merchant';
  const employeeId = 'treasury-employee';
  const deviceId = 'treasury-device';
  const workspace = readPosWorkspace(merchantId, employeeId, deviceId, null, null);
  const pendingShiftOpen = {
    branchId: 'branch',
    registerId: 'register',
    requestId: 'open-request',
    openingFloat: '500.00',
    sourceShiftId: 'previous-closed-shift',
  };
  const pendingShiftCashMovement = {
    branchId: 'branch',
    registerId: 'register',
    shiftId: 'current-shift',
    request: {
      requestId: 'drop-request',
      kind: 'cash_drop',
      amount: '100.00',
      reason: 'Safe handoff',
      dropReference: 'BAG-100',
      safeId: 'named-safe',
    },
  };
  storage.setItem(
    posWorkspaceStorageKey(merchantId, employeeId, deviceId),
    JSON.stringify({
      version: 5,
      workspace: {
        ...workspace,
        selectedBranchId: 'branch',
        pendingShiftOpen,
        pendingShiftCashMovement,
      },
    }),
  );
  const restored = readPosWorkspace(merchantId, employeeId, deviceId, storage, null);
  assert.deepEqual(restored.pendingShiftOpen, pendingShiftOpen);
  assert.deepEqual(restored.pendingShiftCashMovement, pendingShiftCashMovement);
  assert.ok(!Object.hasOwn(restored.pendingShiftCashMovement!.request, 'approval'));
});

test('new drafts reuse only truly blank records; cleanup and deletion protect pending sales and other branches', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage: new MemoryStorage() },
  });
  const merchant = 'switcher-merchant';
  const employee = 'switcher-employee';
  try {
    const store = usePosWorkspaceStore.getState();
    store.hydrate(merchant, employee);
    store.selectBranch(merchant, employee, 'branch');
    const first = store.startDraft(merchant, employee);
    assert.equal(store.startDraft(merchant, employee), first);
    const blank = usePosWorkspaceStore.getState().workspace!.drafts[first]!;
    for (const details of [
      { customerName: 'Guest' },
      { customerPhone: '010' },
      { deliveryAddress: 'Address' },
      { tableId: 'table' },
      { fulfillment: 'delivery' as const },
      { lines: [{ id: 'line', productId: 'product', quantity: 1, selections: [], note: 'note' }] },
    ]) {
      store.saveDraft(merchant, employee, { ...blank, ...details });
      const next = store.startDraft(merchant, employee);
      assert.notEqual(next, first);
      store.removeDraft(merchant, employee, next);
      store.selectDraft(merchant, employee, first);
    }
    store.saveDraft(merchant, employee, { ...blank, customerName: 'Guest' });
    const blankId = store.startDraft(merchant, employee);
    store.saveDraft(merchant, employee, { ...blank, id: 'old-blank' });
    store.saveDraft(merchant, employee, { ...blank, id: 'pending' });
    const pending = {
      requestId: 'saved-sale',
      payload: {
        requestId: 'saved-sale',
        registerId: 'register',
        fulfillmentType: 'takeaway' as const,
        items: [
          {
            lineId: 'line',
            productId: 'product',
            quantity: 1,
            expectedProductRevision: 1,
            selections: [],
          },
        ],
      },
    };
    store.savePendingSale(merchant, employee, 'pending', pending);
    assert.throws(() => store.removeDraft(merchant, employee, 'pending'), /Resolve the saved sale/);
    store.selectBranch(merchant, employee, 'other');
    const otherId = store.startDraft(merchant, employee);
    store.selectBranch(merchant, employee, 'branch');
    store.selectDraft(merchant, employee, blankId);
    store.discardEmptyDrafts(merchant, employee);
    const workspace = usePosWorkspaceStore.getState().workspace!;
    assert.ok(workspace.drafts[first]);
    assert.ok(workspace.drafts[blankId]);
    assert.ok(workspace.drafts.pending);
    assert.ok(workspace.drafts[otherId]);
    assert.equal(workspace.drafts['old-blank'], undefined);
    assert.throws(() => store.removeDraft(merchant, employee, otherId), /selected branch/);
    store.selectDraft(merchant, employee, first);
    const deviceId = localStorage.getItem('waffarly:pos:device:v1')!;
    assert.equal(
      readPosWorkspace(merchant, employee, deviceId, localStorage, null).selectedDraftId,
      first,
    );
    localStorage.setItem = () => {
      throw new Error('Storage full');
    };
    assert.throws(() => store.removeDraft(merchant, employee, first));
    assert.ok(usePosWorkspaceStore.getState().workspace?.drafts[first]);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingSales.pending, pending);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('confirmed sale references replace drafts atomically, survive reload and stay actor/branch/device scoped', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage: new MemoryStorage() },
  });
  const merchantId = 'reference-merchant';
  const employeeId = 'reference-employee';
  const draft: PosOrderDraft = {
    id: 'draft',
    branchId: 'branch',
    createdAt: '2026-10-17T08:00:00.000Z',
    updatedAt: '2026-10-17T08:00:00.000Z',
    fulfillment: 'takeaway',
    lines: [],
  };
  const order = { id: 'confirmed', createdAt: draft.createdAt };
  const pending = {
    requestId: 'sale',
    payload: {
      requestId: 'sale',
      registerId: 'register',
      fulfillmentType: 'takeaway' as const,
      items: [],
    },
  };
  try {
    const store = usePosWorkspaceStore.getState();
    store.hydrate(merchantId, employeeId);
    store.selectBranch(merchantId, employeeId, draft.branchId);
    store.saveDraft(merchantId, employeeId, draft);
    store.savePendingSale(merchantId, employeeId, draft.id, pending);
    assert.throws(
      () => store.completeSale(merchantId, employeeId, draft.id, 'wrong-request', order),
      /does not match/,
    );
    const write = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => {
      throw new Error('full');
    };
    assert.throws(() => store.completeSale(merchantId, employeeId, draft.id, 'sale', order));
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.drafts[draft.id], draft);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingSales[draft.id], pending);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.confirmedOrders, {});
    localStorage.setItem = write;
    store.completeSale(merchantId, employeeId, draft.id, 'sale', order);
    const deviceId = localStorage.getItem('waffarly:pos:device:v1')!;
    const restored = readPosWorkspace(merchantId, employeeId, deviceId, localStorage, null);
    assert.deepEqual(restored.drafts, {});
    assert.deepEqual(restored.pendingSales, {});
    assert.equal(restored.selectedConfirmedOrderId, order.id);
    store.selectBranch(merchantId, employeeId, draft.branchId);
    assert.equal(usePosWorkspaceStore.getState().workspace?.selectedConfirmedOrderId, order.id);
    assert.deepEqual(restored.confirmedOrders[order.id], {
      orderId: order.id,
      branchId: draft.branchId,
      createdAt: order.createdAt,
    });
    for (const [merchant, employee, device] of [
      [merchantId, 'another-employee', deviceId],
      ['another-merchant', employeeId, deviceId],
      [merchantId, employeeId, 'another-device'],
    ]) {
      assert.deepEqual(
        readPosWorkspace(merchant!, employee!, device!, localStorage, null).confirmedOrders,
        {},
      );
    }
    store.selectBranch(merchantId, employeeId, 'another-branch');
    assert.equal(usePosWorkspaceStore.getState().workspace?.selectedConfirmedOrderId, null);
    assert.throws(
      () => store.selectConfirmedOrder(merchantId, employeeId, order.id),
      /another branch/,
    );
    store.selectBranch(merchantId, employeeId, draft.branchId);
    store.selectConfirmedOrder(merchantId, employeeId, order.id);
    assert.equal(usePosWorkspaceStore.getState().workspace?.selectedConfirmedOrderId, order.id);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('kitchen additions persist the exact retry and protect their draft until the result is saved', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage: new MemoryStorage() },
  });
  const merchantId = 'amendment-merchant';
  const employeeId = 'amendment-employee';
  const store = usePosWorkspaceStore.getState();
  try {
    store.hydrate(merchantId, employeeId);
    store.selectBranch(merchantId, employeeId, 'branch');
    const saleDraftId = store.startDraft(merchantId, employeeId);
    const sale = {
      requestId: 'initial-sale',
      payload: {
        requestId: 'initial-sale',
        registerId: 'register',
        fulfillmentType: 'takeaway' as const,
        items: [
          {
            lineId: 'initial-line',
            productId: 'product',
            quantity: 1,
            expectedProductRevision: 1,
            selections: [],
          },
        ],
      },
    };
    store.savePendingSale(merchantId, employeeId, saleDraftId, sale);
    store.completeSale(merchantId, employeeId, saleDraftId, sale.requestId, {
      id: 'order',
      createdAt: '2026-10-19T08:00:00.000Z',
    });

    const amendmentDraftId = store.startDraft(merchantId, employeeId);
    const pending = {
      requestId: 'exact-amendment-request',
      draftId: amendmentDraftId,
      payload: {
        requestId: 'exact-amendment-request',
        revision: 1,
        items: [
          {
            lineId: 'added-line',
            productId: 'product',
            quantity: 1,
            expectedProductRevision: 1,
            selections: [],
          },
        ],
      },
    };
    store.savePendingKitchenAmendment(merchantId, employeeId, 'order', pending);
    store.savePendingKitchenAmendment(merchantId, employeeId, 'order', pending);
    assert.throws(
      () =>
        store.savePendingKitchenAmendment(merchantId, employeeId, 'order', {
          ...pending,
          requestId: 'changed-request',
          payload: { ...pending.payload, requestId: 'changed-request' },
        }),
      /Resolve the saved kitchen addition/,
    );
    assert.throws(
      () => store.removeDraft(merchantId, employeeId, amendmentDraftId),
      /Resolve the saved kitchen addition/,
    );
    store.selectConfirmedOrder(merchantId, employeeId, 'order');
    store.discardEmptyDrafts(merchantId, employeeId);
    assert.ok(usePosWorkspaceStore.getState().workspace?.drafts[amendmentDraftId]);

    const deviceId = localStorage.getItem('waffarly:pos:device:v1')!;
    const restored = readPosWorkspace(merchantId, employeeId, deviceId, localStorage, null);
    assert.deepEqual(restored.pendingKitchenAmendments.order, pending);
    store.completeKitchenAmendment(
      merchantId,
      employeeId,
      'order',
      pending.requestId,
      amendmentDraftId,
    );
    const completed = usePosWorkspaceStore.getState().workspace!;
    assert.equal(completed.pendingKitchenAmendments.order, undefined);
    assert.equal(completed.drafts[amendmentDraftId], undefined);
    assert.equal(completed.selectedConfirmedOrderId, 'order');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('workspace persistence is tenant, employee, branch and device scoped and migrates uncertain actions', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    const merchantId = 'merchant-a';
    const employeeId = 'employee-a';
    const legacyKey = `waffarly:pos:${merchantId}:${employeeId}:order-a`;
    const pending = { action: 'accept', requestId: 'request-a', branchId: 'branch-a' } as const;
    sessionStorage.setItem(legacyKey, JSON.stringify(pending));

    const store = usePosWorkspaceStore.getState();
    store.hydrate(merchantId, employeeId);

    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingActions['order-a'], pending);
    assert.equal(sessionStorage.getItem(legacyKey), null);
    const deviceId = localStorage.getItem('waffarly:pos:device:v1');
    assert.ok(deviceId);
    assert.ok(localStorage.getItem(posWorkspaceStorageKey(merchantId, employeeId, deviceId)));
    assert.deepEqual(
      readPosWorkspace(merchantId, employeeId, 'another-device', localStorage, null).pendingActions,
      {},
    );

    const draft: PosOrderDraft = {
      id: 'draft-a',
      branchId: 'branch-a',
      createdAt: '2026-10-17T10:00:00.000Z',
      updatedAt: '2026-10-17T10:00:00.000Z',
      fulfillment: 'takeaway',
      lines: [
        {
          id: 'line-a',
          productId: 'product-a',
          quantity: 2,
          selections: [],
          note: '',
        },
      ],
    };
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, 'branch-a');
    usePosWorkspaceStore.getState().saveDraft(merchantId, employeeId, draft);
    const pendingHandover = {
      action: 'handover',
      requestId: 'request-handover',
    } as const;
    usePosWorkspaceStore
      .getState()
      .savePendingAction(merchantId, employeeId, 'order-handover', pendingHandover);
    const pendingItemReady = {
      action: 'item_ready',
      requestId: 'request-item-ready',
      lineId: 'line-a',
    } as const;
    usePosWorkspaceStore
      .getState()
      .savePendingAction(merchantId, employeeId, 'order-item-ready', pendingItemReady);
    assert.deepEqual(
      readPosWorkspace(merchantId, employeeId, deviceId, localStorage, null).pendingActions[
        'order-handover'
      ],
      pendingHandover,
    );
    assert.deepEqual(
      readPosWorkspace(merchantId, employeeId, deviceId, localStorage, null).pendingActions[
        'order-item-ready'
      ],
      pendingItemReady,
    );
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, 'branch-b');
    assert.throws(
      () => usePosWorkspaceStore.getState().saveDraft(merchantId, employeeId, draft),
      /selected branch/,
    );
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, 'branch-a');
    usePosWorkspaceStore.getState().hydrate('merchant-b', employeeId);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.drafts, {});
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingActions, {});

    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.drafts['draft-a'], draft);
    assert.deepEqual(
      usePosWorkspaceStore.getState().workspace?.pendingActions['order-handover'],
      pendingHandover,
    );
    assert.deepEqual(
      usePosWorkspaceStore.getState().workspace?.pendingActions['order-item-ready'],
      pendingItemReady,
    );
    assert.equal(usePosWorkspaceStore.getState().workspace?.selectedBranchId, 'branch-a');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('shift opening envelopes persist the exact request and require explicit resolution', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    const merchantId = 'merchant-shift';
    const employeeId = 'employee-shift';
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, 'branch-shift');
    const pending = {
      branchId: 'branch-shift',
      registerId: 'register-shift',
      requestId: 'request-shift',
      openingFloat: '125.50',
    };
    usePosWorkspaceStore.getState().savePendingShiftOpen(merchantId, employeeId, pending);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingShiftOpen, pending);
    assert.throws(
      () =>
        usePosWorkspaceStore.getState().savePendingShiftOpen(merchantId, employeeId, {
          ...pending,
          requestId: 'replacement-request',
        }),
      /Resolve the pending shift opening/,
    );
    usePosWorkspaceStore
      .getState()
      .removePendingShiftOpen(merchantId, employeeId, pending.requestId);
    assert.equal(usePosWorkspaceStore.getState().workspace?.pendingShiftOpen, null);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('cash movement and shift close recovery persist exact commands but never supervisor credentials', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    const merchantId = 'merchant-reconciliation';
    const employeeId = 'employee-reconciliation';
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, 'branch-reconciliation');
    const movement = {
      branchId: 'branch-reconciliation',
      registerId: 'register-reconciliation',
      shiftId: 'shift-reconciliation',
      request: {
        requestId: 'cash-movement-retry',
        kind: 'cash_drop' as const,
        amount: '15.25',
        reason: 'Change float',
        dropReference: 'SAFE-2026-19',
      },
    };
    usePosWorkspaceStore.getState().savePendingShiftCashMovement(merchantId, employeeId, movement);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingShiftCashMovement, movement);
    assert.throws(
      () =>
        usePosWorkspaceStore.getState().savePendingShiftClose(merchantId, employeeId, {
          branchId: 'branch-reconciliation',
          registerId: 'register-reconciliation',
          shiftId: 'shift-reconciliation',
          request: { requestId: 'close-blocked', countedCash: '15.25' },
        }),
      /Resolve the pending cash movement/,
    );

    const deviceId = usePosWorkspaceStore.getState().workspace!.deviceId;
    const persisted = localStorage.getItem(
      posWorkspaceStorageKey(merchantId, employeeId, deviceId),
    )!;
    assert.match(persisted, /"version":10/);
    assert.doesNotMatch(persisted, /password|supervisor-secret/i);
    usePosWorkspaceStore.setState({ activeScope: null, workspace: null, hydratedScope: null });
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingShiftCashMovement, movement);
    usePosWorkspaceStore
      .getState()
      .removePendingShiftCashMovement(merchantId, employeeId, movement.request.requestId);

    const close = {
      branchId: 'branch-reconciliation',
      registerId: 'register-reconciliation',
      shiftId: 'shift-reconciliation',
      request: {
        requestId: 'shift-close-retry',
        countedCash: '110.00',
        reason: 'Small drawer variance',
        deliveryHandover: { recipientUsername: 'next-cashier' },
      },
    };
    usePosWorkspaceStore.getState().savePendingShiftClose(merchantId, employeeId, close);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingShiftClose, close);
    const closeDevice = usePosWorkspaceStore.getState().workspace!.deviceId;
    assert.deepEqual(
      readPosWorkspace(merchantId, employeeId, closeDevice, localStorage, null).pendingShiftClose
        ?.request.deliveryHandover,
      close.request.deliveryHandover,
    );
    assert.throws(
      () =>
        usePosWorkspaceStore.getState().savePendingShiftClose(merchantId, employeeId, {
          ...close,
          request: { ...close.request, requestId: 'replacement-close' },
        }),
      /Resolve the pending shift close/,
    );
    usePosWorkspaceStore
      .getState()
      .removePendingShiftClose(merchantId, employeeId, close.request.requestId);
    assert.equal(usePosWorkspaceStore.getState().workspace?.pendingShiftClose, null);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('sale confirmation recovery preserves the exact quote revision and blocks replacement requests', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    const merchantId = 'merchant-sale';
    const employeeId = 'employee-sale';
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, 'branch-sale');
    const pending = {
      requestId: 'sale-request',
      payload: {
        requestId: 'sale-request',
        registerId: 'register-sale',
        fulfillmentType: 'takeaway' as const,
        items: [
          {
            lineId: 'line-sale',
            productId: 'product-sale',
            selections: [],
            quantity: 2,
            expectedProductRevision: 7,
          },
        ],
      },
    };
    usePosWorkspaceStore.getState().savePendingSale(merchantId, employeeId, 'draft-sale', pending);
    assert.deepEqual(
      usePosWorkspaceStore.getState().workspace?.pendingSales['draft-sale'],
      pending,
    );
    assert.throws(
      () =>
        usePosWorkspaceStore.getState().savePendingSale(merchantId, employeeId, 'draft-sale', {
          requestId: 'new-sale-request',
          payload: { ...pending.payload, requestId: 'new-sale-request' },
        }),
      /Resolve the pending sale request/,
    );
    usePosWorkspaceStore
      .getState()
      .removePendingSale(merchantId, employeeId, 'draft-sale', pending.requestId);
    assert.equal(usePosWorkspaceStore.getState().workspace?.pendingSales['draft-sale'], undefined);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('payment recovery persists the exact branch-scoped command and restores it after hydration', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    const merchantId = 'merchant-payment';
    const employeeId = 'employee-payment';
    const orderId = 'order-payment';
    const pending: PendingPosPayment = {
      branchId: 'branch-payment',
      checkId: 'check-payment',
      request: {
        requestId: 'payment-request',
        revision: 4,
        tenders: [
          { method: 'cash', amount: '5.00', receivedAmount: '10.00' },
          { method: 'terminal', amount: '3.00' },
        ],
      },
    };

    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, pending.branchId);
    usePosWorkspaceStore.getState().savePendingPayment(merchantId, employeeId, orderId, pending);
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, 'branch-other');
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingPayments[orderId], pending);

    const deviceId = localStorage.getItem('waffarly:pos:device:v1');
    assert.ok(deviceId);
    const storageKey = posWorkspaceStorageKey(merchantId, employeeId, deviceId);
    const persisted = JSON.parse(localStorage.getItem(storageKey)!) as { version: number };
    assert.equal(persisted.version, 10);
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...JSON.parse(localStorage.getItem(storageKey)!), version: 3 }),
    );

    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingPayments[orderId], pending);
    assert.deepEqual(
      readPosWorkspace('another-merchant', employeeId, deviceId, localStorage, null)
        .pendingPayments,
      {},
    );
    assert.deepEqual(
      readPosWorkspace(merchantId, 'another-employee', deviceId, localStorage, null)
        .pendingPayments,
      {},
    );
    assert.deepEqual(
      readPosWorkspace(merchantId, employeeId, 'another-device', localStorage, null)
        .pendingPayments,
      {},
    );
    assert.throws(
      () =>
        usePosWorkspaceStore.getState().savePendingPayment(merchantId, employeeId, orderId, {
          ...pending,
          request: { ...pending.request, requestId: 'replacement-payment-request' },
        }),
      /Resolve the pending payment/,
    );
    assert.equal(
      usePosWorkspaceStore
        .getState()
        .removePendingPayment(merchantId, employeeId, orderId, 'wrong-request'),
      false,
    );
    assert.equal(
      usePosWorkspaceStore
        .getState()
        .removePendingPayment(merchantId, employeeId, orderId, pending.request.requestId),
      true,
    );
    assert.equal(usePosWorkspaceStore.getState().workspace?.pendingPayments[orderId], undefined);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('cancellation recovery persists the exact branch-scoped request without supervisor credentials', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage: new MemoryStorage() },
  });
  const merchantId = 'merchant-cancel';
  const employeeId = 'employee-cashier';
  const branchId = 'branch-cancel';
  const orderId = 'order-cancel';

  try {
    const store = usePosWorkspaceStore.getState();
    store.hydrate(merchantId, employeeId);
    store.selectBranch(merchantId, employeeId, branchId);
    const draftId = store.startDraft(merchantId, employeeId);
    const sale = {
      requestId: 'sale-cancel-fixture',
      payload: { requestId: 'sale-cancel-fixture' } as never,
    };
    store.savePendingSale(merchantId, employeeId, draftId, sale);
    store.completeSale(merchantId, employeeId, draftId, sale.requestId, {
      id: orderId,
      createdAt: '2026-10-19T08:00:00.000Z',
    });
    const cancellation = {
      requestId: 'exact-cancel-command',
      branchId,
      reason: 'Customer changed their mind',
    };
    store.savePendingCancellation(merchantId, employeeId, orderId, cancellation);
    store.savePendingCancellation(merchantId, employeeId, orderId, cancellation);
    assert.throws(
      () =>
        store.savePendingCancellation(merchantId, employeeId, orderId, {
          ...cancellation,
          reason: 'A different reason',
        }),
      /Resolve the saved cancellation/,
    );
    assert.throws(
      () =>
        store.savePendingCancellation(merchantId, employeeId, orderId, {
          ...cancellation,
          branchId: 'another-branch',
        }),
      /original branch/,
    );

    const deviceId = localStorage.getItem('waffarly:pos:device:v1')!;
    const storageKey = posWorkspaceStorageKey(merchantId, employeeId, deviceId);
    const serialized = localStorage.getItem(storageKey)!;
    assert.equal(serialized.includes('supervisor-password'), false);
    const parsed = JSON.parse(serialized) as { workspace: { pendingCancellations: unknown } };
    assert.deepEqual(parsed.workspace.pendingCancellations, { [orderId]: cancellation });

    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    assert.deepEqual(
      usePosWorkspaceStore.getState().workspace?.pendingCancellations[orderId],
      cancellation,
    );
    store.removePendingCancellation(merchantId, employeeId, orderId, 'wrong-request');
    assert.deepEqual(
      usePosWorkspaceStore.getState().workspace?.pendingCancellations[orderId],
      cancellation,
    );
    store.removePendingCancellation(merchantId, employeeId, orderId, cancellation.requestId);
    assert.equal(
      usePosWorkspaceStore.getState().workspace?.pendingCancellations[orderId],
      undefined,
    );
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('refund recovery migrates, preserves exact tender allocations, and strips supervisor credentials', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    const merchantId = 'merchant-refund';
    const employeeId = 'employee-refund';
    const orderId = 'order-refund';
    const checkId = 'check-refund';
    const branchId = 'branch-refund';
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, branchId);
    const workspace = usePosWorkspaceStore.getState().workspace!;
    usePosWorkspaceStore.setState({
      workspace: {
        ...workspace,
        confirmedOrders: {
          [orderId]: { orderId, branchId, createdAt: '2026-10-19T00:00:00.000Z' },
        },
      },
    });
    const pending = {
      branchId,
      request: {
        requestId: 'refund-request',
        revision: 8,
        branchId,
        refundShiftId: 'refund-shift',
        reason: 'Customer return',
        allocations: [
          { paymentId: 'cash-payment', amount: '2.50' },
          { paymentId: 'terminal-payment', amount: '1.25', terminalReference: 'REF-123' },
        ],
        approval: { username: 'supervisor', password: 'never-store-me' },
      },
    } as unknown as PendingPosRefund;
    usePosWorkspaceStore
      .getState()
      .savePendingRefund(merchantId, employeeId, orderId, checkId, pending);
    const key = posWorkspaceStorageKey(merchantId, employeeId, workspace.deviceId);
    const raw = localStorage.getItem(key)!;
    assert.equal(raw.includes('never-store-me'), false);
    assert.equal(raw.includes('approval'), false);
    assert.equal(JSON.parse(raw).version, 10);
    usePosWorkspaceStore.setState({ activeScope: null, hydratedScope: null, workspace: null });
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    const saved =
      usePosWorkspaceStore.getState().workspace?.pendingRefunds[`${orderId}:${checkId}`];
    assert.deepEqual(saved, {
      branchId,
      request: {
        requestId: 'refund-request',
        revision: 8,
        branchId,
        refundShiftId: 'refund-shift',
        reason: 'Customer return',
        allocations: [
          { paymentId: 'cash-payment', amount: '2.50' },
          { paymentId: 'terminal-payment', amount: '1.25', terminalReference: 'REF-123' },
        ],
      },
    });
    assert.throws(
      () =>
        usePosWorkspaceStore
          .getState()
          .savePendingRefund(merchantId, employeeId, orderId, checkId, {
            ...saved!,
            request: { ...saved!.request, reason: 'Changed reason' },
          }),
      /Resolve the saved refund/,
    );
    assert.equal(
      usePosWorkspaceStore
        .getState()
        .removePendingRefund(merchantId, employeeId, orderId, checkId, 'refund-request'),
      true,
    );
    assert.equal(
      usePosWorkspaceStore.getState().workspace?.pendingRefunds[`${orderId}:${checkId}`],
      undefined,
    );
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('version 1 through 4 POS workspaces migrate without dropping existing drafts or actions', () => {
  const merchantId = 'merchant-v2';
  const employeeId = 'employee-v2';
  const deviceId = 'device-v2';
  const localStorage = new MemoryStorage();
  const workspace = {
    merchantId,
    employeeId,
    deviceId,
    selectedBranchId: 'branch-v2',
    drafts: { draft: { id: 'draft', branchId: 'branch-v2' } },
    pendingActions: { order: { action: 'prepare', requestId: 'prepare-request' } },
    pendingShiftOpen: null,
    pendingSales: {},
  };
  const storageKey = posWorkspaceStorageKey(merchantId, employeeId, deviceId);
  for (const version of [1, 2, 3, 4]) {
    localStorage.setItem(storageKey, JSON.stringify({ version, workspace }));
    const migrated = readPosWorkspace(merchantId, employeeId, deviceId, localStorage, null);
    assert.equal(migrated.selectedBranchId, 'branch-v2');
    assert.deepEqual(migrated.drafts, workspace.drafts);
    assert.deepEqual(migrated.pendingActions, workspace.pendingActions);
    assert.deepEqual(migrated.pendingPayments, {});
    assert.deepEqual(migrated.confirmedOrders, {});
    assert.equal(migrated.selectedConfirmedOrderId, null);
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify({
      version: 3,
      workspace: {
        ...workspace,
        pendingPayments: {
          malformed: {
            branchId: 'branch-v2',
            checkId: 'check-v2',
            request: {
              requestId: 'invalid-payment',
              revision: 1,
              tenders: [{ method: 'cash', amount: '-1.00', receivedAmount: '0.00' }],
            },
          },
        },
      },
    }),
  );
  const invalidEnvelope = readPosWorkspace(merchantId, employeeId, deviceId, localStorage, null);
  assert.deepEqual(invalidEnvelope.pendingPayments, {});
});

test('payment storage failures block new commands and retain existing requests until cleared durably', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const merchantId = 'merchant-payment-storage';
  const employeeId = 'employee-payment-storage';
  const orderId = 'order-payment-storage';
  const pending: PendingPosPayment = {
    branchId: 'branch-payment-storage',
    checkId: 'check-payment-storage',
    request: {
      requestId: 'payment-storage-request',
      revision: 1,
      tenders: [{ method: 'cash', amount: '12.00', receivedAmount: '12.00' }],
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, pending.branchId);
    usePosWorkspaceStore.getState().savePendingPayment(merchantId, employeeId, orderId, pending);
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, 'branch-other');
    localStorage.setItem = () => {
      throw new Error('Storage is full.');
    };
    assert.doesNotThrow(() =>
      usePosWorkspaceStore.getState().savePendingPayment(merchantId, employeeId, orderId, pending),
    );
    assert.equal(
      usePosWorkspaceStore
        .getState()
        .removePendingPayment(merchantId, employeeId, orderId, pending.request.requestId),
      false,
    );
    assert.deepEqual(usePosWorkspaceStore.getState().workspace?.pendingPayments[orderId], pending);
    assert.throws(
      () =>
        usePosWorkspaceStore.getState().savePendingPayment(merchantId, employeeId, 'new-order', {
          ...pending,
          branchId: 'branch-other',
          request: { ...pending.request, requestId: 'new-payment-request' },
        }),
      /Could not save this payment safely/,
    );
    assert.equal(
      usePosWorkspaceStore.getState().workspace?.pendingPayments['new-order'],
      undefined,
    );
    usePosWorkspaceStore.setState({ workspace: null });
    assert.throws(
      () =>
        usePosWorkspaceStore
          .getState()
          .savePendingPayment(merchantId, employeeId, orderId, pending),
      /Could not save this payment safely/,
    );
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('storage failures block new commands but retain and replay an existing exact request ID', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  localStorage.setItem = () => {
    throw new Error('Storage is full.');
  };
  const sessionStorage = new MemoryStorage();
  const merchantId = 'merchant-storage-error';
  const employeeId = 'employee-storage-error';
  const legacyKey = `waffarly:pos:${merchantId}:${employeeId}:order-existing`;
  const saved = {
    action: 'accept',
    requestId: 'request-existing',
    branchId: 'branch-a',
  } as const;
  sessionStorage.setItem(legacyKey, JSON.stringify(saved));
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    assert.equal(
      usePosWorkspaceStore.getState().workspace?.pendingActions['order-existing']?.requestId,
      saved.requestId,
    );
    assert.doesNotThrow(() =>
      usePosWorkspaceStore
        .getState()
        .savePendingAction(merchantId, employeeId, 'order-existing', saved),
    );
    assert.throws(
      () =>
        usePosWorkspaceStore.getState().savePendingAction(merchantId, employeeId, 'order-new', {
          action: 'accept',
          requestId: 'request-new',
          branchId: 'branch-a',
        }),
      /save this action safely/,
    );
    assert.equal(sessionStorage.getItem(legacyKey), JSON.stringify(saved));
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});

test('item-return recovery preserves exact line quantities but never stores supervisor credentials', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  });
  try {
    const merchantId = 'merchant-item-return';
    const employeeId = 'employee-item-return';
    const orderId = 'order-item-return';
    const branchId = 'branch-item-return';
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    usePosWorkspaceStore.getState().selectBranch(merchantId, employeeId, branchId);
    const unsafe = {
      branchId,
      request: {
        requestId: 'item-return-request',
        branchId,
        reason: 'Customer returned damaged food',
        lines: [{ orderLineId: 'original-sale-line', quantity: 2 }],
        approval: { username: 'supervisor', password: 'never-store-this' },
      },
    } as unknown as PendingPosItemReturn;
    usePosWorkspaceStore.getState().savePendingItemReturn(merchantId, employeeId, orderId, unsafe);
    const deviceId = usePosWorkspaceStore.getState().workspace!.deviceId;
    const key = posWorkspaceStorageKey(merchantId, employeeId, deviceId);
    const raw = localStorage.getItem(key)!;
    assert.equal(JSON.parse(raw).version, 10);
    assert.equal(raw.includes('never-store-this'), false);
    assert.equal(raw.includes('approval'), false);

    usePosWorkspaceStore.setState({ activeScope: null, workspace: null, hydratedScope: null });
    usePosWorkspaceStore.getState().hydrate(merchantId, employeeId);
    const expected = {
      branchId,
      request: {
        requestId: 'item-return-request',
        branchId,
        reason: 'Customer returned damaged food',
        lines: [{ orderLineId: 'original-sale-line', quantity: 2 }],
      },
    };
    assert.deepEqual(
      usePosWorkspaceStore.getState().workspace?.pendingItemReturns[orderId],
      expected,
    );
    assert.throws(
      () =>
        usePosWorkspaceStore.getState().savePendingItemReturn(merchantId, employeeId, orderId, {
          ...expected,
          request: {
            ...expected.request,
            lines: [{ orderLineId: 'original-sale-line', quantity: 1 }],
          },
        }),
      /Resolve the saved item return/,
    );
    assert.equal(
      usePosWorkspaceStore
        .getState()
        .removePendingItemReturn(merchantId, employeeId, orderId, expected.request.requestId),
      true,
    );
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    usePosWorkspaceStore.setState({
      activeScope: null,
      workspace: null,
      hydratedScope: null,
      persistenceError: null,
    });
  }
});
