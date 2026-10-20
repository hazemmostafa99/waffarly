import { ConflictException } from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OrderLifecycleService } from '../../src/modules/orders/order-lifecycle.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const orderId = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
const supervisorId = '99999999-9999-4999-8999-999999999999';

const employee: PosEmployeeSession = {
  id: employeeId,
  merchantId,
  username: 'kitchen',
  displayName: 'Kitchen operator',
  role: 'cashier',
  permissions: ['start_preparation'],
  branches: [{ id: branchId, name: 'Main', archivedAt: null }],
};

function createReadyService(
  initialStatus: string,
  checks: Array<{ id: string; settledAt: Date | null }> = [
    { id: '88888888-8888-4888-8888-888888888888', settledAt: new Date() },
  ],
  ticketed = true,
) {
  const amount = { toString: () => '10.00' };
  const order = {
    id: orderId,
    status: initialStatus,
    source: ticketed ? 'pos' : 'storefront',
    branchId,
    warehouseId: null,
    branchName: 'Main',
    warehouseName: null,
    acceptedAt: new Date('2026-10-19T09:00:00.000Z'),
    preparationStartedAt: new Date('2026-10-19T09:01:00.000Z'),
    readyAt: null as Date | null,
    completedAt: null as Date | null,
    posDiningSessionId: null,
    cancelledAt: null,
    cancellationReason: null,
    stockRestored: null,
    kitchenTicket: ticketed
      ? {
          id: '66666666-6666-4666-8666-666666666666',
          dispatchMode: 'automatic',
          dispatchedAt: new Date('2026-10-19T08:59:00.000Z'),
          station: { id: branchId, name: 'Kitchen' },
        }
      : null,
    diningSession: null,
    customerName: null,
    customerPhone: null,
    fulfillmentType: 'takeaway',
    deliveryAddress: null,
    total: amount,
    currency: 'EGP',
    createdAt: new Date('2026-10-19T08:58:00.000Z'),
    lines: [
      {
        id: '77777777-7777-4777-8777-777777777777',
        stockHandling: ticketed ? 'direct_sale' : 'recipe_acceptance',
        productName: 'Test meal',
        variantName: null,
        basePrice: amount,
        modifierTotal: { toString: () => '0.00' },
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
        kitchenReadyAt: null as Date | null,
        variantAttributes: [],
        selections: [],
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        stockHandling: ticketed ? 'direct_sale' : 'recipe_acceptance',
        productName: 'Second meal',
        variantName: null,
        basePrice: amount,
        modifierTotal: { toString: () => '0.00' },
        quantity: 2,
        unitPrice: amount,
        lineTotal: amount,
        kitchenReadyAt: null as Date | null,
        variantAttributes: [],
        selections: [],
      },
    ],
  };
  const actions = new Map<
    string,
    { action: string; fingerprint: string; createdBy: string; result: unknown }
  >();
  const updates: unknown[] = [];
  const lineUpdates: unknown[] = [];
  const transaction = {
    $queryRaw: async () => [{ id: orderId }],
    storefrontOrder: {
      findFirst: async (_input: unknown) => ({ id: orderId }),
      findFirstOrThrow: async (_input: unknown) => order,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        Object.assign(order, data);
        return order;
      },
    },
    storefrontOrderAction: {
      findUnique: async ({ where }: { where: { merchantId_requestId: { requestId: string } } }) =>
        actions.get(where.merchantId_requestId.requestId) ?? null,
      create: async ({
        data,
      }: {
        data: { requestId: string; action: string; fingerprint: string; createdBy: string; result: unknown };
      }) => {
        actions.set(data.requestId, data);
        return data;
      },
    },
    storefrontOrderLine: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { kitchenReadyAt: Date };
      }) => {
        const line = order.lines.find((candidate) => candidate.id === where.id);
        if (!line || line.kitchenReadyAt) return { count: 0 };
        line.kitchenReadyAt = data.kitchenReadyAt;
        lineUpdates.push({ where, data });
        return { count: 1 };
      },
    },
    posOrderCheck: {
      findMany: async () => checks,
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    storefrontOrderAction: {
      findUnique: async ({ where }: { where: { merchantId_requestId: { requestId: string } } }) =>
        actions.get(where.merchantId_requestId.requestId) ?? null,
    },
  };
  return {
    service: new OrderLifecycleService(prisma as never, {} as never, {} as never),
    updates,
    lineUpdates,
    order,
  };
}

function createCancellationService(options?: {
  status?: string;
  payments?: number;
  actorPermissions?: string[];
  approverPermissions?: string[];
}) {
  const amount = { toString: () => '10.00' };
  const order = {
    id: orderId,
    status: options?.status ?? 'pending',
    source: 'pos',
    branchId,
    warehouseId: null,
    branchName: 'Main',
    warehouseName: null,
    acceptedAt: null,
    preparationStartedAt: null,
    readyAt: null,
    completedAt: null,
    posDiningSessionId: null,
    cancelledAt: null as Date | null,
    cancellationReason: null as string | null,
    stockRestored: null as boolean | null,
    kitchenTicket: {
      id: '66666666-6666-4666-8666-666666666666',
      dispatchMode: 'automatic',
      dispatchedAt: new Date('2026-10-19T09:00:00.000Z'),
      cancellationAcknowledgedAt: null,
      cancellationAcknowledgedBy: null,
      station: { id: branchId, name: 'Kitchen' },
    },
    diningSession: null,
    customerName: null,
    customerPhone: null,
    fulfillmentType: 'takeaway',
    deliveryAddress: null,
    total: amount,
    currency: 'EGP',
    createdAt: new Date('2026-10-19T08:58:00.000Z'),
    lines: [
      {
        id: '77777777-7777-4777-8777-777777777777',
        stockHandling: 'direct_sale',
        productName: 'Test meal',
        variantName: null,
        basePrice: amount,
        modifierTotal: { toString: () => '0.00' },
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
        kitchenReadyAt: null,
        variantAttributes: [],
        selections: [],
        stockRequirements: [],
      },
    ],
  };
  const actions = new Map<string, { action: string; fingerprint: string; createdBy: string; result: unknown }>();
  const actionWrites: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const checkUpdates: Array<Record<string, unknown>> = [];
  const transaction = {
    $queryRaw: async () => [{ id: orderId }],
    posEmployee: {
      findFirst: async ({ where }: { where: { id: string } }) => {
        if (where.id === employeeId)
          return { role: 'cashier', permissions: options?.actorPermissions ?? ['sell'] };
        if (where.id === supervisorId)
          return {
          role: options?.approverPermissions ? 'cashier' : 'supervisor',
            permissions: options?.approverPermissions ?? ['approve_voids'],
          };
        return null;
      },
    },
    storefrontOrderAction: {
      findUnique: async ({ where }: { where: { merchantId_requestId: { requestId: string } } }) =>
        actions.get(where.merchantId_requestId.requestId) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        actionWrites.push(data);
        actions.set(data.requestId as string, data as (typeof actions extends Map<string, infer V> ? V : never));
        return data;
      },
    },
    storefrontOrder: {
      findFirst: async () => ({ id: orderId }),
      findFirstOrThrow: async () => order,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        Object.assign(order, data);
        return order;
      },
    },
    posOrderPayment: { count: async () => options?.payments ?? 0 },
    storefrontOrderStockBatch: { findMany: async () => [] },
    storefrontOrderLine: { findMany: async () => [] },
    posOrderCheck: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        checkUpdates.push(data);
        return { count: 1 };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
    storefrontOrderAction: {
      findUnique: async ({ where }: { where: { merchantId_requestId: { requestId: string } } }) =>
        actions.get(where.merchantId_requestId.requestId) ?? null,
    },
  };
  const cancellationEmployee: PosEmployeeSession = {
    ...employee,
    permissions: ['sell'],
  };
  return {
    service: new OrderLifecycleService(prisma as never, {} as never, {} as never),
    employee: cancellationEmployee,
    order,
    actionWrites,
    updates,
    checkUpdates,
  };
}

describe('POS kitchen readiness', () => {
  it('marks a preparing ticket ready once and replays the exact command', async () => {
    const { service, updates } = createReadyService('preparing', undefined, false);
    const input = { requestId };
    const marked = await service.markReadyFromPos(
      employee.merchantId,
      `pos:${employee.id}`,
      orderId,
      input,
      [branchId],
    );

    assert.equal(marked.status, 'ready');
    assert.ok(marked.readyAt);
    assert.deepEqual(updates[0], { status: 'ready', readyAt: new Date(marked.readyAt!) });
    assert.deepEqual(
      await service.markReadyFromPos(employee.merchantId, `pos:${employee.id}`, orderId, input, [
        branchId,
      ]),
      marked,
    );
    assert.equal(updates.length, 1);
  });

  it('marks ticket items ready separately and readies the ticket only after every line is ready', async () => {
    const { service, updates, lineUpdates, order } = createReadyService('preparing');
    const firstLineId = order.lines[0]!.id;
    const secondLineId = order.lines[1]!.id;
    const firstRequest = { requestId };
    const first = await service.markKitchenItemReadyFromPos(
      merchantId,
      `pos:${employeeId}`,
      orderId,
      firstLineId,
      firstRequest,
      [branchId],
    );

    assert.equal(first.status, 'preparing');
    assert.ok(first.lines[0]!.kitchenReadyAt);
    assert.equal(first.lines[1]!.kitchenReadyAt, null);
    assert.equal(updates.length, 0);
    assert.equal(lineUpdates.length, 1);

    const second = await service.markKitchenItemReadyFromPos(
      merchantId,
      `pos:${employeeId}`,
      orderId,
      secondLineId,
      { requestId: '55555555-5555-4555-8555-666666666666' },
      [branchId],
    );
    assert.equal(second.status, 'ready');
    assert.ok(second.readyAt);
    assert.ok(second.lines.every((line) => line.kitchenReadyAt));
    assert.equal(updates.length, 1);
    assert.equal(lineUpdates.length, 2);
    assert.deepEqual(
      await service.markKitchenItemReadyFromPos(
        merchantId,
        `pos:${employeeId}`,
        orderId,
        secondLineId,
        { requestId: '55555555-5555-4555-8555-666666666666' },
        [branchId],
      ),
      second,
    );
    assert.equal(lineUpdates.length, 2);
  });

  it('rejects the old whole-ticket ready command for a ticketed POS order', async () => {
    const { service, updates } = createReadyService('preparing');
    await assert.rejects(
      service.markReadyFromPos(merchantId, `pos:${employeeId}`, orderId, { requestId }, [branchId]),
      ConflictException,
    );
    assert.equal(updates.length, 0);
  });

  it('rejects marking an order ready before preparation starts', async () => {
    const { service, updates } = createReadyService('accepted');
    await assert.rejects(
      service.markReadyFromPos(employee.merchantId, `pos:${employee.id}`, orderId, { requestId }, [
        branchId,
      ]),
      ConflictException,
    );
    assert.equal(updates.length, 0);
  });

  it('blocks handover until every check on the order is settled', async () => {
    const { service, updates } = createReadyService('ready', [
      { id: '88888888-8888-4888-8888-888888888888', settledAt: new Date() },
      { id: '99999999-9999-4999-8999-999999999999', settledAt: null },
    ]);

    await assert.rejects(
      service.handoverFromPos(merchantId, `pos:${employeeId}`, orderId, { requestId }, [branchId]),
      ConflictException,
    );
    assert.equal(updates.length, 0);
  });

  it('completes a paid ticket once and replays the same handover command', async () => {
    const { service, updates } = createReadyService('ready');
    const input = { requestId };
    const handedOver = await service.handoverFromPos(
      merchantId,
      `pos:${employeeId}`,
      orderId,
      input,
      [branchId],
    );

    assert.equal(handedOver.status, 'completed');
    assert.ok(handedOver.completedAt);
    assert.deepEqual(updates[0], {
      status: 'completed',
      completedAt: new Date(handedOver.completedAt!),
    });
    assert.deepEqual(
      await service.handoverFromPos(merchantId, `pos:${employeeId}`, orderId, input, [branchId]),
      handedOver,
    );
    assert.equal(updates.length, 1);
  });
});

describe('POS order cancellation', () => {
  it('cancels an unpaid ticket with a distinct branch supervisor and replays without repeating stock effects', async () => {
    const { service, employee: cashier, order, actionWrites, updates, checkUpdates } =
      createCancellationService();
    const command = { requestId, branchId, reason: 'Customer changed their mind' };
    const cancelled = await service.cancelPosFromPos(cashier, orderId, command, supervisorId);
    const replay = await service.cancelPosFromPos(cashier, orderId, command, supervisorId);

    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.cancellationReason, command.reason);
    assert.equal(order.stockRestored, true);
    assert.deepEqual(replay, cancelled);
    assert.equal(updates.length, 1);
    assert.equal(checkUpdates.length, 1);
    assert.equal(actionWrites.length, 1);
    assert.deepEqual(actionWrites[0], {
      merchantId,
      orderId,
      requestId,
      action: 'pos_cancel',
      fingerprint: actionWrites[0]!.fingerprint,
      result: cancelled,
      createdBy: `pos:${employeeId}`,
      approvedByPosEmployeeId: supervisorId,
    });
    assert.equal(JSON.stringify(actionWrites[0]).includes('password'), false);
  });

  it('rejects paid, prepared, unapproved, cross-branch, and unauthorized-approver cancellations', async () => {
    const command = { requestId, branchId, reason: 'Customer changed their mind' };
    const paid = createCancellationService({ payments: 1 });
    await assert.rejects(
      paid.service.cancelPosFromPos(paid.employee, orderId, command, supervisorId),
      /recorded payment must use a refund/,
    );
    assert.equal(paid.updates.length, 0);

    const preparing = createCancellationService({ status: 'preparing' });
    await assert.rejects(
      preparing.service.cancelPosFromPos(preparing.employee, orderId, command, supervisorId),
      /waiting for kitchen preparation/,
    );

    const unapproved = createCancellationService();
    await assert.rejects(unapproved.service.cancelPosFromPos(unapproved.employee, orderId, command));

    const wrongBranch = createCancellationService();
    await assert.rejects(
      wrongBranch.service.cancelPosFromPos(wrongBranch.employee, orderId, {
        ...command,
        branchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }, supervisorId),
    );

    const unauthorized = createCancellationService({ approverPermissions: ['sell'] });
    await assert.rejects(
      unauthorized.service.cancelPosFromPos(
        unauthorized.employee,
        orderId,
        command,
        supervisorId,
      ),
      /approval is no longer valid/,
    );
  });
});
