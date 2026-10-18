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
  PosShiftsController,
} from '../../src/modules/shifts/shifts.controller.js';
import { ShiftsService } from '../../src/modules/shifts/shifts.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const registerId = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';

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
      controllers: [OwnerPosRegistersController, PosShiftsController],
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
          },
        },
        {
          provide: ShiftsService,
          useValue: {
            listOwnerRegisters: async (...args: unknown[]) => {
              calls.push({ method: 'listOwnerRegisters', args });
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
});
