import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { PosEmployeeGuard } from '../../src/modules/auth/pos-employee.guard.js';
import { PosOrdersService } from '../../src/modules/orders/pos-orders.service.js';
import { PosReturnsService } from '../../src/modules/orders/pos-returns.service.js';
import { PosKitchenService } from '../../src/modules/orders/pos-kitchen.service.js';
import { PosStorefrontOrdersController } from '../../src/modules/orders/storefront-orders.controller.js';
import { PosReceiptsController } from '../../src/modules/orders/pos-receipts.controller.js';
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
  let canPrepare: boolean;
  let canSell: boolean;
  const calls: unknown[][] = [];
  const stateCalls: unknown[][] = [];
  const detailCalls: unknown[][] = [];
  const salesCalls: unknown[][] = [];
  const receiptCalls: unknown[][] = [];
  const receiptListCalls: unknown[][] = [];
  const kitchenCalls: unknown[][] = [];
  const readyCalls: unknown[][] = [];
  const handoverCalls: unknown[][] = [];

  beforeEach(async () => {
    authorized = true;
    canPrepare = false;
    canSell = true;
    calls.length = 0;
    stateCalls.length = 0;
    detailCalls.length = 0;
    salesCalls.length = 0;
    receiptCalls.length = 0;
    receiptListCalls.length = 0;
    kitchenCalls.length = 0;
    readyCalls.length = 0;
    handoverCalls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [PosStorefrontOrdersController, PosReceiptsController],
      providers: [
        PosEmployeeGuard,
        {
          provide: AuthService,
          useValue: {
            requirePosEmployee: async () => {
              if (!authorized) throw new UnauthorizedException();
              return {
                ...employee,
                permissions: [
                  ...(canSell ? ['sell' as const] : []),
                  ...(canPrepare ? ['start_preparation' as const] : []),
                ],
              };
            },
          },
        },
        { provide: StorefrontOrdersService, useValue: {} },
        {
          provide: PosReturnsService,
          useValue: {
            state: async () => ({ orderId, eligible: false, items: [], returns: [] }),
            record: async () => ({ orderId }),
          },
        },
        {
          provide: OrderLifecycleService,
          useValue: {
            markReadyFromPos: async (...args: unknown[]) => {
              readyCalls.push(args);
              return { id: orderId, status: 'ready' };
            },
            handoverFromPos: async (...args: unknown[]) => {
              handoverCalls.push(args);
              return { id: orderId, status: 'completed' };
            },
          },
        },
        {
          provide: PosKitchenService,
          useValue: {
            dispatchDineInOrder: async (...args: unknown[]) => {
              kitchenCalls.push(args);
              return { id: orderId, kitchenTicket: { dispatchMode: 'manual' } };
            },
          },
        },
        {
          provide: PosOrdersService,
          useValue: {
            listActiveSales: async (...args: unknown[]) => {
              salesCalls.push(args);
              return { items: [], nextCursor: null };
            },
            detail: async (...args: unknown[]) => {
              detailCalls.push(args);
              return { id: orderId, total: '8.50', lines: [] };
            },
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
            getCheckReceipt: async (...args: unknown[]) => {
              receiptCalls.push(args);
              return {
                version: 1,
                id: 'receipt-id',
                receiptNumber: 'POS-AB12CD34EF56AB78',
                issuedAt: '2026-10-18T10:00:00.000Z',
                merchantName: 'Test Merchant',
                branchName: 'Main',
                orderId,
                orderReference: 'ORD-44444444',
                orderCreatedAt: '2026-10-18T09:50:00.000Z',
                fulfillmentType: 'takeaway',
                tableCode: null,
                cashierName: 'Cashier',
                registerName: 'Front counter',
                currency: 'EGP',
                checkNumber: 1,
                splitMethod: 'whole',
                amount: '8.50',
                items: [],
                payments: [],
                paidAmount: '8.50',
                cashReceivedAmount: '8.50',
                changeAmount: '0.00',
              };
            },
            listReceipts: async (...args: unknown[]) => {
              receiptListCalls.push(args);
              return {
                items: [
                  {
                    id: 'receipt-id',
                    receiptNumber: 'POS-AB12CD34EF56AB78',
                    issuedAt: '2026-10-18T10:00:00.000Z',
                    orderId,
                    checkId,
                    orderReference: 'ORD-44444444',
                    checkNumber: 1,
                    amount: '8.50',
                    currency: 'EGP',
                  },
                ],
                nextCursor: null,
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

  it('passes a manual kitchen dispatch through the authenticated POS order route', async () => {
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/kitchen-dispatch`)
      .send({ requestId })
      .expect(200, { id: orderId, kitchenTicket: { dispatchMode: 'manual' } });
    assert.deepEqual(kitchenCalls, [[employee, orderId, { requestId }]]);
  });

  it('requires preparation permission before marking a POS kitchen order ready', async () => {
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/ready`)
      .send({ requestId })
      .expect(403);
    assert.equal(readyCalls.length, 0);

    canPrepare = true;
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/ready`)
      .send({ requestId })
      .expect(200, { id: orderId, status: 'ready' });
    assert.deepEqual(readyCalls, [
      [merchantId, `pos:${employeeId}`, orderId, { requestId }, [branchId]],
    ]);
  });

  it('requires sell permission and records an idempotent POS handover command', async () => {
    const body = { requestId };
    canSell = false;
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/handover`)
      .send(body)
      .expect(403);
    assert.equal(handoverCalls.length, 0);

    canSell = true;
    authorized = false;
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/handover`)
      .send(body)
      .expect(401);

    authorized = true;
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/handover`)
      .send(body)
      .expect(200, { id: orderId, status: 'completed' });
    assert.deepEqual(handoverCalls, [[merchantId, `pos:${employeeId}`, orderId, body, [branchId]]]);
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

  it('authenticates and validates a committed order detail read', async () => {
    authorized = false;
    await request(app.getHttpServer()).get(`/pos/orders/${orderId}`).expect(401);
    authorized = true;
    await request(app.getHttpServer()).get('/pos/orders/not-a-uuid').expect(400);
    await request(app.getHttpServer())
      .get(`/pos/orders/${orderId}`)
      .expect(200)
      .expect(({ body }) => assert.equal(body.id, orderId));
    assert.deepEqual(detailCalls, [[employee, orderId]]);
    assert.equal(calls.length, 0);
  });

  it('validates and routes bounded sales recovery before the order ID route', async () => {
    authorized = false;
    await request(app.getHttpServer())
      .get(`/pos/orders/active-sales?branchId=${branchId}`)
      .expect(401);
    authorized = true;
    await request(app.getHttpServer())
      .get(`/pos/orders/active-sales?branchId=${branchId}&limit=101`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/pos/orders/active-sales?branchId=${branchId}&mode=history&search=42&limit=25`)
      .expect(200);
    assert.deepEqual(salesCalls, [
      [employee, { branchId, mode: 'history', search: '42', limit: 25 }],
    ]);
  });

  it('requires an employee and loads the immutable receipt for a settled check', async () => {
    authorized = false;
    await request(app.getHttpServer())
      .get(`/pos/orders/${orderId}/checks/${checkId}/receipt`)
      .expect(401);

    authorized = true;
    await request(app.getHttpServer())
      .get(`/pos/orders/${orderId}/checks/${checkId}/receipt`)
      .expect(200)
      .expect(({ body }) => {
        assert.equal(body.receiptNumber, 'POS-AB12CD34EF56AB78');
        assert.equal(body.amount, '8.50');
      });
    assert.deepEqual(receiptCalls, [[employee, orderId, checkId]]);
  });

  it('requires an employee and lists recent receipts for the selected branch', async () => {
    authorized = false;
    await request(app.getHttpServer()).get(`/pos/receipts?branchId=${branchId}`).expect(401);

    authorized = true;
    await request(app.getHttpServer())
      .get(`/pos/receipts?branchId=${branchId}&limit=10`)
      .expect(200)
      .expect(({ body }) => {
        assert.equal(body.items[0].receiptNumber, 'POS-AB12CD34EF56AB78');
        assert.equal(body.nextCursor, null);
      });
    assert.deepEqual(receiptListCalls, [[employee, { branchId, limit: 10 }]]);
  });
});
