import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService, OwnerGuard, PosEmployeeGuard } from '../../src/modules/auth/index.js';
import { CashCustodyService } from '../../src/modules/shifts/cash-custody.service.js';
import {
  OwnerCashCustodyController,
  PosCashCustodyController,
} from '../../src/modules/shifts/cash-custody.controller.js';
import {
  createSafeSchema,
  transferCashSchema,
  receiveCashSchema,
  cashPageSchema,
} from '../../src/modules/shifts/cash-custody.schemas.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
describe('cash custody HTTP boundaries', () => {
  let app: INestApplication;
  let authorized = true;
  const calls: Array<{ method: string; args: unknown[] }> = [];
  beforeEach(async () => {
    authorized = true;
    calls.length = 0;
    const cash = Object.fromEntries(
      [
        'listSafes',
        'createSafe',
        'drawers',
        'listTransfers',
        'transferClosedCash',
        'receive',
        'receiveForEmployee',
        'resolve',
        'drawerLedger',
        'safeLedger',
        'safeMovement',
        'employeeBranch',
        'carryoverOptions',
      ].map((method) => [
        method,
        async (...args: unknown[]) => {
          calls.push({ method, args });
          return method === 'listSafes'
            ? {
                items: [{ id, branchId, name: 'Safe', balance: '100.00', pendingAmount: '10.00' }],
                nextCursor: null,
              }
            : { items: [], nextCursor: null };
        },
      ]),
    );
    const module = await Test.createTestingModule({
      controllers: [OwnerCashCustodyController, PosCashCustodyController],
      providers: [
        OwnerGuard,
        PosEmployeeGuard,
        { provide: CashCustodyService, useValue: cash },
        {
          provide: AuthService,
          useValue: {
            requireOwner: async () => {
              if (!authorized) throw new UnauthorizedException();
              return { merchantId, username: 'owner' };
            },
            requirePosEmployee: async () => {
              if (!authorized) throw new UnauthorizedException();
              return {
                id,
                merchantId,
                permissions: ['open_register_shift'],
                branches: [{ id: branchId, archivedAt: null }],
              };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it('uses the owner merchant and attributable actor when recording a closed-shift handoff', async () => {
    const body = {
      requestId: id,
      safeId: id,
      amount: '10.00',
      reference: 'BAG-1',
      reason: 'After closing',
    };
    await request(app.getHttpServer())
      .post(`/owner/pos/cash/shifts/${id}/transfers`)
      .send(body)
      .expect(201);
    assert.deepEqual(calls[0], {
      method: 'transferClosedCash',
      args: [merchantId, 'owner:owner', id, body],
    });
  });
  it('never exposes treasury balances through the cashier destination selector', async () => {
    const response = await request(app.getHttpServer())
      .get(`/pos/cash/safes?branchId=${branchId}`)
      .expect(200);
    assert.deepEqual(response.body.items, [{ id, branchId, name: 'Safe' }]);
    assert.equal(calls[0]?.method, 'employeeBranch');
    assert.deepEqual(calls[0]?.args.slice(1), [branchId]);
  });
  it('checks receiving permission and branch before employee receipt', async () => {
    await request(app.getHttpServer())
      .post(`/pos/cash/transfers/${id}/receive?branchId=${branchId}`)
      .send({ requestId: id, receivedAmount: '10.00' })
      .expect(201);
    assert.equal(calls[0]?.method, 'employeeBranch');
    assert.deepEqual(calls[0]?.args.slice(1), [branchId, true]);
    assert.equal(calls[1]?.method, 'receiveForEmployee');
  });
  it('rejects unauthenticated owner and employee requests', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/owner/pos/cash/drawers').expect(401);
    await request(app.getHttpServer()).get(`/pos/cash/safes?branchId=${branchId}`).expect(401);
    assert.equal(calls.length, 0);
  });
  it('rejects invalid identities and keeps list queries bounded', async () => {
    await request(app.getHttpServer()).get('/owner/pos/cash/drawers/invalid/movements').expect(400);
    assert.equal(cashPageSchema.safeParse({ limit: 51 }).success, false);
    assert.equal(cashPageSchema.safeParse({ merchantId }).success, false);
    assert.equal(
      transferCashSchema.safeParse({
        requestId: id,
        safeId: id,
        amount: '0.00',
        reference: 'A',
        reason: 'B',
      }).success,
      false,
    );
    assert.equal(
      transferCashSchema.safeParse({
        requestId: id,
        safeId: id,
        amount: '1.001',
        reference: 'A',
        reason: 'B',
      }).success,
      false,
    );
    assert.equal(
      receiveCashSchema.safeParse({ requestId: id, receivedAmount: '-1.00' }).success,
      false,
    );
    assert.equal(
      createSafeSchema.safeParse({
        requestId: id,
        branchId,
        name: 'Safe',
        openingBalance: '0.00',
        merchantId,
      }).success,
      false,
    );
  });
});
