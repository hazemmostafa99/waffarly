import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { PosEmployeeGuard } from '../../src/modules/auth/pos-employee.guard.js';
import { PosOrdersService } from '../../src/modules/orders/pos-orders.service.js';
import { PosStorefrontOrdersController } from '../../src/modules/orders/storefront-orders.controller.js';
import { OrderLifecycleService } from '../../src/modules/orders/order-lifecycle.service.js';
import { StorefrontOrdersService } from '../../src/modules/orders/storefront-orders.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const orderId = '44444444-4444-4444-8444-444444444444';
const checkId = '55555555-5555-4555-8555-555555555555';
const requestId = '66666666-6666-4666-8666-666666666666';

const employee: PosEmployeeSession = {
  id: employeeId,
  merchantId,
  username: 'cashier',
  displayName: 'Cashier',
  role: 'cashier',
  permissions: ['sell'],
  branches: [{ id: branchId, name: 'Main', archivedAt: null }],
};

describe('POS payment endpoint', () => {
  let app: INestApplication;
  let authorized: boolean;
  const calls: unknown[][] = [];
  const stateCalls: unknown[][] = [];

  beforeEach(async () => {
    authorized = true;
    calls.length = 0;
    stateCalls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [PosStorefrontOrdersController],
      providers: [
        PosEmployeeGuard,
        {
          provide: AuthService,
          useValue: {
            requirePosEmployee: async () => {
              if (!authorized) throw new UnauthorizedException();
              return employee;
            },
          },
        },
        { provide: StorefrontOrdersService, useValue: {} },
        { provide: OrderLifecycleService, useValue: {} },
        {
          provide: PosOrdersService,
          useValue: {
            recordCheckPayment: async (...args: unknown[]) => {
              calls.push(args);
              return { orderId, check: { id: checkId, balanceDue: '0.00' }, payments: [] };
            },
            paymentState: async (...args: unknown[]) => {
              stateCalls.push(args);
              return {
                orderId,
                revision: 3,
                total: '8.50',
                currency: 'EGP',
                status: 'pending',
                checks: [
                  {
                    id: checkId,
                    position: 0,
                    amount: '8.50',
                    paidAmount: '0.00',
                    balanceDue: '8.50',
                    revision: 1,
                    status: 'open',
                    settledAt: null,
                    payments: [],
                  },
                ],
              };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('requires an employee and records a tender on the selected order check', async () => {
    const body = {
      requestId,
      revision: 3,
      tenders: [{ method: 'cash', amount: '8.50', receivedAmount: '10.00' }],
    };
    authorized = false;
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/checks/${checkId}/payments`)
      .send(body)
      .expect(401);

    authorized = true;
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/checks/${checkId}/payments`)
      .send(body)
      .expect(201);
    assert.deepEqual(calls, [[employee, orderId, checkId, body]]);
  });

  it('requires an employee and loads payment state for an order', async () => {
    authorized = false;
    await request(app.getHttpServer()).get(`/pos/orders/${orderId}/payment-state`).expect(401);

    authorized = true;
    await request(app.getHttpServer())
      .get(`/pos/orders/${orderId}/payment-state`)
      .expect(200)
      .expect(({ body }) => {
        assert.equal(body.checks[0].balanceDue, '8.50');
      });
    assert.deepEqual(stateCalls, [[employee, orderId]]);
  });
});
