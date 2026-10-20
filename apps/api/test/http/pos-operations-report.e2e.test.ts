import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import { PosOperationsReportController } from '../../src/modules/reports/pos-operations-report.controller.js';
import { PosOperationsReportService } from '../../src/modules/reports/pos-operations-report.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const owner: OwnerProfile = {
  username: 'owner',
  merchantId,
  merchantName: 'Cafe',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner',
  ownerMobile: '01100000000',
  firstMonthActivatedAt: '2026-01-01T00:00:00.000Z',
};

describe('owner POS operations report endpoint', () => {
  let app: INestApplication;
  let ownerAuthorized = true;
  const calls: unknown[][] = [];

  beforeEach(async () => {
    ownerAuthorized = true;
    calls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [PosOperationsReportController],
      providers: [
        OwnerGuard,
        {
          provide: AuthService,
          useValue: {
            requireOwner: async () => {
              if (!ownerAuthorized) throw new UnauthorizedException();
              return owner;
            },
          },
        },
        {
          provide: PosOperationsReportService,
          useValue: {
            get: async (...args: unknown[]) => {
              calls.push(args);
              return { orders: { placedCount: 0 } };
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

  it('requires owner authentication and derives the tenant from the owner session', async () => {
    const from = '2026-10-01T00:00:00.000Z';
    const to = '2026-10-20T00:00:00.000Z';
    ownerAuthorized = false;
    await request(app.getHttpServer())
      .get('/owner/pos/reports/operations')
      .query({ from, to })
      .expect(401);
    assert.equal(calls.length, 0);

    ownerAuthorized = true;
    await request(app.getHttpServer())
      .get('/owner/pos/reports/operations')
      .query({ from, to, branchId })
      .expect(200);
    assert.deepEqual(calls, [[merchantId, { from, to, branchId }]]);

    await request(app.getHttpServer())
      .get('/owner/pos/reports/operations')
      .query({ from, to, merchantId })
      .expect(400);
    await request(app.getHttpServer())
      .get('/owner/pos/reports/operations')
      .query({ from: to, to: from })
      .expect(400);
    await request(app.getHttpServer())
      .get('/owner/pos/reports/operations')
      .query({ from, to: '2027-02-01T00:00:00.000Z' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/owner/pos/reports/operations')
      .query({ from, to, branchId: 'not-a-uuid' })
      .expect(400);
    assert.equal(calls.length, 1);
  });
});
