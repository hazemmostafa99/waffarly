import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import request from 'supertest';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PublicMerchantApplicationController } from '../../src/modules/merchants/merchant-application.controller.js';
import { MerchantService } from '../../src/modules/merchants/merchant.service.js';

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
  let createdSlug = '';
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
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdSlug = String(data.storefrontSlug);
        return {
          ...data,
          id: 'merchant',
          createdAt: new Date(),
          firstMonthActivatedAt: null,
          owner: { username: 'owner' },
        };
      },
    },
    $transaction: async <T>(fn: (client: unknown) => Promise<T>) => fn(prisma),
  };
  const service = new MerchantService(prisma as unknown as PrismaService);
  const merchant = await service.approveApplication(
    'application',
    { storefrontHandle: 'clothing-store', username: 'owner', password: 'correct-horse-battery-staple' },
    'admin',
  );
  assert.equal(merchant.activity, 'clothing');
  assert.match(createdSlug, /^clothing-store-[a-f0-9]{32}$/);
});

