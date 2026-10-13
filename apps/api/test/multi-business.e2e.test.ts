import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { PublicMerchantApplicationController } from '../src/modules/super-admin/merchant-application.controller.js';
import { MerchantService } from '../src/modules/super-admin/merchant.service.js';
import { StorefrontService } from '../src/modules/auth/storefront.service.js';

it('accepts each activity in public applications, defaults legacy requests and rejects unknown activities', async () => {
  const saved: Record<string, unknown>[] = [];
  const module = await Test.createTestingModule({
    controllers: [PublicMerchantApplicationController],
    providers: [
      MerchantService,
      {
        provide: PrismaService,
        useValue: {
          merchantApplication: {
            create: async ({ data }: { data: Record<string, unknown> }) => saved.push(data),
          },
        },
      },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  await app.init();
  const body = {
    name: 'Local business',
    contactPhone: '0212345678',
    ownerName: 'Owner',
    ownerMobile: '01012345678',
  };
  try {
    for (const activity of ['restaurant', 'clothing', 'supermarket', 'other']) {
      await request(app.getHttpServer())
        .post('/merchant-applications')
        .send({ ...body, activity })
        .expect(201);
      assert.equal(saved.at(-1)?.activity, activity);
    }
    await request(app.getHttpServer()).post('/merchant-applications').send(body).expect(201);
    assert.equal(saved.at(-1)?.activity, 'other');
    await request(app.getHttpServer())
      .post('/merchant-applications')
      .send({ ...body, activity: 'unsupported' })
      .expect(400);
    assert.equal(saved.length, 5);
  } finally {
    await app.close();
  }
});

it('preserves the business activity when an application is approved', async () => {
  const prisma = {
    merchantApplication: {
      findUnique: async () => ({
        name: 'Clothing store',
        activity: 'clothing',
        contactPhone: '0123',
        ownerName: 'Owner',
        ownerMobile: '0124',
        approvedAt: null,
        merchantId: null,
        rejectedAt: null,
      }),
      updateMany: async () => ({ count: 1 }),
    },
    merchant: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: 'merchant',
        createdAt: new Date(),
        firstMonthActivatedAt: null,
        owner: { username: 'owner' },
      }),
    },
    $transaction: async <T>(fn: (client: unknown) => Promise<T>) => fn(prisma),
  };
  const service = new MerchantService(prisma as unknown as PrismaService);
  const merchant = await service.approveApplication(
    'application',
    { username: 'owner', password: 'correct-horse-battery-staple' },
    'admin',
  );
  assert.equal(merchant.activity, 'clothing');
});

it('lists shared and matching storefront templates and refuses a template for another activity', async () => {
  let visibleActivities: string[] = [];
  const prisma = {
    merchant: { findUniqueOrThrow: async () => ({ activity: 'supermarket' }) },
    storefrontTemplate: {
      findMany: async ({ where }: { where: { activity: { in: string[] } } }) => {
        visibleActivities = where.activity.in;
        return [];
      },
      findFirst: async ({ where }: { where: { activity: { in: string[] } } }) => {
        assert.deepEqual(where.activity.in, ['general', 'supermarket']);
        return null;
      },
    },
    merchantStorefront: { findUnique: async () => null },
    $transaction: async <T>(fn: (client: unknown) => Promise<T>) => fn(prisma),
  };
  const service = new StorefrontService(prisma as unknown as PrismaService);
  await service.getSettings('merchant');
  assert.deepEqual(visibleActivities, ['general', 'supermarket']);
  await assert.rejects(
    service.saveSettings('merchant', {
      templateId: 'restaurant-template',
      accentColor: '#315b43',
      logoData: null,
      revision: 0,
    }),
    /Choose an available design for your business activity/,
  );
});
