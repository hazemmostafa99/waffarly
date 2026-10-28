import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile, UpdateMerchantAccountRequest } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AppConfiguration } from '../../src/config/app-configuration.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AuthService } from '../../src/modules/auth/index.js';
import { MerchantAccountService } from '../../src/modules/merchants/merchant-account.service.js';

const owner: OwnerProfile = {
  username: 'account-owner',
  merchantId: '11111111-1111-4111-8111-111111111111',
  merchantName: 'Account merchant',
  ownerName: 'Owner',
  contactPhone: '01000000000',
  ownerMobile: '01100000000',
  firstMonthActivatedAt: null,
  subscriptionStatus: 'pending',
};
const input: UpdateMerchantAccountRequest = {
  merchantName: ' Updated merchant ',
  ownerName: ' Updated owner ',
  contactPhone: ' 01012345678 ',
  ownerMobile: ' 01112345678 ',
  revision: 1,
};

describe('merchant account HTTP contract', () => {
  let app: INestApplication;
  let authorized: boolean;
  let lookups: number;
  let calls: unknown[];

  beforeEach(async () => {
    authorized = true;
    lookups = 0;
    calls = [];
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AppConfiguration)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AuthService)
      .useValue({
        requireOwner: async () => {
          lookups++;
          if (!authorized) throw new UnauthorizedException();
          return owner;
        },
      })
      .overrideProvider(MerchantAccountService)
      .useValue({
        get: async (merchantId: string) => {
          calls.push({ merchantId });
          return { merchantId };
        },
        update: async (merchantId: string, actor: string, data: UpdateMerchantAccountRequest) => {
          calls.push({ merchantId, actor, data });
          return data;
        },
        history: async (merchantId: string, cursor?: string) => {
          calls.push({ merchantId, cursor });
          return { items: [], nextCursor: null };
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('resolves the authenticated tenant once for reads, including inactive owners', async () => {
    await request(app.getHttpServer()).get('/owner/account').expect(200);
    assert.equal(lookups, 1);
    assert.deepEqual(calls, [{ merchantId: owner.merchantId }]);
  });

  it('normalizes editable fields and attributes changes to the authenticated owner', async () => {
    await request(app.getHttpServer()).patch('/owner/account').send(input).expect(200);
    assert.equal(lookups, 1);
    assert.deepEqual(calls, [
      {
        merchantId: owner.merchantId,
        actor: owner.username,
        data: {
          merchantName: 'Updated merchant',
          ownerName: 'Updated owner',
          contactPhone: '01012345678',
          ownerMobile: '01112345678',
          revision: 1,
        },
      },
    ]);
  });

  it('rejects anonymous reads, history and writes before invoking account services', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/owner/account').expect(401);
    await request(app.getHttpServer()).get('/owner/account/subscription/periods').expect(401);
    await request(app.getHttpServer()).patch('/owner/account').send(input).expect(401);
    assert.deepEqual(calls, []);
  });

  it('rejects tenant, slug, username and subscription injection as well as invalid revisions', async () => {
    for (const extra of [
      { merchantId: 'another-merchant' },
      { storefrontSlug: 'changed' },
      { username: 'changed' },
      { subscriptionStatus: 'active' },
      { revision: 0 },
      { ownerName: ' ' },
    ]) {
      await request(app.getHttpServer())
        .patch('/owner/account')
        .send({ ...input, ...extra })
        .expect(400);
    }
    assert.deepEqual(calls, []);
  });

  it('allows only a validated history cursor and always derives the tenant from authentication', async () => {
    const cursor = '22222222-2222-4222-8222-222222222222';
    await request(app.getHttpServer())
      .get(`/owner/account/subscription/periods?cursor=${cursor}`)
      .expect(200);
    assert.deepEqual(calls, [{ merchantId: owner.merchantId, cursor }]);
    await request(app.getHttpServer())
      .get('/owner/account/subscription/periods?cursor=invalid')
      .expect(400);
    await request(app.getHttpServer())
      .get(`/owner/account/subscription/periods?merchantId=${cursor}`)
      .expect(400);
    assert.equal(calls.length, 1);
  });
});
