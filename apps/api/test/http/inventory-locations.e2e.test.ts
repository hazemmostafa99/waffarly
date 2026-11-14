import { InventoryHealthController } from '../../src/modules/inventory/visibility/stock-health.controller.js';
import { InventoryLedgerController } from '../../src/modules/inventory/ledger/inventory-ledger.controller.js';
import { InventoryPolicyController } from '../../src/modules/inventory/policy/inventory-policy.controller.js';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { InventoryBranch, OwnerProfile } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import { InventoryLedgerService } from '../../src/modules/inventory/inventory-ledger.service.js';
import { InventoryLocationsController } from '../../src/modules/inventory/inventory-locations.controller.js';
import { InventoryLocationsService } from '../../src/modules/inventory/inventory-locations.service.js';
import { InventoryVisibilityService } from '../../src/modules/inventory/inventory-visibility.service.js';

const owner: OwnerProfile = {
  username: 'inventory-location-owner',
  merchantId: '11111111-1111-4111-8111-111111111111',
  merchantName: 'Merchant',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner',
  ownerMobile: '01100000000',
  firstMonthActivatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
};
const branch: InventoryBranch = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Downtown',
  address: null,
  archivedAt: null,
  revision: 1,
  defaultConsumptionWarehouseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  warehouses: [
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      branchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Main',
      isDefaultConsumption: true,
      archivedAt: null,
      revision: 1,
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  ],
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
};

describe('inventory locations and ledger owner endpoints', () => {
  let app: INestApplication;
  let authorized = true;
  const calls: Array<{ name: string; args: unknown[] }> = [];

  beforeEach(async () => {
    authorized = true;
    calls.length = 0;
    const makeStub = (methods: string[]) =>
      Object.fromEntries(
        methods.map((method) => [
          method,
          async (...args: unknown[]) => {
            calls.push({ name: method, args });
            if (method === 'getPolicy' || method === 'updatePolicy') {
              return { negativeStockPolicy: 'allow', revision: 1, updatedAt: null };
            }
            if (method === 'createOpening') {
              return {
                id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                kind: 'opening_balance',
                reason: 'Count',
                createdAt: '2026-10-15T00:00:00.000Z',
                replayed: false,
                movements: [],
              };
            }
            if (
              method === 'listBranches' ||
              method === 'listBalances' ||
              method === 'listMovements'
            ) {
              return { items: [], nextCursor: null };
            }
            if (method === 'listHealth') {
              return {
                items: [],
                nextCursor: null,
                summary: {
                  configuredItemLocations: 0,
                  lowStockItemLocations: 0,
                  healthyItemLocations: 0,
                },
              };
            }
            return branch;
          },
        ]),
      );
    const module = await Test.createTestingModule({
      controllers: [
        InventoryPolicyController,
        InventoryLedgerController,
        InventoryHealthController,
        InventoryLocationsController,
      ],
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
          provide: InventoryLocationsService,
          useValue: makeStub([
            'listBranches',
            'listWarehouses',
            'getWarehouse',
            'getBranch',
            'createBranch',
            'updateBranch',
            'setBranchArchived',
            'createWarehouse',
            'updateWarehouse',
            'setDefaultConsumptionWarehouse',
            'setWarehouseArchived',
            'getPolicy',
            'updatePolicy',
          ]),
        },
        {
          provide: InventoryLedgerService,
          useValue: makeStub(['createOpening', 'listBalances', 'listMovements']),
        },
        {
          provide: InventoryVisibilityService,
          useValue: makeStub(['getMovement', 'listHealth', 'saveThreshold', 'deleteThreshold']),
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('authenticates warehouse lookup/detail and forwards the owner tenant', async () => {
    await request(app.getHttpServer())
      .get('/owner/inventory/warehouses?limit=25&status=active&search=Main')
      .expect(200);
    assert.equal(calls.at(-1)?.name, 'listWarehouses');
    assert.equal(calls.at(-1)?.args[0], owner.merchantId);
    await request(app.getHttpServer())
      .get(`/owner/inventory/warehouses/${branch.warehouses[0]!.id}`)
      .expect(200);
    assert.deepEqual(calls.at(-1)?.args, [owner.merchantId, branch.warehouses[0]!.id]);
    authorized = false;
    await request(app.getHttpServer()).get('/owner/inventory/warehouses').expect(401);
    await request(app.getHttpServer())
      .get(`/owner/inventory/warehouses/${branch.warehouses[0]!.id}`)
      .expect(401);
  });

  it('requires owner authentication and derives the tenant from the authenticated owner', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/owner/inventory/branches').expect(401);
    assert.equal(calls.length, 0);
    authorized = true;
    await request(app.getHttpServer()).get('/owner/inventory/branches?limit=10').expect(200);
    assert.equal(calls[0]?.name, 'listBranches');
    assert.equal(calls[0]?.args[0], owner.merchantId);

    const payload = { name: 'Downtown', address: 'Cairo', defaultWarehouseName: 'Main' };
    await request(app.getHttpServer())
      .post('/owner/inventory/branches')
      .send({ ...payload, merchantId: '22222222-2222-4222-8222-222222222222' })
      .expect(400);
    assert.equal(calls.length, 1);
    await request(app.getHttpServer()).post('/owner/inventory/branches').send(payload).expect(201);
    assert.deepEqual(calls[1]?.args, [owner.merchantId, owner.username, payload]);
  });

  it('validates location revisions, default warehouse payloads, and policy values', async () => {
    await request(app.getHttpServer())
      .patch(`/owner/inventory/branches/${branch.id}`)
      .send({ revision: 0, name: 'Renamed' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/owner/inventory/branches/${branch.id}/default-consumption-warehouse`)
      .send({ revision: 1, warehouseId: 'not-a-uuid' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/owner/inventory/policy')
      .send({ revision: 1, negativeStockPolicy: 'sometimes' })
      .expect(400);
    assert.equal(calls.length, 0);

    await request(app.getHttpServer())
      .patch('/owner/inventory/policy')
      .send({ revision: 1, negativeStockPolicy: 'prevent' })
      .expect(200);
    assert.deepEqual(calls[0]?.args, [
      owner.merchantId,
      owner.username,
      { revision: 1, negativeStockPolicy: 'prevent' },
    ]);
  });

  it('validates opening quantity strings and forwards owner scope and actor', async () => {
    const valid = {
      requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      reason: 'Opening count',
      lines: [
        {
          warehouseId: branch.warehouses[0]!.id,
          stockItemId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          condition: 'available',
          quantity: '1.25',
          unitCode: 'kg',
        },
      ],
    };
    await request(app.getHttpServer())
      .post('/owner/inventory/opening-balances')
      .send({ ...valid, lines: [{ ...valid.lines[0], quantity: 1.25 }] })
      .expect(400);
    assert.equal(calls.length, 0);
    await request(app.getHttpServer())
      .post('/owner/inventory/opening-balances')
      .send(valid)
      .expect(201);
    assert.equal(calls[0]?.name, 'createOpening');
    assert.equal(calls[0]?.args[0], owner.merchantId);
    assert.equal(calls[0]?.args[1], owner.username);
    assert.deepEqual(calls[0]?.args[2], valid);
  });

  it('scopes movement details and health reads to the authenticated owner', async () => {
    const movementId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await request(app.getHttpServer()).get(`/owner/inventory/movements/${movementId}`).expect(200);
    assert.deepEqual(calls.at(-1)?.args, [owner.merchantId, movementId]);

    await request(app.getHttpServer())
      .get('/owner/inventory/health?limit=10&search=flour')
      .expect(200);
    assert.equal(calls.at(-1)?.name, 'listHealth');
    assert.equal(calls.at(-1)?.args[0], owner.merchantId);
    assert.deepEqual(calls.at(-1)?.args[1], { limit: 10, search: 'flour' });

    await request(app.getHttpServer()).get('/owner/inventory/health?limit=101').expect(400);
    await request(app.getHttpServer()).get('/owner/inventory/movements/not-a-uuid').expect(400);

    authorized = false;
    await request(app.getHttpServer()).get('/owner/inventory/health').expect(401);
    await request(app.getHttpServer()).get(`/owner/inventory/movements/${movementId}`).expect(401);
  });

  it('validates revisioned, non-negative reorder thresholds and forwards owner attribution', async () => {
    const warehouseId = branch.warehouses[0]!.id;
    const stockItemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const payload = { revision: null, minimumAvailableQuantity: '0' };
    await request(app.getHttpServer())
      .patch(`/owner/inventory/warehouses/${warehouseId}/items/${stockItemId}/reorder-threshold`)
      .send({ ...payload, minimumAvailableQuantity: '-1' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/owner/inventory/warehouses/${warehouseId}/items/${stockItemId}/reorder-threshold`)
      .send({ ...payload, minimumAvailableQuantity: 0 })
      .expect(400);
    assert.equal(calls.length, 0);

    await request(app.getHttpServer())
      .patch(`/owner/inventory/warehouses/${warehouseId}/items/${stockItemId}/reorder-threshold`)
      .send(payload)
      .expect(200);
    assert.deepEqual(calls.at(-1)?.args, [
      owner.merchantId,
      owner.username,
      warehouseId,
      stockItemId,
      payload,
    ]);
  });
});
