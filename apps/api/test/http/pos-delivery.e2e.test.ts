import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { AuthService, PosEmployeeGuard } from '../../src/modules/auth/index.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ShiftsService } from '../../src/modules/shifts/shifts.service.js';
import { PosDeliveryService } from '../../src/modules/orders/delivery/pos-delivery.service.js';
import { PosDeliveryController } from '../../src/modules/orders/http/pos/pos-delivery.controller.js';

describe('delivery employee endpoints', () => {
  const merchantId = randomUUID();
  const branchId = randomUUID();
  const orderId = randomUUID();
  const employeeId = randomUUID();
  let app: INestApplication;
  let authorized = true;
  let employee: PosEmployeeSession;
  let visibleOrder = true;
  let action: { orderId: string; createdBy: string; action: string } | null = null;
  const statements: unknown[][] = [];
  beforeEach(async () => {
    authorized = true;
    visibleOrder = true;
    action = null;
    statements.length = 0;
    employee = {
      id: employeeId,
      merchantId,
      username: 'cashier',
      displayName: 'Cashier',
      role: 'cashier',
      permissions: ['sell', 'open_register_shift'],
      branches: [{ id: branchId, name: 'Main', archivedAt: null }],
    };
    const module = await Test.createTestingModule({
      controllers: [PosDeliveryController],
      providers: [
        PosEmployeeGuard,
        PosDeliveryService,
        {
          provide: AuthService,
          useValue: {
            requirePosEmployee: async () => {
              if (!authorized) throw new UnauthorizedException();
              return employee;
            },
          },
        },
        { provide: ShiftsService, useValue: {} },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: async (_strings: unknown, ...values: unknown[]) => {
              statements.push(values);
              return [];
            },
            storefrontOrder: {
              findFirst: async () => (visibleOrder ? { branchId } : null),
              findMany: async () => [],
            },
            storefrontOrderAction: { findUnique: async () => action },
            $transaction: async (callback: (tx: unknown) => unknown) =>
              callback({ storefrontOrder: { findFirst: async () => null } }),
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

  it('requires a POS session, sell access and assigned active branch', async () => {
    authorized = false;
    await request(app.getHttpServer()).get(`/pos/deliveries?branchId=${branchId}`).expect(401);
    authorized = true;
    employee = { ...employee, permissions: [] };
    await request(app.getHttpServer()).get(`/pos/deliveries?branchId=${branchId}`).expect(403);
    employee = { ...employee, permissions: ['sell'], branches: [] };
    await request(app.getHttpServer())
      .get(`/pos/deliveries/ready?branchId=${branchId}`)
      .expect(403);
    assert.equal(statements.length, 0);
  });

  it('derives the tenant from the actor and validates bounded lists and command payloads', async () => {
    await request(app.getHttpServer())
      .get(`/pos/deliveries?branchId=${branchId}&limit=25`)
      .expect(200, { items: [], nextCursor: null });
    assert.ok(statements[0]?.includes(merchantId));
    await request(app.getHttpServer())
      .get(`/pos/deliveries?branchId=${branchId}&merchantId=${randomUUID()}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/pos/deliveries?branchId=${branchId}&limit=101`)
      .expect(400);
    await request(app.getHttpServer())
      .post(`/pos/deliveries/${orderId}/actions`)
      .send({
        action: 'remit',
        requestId: randomUUID(),
        revision: 1,
        receivingShiftId: randomUUID(),
        paymentId: randomUUID(),
        amount: '0',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/pos/deliveries/not-a-uuid/actions')
      .send({})
      .expect(400);
  });

  it('does not expose another employee saved result or a foreign order', async () => {
    const requestId = randomUUID();
    action = { action: 'pos_delivery', orderId, createdBy: `pos:${employeeId}` };
    await request(app.getHttpServer())
      .get(`/pos/deliveries/${orderId}/requests/${requestId}`)
      .expect(200, { committed: true });
    action = { ...action, createdBy: `pos:${randomUUID()}` };
    await request(app.getHttpServer())
      .get(`/pos/deliveries/${orderId}/requests/${requestId}`)
      .expect(403);
    visibleOrder = false;
    await request(app.getHttpServer())
      .get(`/pos/deliveries/${orderId}/requests/${requestId}`)
      .expect(404);
  });
});
