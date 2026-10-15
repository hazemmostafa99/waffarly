import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile, SaveMerchantStorefrontRequest } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AppConfiguration } from '../../src/config/app-configuration.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AuthService } from '../../src/modules/auth/index.js';
import { PlanService } from '../../src/modules/plans/plan.service.js';
import { StorefrontService } from '../../src/modules/storefront/storefront.service.js';

const owner: OwnerProfile = {
  username: 'owner',
  merchantId: '11111111-1111-4111-8111-111111111111',
  merchantName: 'Merchant',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner',
  ownerMobile: '01000000001',
  firstMonthActivatedAt: '2026-10-01T00:00:00.000Z',
};
const input: SaveMerchantStorefrontRequest = {
  templateId: '22222222-2222-4222-8222-222222222222',
  accentColor: '#ABCDEF',
  logoData: null,
  revision: 0,
};

describe('feature modules and authenticated request actors', () => {
  let app: INestApplication;
  let authorized: boolean;
  let ownerLookups: number;
  let adminLookups: number;
  let calls: Array<{ merchantId: string; input?: SaveMerchantStorefrontRequest }>;

  beforeEach(async () => {
    authorized = true;
    ownerLookups = 0;
    adminLookups = 0;
    calls = [];
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AppConfiguration)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AuthService)
      .useValue({
        requireOwner: async () => {
          ownerLookups++;
          if (!authorized) throw new UnauthorizedException();
          return owner;
        },
        requireAdmin: async () => {
          adminLookups++;
          if (!authorized) throw new UnauthorizedException();
          return 'admin';
        },
      })
      .overrideProvider(StorefrontService)
      .useValue({
        getSettings: async (merchantId: string) => {
          calls.push({ merchantId });
          return { merchantId, templateId: null, revision: 0, templates: [] };
        },
        saveSettings: async (merchantId: string, settings: SaveMerchantStorefrontRequest) => {
          calls.push({ merchantId, input: settings });
          return { merchantId, ...settings, revision: 1, templates: [] };
        },
      })
      .overrideProvider(PlanService)
      .useValue({
        create: async (settings: unknown, actor: string) => ({ actor, settings }),
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('keeps the settings URL and resolves the owner once before reading the tenant', async () => {
    const response = await request(app.getHttpServer()).get('/auth/owner/storefront').expect(200);
    assert.equal(response.body.merchantId, owner.merchantId);
    assert.equal(ownerLookups, 1);
    assert.deepEqual(calls, [{ merchantId: owner.merchantId }]);
  });

  it('preserves normalized settings and obtains the tenant from the guard', async () => {
    await request(app.getHttpServer()).patch('/auth/owner/storefront').send(input).expect(200);
    assert.equal(ownerLookups, 1);
    assert.deepEqual(calls, [
      { merchantId: owner.merchantId, input: { ...input, accentColor: '#abcdef' } },
    ]);
  });

  it('rejects anonymous reads and writes before invoking the feature', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/auth/owner/storefront').expect(401);
    await request(app.getHttpServer()).patch('/auth/owner/storefront').send(input).expect(401);
    assert.deepEqual(calls, []);
  });

  it('preserves string validation messages and rejects tenant injection', async () => {
    const response = await request(app.getHttpServer())
      .patch('/auth/owner/storefront')
      .send({ ...input, accentColor: 'red', merchantId: 'another-merchant' })
      .expect(400);
    assert.ok(Array.isArray(response.body.message));
    assert.ok(response.body.message.every((message: unknown) => typeof message === 'string'));
    assert.ok(response.body.message.some((message: string) => message.startsWith('accentColor:')));
    assert.deepEqual(calls, []);
  });

  it('passes the authenticated administrator to another feature with one lookup', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/plans')
      .send({
        requestId: '33333333-3333-4333-8333-333333333333',
        name: 'Monthly',
        monthlyPrice: '10.5',
        currency: 'EGP',
        billingInterval: 'monthly',
      })
      .expect(201);
    assert.equal(adminLookups, 1);
    assert.equal(response.body.actor, 'admin');
    assert.equal(response.body.settings.monthlyPrice, '10.50');
  });
});
