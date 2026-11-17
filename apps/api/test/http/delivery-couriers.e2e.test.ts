import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { DeliveryCourierSummary, OwnerProfile, PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import { PosEmployeeGuard } from '../../src/modules/auth/pos-employee.guard.js';
import { DeliveryCourierService } from '../../src/modules/orders/delivery/delivery-courier.service.js';
import { OwnerDeliveryCouriersController } from '../../src/modules/orders/http/owner/owner-delivery-couriers.controller.js';
import { PosDeliveryCouriersController } from '../../src/modules/orders/http/pos/pos-delivery-couriers.controller.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const courierId = '44444444-4444-4444-8444-444444444444';

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
  role: 'cashier',
  permissions: ['sell'],
  branch: { id: branchId, name: 'Main', archivedAt: null },
};

const courier: DeliveryCourierSummary = {
  id: courierId,
  name: 'Ahmed Courier',
  phone: null,
  active: true,
  revision: 1,
  branches: [{ id: branchId, name: 'Main', archivedAt: null }],
  createdAt: '2026-11-17T10:00:00.000Z',
  updatedAt: '2026-11-17T10:00:00.000Z',
};

describe('delivery courier endpoints', () => {
  let app: INestApplication;
  let ownerAuthorized: boolean;
  let employeeAuthorized: boolean;
  const calls: Array<{ method: string; args: unknown[] }> = [];

  beforeEach(async () => {
    ownerAuthorized = true;
    employeeAuthorized = true;
    calls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [OwnerDeliveryCouriersController, PosDeliveryCouriersController],
      providers: [
        OwnerGuard,
        PosEmployeeGuard,
        {
          provide: AuthService,
          useValue: {
            requireOwner: async () => {
              if (!ownerAuthorized) throw new UnauthorizedException();
              return owner;
            },
            requirePosEmployee: async () => {
              if (!employeeAuthorized) throw new UnauthorizedException();
              return employee;
            },
          },
        },
        {
          provide: DeliveryCourierService,
          useValue: {
            listForOwner: async (...args: unknown[]) => {
              calls.push({ method: 'listForOwner', args });
              return { items: [courier], nextCursor: null };
            },
            listForPos: async (...args: unknown[]) => {
              calls.push({ method: 'listForPos', args });
              return { items: [{ id: courierId, name: courier.name }], nextCursor: null };
            },
            performanceForOwner: async (...args: unknown[]) => {
              calls.push({ method: 'performanceForOwner', args });
              return {
                periodStart: '2026-10-18T00:00:00.000Z',
                generatedAt: '2026-11-17T00:00:00.000Z',
                items: [],
              };
            },
            create: async (...args: unknown[]) => {
              calls.push({ method: 'create', args });
              return courier;
            },
            update: async (...args: unknown[]) => {
              calls.push({ method: 'update', args });
              return courier;
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('uses the authenticated owner tenant for courier listing and updates', async () => {
    const list = await request(app.getHttpServer()).get('/owner/delivery-couriers?limit=10');
    assert.equal(list.status, 200);
    assert.deepEqual(calls[0], {
      method: 'listForOwner',
      args: [merchantId, { limit: 10, search: '', status: 'all' }],
    });

    const createBody = { name: courier.name, phone: null, branchIds: [branchId] };
    const created = await request(app.getHttpServer())
      .post('/owner/delivery-couriers')
      .send(createBody);
    assert.equal(created.status, 201);
    assert.deepEqual(calls[1], {
      method: 'create',
      args: [merchantId, owner.username, createBody],
    });

    const updateBody = { ...createBody, revision: 1, active: true };
    const updated = await request(app.getHttpServer())
      .patch(`/owner/delivery-couriers/${courierId}`)
      .send(updateBody);
    assert.equal(updated.status, 200);
    assert.deepEqual(calls[2], {
      method: 'update',
      args: [merchantId, owner.username, courierId, updateBody],
    });
  });

  it('uses the authenticated POS employee for the available branch courier list', async () => {
    const response = await request(app.getHttpServer()).get('/pos/delivery-couriers?limit=20');
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ method: 'listForPos', args: [employee, { limit: 20 }] }]);
  });

  it('scopes the courier performance report to the authenticated owner tenant', async () => {
    const response = await request(app.getHttpServer()).get('/owner/delivery-couriers/performance');
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ method: 'performanceForOwner', args: [merchantId] }]);
    assert.equal(response.body.periodStart, '2026-10-18T00:00:00.000Z');
  });

  it('rejects duplicate branch assignments before calling the service', async () => {
    const response = await request(app.getHttpServer())
      .post('/owner/delivery-couriers')
      .send({ name: courier.name, phone: null, branchIds: [branchId, branchId] });
    assert.equal(response.status, 400);
    assert.deepEqual(calls, []);
  });

  it('rejects requests without the matching owner or POS session', async () => {
    ownerAuthorized = false;
    employeeAuthorized = false;
    const ownerResponse = await request(app.getHttpServer()).get('/owner/delivery-couriers');
    const posResponse = await request(app.getHttpServer()).get('/pos/delivery-couriers');
    assert.equal(ownerResponse.status, 401);
    assert.equal(posResponse.status, 401);
    assert.deepEqual(calls, []);
  });
});
