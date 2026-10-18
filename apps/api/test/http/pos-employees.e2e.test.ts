import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile, PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthController } from '../../src/modules/auth/auth.controller.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import { PosEmployeeService } from '../../src/modules/auth/pos-employee.service.js';
import { PosEmployeeGuard } from '../../src/modules/auth/pos-employee.guard.js';
import { PosEmployeesController } from '../../src/modules/auth/pos-employees.controller.js';
import { OrderLifecycleService } from '../../src/modules/orders/order-lifecycle.service.js';
import { PosStorefrontOrdersController } from '../../src/modules/orders/storefront-orders.controller.js';
import { StorefrontOrdersService } from '../../src/modules/orders/storefront-orders.service.js';
import { PosOrdersService } from '../../src/modules/orders/pos-orders.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const anotherBranchId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';
const requestId = '66666666-6666-4666-8666-666666666666';

const owner: OwnerProfile = {
  username: 'store-owner',
  merchantId,
  merchantName: 'Store',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner',
  ownerMobile: '01100000000',
  firstMonthActivatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
};

const employee: PosEmployeeSession = {
  id: employeeId,
  merchantId,
  username: 'cashier1',
  displayName: 'Cashier One',
  role: null,
  permissions: ['accept_recipe_orders', 'start_preparation'],
  branches: [{ id: branchId, name: 'Main', archivedAt: null }],
};

describe('POS employee endpoints', () => {
  let app: INestApplication;
  let ownerAuthorized: boolean;
  let employeeAuthorized: boolean;
  const calls: Array<{ service: string; method: string; args: unknown[] }> = [];

  beforeEach(async () => {
    ownerAuthorized = true;
    employeeAuthorized = true;
    calls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [AuthController, PosEmployeesController, PosStorefrontOrdersController],
      providers: [
        OwnerGuard,
        PosEmployeeGuard,
        {
          provide: AuthService,
          useValue: {
            loginPos: async (...args: unknown[]) =>
              calls.push({ service: 'auth', method: 'loginPos', args }),
            requireOwner: async () => {
              if (!ownerAuthorized) throw new UnauthorizedException();
              return owner;
            },
            requirePosEmployee: async () => {
              if (!employeeAuthorized) throw new UnauthorizedException();
              return employee;
            },
            logout: async (...args: unknown[]) =>
              calls.push({ service: 'auth', method: 'logout', args }),
          },
        },
        {
          provide: PosEmployeeService,
          useValue: {
            list: async (...args: unknown[]) => {
              calls.push({ service: 'employees', method: 'list', args });
              return { items: [], nextCursor: null };
            },
            create: async (...args: unknown[]) => {
              calls.push({ service: 'employees', method: 'create', args });
              return { id: employeeId };
            },
            update: async (...args: unknown[]) => {
              calls.push({ service: 'employees', method: 'update', args });
              return { id: employeeId };
            },
          },
        },
        {
          provide: StorefrontOrdersService,
          useValue: {
            listForPos: async (...args: unknown[]) => {
              calls.push({ service: 'orders', method: 'listForPos', args });
              return { items: [], nextCursor: null };
            },
          },
        },
        {
          provide: PosOrdersService,
          useValue: {
            quote: async (...args: unknown[]) => {
              calls.push({ service: 'posSales', method: 'quote', args });
              return { items: [], currency: 'EGP', subtotal: '0.00', total: '0.00' };
            },
            create: async (...args: unknown[]) => {
              calls.push({ service: 'posSales', method: 'create', args });
              return { id: orderId };
            },
          },
        },
        {
          provide: OrderLifecycleService,
          useValue: {
            acceptFromPos: async (...args: unknown[]) => {
              calls.push({ service: 'lifecycle', method: 'acceptFromPos', args });
              return { id: orderId, status: 'accepted' };
            },
            startPreparationFromPos: async (...args: unknown[]) => {
              calls.push({ service: 'lifecycle', method: 'startPreparationFromPos', args });
              return { id: orderId, status: 'preparing' };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires the owner and scopes employee management to the authenticated merchant', async () => {
    ownerAuthorized = false;
    await request(app.getHttpServer()).get('/owner/employees').expect(401);
    assert.equal(calls.length, 0);

    ownerAuthorized = true;
    await request(app.getHttpServer())
      .get('/owner/employees?search=ali&status=active&limit=10')
      .expect(200);
    assert.deepEqual(calls.at(-1), {
      service: 'employees',
      method: 'list',
      args: [merchantId, { search: 'ali', status: 'active', limit: 10 }],
    });

    const create = {
      username: 'cashier1',
      displayName: 'Cashier One',
      password: 'long-enough-password',
      branchIds: [branchId],
    };
    await request(app.getHttpServer()).post('/owner/employees').send(create).expect(201);
    assert.deepEqual(calls.at(-1), {
      service: 'employees',
      method: 'create',
      args: [merchantId, owner.username, create],
    });
  });

  it('normalizes the business login and limits POS order reads to assigned branches', async () => {
    await request(app.getHttpServer())
      .post('/auth/pos/login')
      .send({ storefrontSlug: 'My-Store', username: 'Cashier1', password: 'staff-password' })
      .expect(200);
    assert.deepEqual(calls[0]?.args[0], {
      storefrontSlug: 'my-store',
      username: 'cashier1',
      password: 'staff-password',
    });

    employeeAuthorized = false;
    await request(app.getHttpServer()).get(`/pos/orders?branchId=${branchId}`).expect(401);
    employeeAuthorized = true;

    await request(app.getHttpServer()).get(`/pos/orders?branchId=${anotherBranchId}`).expect(403);
    assert.equal(calls.filter((call) => call.service === 'orders').length, 0);

    await request(app.getHttpServer()).get(`/pos/orders?branchId=${branchId}&limit=10`).expect(200);
    assert.deepEqual(calls.at(-1), {
      service: 'orders',
      method: 'listForPos',
      args: [merchantId, branchId, { cursor: undefined, limit: 10 }],
    });
  });

  it('requires a POS session before dispatching quote and sale commands', async () => {
    const lineId = '77777777-7777-4777-8777-777777777777';
    const productId = '88888888-8888-4888-8888-888888888888';
    const registerId = '99999999-9999-4999-8999-999999999999';
    const quote = {
      items: [{ lineId, productId, selections: [], quantity: 1 }],
    };
    employeeAuthorized = false;
    await request(app.getHttpServer()).post('/pos/orders/quote').send(quote).expect(401);
    employeeAuthorized = true;

    await request(app.getHttpServer()).post('/pos/orders/quote').send(quote).expect(200);
    assert.deepEqual(calls.at(-1), {
      service: 'posSales',
      method: 'quote',
      args: [employee, quote],
    });

    const sale = {
      requestId,
      registerId,
      fulfillmentType: 'takeaway',
      items: [{ ...quote.items[0], expectedProductRevision: 4 }],
    };
    await request(app.getHttpServer()).post('/pos/orders').send(sale).expect(201);
    assert.deepEqual(calls.at(-1), {
      service: 'posSales',
      method: 'create',
      args: [employee, sale],
    });
  });

  it('passes only assigned branches to accept and preparation commands and exposes no staff cancellation route', async () => {
    employeeAuthorized = false;
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/accept`)
      .send({ requestId, branchId })
      .expect(401);
    employeeAuthorized = true;

    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/accept`)
      .send({ requestId, branchId })
      .expect(201);
    assert.deepEqual(calls.at(-1), {
      service: 'lifecycle',
      method: 'acceptFromPos',
      args: [merchantId, `pos:${employeeId}`, orderId, { requestId, branchId }, [branchId]],
    });

    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/start-preparation`)
      .send({ requestId })
      .expect(201);
    assert.deepEqual(calls.at(-1), {
      service: 'lifecycle',
      method: 'startPreparationFromPos',
      args: [merchantId, `pos:${employeeId}`, orderId, { requestId }, [branchId]],
    });

    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/cancel`)
      .send({ requestId, reason: 'Customer cancelled', restoreStock: true })
      .expect(404);
    assert.equal(calls.filter((call) => call.service === 'lifecycle').length, 2);
  });
});
