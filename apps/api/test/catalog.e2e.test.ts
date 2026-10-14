import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { OwnerProfile } from '@waffarly/contracts';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../src/modules/auth/owner.guard.js';
import { CategoryController } from '../src/modules/catalog/category.controller.js';
import { CategoryService } from '../src/modules/catalog/category.service.js';
import { MediaController } from '../src/modules/catalog/media.controller.js';
import { MediaService } from '../src/modules/catalog/media.service.js';
import { ProductController } from '../src/modules/catalog/product.controller.js';
import { ProductService } from '../src/modules/catalog/product.service.js';

const owner: OwnerProfile = {
  username: 'owner',
  merchantId: '11111111-1111-4111-8111-111111111111',
  merchantName: 'Merchant',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner',
  ownerMobile: '01000000001',
  firstMonthActivatedAt: new Date().toISOString(),
};

describe('catalog owner endpoints', () => {
  let app: INestApplication;
  let authorized: boolean;
  let createdProduct: Record<string, unknown> | undefined;

  beforeEach(async () => {
    authorized = true;
    createdProduct = undefined;
    const module = await Test.createTestingModule({
      controllers: [MediaController, CategoryController, ProductController],
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
          provide: MediaService,
          useValue: {
            list: async () => [],
            register: async () => ({
              id: 'media-asset',
              storageKey: 'catalog/burger.webp',
              publicUrl: 'https://cdn.example.test/catalog/burger.webp',
              mimeType: 'image/webp',
              sizeBytes: 1024,
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            }),
          },
        },
        {
          provide: CategoryService,
          useValue: { list: async () => [], create: async () => ({ id: 'category' }) },
        },
        {
          provide: ProductService,
          useValue: {
            list: async () => [],
            create: async (_merchantId: string, _actor: string, input: unknown) => {
              createdProduct = input as Record<string, unknown>;
              return { id: 'product', ...createdProduct };
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

  it('protects catalog management with the owner session', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/owner/catalog/products').expect(401);
    await request(app.getHttpServer()).get('/owner/catalog/categories').expect(401);
    await request(app.getHttpServer()).get('/owner/catalog/media').expect(401);
  });

  it('validates the positive EGP product boundary and forwards tenant-owned input', async () => {
    const response = await request(app.getHttpServer())
      .post('/owner/catalog/products')
      .send({
        name: 'Burger',
        basePrice: '75.00',
        availability: 'available',
        imageAssetIds: ['11111111-1111-4111-8111-111111111111'],
        categoryIds: ['22222222-2222-4222-8222-222222222222'],
      })
      .expect(201);
    assert.equal(response.body.id, 'product');
    assert.equal(createdProduct?.basePrice, '75.00');

    await request(app.getHttpServer())
      .post('/owner/catalog/products')
      .send({
        name: 'Free item',
        basePrice: '0',
        availability: 'available',
        imageAssetIds: ['11111111-1111-4111-8111-111111111111'],
        categoryIds: ['22222222-2222-4222-8222-222222222222'],
      })
      .expect(400);
  });

  it('accepts reusable media metadata only for approved image formats', async () => {
    await request(app.getHttpServer())
      .post('/owner/catalog/media')
      .send({
        storageKey: 'catalog/burger.webp',
        publicUrl: 'https://cdn.example.test/catalog/burger.webp',
        mimeType: 'image/webp',
        sizeBytes: 1024,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/owner/catalog/media')
      .send({
        storageKey: 'catalog/burger.gif',
        publicUrl: 'https://cdn.example.test/catalog/burger.gif',
        mimeType: 'image/gif',
        sizeBytes: 1024,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/owner/catalog/media')
      .send({
        storageKey: 'catalog/burger.webp',
        publicUrl: 'ftp://cdn.example.test/catalog/burger.webp',
        mimeType: 'image/webp',
        sizeBytes: 1024,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/owner/catalog/media')
      .send({
        storageKey: 'catalog/broken.webp',
        publicUrl: 'not-a-url',
        mimeType: 'image/webp',
        sizeBytes: 1024,
      })
      .expect(400);
  });

  it('rejects a product price above the database precision boundary', async () => {
    await request(app.getHttpServer())
      .post('/owner/catalog/products')
      .send({
        name: 'Impossible price',
        basePrice: '10000000000.00',
        availability: 'available',
        imageAssetIds: ['11111111-1111-4111-8111-111111111111'],
        categoryIds: ['22222222-2222-4222-8222-222222222222'],
      })
      .expect(400);
  });
});

describe('catalog service invariants', () => {
  it('rejects making a category its own parent', async () => {
    const categoryId = '22222222-2222-4222-8222-222222222222';
    const service = new CategoryService({} as never);

    await assert.rejects(
      service.update(owner.merchantId, owner.username, categoryId, 1, {
        parentId: categoryId,
      }),
      /cannot be its own parent/i,
    );
  });

  it('rejects moving a main category with children beneath another category', async () => {
    const categoryId = '22222222-2222-4222-8222-222222222222';
    const parentId = '33333333-3333-4333-8333-333333333333';
    const service = new CategoryService({
      category: {
        findFirst: async () => ({ _count: { children: 1 } }),
      },
    } as never);

    await assert.rejects(
      service.update(owner.merchantId, owner.username, categoryId, 1, { parentId }),
      /with children cannot become a child category/i,
    );
  });

  it('rejects archived category references on product creation', async () => {
    const service = new ProductService({
      mediaAsset: {
        findMany: async () => [{ id: '11111111-1111-4111-8111-111111111111' }],
      },
      category: { findMany: async () => [] },
    } as never);

    await assert.rejects(
      service.create(owner.merchantId, owner.username, {
        name: 'Burger',
        basePrice: '75.00',
        availability: 'available',
        imageAssetIds: ['11111111-1111-4111-8111-111111111111'],
        categoryIds: ['22222222-2222-4222-8222-222222222222'],
      }),
      /Every category must belong to this merchant/i,
    );
  });
});
