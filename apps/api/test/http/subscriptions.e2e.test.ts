import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, it } from 'node:test';
import request from 'supertest';
import { SubscriptionsController } from '../../src/modules/plans/subscriptions.controller.js';
import { SubscriptionService } from '../../src/modules/subscriptions/subscription.service.js';
import { AdminGuard, AuthService } from '../../src/modules/auth/index.js';

describe('subscription administration HTTP boundaries', () => {
  let app: INestApplication;
  let called: unknown;
  const merchantId = randomUUID();
  beforeEach(async () => {
    called = undefined;
    const module = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        AdminGuard,
        {
          provide: AuthService,
          useValue: {
            requireAdmin: async (req: Request) => {
              if (req.headers['x-test-admin'] !== 'yes') throw new UnauthorizedException();
              return 'subscription-admin';
            },
          },
        },
        {
          provide: SubscriptionService,
          useValue: {
            list: async (query: unknown) => {
              called = query;
              return { items: [], nextCursor: null };
            },
            dashboard: async () => ({ counts: {} }),
            detail: async (id: string) => ({ merchantId: id }),
            history: async (...args: unknown[]) => {
              called = args;
              return { items: [], nextCursor: null };
            },
            quote: async (...args: unknown[]) => {
              called = args;
              return { due: '100.00' };
            },
            command: async (...args: unknown[]) => {
              called = args;
              return { merchantId };
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
  it('requires Super Admin access for reads, quotes, history and actions', async () => {
    for (const path of [
      '/admin/subscriptions',
      '/admin/subscriptions/dashboard',
      `/admin/subscriptions/${merchantId}`,
      `/admin/subscriptions/${merchantId}/history/events`,
    ])
      await request(app.getHttpServer()).get(path).expect(401);
    for (const suffix of ['quote', 'actions'])
      await request(app.getHttpServer())
        .post(`/admin/subscriptions/${merchantId}/${suffix}`)
        .send({})
        .expect(401);
    assert.equal(called, undefined);
  });
  it('validates durations, money, reasons, revisions and tenant-free actions', async () => {
    const base = {
      requestId: randomUUID(),
      revision: 1,
      reason: 'Receipt 123',
      action: 'activate',
      planId: randomUUID(),
      months: 6,
      planRevision: 1,
      expectedDue: '100.00',
      externalCollectionConfirmed: true,
    };
    for (const invalid of [
      { months: 2 },
      { months: 36 },
      { expectedDue: 100 },
      { expectedDue: '-1.00' },
      { externalCollectionConfirmed: false },
      { reason: ' ' },
      { revision: 0 },
      { merchantId: randomUUID() },
      { action: 'delete' },
    ]) {
      await request(app.getHttpServer())
        .post(`/admin/subscriptions/${merchantId}/actions`)
        .set('x-test-admin', 'yes')
        .send({ ...base, ...invalid })
        .expect(400);
    }
    assert.equal(called, undefined);
    await request(app.getHttpServer())
      .post(`/admin/subscriptions/${merchantId}/actions`)
      .set('x-test-admin', 'yes')
      .send(base)
      .expect(200);
    assert.deepEqual(called, [merchantId, base, 'subscription-admin']);
  });
  it('keeps queries bounded and validates cursor, quote and history routes', async () => {
    await request(app.getHttpServer())
      .get('/admin/subscriptions?status=expired&q=Shop&expiring=true')
      .set('x-test-admin', 'yes')
      .expect(200);
    assert.deepEqual(called, { status: 'expired', q: 'Shop', expiring: true });
    for (const query of ['limit=999999', 'status=unknown', 'cursor=bad', 'planId=bad'])
      await request(app.getHttpServer())
        .get(`/admin/subscriptions?${query}`)
        .set('x-test-admin', 'yes')
        .expect(400);
    await request(app.getHttpServer())
      .post(`/admin/subscriptions/${merchantId}/quote`)
      .set('x-test-admin', 'yes')
      .send({ action: 'renew', planId: randomUUID(), months: 24 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/admin/subscriptions/${merchantId}/quote`)
      .set('x-test-admin', 'yes')
      .send({ action: 'renew', planId: randomUUID(), months: 2 })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/admin/subscriptions/${merchantId}/history/delete`)
      .set('x-test-admin', 'yes')
      .expect(400);
  });
});
