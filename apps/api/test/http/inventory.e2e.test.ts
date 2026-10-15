import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile, StockItem } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import { InventoryController } from '../../src/modules/inventory/inventory.controller.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';

const owner: OwnerProfile = {
  username: 'inventory-owner',
  merchantId: '11111111-1111-4111-8111-111111111111',
  merchantName: 'Merchant',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner',
  ownerMobile: '01100000000',
  firstMonthActivatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
};
const stockItem: StockItem = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Water',
  description: null,
  baseUnit: 'piece',
  units: [],
  archivedAt: null,
  revision: 1,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
};

describe('inventory owner endpoints', () => {
  let app: INestApplication;
  let authorized = true;
  const calls: Array<{ name: string; args: unknown[] }> = [];

  beforeEach(async () => {
    authorized = true;
    calls.length = 0;
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
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
          provide: InventoryService,
          useValue: Object.fromEntries(
            ['list', 'get', 'create', 'update', 'setArchived', 'convert'].map((method) => [
              method,
              async (...args: unknown[]) => {
                calls.push({ name: method, args });
                return method === 'convert'
                  ? {
                      itemId: stockItem.id,
                      unitCode: 'case',
                      quantity: '2',
                      baseUnit: 'piece',
                      baseQuantity: '24',
                    }
                  : stockItem;
              },
            ]),
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

  it('requires owner authentication and scopes item queries to the actor merchant', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/owner/inventory/items').expect(401);
    assert.equal(calls.length, 0);
    authorized = true;
    await request(app.getHttpServer())
      .get('/owner/inventory/items?status=archived&limit=10')
      .expect(200);
    assert.equal(calls[0]?.name, 'list');
    assert.equal(calls[0]?.args[0], owner.merchantId);
    await request(app.getHttpServer()).get(`/owner/inventory/items/${stockItem.id}`).expect(200);
    assert.deepEqual(calls[1]?.args, [owner.merchantId, stockItem.id]);
  });

  it('validates quantity strings, base units, pack codes, and tenant-free create payloads', async () => {
    const valid = {
      requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Water',
      baseUnit: 'piece',
      units: [{ code: 'case', name: 'Case', baseQuantity: '12' }],
    };
    await request(app.getHttpServer())
      .post('/owner/inventory/items')
      .send({ ...valid, merchantId: '22222222-2222-4222-8222-222222222222' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/owner/inventory/items')
      .send({ ...valid, units: [{ code: 'kg', name: 'Pack', baseQuantity: '12' }] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/owner/inventory/items')
      .send({ ...valid, units: [{ code: 'case', name: 'Case', baseQuantity: '1.0000001' }] })
      .expect(400);
    assert.equal(calls.length, 0);
    await request(app.getHttpServer()).post('/owner/inventory/items').send(valid).expect(201);
    assert.equal(calls[0]?.args[0], owner.merchantId);
    assert.equal(calls[0]?.args[1], owner.username);
    assert.equal((calls[0]?.args[2] as typeof valid).requestId, valid.requestId);
  });

  it('validates revision and conversion request shapes before service calls', async () => {
    await request(app.getHttpServer())
      .post(`/owner/inventory/items/${stockItem.id}/archive`)
      .send({ revision: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/owner/inventory/items/${stockItem.id}/convert`)
      .send({ quantity: 1, unitCode: 'case' })
      .expect(400);
    assert.equal(calls.length, 0);
    const response = await request(app.getHttpServer())
      .post(`/owner/inventory/items/${stockItem.id}/convert`)
      .send({ quantity: '2', unitCode: 'case' })
      .expect(201);
    assert.equal(response.body.baseQuantity, '24');
    assert.deepEqual(calls[0]?.args.slice(0, 2), [owner.merchantId, stockItem.id]);
  });
});
