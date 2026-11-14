import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  resolvePosEmployeePermissions,
  type PosEmployeeRole,
  type PosEmployeeSession,
} from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AuthService, OwnerGuard, PosEmployeeGuard } from '../../src/modules/auth/index.js';
import { PosEmployeeService } from '../../src/modules/auth/pos-employee.service.js';
import { PosEmployeesController } from '../../src/modules/auth/pos-employees.controller.js';
import { EmployeeInventoryController } from '../../src/modules/inventory/employee-inventory.controller.js';
import { InventoryLedgerService } from '../../src/modules/inventory/inventory-ledger.service.js';
import { OrderLifecycleService } from '../../src/modules/orders/fulfillment/order-lifecycle.service.js';
import { PosOrdersService } from '../../src/modules/orders/pos-sales/pos-orders.service.js';
import { PosReceiptsController } from '../../src/modules/orders/http/pos/pos-receipts.controller.js';
import { StorefrontOrdersService } from '../../src/modules/orders/checkout/storefront-orders.service.js';
import { PosStorefrontOrdersController } from '../../src/modules/orders/http/pos/pos-orders.controller.js';
import { PosKitchenService } from '../../src/modules/orders/kitchen/pos-kitchen.service.js';
import { PosReturnsService } from '../../src/modules/orders/returns/pos-returns.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const branchId = '33333333-3333-4333-8333-333333333333';
const otherBranchId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';
const requestId = '66666666-6666-4666-8666-666666666666';

describe('employee role boundaries', () => {
  let app: INestApplication;
  let employee: PosEmployeeSession;
  let authenticated: boolean;
  const reads: Array<{ model: string; query: { where: unknown } }> = [];
  const writes: string[] = [];
  function assign(role: PosEmployeeRole) {
    employee = {
      id: orderId,
      merchantId,
      username: 'staff',
      displayName: 'Staff',
      role,
      permissions: resolvePosEmployeePermissions(role, [
        'accept_recipe_orders',
        'start_preparation',
        'sell',
      ]),
      branches: [{ id: branchId, name: 'Assigned', archivedAt: null }],
    };
  }

  beforeEach(async () => {
    authenticated = true;
    reads.length = 0;
    writes.length = 0;
    assign('inventory_officer');
    const prisma = {
      stockBalance: {
        findMany: async (query: { where: unknown }) => {
          reads.push({ model: 'stockBalance', query });
          return [];
        },
        findFirst: async () => null,
      },
      posCheckReceipt: {
        findMany: async (query: { where: unknown }) => {
          reads.push({ model: 'receipt', query });
          return [];
        },
        findFirst: async () => null,
      },
      storefrontOrder: {
        findFirst: async (query: { where: unknown }) => {
          reads.push({ model: 'order', query });
          return null;
        },
      },
    };
    const sales = new PosOrdersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const module = await Test.createTestingModule({
      controllers: [
        EmployeeInventoryController,
        PosStorefrontOrdersController,
        PosReceiptsController,
        PosEmployeesController,
      ],
      providers: [
        PosEmployeeGuard,
        OwnerGuard,
        InventoryLedgerService,
        PosEmployeeService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AuthService,
          useValue: {
            requirePosEmployee: async () => {
              if (!authenticated) throw new UnauthorizedException();
              return employee;
            },
            requireOwner: async () => {
              throw new UnauthorizedException();
            },
          },
        },
        { provide: PosOrdersService, useValue: sales },
        { provide: PosKitchenService, useValue: { dispatchDineInOrder: async () => ({}) } },
        {
          provide: PosReturnsService,
          useValue: {
            state: async () => ({ orderId, eligible: false, items: [], returns: [] }),
            record: async () => ({ orderId }),
          },
        },
        {
          provide: StorefrontOrdersService,
          useValue: { listForPos: async () => ({ items: [], nextCursor: null }) },
        },
        {
          provide: OrderLifecycleService,
          useValue: {
            acceptFromPos: async () => {
              writes.push('accept');
              return {};
            },
            startPreparationFromPos: async () => {
              writes.push('prepare');
              return {};
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterEach(async () => app.close());

  it('requires authentication and an assigned branch for stock reads', async () => {
    authenticated = false;
    await request(app.getHttpServer())
      .get(`/pos/inventory/balances?branchId=${branchId}`)
      .expect(401);
    authenticated = true;
    await request(app.getHttpServer()).get('/pos/inventory/balances').expect(400);
    await request(app.getHttpServer())
      .get(`/pos/inventory/balances?branchId=${otherBranchId}`)
      .expect(403);
    assert.equal(reads.length, 0);
    await request(app.getHttpServer())
      .get(`/pos/inventory/balances?branchId=${branchId}`)
      .expect(200, { items: [], nextCursor: null });
    assert.deepEqual(reads[0]?.query.where, { merchantId, warehouse: { branchId } });
    await request(app.getHttpServer())
      .get(`/pos/inventory/balances?branchId=${branchId}&cursor=${orderId}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/pos/inventory/balances?branchId=${branchId}&merchantId=${merchantId}`)
      .expect(400);
  });

  it('keeps accountant receipt access read-only and branch-scoped', async () => {
    assign('accountant');
    await request(app.getHttpServer())
      .get(`/pos/receipts?branchId=${branchId}`)
      .expect(200, { items: [], nextCursor: null });
    assert.deepEqual(reads[0]?.query.where, {
      merchantId,
      order: { is: { source: 'pos', branchId } },
    });
    await request(app.getHttpServer()).get(`/pos/receipts?branchId=${otherBranchId}`).expect(403);
    await request(app.getHttpServer())
      .get(`/pos/orders/${orderId}/checks/${requestId}/receipt`)
      .expect(404);
    assert.deepEqual(reads.at(-1)?.query.where, {
      id: orderId,
      merchantId,
      OR: [
        { source: 'pos' },
        {
          source: 'storefront',
          fulfillmentType: 'pickup',
          posShiftId: { not: null },
          status: { in: ['ready', 'completed'] },
        },
      ],
      branchId: { in: [branchId] },
    });
    await request(app.getHttpServer()).post('/pos/orders/quote').send({}).expect(403);
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/checks/${requestId}/payments`)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .get(`/pos/inventory/balances?branchId=${branchId}`)
      .expect(403);
    await request(app.getHttpServer()).get('/owner/employees').expect(401);
  });

  it('lets customer service view the queue without accepting or preparing orders', async () => {
    assign('customer_service');
    await request(app.getHttpServer()).get(`/pos/orders?branchId=${branchId}`).expect(200);
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/accept`)
      .send({ requestId, branchId })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/start-preparation`)
      .send({ requestId })
      .expect(403);
    await request(app.getHttpServer()).get(`/pos/receipts?branchId=${branchId}`).expect(403);
    assert.deepEqual(writes, []);
    assign('kitchen');
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/accept`)
      .send({ requestId, branchId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/start-preparation`)
      .send({ requestId })
      .expect(201);
    assert.deepEqual(writes, ['accept', 'prepare']);
    await request(app.getHttpServer()).post('/pos/orders/quote').send({}).expect(403);
  });

  it('applies role reassignment on the next request without retaining old grants', async () => {
    assign('branch_manager');
    await request(app.getHttpServer())
      .get(`/pos/inventory/balances?branchId=${branchId}`)
      .expect(200);
    await request(app.getHttpServer()).get(`/pos/receipts?branchId=${branchId}`).expect(200);
    assign('cashier');
    await request(app.getHttpServer())
      .get(`/pos/inventory/balances?branchId=${branchId}`)
      .expect(403);
    assign('inventory_officer');
    await request(app.getHttpServer()).get(`/pos/receipts?branchId=${branchId}`).expect(403);
    await request(app.getHttpServer()).get(`/pos/orders?branchId=${branchId}`).expect(403);
    await request(app.getHttpServer()).post('/pos/orders/quote').send({}).expect(403);
  });
});
