import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile, PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import { PosEmployeeGuard } from '../../src/modules/auth/pos-employee.guard.js';
import { MerchantPosAppearanceService } from '../../src/modules/merchants/merchant-pos-appearance.service.js';
import {
  OwnerPosAppearanceController,
  PosAppearanceController,
} from '../../src/modules/merchants/pos-appearance.controller.js';

const ownerMerchantId = '11111111-1111-4111-8111-111111111111';
const employeeMerchantId = '22222222-2222-4222-8222-222222222222';
const owner: OwnerProfile = {
  username: 'owner-one',
  merchantId: ownerMerchantId,
  merchantName: 'Owner One',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner One',
  ownerMobile: '01100000000',
  firstMonthActivatedAt: '2026-10-20T00:00:00.000Z',
};
const employee: PosEmployeeSession = {
  id: '33333333-3333-4333-8333-333333333333',
  merchantId: employeeMerchantId,
  username: 'cashier-one',
  displayName: 'Cashier One',
  role: 'cashier',
  permissions: ['sell'],
  branches: [],
};

describe('POS appearance endpoints', () => {
  let app: INestApplication;
  let ownerAuthorized: boolean;
  let employeeAuthorized: boolean;
  const calls: Array<{ method: string; args: unknown[] }> = [];

  beforeEach(async () => {
    ownerAuthorized = true;
    employeeAuthorized = true;
    calls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [OwnerPosAppearanceController, PosAppearanceController],
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
          provide: MerchantPosAppearanceService,
          useValue: {
            get: async (...args: unknown[]) => {
              calls.push({ method: 'get', args });
              return { accent: 'orange', revision: 1, updatedAt: '2026-10-20T00:00:00.000Z' };
            },
            update: async (...args: unknown[]) => {
              calls.push({ method: 'update', args });
              return { accent: 'teal', revision: 2, updatedAt: '2026-10-20T00:01:00.000Z' };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('scopes owner writes and POS reads to the authenticated merchant', async () => {
    await request(app.getHttpServer())
      .get('/owner/merchant/pos-appearance')
      .expect(200)
      .expect({ accent: 'orange', revision: 1, updatedAt: '2026-10-20T00:00:00.000Z' });
    await request(app.getHttpServer())
      .patch('/owner/merchant/pos-appearance')
      .send({ accent: 'teal', revision: 1 })
      .expect(200)
      .expect({ accent: 'teal', revision: 2, updatedAt: '2026-10-20T00:01:00.000Z' });
    await request(app.getHttpServer())
      .get('/pos/appearance')
      .expect(200)
      .expect({ accent: 'orange', revision: 1, updatedAt: '2026-10-20T00:00:00.000Z' });

    assert.deepEqual(calls, [
      { method: 'get', args: [ownerMerchantId] },
      {
        method: 'update',
        args: [ownerMerchantId, owner.username, { accent: 'teal', revision: 1 }],
      },
      { method: 'get', args: [employeeMerchantId] },
    ]);
  });

  it('rejects unsupported accents and requires the matching authenticated session', async () => {
    await request(app.getHttpServer())
      .patch('/owner/merchant/pos-appearance')
      .send({ accent: '#ff0000', revision: 1 })
      .expect(400);
    assert.equal(calls.length, 0);

    ownerAuthorized = false;
    await request(app.getHttpServer()).get('/owner/merchant/pos-appearance').expect(401);
    employeeAuthorized = false;
    await request(app.getHttpServer()).get('/pos/appearance').expect(401);
    assert.equal(calls.length, 0);
  });
});
