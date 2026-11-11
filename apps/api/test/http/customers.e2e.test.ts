import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AppConfiguration } from '../../src/config/app-configuration.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AuthService } from '../../src/modules/auth/index.js';
import { CustomersService } from '../../src/modules/customers/index.js';
import { OrderCustomerService } from '../../src/modules/orders/order-customer.service.js';

const tenant = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const owner = { merchantId: tenant, username: 'customer-owner' } as OwnerProfile;

describe('customer owner HTTP boundaries', () => {
  let app: INestApplication;
  let authorized: boolean;
  let calls: unknown[][];
  let lookups: number;
  beforeEach(async () => {
    authorized = true;
    calls = [];
    lookups = 0;
    const capture = async (...args: unknown[]) => {
      calls.push(args);
      return { id };
    };
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
      .overrideProvider(CustomersService)
      .useValue({ list: capture, get: capture, create: capture, update: capture })
      .overrideProvider(OrderCustomerService)
      .useValue({ link: capture, history: capture })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });

  it('derives tenant and actor once and normalizes contact fields', async () => {
    await request(app.getHttpServer())
      .post('/owner/customers')
      .send({ requestId: id, name: ' Ahmed ', email: 'AHMED@example.com' })
      .expect(201);
    assert.equal(lookups, 1);
    assert.deepEqual(calls, [
      [tenant, owner.username, { requestId: id, name: 'Ahmed', email: 'ahmed@example.com' }],
    ]);
  });
  it('rejects account linking, tenant injection and fabricated acquisition channels', async () => {
    for (const extra of [
      { merchantId: tenant },
      { accountId: id },
      { firstChannel: 'marketplace' },
      { phoneVerifiedAt: new Date().toISOString() },
    ]) {
      await request(app.getHttpServer())
        .post('/owner/customers')
        .send({ requestId: id, name: 'Ahmed', ...extra })
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/owner/customers/${id}`)
        .send({ revision: 1, ...extra })
        .expect(400);
    }
    assert.equal(calls.length, 0);
  });
  it('rejects anonymous access across customer and order association routes', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/owner/customers').expect(401);
    await request(app.getHttpServer()).get(`/owner/customers/${id}`).expect(401);
    await request(app.getHttpServer()).post('/owner/customers').send({}).expect(401);
    await request(app.getHttpServer()).patch(`/owner/customers/${id}`).send({}).expect(401);
    await request(app.getHttpServer()).get(`/owner/customers/${id}/orders`).expect(401);
    await request(app.getHttpServer()).put(`/owner/orders/${id}/customer`).send({}).expect(401);
    assert.equal(calls.length, 0);
  });
  it('bounds list/history queries and validates revisions and IDs', async () => {
    for (const query of ['limit=101', 'limit=0', 'cursor=nope', `merchantId=${tenant}`]) {
      await request(app.getHttpServer()).get(`/owner/customers?${query}`).expect(400);
      await request(app.getHttpServer()).get(`/owner/customers/${id}/orders?${query}`).expect(400);
    }
    await request(app.getHttpServer()).get('/owner/customers/not-a-uuid').expect(400);
    await request(app.getHttpServer())
      .patch(`/owner/customers/${id}`)
      .send({ revision: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/owner/orders/${id}/customer`)
      .send({ revision: 0, customerId: id })
      .expect(400);
    assert.equal(calls.length, 0);
    await request(app.getHttpServer()).get('/owner/customers?limit=10&status=all').expect(200);
    await request(app.getHttpServer())
      .put(`/owner/orders/${id}/customer`)
      .send({ revision: 1, customerId: id })
      .expect(200);
    assert.deepEqual(calls, [
      [tenant, { limit: 10, search: '', status: 'all' }],
      [tenant, owner.username, id, { revision: 1, customerId: id }],
    ]);
  });
});
