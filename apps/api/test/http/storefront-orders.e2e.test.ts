import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import {
  OwnerStorefrontOrdersController,
  PublicStorefrontOrdersController,
} from '../../src/modules/orders/storefront-orders.controller.js';
import { OrderLifecycleService } from '../../src/modules/orders/order-lifecycle.service.js';
import { StorefrontOrdersService } from '../../src/modules/orders/storefront-orders.service.js';
import { CustomerOrderAccessService } from '../../src/modules/orders/customer-order-access.service.js';

const owner: OwnerProfile = {
  username: 'store-owner',
  merchantId: '11111111-1111-4111-8111-111111111111',
  merchantName: 'Store',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner',
  ownerMobile: '01100000000',
  firstMonthActivatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
};

describe('storefront order endpoints', () => {
  let app: INestApplication;
  let lifecycleCall: unknown;
  let authorized: boolean;
  let created: { slug: string; body: unknown } | undefined;
  let listedMerchantId: string | undefined;
  let listedPage: { cursor?: string; limit: number } | undefined;
  let statusUpdate: { merchantId: string; id: string; status: string } | undefined;

  beforeEach(async () => {
    authorized = true;
    lifecycleCall = undefined;
    created = undefined;
    listedMerchantId = undefined;
    listedPage = undefined;
    statusUpdate = undefined;
    const module = await Test.createTestingModule({
      controllers: [PublicStorefrontOrdersController, OwnerStorefrontOrdersController],
      providers: [
        { provide: CustomerOrderAccessService, useValue: {} },
        OwnerGuard,
        {
          provide: OrderLifecycleService,
          useValue: Object.fromEntries(
            ['accept', 'startPreparation', 'cancel'].map((action) => [
              action,
              async (merchantId: string, actor: string, orderId: string, input: unknown) => {
                lifecycleCall = { action, merchantId, actor, orderId, input };
                return { id: orderId };
              },
            ]),
          ),
        },
        {
          provide: AuthService,
          useValue: {
            requireOwner: async () => {
              if (!authorized) throw new UnauthorizedException();
              return owner;
            },
          },
        },
        {
          provide: StorefrontOrdersService,
          useValue: {
            create: async (slug: string, body: unknown) => {
              created = { slug, body };
              return {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                status: 'pending',
                currency: 'EGP',
                total: '235.50',
                createdAt: '2026-10-14T10:00:00.000Z',
              };
            },
            listForOwner: async (merchantId: string, page: { cursor?: string; limit: number }) => {
              listedMerchantId = merchantId;
              listedPage = page;
              return { items: [], nextCursor: null };
            },
            updateStatus: async (merchantId: string, id: string, status: string) => {
              statusUpdate = { merchantId, id, status };
              return { id, status, lines: [] };
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

  it('authenticates lifecycle commands and forwards the owner tenant, actor and retry key', async () => {
    const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const branchId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    authorized = false;
    for (const action of ['accept', 'start-preparation', 'cancel'])
      await request(app.getHttpServer())
        .post(`/owner/orders/${orderId}/${action}`)
        .send({ requestId, branchId })
        .expect(401);
    authorized = true;
    await request(app.getHttpServer())
      .post(`/owner/orders/${orderId}/accept`)
      .send({ requestId, branchId })
      .expect(201);
    assert.deepEqual(lifecycleCall, {
      action: 'accept',
      merchantId: owner.merchantId,
      actor: owner.username,
      orderId,
      input: { requestId, branchId },
    });
    await request(app.getHttpServer())
      .post(`/owner/orders/${orderId}/accept`)
      .send({ requestId })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/owner/orders/${orderId}/start-preparation`)
      .send({ requestId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/owner/orders/${orderId}/cancel`)
      .send({ requestId, reason: 'Customer cancelled', restoreStock: false })
      .expect(201);
    assert.deepEqual(lifecycleCall, {
      action: 'cancel',
      merchantId: owner.merchantId,
      actor: owner.username,
      orderId,
      input: { requestId, reason: 'Customer cancelled', restoreStock: false },
    });
    await request(app.getHttpServer())
      .post(`/owner/orders/${orderId}/cancel`)
      .send({ requestId, restoreStock: true })
      .expect(400);
  });

  it('validates and submits a pickup order to its storefront', async () => {
    const body = {
      customerName: 'Mona Ali',
      customerPhone: '+201000000000',
      fulfillmentType: 'pickup',
      items: [
        {
          productId: '22222222-2222-4222-8222-222222222222',
          variantId: '33333333-3333-4333-8333-333333333333',
          selections: [],
          quantity: 2,
        },
      ],
    };
    const response = await request(app.getHttpServer())
      .post('/catalog/stores/cairo-kitchen/orders')
      .send(body)
      .expect(201);

    assert.equal(response.body.status, 'pending');
    assert.equal(response.body.total, '235.50');
    assert.deepEqual(created, { slug: 'cairo-kitchen', body });
  });

  it('requires an address for delivery and never calls the order service for invalid input', async () => {
    await request(app.getHttpServer())
      .post('/catalog/stores/cairo-kitchen/orders')
      .send({
        customerName: 'Mona Ali',
        customerPhone: '01000000000',
        fulfillmentType: 'delivery',
        items: [
          {
            productId: '22222222-2222-4222-8222-222222222222',
            selections: [],
            quantity: 1,
          },
        ],
      })
      .expect(400);
    assert.equal(created, undefined);
  });

  it('scopes owner order reads and status changes to the signed-in merchant', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const cursor = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const response = await request(app.getHttpServer())
      .get(`/owner/orders?limit=1&cursor=${cursor}`)
      .expect(200);
    assert.equal(listedMerchantId, owner.merchantId);
    assert.deepEqual(listedPage, { cursor, limit: 1 });
    assert.deepEqual(response.body, { items: [], nextCursor: null });

    await request(app.getHttpServer())
      .patch(`/owner/orders/${id}/status`)
      .send({ status: 'rejected' })
      .expect(200);
    assert.deepEqual(statusUpdate, { merchantId: owner.merchantId, id, status: 'rejected' });
  });

  it('requires owner authentication and only accepts terminal order actions', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/owner/orders').expect(401);
    authorized = true;
    await request(app.getHttpServer())
      .patch('/owner/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/status')
      .send({ status: 'pending' })
      .expect(400);
    assert.equal(statusUpdate, undefined);
  });
});
