import { ForbiddenException } from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PosKitchenService } from '../../src/modules/orders/pos-kitchen.service.js';
import { createPosKitchenTicket } from '../../src/modules/orders/pos-kitchen.persistence.js';
import { StorefrontOrdersService } from '../../src/modules/orders/storefront-orders.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const orderId = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
const stationId = '66666666-6666-4666-8666-666666666666';
const ticketId = '77777777-7777-4777-8777-777777777777';

const employee: PosEmployeeSession = {
  id: employeeId,
  merchantId,
  username: 'cashier',
  displayName: 'Cashier',
  role: 'cashier',
  permissions: ['sell'],
  branches: [{ id: branchId, name: 'Main', archivedAt: null }],
};

describe('POS kitchen tickets', () => {
  it('keeps the legacy recipe queue and scopes ticketed POS work to its branch and active statuses', async () => {
    let capturedWhere: unknown;
    const service = new StorefrontOrdersService(
      {
        storefrontOrder: {
          findMany: async ({ where }: { where: unknown }) => {
            capturedWhere = where;
            return [];
          },
        },
      } as never,
      {} as never,
    );

    await service.listForPos(merchantId, branchId);

    assert.deepEqual(capturedWhere, {
      merchantId,
      delivery: { is: null },
      OR: [
        {
          lines: { some: { stockHandling: 'recipe_acceptance' } },
          OR: [
            {
              status: 'pending',
              OR: [{ source: 'storefront', branchId: null }, { branchId }],
            },
            { status: { in: ['accepted', 'preparing', 'ready'] }, branchId },
          ],
        },
        {
          source: 'pos',
          branchId,
          status: { in: ['pending', 'accepted', 'preparing', 'ready'] },
          kitchenTicket: { isNot: null },
        },
        {
          source: 'pos',
          branchId,
          status: 'cancelled',
          kitchenTicket: { is: { cancellationAcknowledgedAt: null } },
        },
      ],
    });
  });

  it('marks only fully paid ready tickets eligible for handover', async () => {
    const readyOrder = (id: string, settledAt: Date | null) => ({
      id,
      status: 'ready',
      source: 'pos',
      customerName: null,
      customerPhone: null,
      fulfillmentType: 'takeaway',
      deliveryAddress: null,
      total: { toString: () => '10.00' },
      currency: 'EGP',
      createdAt: new Date('2026-10-19T09:00:00.000Z'),
      readyAt: new Date('2026-10-19T09:10:00.000Z'),
      completedAt: null,
      kitchenTicket: {
        id: `ticket-${id}`,
        dispatchMode: 'automatic',
        dispatchedAt: new Date('2026-10-19T09:01:00.000Z'),
        station: { id: stationId, name: 'Kitchen' },
      },
      diningSession: null,
      checks: [{ settledAt }],
      lines: [],
    });
    const service = new StorefrontOrdersService(
      {
        storefrontOrder: {
          findMany: async () => [
            readyOrder(orderId, new Date('2026-10-19T09:09:00.000Z')),
            readyOrder('88888888-8888-4888-8888-888888888888', null),
          ],
        },
      } as never,
      {} as never,
    );

    const result = await service.listForPos(merchantId, branchId);
    assert.deepEqual(
      result.items.map((order) => order.handoverEligible),
      [true, false],
    );
  });

  it('creates a branch-scoped default station ticket with explicit dispatch facts', async () => {
    const writes: Array<{ model: string; input: unknown }> = [];
    const transaction = {
      posKitchenTicket: {
        findUnique: async (input: unknown) => {
          writes.push({ model: 'ticket.findUnique', input });
          return null;
        },
        create: async (input: unknown) => {
          writes.push({ model: 'ticket.create', input });
          return { id: ticketId };
        },
      },
      posKitchenStation: {
        upsert: async (input: unknown) => {
          writes.push({ model: 'station.upsert', input });
          return { id: stationId, active: true };
        },
      },
    };

    const result = await createPosKitchenTicket(transaction as never, {
      merchantId,
      branchId,
      orderId,
      dispatchMode: 'automatic',
      dispatchedByPosEmployeeId: employeeId,
    });

    assert.deepEqual(result, { id: ticketId });
    assert.deepEqual(writes[1], {
      model: 'station.upsert',
      input: {
        where: { merchantId_branchId_code: { merchantId, branchId, code: 'default' } },
        create: { merchantId, branchId, code: 'default', name: 'Kitchen' },
        update: {},
        select: { id: true, active: true },
      },
    });
    assert.deepEqual(writes[2], {
      model: 'ticket.create',
      input: {
        data: {
          merchantId,
          branchId,
          stationId,
          orderId,
          dispatchMode: 'automatic',
          dispatchedByPosEmployeeId: employeeId,
        },
        select: { id: true },
      },
    });
  });

  it('does not create a second ticket for an order', async () => {
    let stationLookups = 0;
    let ticketCreates = 0;
    const transaction = {
      posKitchenTicket: {
        findUnique: async () => ({ id: ticketId }),
        create: async () => {
          ticketCreates += 1;
          return { id: ticketId };
        },
      },
      posKitchenStation: {
        upsert: async () => {
          stationLookups += 1;
          return { id: stationId, active: true };
        },
      },
    };

    const result = await createPosKitchenTicket(transaction as never, {
      merchantId,
      branchId,
      orderId,
      dispatchMode: 'manual',
      dispatchedByPosEmployeeId: employeeId,
    });

    assert.deepEqual(result, { id: ticketId });
    assert.equal(stationLookups, 0);
    assert.equal(ticketCreates, 0);
  });

  it('requires sell permission before opening a database transaction', async () => {
    let transactionOpened = false;
    const service = new PosKitchenService({
      $transaction: async () => {
        transactionOpened = true;
        throw new Error('Transaction should not start');
      },
    } as never);

    await assert.rejects(
      service.dispatchDineInOrder({ ...employee, permissions: ['view_orders'] }, orderId, {
        requestId,
      }),
      ForbiddenException,
    );
    assert.equal(transactionOpened, false);
  });

  it('routes one manually dispatched dine-in round to its assigned branch ticket queue', async () => {
    const dispatchedAt = new Date('2026-10-19T09:30:00.000Z');
    const actionResults = new Map<string, { fingerprint: string; result: unknown }>();
    let ticketCreates = 0;
    let currentOrder = {
      id: orderId,
      status: 'pending',
      customerName: null,
      customerPhone: null,
      fulfillmentType: 'dine_in',
      deliveryAddress: null,
      total: { toString: () => '80.00' },
      createdAt: new Date('2026-10-19T09:00:00.000Z'),
      lines: [],
      kitchenTicket: null as null | {
        id: string;
        dispatchMode: string;
        dispatchedAt: Date;
        station: { id: string; name: string };
      },
    };
    const tx = {
      $queryRaw: async () => [{ id: orderId }],
      storefrontOrderAction: {
        findUnique: async ({ where }: { where: { merchantId_requestId: { requestId: string } } }) =>
          actionResults.get(where.merchantId_requestId.requestId) ?? null,
        create: async ({
          data,
        }: {
          data: { requestId: string; fingerprint: string; result: unknown };
        }) => {
          actionResults.set(data.requestId, { fingerprint: data.fingerprint, result: data.result });
          return data;
        },
      },
      storefrontOrder: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          assert.deepEqual(where, {
            id: orderId,
            merchantId,
            source: 'pos',
            branchId: { in: [branchId] },
          });
          return currentOrder;
        },
        findFirstOrThrow: async () => currentOrder,
      },
      posKitchenTicket: {
        findUnique: async () => (currentOrder.kitchenTicket ? { id: ticketId } : null),
        create: async () => {
          ticketCreates += 1;
          currentOrder = {
            ...currentOrder,
            kitchenTicket: {
              id: ticketId,
              dispatchMode: 'manual',
              dispatchedAt,
              station: { id: stationId, name: 'Kitchen' },
            },
          };
          return { id: ticketId };
        },
      },
      posKitchenStation: {
        upsert: async () => ({ id: stationId, active: true }),
      },
    };
    const prisma = {
      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
      storefrontOrderAction: {
        findUnique: async ({ where }: { where: { merchantId_requestId: { requestId: string } } }) =>
          actionResults.get(where.merchantId_requestId.requestId) ?? null,
      },
    };
    const service = new PosKitchenService(prisma as never);

    const result = await service.dispatchDineInOrder(employee, orderId, { requestId });
    const retried = await service.dispatchDineInOrder(employee, orderId, { requestId });

    assert.equal(result.kitchenTicket?.dispatchMode, 'manual');
    assert.equal(result.kitchenTicket?.station.name, 'Kitchen');
    assert.equal(result.kitchenTicket?.dispatchedAt, dispatchedAt.toISOString());
    assert.deepEqual(retried, result);
    assert.equal(ticketCreates, 1);
    assert.equal(actionResults.size, 1);
  });

  it('acknowledges a pending kitchen cancellation once and returns its saved result on retry', async () => {
    const kitchenEmployee: PosEmployeeSession = {
      ...employee,
      role: 'kitchen',
      permissions: ['accept_recipe_orders'],
    };
    const cancelledOrder = {
      id: orderId,
      status: 'cancelled',
      source: 'pos',
      branchId,
      warehouseId: null,
      branchName: null,
      warehouseName: null,
      acceptedAt: null,
      preparationStartedAt: null,
      readyAt: null,
      completedAt: null,
      cancelledAt: new Date('2026-10-19T09:02:00.000Z'),
      cancellationReason: 'Customer changed their mind',
      stockRestored: true,
      kitchenTicket: {
        id: ticketId,
        dispatchMode: 'automatic',
        dispatchedAt: new Date('2026-10-19T09:00:00.000Z'),
        cancellationAcknowledgedAt: null as Date | null,
        cancellationAcknowledgedBy: null,
        station: { id: stationId, name: 'Kitchen' },
      },
      diningSession: null,
      customerName: null,
      customerPhone: null,
      fulfillmentType: 'takeaway',
      deliveryAddress: null,
      total: { toString: () => '10.00' },
      currency: 'EGP',
      createdAt: new Date('2026-10-19T08:58:00.000Z'),
      lines: [],
    };
    const actions = new Map<string, Record<string, unknown>>();
    let ticketWrites = 0;
    const tx = {
      $queryRaw: async () => [{ id: orderId }],
      posEmployee: {
        findFirst: async () => ({ role: 'kitchen', permissions: ['accept_recipe_orders'] }),
      },
      storefrontOrderAction: {
        findUnique: async ({ where }: { where: { merchantId_requestId: { requestId: string } } }) =>
          actions.get(where.merchantId_requestId.requestId) ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          actions.set(data.requestId as string, data);
          return data;
        },
      },
      storefrontOrder: {
        findFirst: async () => cancelledOrder,
        findFirstOrThrow: async () => cancelledOrder,
      },
      posKitchenTicket: {
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          ticketWrites += 1;
          Object.assign(cancelledOrder.kitchenTicket, data);
          return { count: 1 };
        },
      },
    };
    const prisma = {
      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
      storefrontOrderAction: {
        findUnique: async ({ where }: { where: { merchantId_requestId: { requestId: string } } }) =>
          actions.get(where.merchantId_requestId.requestId) ?? null,
      },
    };
    const service = new PosKitchenService(prisma as never);
    const command = { requestId };
    const first = await service.acknowledgeCancellation(kitchenEmployee, orderId, command);
    const replay = await service.acknowledgeCancellation(kitchenEmployee, orderId, command);

    assert.equal(first.status, 'cancelled');
    assert.ok(first.kitchenTicket?.cancellationAcknowledgedAt);
    assert.deepEqual(replay, first);
    assert.equal(ticketWrites, 1);
    assert.equal(actions.size, 1);
  });
});
