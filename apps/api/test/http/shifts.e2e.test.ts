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
  OwnerPosRegistersController,
  OwnerPosShiftReportsController,
  PosShiftsController,
} from '../../src/modules/shifts/shifts.controller.js';
import { ShiftsService } from '../../src/modules/shifts/shifts.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const registerId = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
const shiftId = '66666666-6666-4666-8666-666666666666';
const supervisorId = '77777777-7777-4777-8777-777777777777';

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
  permissions: ['accept_recipe_orders', 'open_register_shift', 'sell', 'start_preparation'],
  branches: [{ id: branchId, name: 'Main', archivedAt: null }],
};

describe('POS register and shift endpoints', () => {
  let app: INestApplication;
  let ownerAuthorized: boolean;
  let employeeAuthorized: boolean;
  let currentEmployee: PosEmployeeSession;
  const calls: Array<{ method: string; args: unknown[] }> = [];

  beforeEach(async () => {
    ownerAuthorized = true;
    employeeAuthorized = true;
    currentEmployee = employee;
    calls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [OwnerPosRegistersController, OwnerPosShiftReportsController, PosShiftsController],
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
              return currentEmployee;
            },
            verifyPosEmployeeApproval: async (...args: unknown[]) => {
              calls.push({ method: 'verifyPosEmployeeApproval', args });
              return supervisorId;
            },
          },
        },
        {
          provide: ShiftsService,
          useValue: {
            listOwnerRegisters: async (...args: unknown[]) => {
              calls.push({ method: 'listOwnerRegisters', args });
              return { items: [], nextCursor: null };
            },
            listOwnerCloseReports: async (...args: unknown[]) => {
              calls.push({ method: 'listOwnerCloseReports', args });
              return { items: [], nextCursor: null };
            },
            createRegister: async (...args: unknown[]) => {
              calls.push({ method: 'createRegister', args });
              return { id: registerId, branchId, name: 'Front' };
            },
            updateRegister: async (...args: unknown[]) => {
              calls.push({ method: 'updateRegister', args });
              return { id: registerId, branchId, name: 'Front' };
            },
            listForEmployee: async (...args: unknown[]) => {
              calls.push({ method: 'listForEmployee', args });
              return [];
            },
            getCurrentShift: async (...args: unknown[]) => {
              calls.push({ method: 'getCurrentShift', args });
              return null;
            },
            getShiftBranch: async (...args: unknown[]) => {
              calls.push({ method: 'getShiftBranch', args });
              return branchId;
            },
            getReconciliation: async (...args: unknown[]) => {
              calls.push({ method: 'getReconciliation', args });
              return { shiftId, branchId, unsettledCheckCount: 0 };
            },
            previewCloseShift: async (...args: unknown[]) => {
              calls.push({ method: 'previewCloseShift', args });
              return { unsettledCheckCount: 0, requiresReason: false, requiresSupervisorApproval: true };
            },
            getLatestCloseReport: async (...args: unknown[]) => {
              calls.push({ method: 'getLatestCloseReport', args });
              return null;
            },
            getCloseReport: async (...args: unknown[]) => {
              calls.push({ method: 'getCloseReport', args });
              return { shiftId, variance: '0.00' };
            },
            recordManualCashMovement: async (...args: unknown[]) => {
              calls.push({ method: 'recordManualCashMovement', args });
              return { shiftId, movement: {}, reconciliation: {} };
            },
            closeShift: async (...args: unknown[]) => {
              calls.push({ method: 'closeShift', args });
              return { shiftId, variance: '0.00' };
            },
            openShift: async (...args: unknown[]) => {
              calls.push({ method: 'openShift', args });
              return { id: '66666666-6666-4666-8666-666666666666', status: 'open' };
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

  it('requires owner auth and derives the register tenant and actor from the session', async () => {
    ownerAuthorized = false;
    await request(app.getHttpServer()).get('/owner/pos/registers').expect(401);
    assert.equal(calls.length, 0);

    ownerAuthorized = true;
    await request(app.getHttpServer())
      .post('/owner/pos/registers')
      .send({ branchId, name: 'Front' })
      .expect(201);
    assert.deepEqual(calls.at(-1), {
      method: 'createRegister',
      args: [merchantId, owner.username, { branchId, name: 'Front' }],
    });

    await request(app.getHttpServer())
      .post('/owner/pos/registers')
      .send({ merchantId, branchId, name: 'Injected tenant' })
      .expect(400);
    assert.equal(calls.length, 1);
  });

  it('authorizes owner shift reports, validates bounded filters, and derives tenant from the owner session', async () => {
    const from = '2026-10-01T00:00:00.000Z';
    const to = '2026-10-20T00:00:00.000Z';
    ownerAuthorized = false;
    await request(app.getHttpServer())
      .get('/owner/pos/shifts/reports')
      .query({ from, to })
      .expect(401);
    assert.equal(calls.length, 0);

    ownerAuthorized = true;
    await request(app.getHttpServer())
      .get('/owner/pos/shifts/reports')
      .query({ from, to, branchId, limit: '50' })
      .expect(200);
    assert.deepEqual(calls.at(-1), {
      method: 'listOwnerCloseReports',
      args: [merchantId, { from, to, branchId, limit: 50 }],
    });

    await request(app.getHttpServer())
      .get('/owner/pos/shifts/reports')
      .query({ from, to, merchantId })
      .expect(400);
    await request(app.getHttpServer())
      .get('/owner/pos/shifts/reports')
      .query({ from, to: '2026-10-01T00:00:00.000Z' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/owner/pos/shifts/reports')
      .query({ from: '2026-01-01T00:00:00.000Z', to: '2026-10-20T00:00:00.000Z' })
      .expect(400);
    assert.equal(calls.length, 1);
  });

  it('requires an authenticated POS employee and the explicit register-shift grant', async () => {
    employeeAuthorized = false;
    await request(app.getHttpServer()).get('/pos/registers').query({ branchId }).expect(401);

    employeeAuthorized = true;
    currentEmployee = { ...employee, role: null, permissions: ['accept_recipe_orders'] };
    await request(app.getHttpServer()).get('/pos/registers').query({ branchId }).expect(403);
    assert.equal(calls.length, 0);
  });

  it('validates branch/register query boundaries before calling the shifts service', async () => {
    await request(app.getHttpServer()).get('/pos/registers').expect(400);
    await request(app.getHttpServer())
      .get('/pos/registers')
      .query({ merchantId, branchId })
      .expect(400);
    assert.equal(calls.length, 0);
  });

  it('rejects malformed opening amounts and forwards the exact employee-scoped request', async () => {
    await request(app.getHttpServer())
      .post('/pos/shifts/open')
      .send({ registerId, requestId, openingFloat: '-1' })
      .expect(400);
    assert.equal(calls.length, 0);

    await request(app.getHttpServer())
      .post('/pos/shifts/open')
      .send({ registerId, requestId, openingFloat: '125.50' })
      .expect(201);
    assert.deepEqual(calls.at(-1), {
      method: 'openShift',
      args: [employee, { registerId, requestId, openingFloat: '125.50' }],
    });
  });

  it('rejects caller-supplied tenant identity on POS shift commands', async () => {
    await request(app.getHttpServer())
      .post('/pos/shifts/open')
      .send({ merchantId, registerId, requestId, openingFloat: '10' })
      .expect(400);
    assert.equal(calls.length, 0);
  });

  it('scopes reconciliation and verifies supervisor credentials before cash adjustments', async () => {
    await request(app.getHttpServer())
      .get(`/pos/shifts/${shiftId}/reconciliation`)
      .expect(200);
    assert.deepEqual(calls.at(-1), { method: 'getReconciliation', args: [employee, shiftId] });

    const body = {
      requestId,
      kind: 'cash_in',
      amount: '10.00',
      reason: 'Change float',
      approval: { username: 'shift-supervisor', password: 'secret' },
    };
    await request(app.getHttpServer())
      .post(`/pos/shifts/${shiftId}/cash-movements`)
      .send(body)
      .expect(201);
    assert.deepEqual(calls.at(-3), { method: 'getShiftBranch', args: [employee, shiftId] });
    assert.deepEqual(calls.at(-2), {
      method: 'verifyPosEmployeeApproval',
      args: [{
        merchantId,
        branchId,
        actingEmployeeId: employeeId,
        username: 'shift-supervisor',
        password: 'secret',
        permission: 'manage_cash_movements',
      }],
    });
    assert.deepEqual(calls.at(-1), {
      method: 'recordManualCashMovement',
      args: [employee, shiftId, body, supervisorId],
    });
    assert.equal(JSON.stringify(calls.at(-1)).includes('secret'), true);

    await request(app.getHttpServer())
      .post(`/pos/shifts/${shiftId}/cash-movements`)
      .send({ ...body, requestId: 'not-a-uuid' })
      .expect(400);
  });

  it('requires a cash-drop reference and preserves it while verifying cashier approval', async () => {
    const body = {
      requestId,
      kind: 'cash_drop',
      amount: '250.00',
      reason: 'Evening safe drop',
      dropReference: 'SAFE-BAG-1042',
      approval: { username: 'shift-supervisor', password: 'secret' },
    };
    await request(app.getHttpServer())
      .post(`/pos/shifts/${shiftId}/cash-movements`)
      .send({ ...body, dropReference: undefined })
      .expect(400);
    assert.equal(calls.length, 0);

    await request(app.getHttpServer())
      .post(`/pos/shifts/${shiftId}/cash-movements`)
      .send(body)
      .expect(201);
    assert.equal(calls.at(-2)?.method, 'verifyPosEmployeeApproval');
    assert.equal(calls.at(-1)?.method, 'recordManualCashMovement');
    assert.deepEqual(calls.at(-1)?.args, [employee, shiftId, body, supervisorId]);
  });

  it('allows exact shift-close retry after the shift is already closed and checks close approval', async () => {
    const body = {
      requestId,
      countedCash: '101.00',
      reason: 'One pound variance',
      approval: { username: 'shift-supervisor', password: 'secret' },
    };
    await request(app.getHttpServer())
      .post(`/pos/shifts/${shiftId}/close`)
      .send(body)
      .expect(201);
    assert.deepEqual(calls.at(-3), { method: 'getShiftBranch', args: [employee, shiftId] });
    assert.equal(calls.at(-2)?.method, 'verifyPosEmployeeApproval');
    assert.deepEqual(calls.at(-1), {
      method: 'closeShift',
      args: [employee, shiftId, body, supervisorId],
    });
  });

  it('previews a blind close without returning expected drawer totals', async () => {
    const body = { countedCash: '100.00', reason: 'Count complete' };
    const response = await request(app.getHttpServer())
      .post(`/pos/shifts/${shiftId}/close-preview`)
      .send(body)
      .expect(201);
    assert.deepEqual(calls.at(-1), {
      method: 'previewCloseShift',
      args: [employee, shiftId, body],
    });
    assert.deepEqual(response.body, {
      unsettledCheckCount: 0,
      requiresReason: false,
      requiresSupervisorApproval: true,
    });
    assert.equal('expectedCash' in response.body, false);

    await request(app.getHttpServer())
      .post(`/pos/shifts/${shiftId}/close-preview`)
      .send({ countedCash: '100.00', expectedCash: '100.00' })
      .expect(400);
  });
});
