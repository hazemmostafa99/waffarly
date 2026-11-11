import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AdminGuard } from '../../src/modules/auth/admin.guard.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { MerchantController } from '../../src/modules/merchants/merchant.controller.js';
import { PublicStorefrontAddressController } from '../../src/modules/merchants/public-storefront-address.controller.js';
import { MerchantService } from '../../src/modules/merchants/merchant.service.js';

describe('merchant storefront handles HTTP boundaries', () => {
  let app: INestApplication;
  let authorized: boolean;
  let calls: unknown[];
  const id = '11111111-1111-4111-8111-111111111111';
  beforeEach(async () => {
    authorized = true;
    calls = [];
    const module = await Test.createTestingModule({
      controllers: [MerchantController, PublicStorefrontAddressController],
      providers: [
        AdminGuard,
        {
          provide: AuthService,
          useValue: {
            requireAdmin: async () => {
              if (!authorized) throw new UnauthorizedException();
              return 'test-administrator';
            },
          },
        },
        {
          provide: MerchantService,
          useValue: {
            assignStorefrontHandle: async (...args: unknown[]) => {
              calls.push(args);
              return { storefrontHandle: args[1] };
            },
            create: async (...args: unknown[]) => {
              calls.push(args);
              return { created: true };
            },
            resolveStorefrontHandle: async (handle: string) => ({
              handle,
              storefrontSlug: 'technical-store-code',
            }),
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

  it('normalizes a handle and attributes assignment to the authenticated admin', async () => {
    await request(app.getHttpServer())
      .put(`/admin/merchants/${id}/storefront-handle`)
      .send({ handle: ' ABO-ALI ' })
      .expect(200);
    assert.deepEqual(calls, [[id, 'abo-ali', 'test-administrator']]);
  });
  it('rejects anonymous assignment and creation before service calls', async () => {
    authorized = false;
    await request(app.getHttpServer())
      .put(`/admin/merchants/${id}/storefront-handle`)
      .send({ handle: 'abo-ali' })
      .expect(401);
    await request(app.getHttpServer()).post('/admin/merchants').send({}).expect(401);
    assert.deepEqual(calls, []);
  });
  it('rejects reserved names, invalid labels, tenant injection and malformed merchant IDs', async () => {
    for (const handle of [
      'pos',
      'admin',
      'marketplace',
      '-shop',
      'shop-',
      'a.b',
      'ab',
      'a'.repeat(64),
    ]) {
      await request(app.getHttpServer())
        .put(`/admin/merchants/${id}/storefront-handle`)
        .send({ handle })
        .expect(400);
    }
    await request(app.getHttpServer())
      .put(`/admin/merchants/${id}/storefront-handle`)
      .send({ handle: 'abo-ali', merchantId: 'other' })
      .expect(400);
    await request(app.getHttpServer())
      .put('/admin/merchants/not-a-uuid/storefront-handle')
      .send({ handle: 'abo-ali' })
      .expect(400);
    assert.deepEqual(calls, []);
  });
  it('allows public resolution without exposing owner/account details', async () => {
    authorized = false;
    const result = await request(app.getHttpServer())
      .get('/storefront-handles/abo-ali')
      .expect(200);
    assert.deepEqual(result.body, { handle: 'abo-ali', storefrontSlug: 'technical-store-code' });
  });
  it('accepts an optional handle on merchant creation', async () => {
    await request(app.getHttpServer())
      .post('/admin/merchants')
      .send({
        name: 'Example',
        ownerName: 'Owner',
        contactPhone: '000000',
        ownerMobile: '000000',
        username: 'example-owner',
        password: 'example-password-only',
        storefrontHandle: ' ABO-ALI ',
      })
      .expect(201);
    assert.equal((calls[0] as [{ storefrontHandle: string }])[0].storefrontHandle, 'abo-ali');
  });
});
