import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readPosWorkspace,
  posWorkspaceStorageKey,
  usePosWorkspaceStore,
  type PendingPosPayment,
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
    assert.equal(persisted.version, 3);

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

test('version 1 and 2 POS workspaces migrate without dropping existing drafts or actions', () => {
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
  for (const version of [1, 2]) {
    localStorage.setItem(storageKey, JSON.stringify({ version, workspace }));
    const migrated = readPosWorkspace(merchantId, employeeId, deviceId, localStorage, null);
    assert.equal(migrated.selectedBranchId, 'branch-v2');
    assert.deepEqual(migrated.drafts, workspace.drafts);
    assert.deepEqual(migrated.pendingActions, workspace.pendingActions);
    assert.deepEqual(migrated.pendingPayments, {});
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
