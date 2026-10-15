import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AdminGuard } from '../../src/modules/auth/admin.guard.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { PlanController } from '../../src/modules/plans/plan.controller.js';
import { PlanService } from '../../src/modules/plans/plan.service.js';

type RecordValue = {
  id: string;
  creationRequest: string;
  name: string;
  description: string;
  monthlyPrice: { toFixed: () => string };
  currency: string;
  billingInterval: string;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

describe('monthly plan administration', () => {
  let app: INestApplication;
  let records: RecordValue[];
  const payload = () => ({
    requestId: randomUUID(),
    name: 'Monthly offer',
    description: '',
    monthlyPrice: '250.5',
    currency: 'EGP',
    billingInterval: 'monthly',
  });

  beforeEach(async () => {
    records = [];
    const model = {
      findMany: async () => records,
      create: async ({
        data,
      }: {
        data: Omit<RecordValue, 'id' | 'monthlyPrice' | 'revision' | 'createdAt' | 'updatedAt'> & {
          monthlyPrice: string;
        };
      }) => {
        if (records.some((row) => row.creationRequest === data.creationRequest))
          throw { code: 'P2002' };
        const row = {
          ...data,
          id: randomUUID(),
          monthlyPrice: { toFixed: () => data.monthlyPrice },
          revision: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        records.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id?: string; creationRequest?: string } }) =>
        records.find((row) =>
          where.id ? row.id === where.id : row.creationRequest === where.creationRequest,
        ) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = records.find((value) => value.id === where.id);
        if (!row) throw new Error('Missing row');
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; revision: number };
        data: {
          name: string;
          description: string;
          monthlyPrice: string;
          currency: string;
          billingInterval: string;
          updatedBy: string;
          revision: { increment: number };
        };
      }) => {
        const row = records.find(
          (value) => value.id === where.id && value.revision === where.revision,
        );
        if (!row) return { count: 0 };
        Object.assign(row, {
          ...data,
          monthlyPrice: { toFixed: () => data.monthlyPrice },
          revision: row.revision + data.revision.increment,
          updatedAt: new Date(),
        });
        return { count: 1 };
      },
    };
    const prisma = {
      monthlyPlan: model,
      $transaction: async <T>(fn: (client: { monthlyPlan: typeof model }) => Promise<T>) =>
        fn({ monthlyPlan: model }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [PlanController],
      providers: [
        PlanService,
        AdminGuard,
        { provide: PrismaService, useValue: prisma },
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

  it('denies unauthenticated list, create and update requests', async () => {
    await request(app.getHttpServer()).get('/admin/plans').expect(401);
    await request(app.getHttpServer()).post('/admin/plans').send(payload()).expect(401);
    await request(app.getHttpServer()).patch(`/admin/plans/${randomUUID()}`).send({}).expect(401);
    assert.equal(records.length, 0);
  });

  it('normalizes exact decimal prices, attributes creation, and lists the offer', async () => {
    const body = { ...payload(), name: ' Monthly offer ', description: ' Optional note ' };
    const created = await request(app.getHttpServer())
      .post('/admin/plans')
      .set('x-test-admin', 'yes')
      .send(body)
      .expect(201);
    assert.equal(created.body.monthlyPrice, '250.50');
    assert.equal(created.body.name, 'Monthly offer');
    assert.equal(created.body.description, 'Optional note');
    assert.equal(created.body.createdBy, 'test-admin');
    assert.equal(created.body.billingInterval, 'monthly');
    assert.equal(created.body.requestId, undefined);
    const list = await request(app.getHttpServer())
      .get('/admin/plans')
      .set('x-test-admin', 'yes')
      .expect(200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].id, created.body.id);
  });

  it('rejects invalid amounts, unsupported currency/interval, and unknown fields', async () => {
    for (const invalid of [
      { monthlyPrice: '-1' },
      { monthlyPrice: '1.001' },
      { monthlyPrice: 250 },
      { monthlyPrice: '100000000' },
      { monthlyPrice: '1e3' },
      { monthlyPrice: '' },
      { currency: 'XYZ' },
      { billingInterval: 'yearly' },
      { name: '  ' },
      { firstMonthActivatedAt: new Date().toISOString() },
    ]) {
      await request(app.getHttpServer())
        .post('/admin/plans')
        .set('x-test-admin', 'yes')
        .send({ ...payload(), ...invalid })
        .expect(400);
    }
    assert.equal(records.length, 0);
  });

  it('accepts monetary bounds and an omitted optional description', async () => {
    for (const amount of ['0', '0.01', '99999999.99']) {
      const { description: _description, ...body } = payload();
      assert.equal(_description, '');
      const response = await request(app.getHttpServer())
        .post('/admin/plans')
        .set('x-test-admin', 'yes')
        .send({ ...body, monthlyPrice: amount })
        .expect(201);
      assert.equal(response.body.description, '');
      assert.equal(response.body.monthlyPrice, amount === '0' ? '0.00' : amount);
    }
  });

  it('reuses identical creation retries and rejects conflicting reuse', async () => {
    const body = payload();
    const first = await request(app.getHttpServer())
      .post('/admin/plans')
      .set('x-test-admin', 'yes')
      .send(body)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post('/admin/plans')
      .set('x-test-admin', 'yes')
      .send(body)
      .expect(201);
    assert.equal(first.body.id, retry.body.id);
    await request(app.getHttpServer())
      .post('/admin/plans')
      .set('x-test-admin', 'yes')
      .send({ ...body, monthlyPrice: '251' })
      .expect(409);
    assert.equal(records.length, 1);
  });

  it('updates the current revision and rejects stale or missing edits', async () => {
    const creation = payload();
    const created = await request(app.getHttpServer())
      .post('/admin/plans')
      .set('x-test-admin', 'yes')
      .send(creation)
      .expect(201);
    const { requestId: _requestId, ...settings } = creation;
    assert.ok(_requestId);
    const edit = { ...settings, monthlyPrice: '400', revision: 1 };
    const updated = await request(app.getHttpServer())
      .patch(`/admin/plans/${created.body.id}`)
      .set('x-test-admin', 'yes')
      .send(edit)
      .expect(200);
    assert.equal(updated.body.revision, 2);
    assert.equal(updated.body.monthlyPrice, '400.00');
    await request(app.getHttpServer())
      .patch(`/admin/plans/${created.body.id}`)
      .set('x-test-admin', 'yes')
      .send(edit)
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/admin/plans/${randomUUID()}`)
      .set('x-test-admin', 'yes')
      .send(edit)
      .expect(404);
    await request(app.getHttpServer())
      .patch('/admin/plans/invalid-id')
      .set('x-test-admin', 'yes')
      .send(edit)
      .expect(400);
  });
});
