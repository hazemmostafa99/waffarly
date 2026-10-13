import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { AdminGuard } from '../src/modules/auth/admin.guard.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { ActivitiesModulesController } from '../src/modules/super-admin/activities-modules.controller.js';
import { ActivitiesModulesService } from '../src/modules/super-admin/activities-modules.service.js';

type RecordValue = {
  key: string;
  name: string;
  description: string;
  moduleKeys?: string[];
  revision: number;
  updatedBy: string;
  updatedAt: Date;
};

// Exercise HTTP auth, parsing, registry rules, and compare-and-swap writes without
// requiring a database. SQL constraints are also verified separately against PostgreSQL.
function model() {
  const records = new Map<string, RecordValue>();
  return {
    records,
    findMany: async () => [...records.values()],
    create: async ({ data }: { data: Omit<RecordValue, 'revision' | 'updatedAt'> }) => {
      if (records.has(data.key)) throw { code: 'P2002' };
      const value = { ...data, revision: 1, updatedAt: new Date() };
      records.set(value.key, value);
      return { ...value };
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { key: string; revision: number };
      data: Omit<RecordValue, 'key' | 'revision' | 'updatedAt'> & {
        revision: { increment: number };
      };
    }) => {
      const existing = records.get(where.key);
      if (!existing || existing.revision !== where.revision) return { count: 0 };
      records.set(where.key, {
        ...existing,
        ...data,
        revision: existing.revision + data.revision.increment,
        updatedAt: new Date(),
      });
      return { count: 1 };
    },
    findUniqueOrThrow: async ({ where }: { where: { key: string } }) => {
      const existing = records.get(where.key);
      if (!existing) throw new Error('Missing row');
      return { ...existing };
    },
  };
}

describe('business activity and module administration', () => {
  let app: INestApplication;
  let activity: ReturnType<typeof model>;
  let module: ReturnType<typeof model>;
  const base = '/admin/activities-modules';
  const body = () => ({
    name: ' Restaurants ',
    description: ' Restaurant operations ',
    moduleKeys: ['storefront-design'],
    revision: 0,
  });

  beforeEach(async () => {
    activity = model();
    module = model();
    const prisma = { businessActivity: activity, platformModule: module };
    const moduleRef = await Test.createTestingModule({
      controllers: [ActivitiesModulesController],
      providers: [
        ActivitiesModulesService,
        AdminGuard,
        {
          provide: PrismaService,
          useValue: {
            ...prisma,
            $transaction: async <T>(fn: (client: typeof prisma) => Promise<T>) => fn(prisma),
          },
        },
        {
          provide: AuthService,
          useValue: {
            requireAdmin: async (incoming: Request) => {
              if (incoming.headers['x-test-admin'] !== 'yes') throw new UnauthorizedException();
              return 'test-admin';
            },
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('denies anonymous reads and edits', async () => {
    await request(app.getHttpServer()).get(base).expect(401);
    await request(app.getHttpServer())
      .patch(`${base}/activities/restaurant`)
      .send(body())
      .expect(401);
    await request(app.getHttpServer())
      .patch(`${base}/modules/storefront-design`)
      .send({})
      .expect(401);
    assert.equal(activity.records.size + module.records.size, 0);
  });

  it('lists code definitions without persisting anything or exposing future capabilities', async () => {
    const response = await request(app.getHttpServer())
      .get(base)
      .set('x-test-admin', 'yes')
      .expect(200);
    assert.deepEqual(
      response.body.activities.map((entry: { key: string }) => entry.key),
      ['restaurant', 'clothing', 'supermarket', 'other'],
    );
    assert.deepEqual(
      response.body.modules.map((entry: { key: string }) => entry.key),
      ['merchant-profile', 'storefront-design'],
    );
    assert.equal(response.body.activities[0].revision, 0);
    assert.equal(response.body.modules[0].updatedBy, null);
    assert.equal(activity.records.size + module.records.size, 0);
  });

  it('supports shared modules for clothing, supermarkets and other businesses', async () => {
    for (const key of ['clothing', 'supermarket', 'other']) {
      const response = await request(app.getHttpServer())
        .patch(`${base}/activities/${key}`)
        .set('x-test-admin', 'yes')
        .send({ ...body(), name: key, moduleKeys: ['merchant-profile', 'storefront-design'] })
        .expect(200);
      assert.equal(response.body.key, key);
      assert.deepEqual(response.body.moduleKeys, ['merchant-profile', 'storefront-design']);
    }
  });

  it('saves normalized metadata and activity associations with attribution', async () => {
    const edited = await request(app.getHttpServer())
      .patch(`${base}/activities/restaurant`)
      .set('x-test-admin', 'yes')
      .send(body())
      .expect(200);
    assert.equal(edited.body.name, 'Restaurants');
    assert.equal(edited.body.description, 'Restaurant operations');
    assert.equal(edited.body.updatedBy, 'test-admin');
    assert.equal(edited.body.revision, 1);
    assert.deepEqual(edited.body.moduleKeys, ['storefront-design']);
    const catalog = await request(app.getHttpServer())
      .get(base)
      .set('x-test-admin', 'yes')
      .expect(200);
    assert.deepEqual(catalog.body.activities[0], edited.body);
    assert.equal(catalog.body.modules[1].revision, 0);
  });

  it('edits module descriptions while preserving its code-managed compatibility and dependencies', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${base}/modules/storefront-design`)
      .set('x-test-admin', 'yes')
      .send({ name: ' Branding ', description: ' Choose a design ', revision: 0 })
      .expect(200);
    assert.equal(response.body.name, 'Branding');
    assert.deepEqual(response.body.supportedActivities, [
      'restaurant',
      'clothing',
      'supermarket',
      'other',
    ]);
    assert.deepEqual(response.body.dependencies, []);
    const list = await request(app.getHttpServer())
      .get(base)
      .set('x-test-admin', 'yes')
      .expect(200);
    assert.equal(list.body.modules[1].description, 'Choose a design');
    assert.equal(activity.records.size, 0);
  });

  it('rejects unsupported keys, duplicate associations, invalid revisions, blank names and extra fields', async () => {
    for (const invalid of [
      { name: '  ' },
      { name: 'a'.repeat(161) },
      { description: 'a'.repeat(1001) },
      { revision: -1 },
      { revision: 1.5 },
      { revision: '0' },
      { revision: 2147483647 },
      { moduleKeys: ['orders'] },
      { moduleKeys: ['storefront-design', 'storefront-design'] },
      { status: 'available' },
      { key: 'clothing' },
    ]) {
      await request(app.getHttpServer())
        .patch(`${base}/activities/restaurant`)
        .set('x-test-admin', 'yes')
        .send({ ...body(), ...invalid })
        .expect(400);
    }
    await request(app.getHttpServer())
      .patch(`${base}/activities/unsupported`)
      .set('x-test-admin', 'yes')
      .send(body())
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${base}/modules/orders`)
      .set('x-test-admin', 'yes')
      .send({ name: 'Orders', description: '', revision: 0 })
      .expect(400);
    for (const field of [
      { dependencies: [] },
      { supportedActivities: ['restaurant'] },
      { moduleKeys: [] },
    ]) {
      await request(app.getHttpServer())
        .patch(`${base}/modules/storefront-design`)
        .set('x-test-admin', 'yes')
        .send({ name: 'Branding', description: '', revision: 0, ...field })
        .expect(400);
    }
    assert.equal(activity.records.size + module.records.size, 0);
  });

  it('allows empty applicability without deleting supported definitions', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/activities/restaurant`)
      .set('x-test-admin', 'yes')
      .send({ ...body(), moduleKeys: [] })
      .expect(200);
    const response = await request(app.getHttpServer())
      .get(base)
      .set('x-test-admin', 'yes')
      .expect(200);
    assert.deepEqual(response.body.activities[0].moduleKeys, []);
    assert.equal(response.body.modules.length, 2);
  });

  it('rejects stale first and subsequent edits for both entry kinds', async () => {
    for (const path of ['activities/restaurant', 'modules/storefront-design']) {
      const settings = path.startsWith('activities')
        ? body()
        : { name: 'Branding', description: '', revision: 0 };
      await request(app.getHttpServer())
        .patch(`${base}/${path}`)
        .set('x-test-admin', 'yes')
        .send(settings)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`${base}/${path}`)
        .set('x-test-admin', 'yes')
        .send(settings)
        .expect(409);
      const updated = await request(app.getHttpServer())
        .patch(`${base}/${path}`)
        .set('x-test-admin', 'yes')
        .send({ ...settings, name: 'Updated', revision: 1 })
        .expect(200);
      assert.equal(updated.body.revision, 2);
      await request(app.getHttpServer())
        .patch(`${base}/${path}`)
        .set('x-test-admin', 'yes')
        .send({ ...settings, revision: 1 })
        .expect(409);
    }
  });

  it('does not create an override for a nonexistent expected revision', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/activities/restaurant`)
      .set('x-test-admin', 'yes')
      .send({ ...body(), revision: 5 })
      .expect(409);
    assert.equal(activity.records.size, 0);
  });
});
