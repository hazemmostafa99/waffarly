import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { CustomerAuthController } from '../../src/modules/auth/customer-auth.controller.js';
import { CustomerAuthService } from '../../src/modules/auth/customer-auth.service.js';

describe('customer authentication HTTP contracts', () => {
  let app: INestApplication;
  let calls: unknown[];
  beforeEach(async () => {
    calls = [];
    const module = await Test.createTestingModule({
      controllers: [CustomerAuthController],
      providers: [
        {
          provide: CustomerAuthService,
          useValue: {
            signUp: async (data: unknown) => {
              calls.push(data);
              return { id: 'customer' };
            },
            signIn: async (data: unknown) => {
              calls.push(data);
              return { id: 'customer' };
            },
            me: async () => ({ id: 'customer' }),
            logout: async () => undefined,
          },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });
  it('normalizes signup/login contact details and prevents caching private responses', async () => {
    const signup = {
      name: ' Ahmed ',
      email: 'AHMED@example.com ',
      phone: '010 1234 5678',
      password: 'secret-pass',
    };
    await request(app.getHttpServer())
      .post('/auth/customer/sign-up')
      .send(signup)
      .expect(201)
      .expect('Cache-Control', 'no-store');
    assert.deepEqual(calls[0], {
      ...signup,
      name: 'Ahmed',
      email: 'ahmed@example.com',
      phone: '+201012345678',
    });
    await request(app.getHttpServer())
      .post('/auth/customer/login')
      .send({ identifier: '٠١٠١٢٣٤٥٦٧٨', password: 'secret-pass' })
      .expect(200);
    assert.deepEqual(calls[1], { identifier: '+201012345678', password: 'secret-pass' });
    await request(app.getHttpServer())
      .get('/auth/customer/me')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    await request(app.getHttpServer())
      .post('/auth/customer/logout')
      .send({})
      .expect(200)
      .expect({ authenticated: false });
  });
  it('rejects verification, tenant and account injection plus invalid/oversized credentials', async () => {
    const signup = {
      name: 'Ahmed',
      email: 'a@example.com',
      phone: '01012345678',
      password: 'secret-pass',
    };
    for (const extra of [
      { phoneVerifiedAt: new Date().toISOString() },
      { merchantId: 'other' },
      { accountId: 'other' },
      { emailVerified: true },
      { password: 'short' },
      { password: 'a'.repeat(129) },
      { phone: 'abc' },
      { email: 'broken' },
      { name: ' ' },
    ]) {
      await request(app.getHttpServer())
        .post('/auth/customer/sign-up')
        .send({ ...signup, ...extra })
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/auth/customer/login')
      .send({ identifier: 'a@example.com', password: 'pass', merchantId: 'other' })
      .expect(400);
    assert.equal(calls.length, 0);
  });
});
