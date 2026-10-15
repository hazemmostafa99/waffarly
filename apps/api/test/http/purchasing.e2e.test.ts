import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile, PurchaseInvoice, PurchaseSupplier } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import { PurchaseSuppliersService } from '../../src/modules/purchasing/purchase-suppliers.service.js';
import { PurchasingController } from '../../src/modules/purchasing/purchasing.controller.js';
import { PurchasingService } from '../../src/modules/purchasing/purchasing.service.js';

const owner: OwnerProfile = {
  username: 'purchasing-owner',
  merchantId: '11111111-1111-4111-8111-111111111111',
  merchantName: 'Merchant',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner',
  ownerMobile: '01100000000',
  firstMonthActivatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
};
const supplier = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } as PurchaseSupplier;
const invoice = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } as PurchaseInvoice;

describe('purchasing owner endpoints', () => {
  let app: INestApplication;
  let authorized = true;
  const calls: Array<{ name: string; args: unknown[] }> = [];

  beforeEach(async () => {
    authorized = true;
    calls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [PurchasingController],
      providers: [
        OwnerGuard,
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
          provide: PurchaseSuppliersService,
          useValue: Object.fromEntries(
            ['list', 'get', 'create', 'update', 'setArchived'].map((method) => [
              method,
              async (...args: unknown[]) => {
                calls.push({ name: `supplier:${method}`, args });
                return supplier;
              },
            ]),
          ),
        },
        {
          provide: PurchasingService,
          useValue: Object.fromEntries(
            ['listInvoices', 'getInvoice', 'createInvoice', 'updateInvoice', 'confirmInvoice'].map(
              (method) => [
                method,
                async (...args: unknown[]) => {
                  calls.push({ name: `invoice:${method}`, args });
                  return method === 'confirmInvoice' ? { invoice, receipt: {} } : invoice;
                },
              ],
            ),
          ),
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reads a selected supplier under the authenticated owner tenant', async () => {
    authorized = false;
    await request(app.getHttpServer())
      .get(`/owner/purchasing/suppliers/${supplier.id}`)
      .expect(401);
    assert.equal(calls.length, 0);
    authorized = true;
    await request(app.getHttpServer())
      .get(`/owner/purchasing/suppliers/${supplier.id}`)
      .expect(200);
    assert.deepEqual(calls[0], { name: 'supplier:get', args: [owner.merchantId, supplier.id] });
  });

  it('requires owner authentication and scopes supplier reads to the actor merchant', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/owner/purchasing/suppliers').expect(401);
    assert.equal(calls.length, 0);
    authorized = true;
    await request(app.getHttpServer())
      .get('/owner/purchasing/suppliers?status=archived&limit=10')
      .expect(200);
    assert.equal(calls[0]?.name, 'supplier:list');
    assert.equal(calls[0]?.args[0], owner.merchantId);
    assert.deepEqual(calls[0]?.args[1], {
      status: 'archived',
      limit: 10,
      search: '',
    });
  });

  it('rejects tenant fields, invalid supplier email, and duplicate item/condition lines', async () => {
    const validSupplier = {
      requestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      name: 'Dairy supplier',
    };
    await request(app.getHttpServer())
      .post('/owner/purchasing/suppliers')
      .send({ ...validSupplier, merchantId: '22222222-2222-4222-8222-222222222222' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/owner/purchasing/suppliers')
      .send({ ...validSupplier, email: 'not-an-email' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/owner/purchasing/suppliers')
      .send(validSupplier)
      .expect(201);
    assert.equal(calls[0]?.args[0], owner.merchantId);
    assert.equal(calls[0]?.args[1], owner.username);

    const validInvoice = {
      requestId: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      supplierId: supplier.id,
      warehouseId: 'cccccccc-cccc-4ccc-8ddd-eeeeeeeeeeee',
      lines: [
        {
          stockItemId: 'dddddddd-dddd-4ddd-8ddd-eeeeeeeeeeee',
          condition: 'available',
          quantity: '2',
          unitCode: 'piece',
        },
      ],
    };
    await request(app.getHttpServer())
      .post('/owner/purchasing/invoices')
      .send({
        ...validInvoice,
        lines: [...validInvoice.lines, ...validInvoice.lines],
      })
      .expect(400);
    assert.equal(
      calls.some((call) => call.name === 'invoice:createInvoice'),
      false,
    );
  });

  it('uses the authenticated owner and validates confirm request identity and revision', async () => {
    const id = invoice.id;
    const body = { requestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', revision: 3 };
    await request(app.getHttpServer())
      .post(`/owner/purchasing/invoices/${id}/confirm`)
      .send({ ...body, revision: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/owner/purchasing/invoices/${id}/confirm`)
      .send(body)
      .expect(201);
    const call = calls[0]!;
    assert.equal(call.name, 'invoice:confirmInvoice');
    assert.deepEqual(call.args, [owner.merchantId, owner.username, id, body]);
  });
});
