import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AdminGuard } from '../../src/modules/auth/admin.guard.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { AdminMerchantApplicationController } from '../../src/modules/merchants/merchant-application.controller.js';
import { MerchantService } from '../../src/modules/merchants/merchant.service.js';

type Application = {
  id: string;
  name: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  createdAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  merchantId: string | null;
};

function createApplication(id: string, overrides: Partial<Application> = {}): Application {
  return {
    id,
    name: `Restaurant ${id}`,
    contactPhone: `010000000${id.slice(-1)}`,
    ownerName: `Owner ${id}`,
    ownerMobile: `011000000${id.slice(-1)}`,
    createdAt: new Date(`2026-10-0${id.slice(-1)}T10:00:00.000Z`),
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    merchantId: null,
    ...overrides,
  };
}

function createPrismaMock(seed: Application[]) {
  const records = new Map(seed.map((application) => [application.id, { ...application }]));
  const merchantApplication = {
    findMany: async () =>
      [...records.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    findUnique: async ({ where }: { where: { id: string } }) => {
      const record = records.get(where.id);
      return record ? { ...record } : null;
    },
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const record = records.get(where.id);
      if (!record) throw new Error('Application is missing.');
      return { ...record };
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; approvedAt: null; merchantId: null; rejectedAt: null };
      data: Pick<
        Application,
        'approvedAt' | 'approvedBy' | 'rejectedAt' | 'rejectedBy' | 'rejectionReason'
      >;
    }) => {
      const record = records.get(where.id);
      if (!record || record.approvedAt || record.merchantId || record.rejectedAt)
        return { count: 0 };
      records.set(where.id, { ...record, ...data });
      return { count: 1 };
    },
  };
  const transactionClient = { merchantApplication };
  return {
    records,
    prisma: {
      merchantApplication,
      $transaction: async <T>(operation: (client: typeof transactionClient) => Promise<T>) =>
        operation(transactionClient),
    },
  };
}

describe('merchant application rejection and reapplication history', () => {
  let app: INestApplication;
  let records: Map<string, Application>;

  beforeEach(async () => {
    const priorByRestaurant = createApplication('00000000-0000-4000-8000-000000000001', {
      contactPhone: '0101111111',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      rejectedAt: new Date('2026-10-02T10:00:00.000Z'),
      rejectedBy: 'reviewer-one',
      rejectionReason: 'The restaurant details could not be confirmed.',
    });
    const priorByOwner = createApplication('00000000-0000-4000-8000-000000000002', {
      ownerMobile: '0112222222',
      createdAt: new Date('2026-10-02T11:00:00.000Z'),
      rejectedAt: new Date('2026-10-03T10:00:00.000Z'),
      rejectedBy: 'reviewer-two',
      rejectionReason: 'The owner information needs review.',
    });
    const current = createApplication('00000000-0000-4000-8000-000000000003', {
      contactPhone: priorByRestaurant.contactPhone,
      ownerMobile: priorByOwner.ownerMobile,
      createdAt: new Date('2026-10-04T10:00:00.000Z'),
    });
    const unrelated = createApplication('00000000-0000-4000-8000-000000000004', {
      createdAt: new Date('2026-10-05T10:00:00.000Z'),
      rejectedAt: new Date('2026-10-06T10:00:00.000Z'),
      rejectedBy: 'reviewer-three',
      rejectionReason: 'Unrelated prior record.',
    });
    const database = createPrismaMock([priorByRestaurant, priorByOwner, current, unrelated]);
    records = database.records;

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminMerchantApplicationController],
      providers: [
        MerchantService,
        AdminGuard,
        { provide: PrismaService, useValue: database.prisma },
        {
          provide: AuthService,
          useValue: {
            requireAdmin: async (incoming: Request) => {
              if (incoming.headers['x-test-admin'] !== 'yes') throw new UnauthorizedException();
              return 'reviewer-test';
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

  it('requires Super Admin authentication for rejection and history', async () => {
    await request(app.getHttpServer())
      .post('/admin/merchant-applications/00000000-0000-4000-8000-000000000003/reject')
      .send({ reason: 'No' })
      .expect(401);
    await request(app.getHttpServer()).get('/admin/merchant-applications').expect(401);
  });

  it('requires a non-empty reason and leaves the application unchanged on validation failure', async () => {
    await request(app.getHttpServer())
      .post('/admin/merchant-applications/00000000-0000-4000-8000-000000000003/reject')
      .set('x-test-admin', 'yes')
      .send({ reason: '   ' })
      .expect(400);
    assert.equal(records.get('00000000-0000-4000-8000-000000000003')?.rejectedAt, null);
  });

  it('records an attributable final rejection and prevents a later approval', async () => {
    const id = '00000000-0000-4000-8000-000000000003';
    const response = await request(app.getHttpServer())
      .post(`/admin/merchant-applications/${id}/reject`)
      .set('x-test-admin', 'yes')
      .send({ reason: '  Please provide complete restaurant information.  ' })
      .expect(201);

    assert.equal(response.body.rejectionReason, 'Please provide complete restaurant information.');
    assert.equal(response.body.rejectedBy, 'reviewer-test');
    assert.ok(response.body.rejectedAt);
    assert.equal(
      records.get(id)?.rejectionReason,
      'Please provide complete restaurant information.',
    );

    await request(app.getHttpServer())
      .post(`/admin/merchant-applications/${id}/approve`)
      .set('x-test-admin', 'yes')
      .send({ username: 'restaurant-owner', password: 'correct-horse-battery-staple' })
      .expect(409);
  });

  it('shows all matching prior rejections by either phone field, including their reasons', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/merchant-applications')
      .set('x-test-admin', 'yes')
      .expect(200);
    const current = response.body.find(
      (application: { id: string }) => application.id === '00000000-0000-4000-8000-000000000003',
    );

    assert.deepEqual(
      current.priorRejectedApplications.map((application: { id: string }) => application.id).sort(),
      ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal(
      current.priorRejectedApplications[0].rejectionReason,
      'The restaurant details could not be confirmed.',
    );
    assert.equal(
      current.priorRejectedApplications[0].ownerName,
      'Owner 00000000-0000-4000-8000-000000000001',
    );
    assert.equal(current.priorRejectedApplications[0].contactPhone, '0101111111');
    assert.ok(
      !current.priorRejectedApplications.some(
        (application: { id: string }) => application.id === '00000000-0000-4000-8000-000000000004',
      ),
    );
  });
});
