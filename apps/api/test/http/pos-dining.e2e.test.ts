import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile, PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import { PosEmployeeGuard } from '../../src/modules/auth/pos-employee.guard.js';
import {
  OwnerPosDiningTablesController,
  PosDiningController,
  PosDiningOrdersController,
} from '../../src/modules/orders/pos-dining.controller.js';
import { PosDiningService } from '../../src/modules/orders/pos-dining.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const tableId = '44444444-4444-4444-8444-444444444444';
const sessionId = '55555555-5555-4555-8555-555555555555';
const orderId = '66666666-6666-4666-8666-666666666666';
const requestId = '77777777-7777-4777-8777-777777777777';

const owner: OwnerProfile = {
  username: 'owner',
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
  username: 'cashier',
  displayName: 'Cashier',
  role: 'cashier',
  permissions: ['sell'],
  branches: [{ id: branchId, name: 'Main', archivedAt: null }],
};

describe('POS dining endpoints', () => {
  let app: INestApplication;
  let ownerAuthorized: boolean;
  let employeeAuthorized: boolean;
  const calls: Array<{ method: string; args: unknown[] }> = [];

  beforeEach(async () => {
    ownerAuthorized = true;
    employeeAuthorized = true;
    calls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [OwnerPosDiningTablesController, PosDiningController, PosDiningOrdersController],
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
          provide: PosDiningService,
          useValue: {
            listOwnerTables: async (...args: unknown[]) => {
              calls.push({ method: 'listOwnerTables', args });
              return { items: [], nextCursor: null };
            },
            createTable: async (...args: unknown[]) => {
              calls.push({ method: 'createTable', args });
              return { id: tableId };
            },
            updateTable: async (...args: unknown[]) => {
              calls.push({ method: 'updateTable', args });
              return { id: tableId };
            },
            listTablesForEmployee: async (...args: unknown[]) => {
              calls.push({ method: 'listTablesForEmployee', args });
              return [];
            },
            listOpenSessionsForEmployee: async (...args: unknown[]) => {
              calls.push({ method: 'listOpenSessionsForEmployee', args });
              return [];
            },
            moveSession: async (...args: unknown[]) => {
              calls.push({ method: 'moveSession', args });
              return { id: sessionId };
            },
            splitOrder: async (...args: unknown[]) => {
              calls.push({ method: 'splitOrder', args });
              return { orderId };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('keeps table configuration owner-only and forwards validated branch-scoped data', async () => {
    ownerAuthorized = false;
    await request(app.getHttpServer()).get('/owner/pos/tables').expect(401);
    ownerAuthorized = true;
    await request(app.getHttpServer())
      .get(`/owner/pos/tables?branchId=${branchId}&limit=20`)
      .expect(200);
    assert.deepEqual(calls.at(-1), {
      method: 'listOwnerTables',
      args: [merchantId, { branchId, limit: 20, status: 'active' }],
    });

    const body = { branchId, code: '#01', capacity: 4 };
    await request(app.getHttpServer()).post('/owner/pos/tables').send(body).expect(201);
    assert.deepEqual(calls.at(-1), {
      method: 'createTable',
      args: [merchantId, owner.username, body],
    });
  });

  it('requires an employee session for table/session reads and validates move/split commands', async () => {
    employeeAuthorized = false;
    await request(app.getHttpServer()).get(`/pos/dining/tables?branchId=${branchId}`).expect(401);
    employeeAuthorized = true;
    await request(app.getHttpServer()).get(`/pos/dining/tables?branchId=${branchId}`).expect(200);
    assert.deepEqual(calls.at(-1), { method: 'listTablesForEmployee', args: [employee, branchId] });

    const move = { requestId, revision: 1, tableId };
    await request(app.getHttpServer())
      .post(`/pos/dining/sessions/${sessionId}/move`)
      .send(move)
      .expect(201);
    assert.deepEqual(calls.at(-1), { method: 'moveSession', args: [employee, sessionId, move] });
    await request(app.getHttpServer())
      .post(`/pos/dining/sessions/${sessionId}/move`)
      .send({ ...move, extra: true })
      .expect(400);

    const split = { requestId, revision: 1, method: 'equal', checkCount: 3 };
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/split-checks`)
      .send(split)
      .expect(201);
    assert.deepEqual(calls.at(-1), { method: 'splitOrder', args: [employee, orderId, split] });
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/split-checks`)
      .send({ ...split, checkCount: 1 })
      .expect(400);
  });
});
