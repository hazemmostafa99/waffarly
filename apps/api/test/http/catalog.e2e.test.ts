import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OwnerProfile, PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { StructuredLogger } from '../../src/common/logging/structured-logger.js';
import { configureHttpApplication } from '../../src/configure-http-application.js';
import { LocalMediaStorage } from '../../src/infrastructure/storage/local-media-storage.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../../src/modules/auth/owner.guard.js';
import { PosEmployeeGuard } from '../../src/modules/auth/pos-employee.guard.js';
import { CatalogQueryService } from '../../src/modules/catalog/catalog-query.service.js';
import { PosCatalogController } from '../../src/modules/catalog/pos-catalog.controller.js';
import { CategoryController } from '../../src/modules/catalog/categories/category.controller.js';
import { CategoryService } from '../../src/modules/catalog/categories/category.service.js';
import { ModifierGroupController } from '../../src/modules/catalog/modifiers/modifier-group.controller.js';
import { ModifierGroupService } from '../../src/modules/catalog/modifiers/modifier-group.service.js';
import { ProductPricingService } from '../../src/modules/catalog/pricing/product-pricing.service.js';
import { ProductQuoteController } from '../../src/modules/catalog/pricing/product-quote.controller.js';
import { ProductController } from '../../src/modules/catalog/products/product.controller.js';
import { ProductService } from '../../src/modules/catalog/products/product.service.js';
import { MediaController } from '../../src/modules/media/media.controller.js';
import { MediaService } from '../../src/modules/media/media.service.js';
import { PublicStorefrontController } from '../../src/modules/storefront/public-storefront.controller.js';

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

const posEmployee: PosEmployeeSession = {
  id: '22222222-2222-4222-8222-222222222222',
  merchantId: owner.merchantId,
  username: 'cashier',
  displayName: 'Cashier',
  role: null,
  permissions: ['accept_recipe_orders', 'start_preparation'],
  branches: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Central',
      archivedAt: null,
    },
  ],
};

describe('catalog owner endpoints', () => {
  let app: INestApplication;
  let authorized: boolean;
  let createdProduct: Record<string, unknown> | undefined;
  let readProduct: { merchantId: string; id: string } | undefined;
  let createdModifierGroup: { merchantId: string; input: unknown } | undefined;
  let quotedProduct:
    { id: string; variantId?: string; selections: unknown; storefrontSlug?: string } | undefined;
  let attachedModifierGroup:
    { productId: string; revision: number; assignment: unknown } | undefined;
  let detachedModifierGroup:
    { productId: string; assignmentId: string; revision: number } | undefined;
  let publicSlug: string | undefined;
  let publicProductCursor: string | undefined;
  let publicCategoryCursor: string | undefined;
  let posEmployeeAuthorized: boolean;
  let posCatalogRead:
    { merchantId: string; productCursor?: string; categoryCursor?: string } | undefined;

  beforeEach(async () => {
    authorized = true;
    createdProduct = undefined;
    readProduct = undefined;
    createdModifierGroup = undefined;
    quotedProduct = undefined;
    attachedModifierGroup = undefined;
    detachedModifierGroup = undefined;
    publicSlug = undefined;
    publicProductCursor = undefined;
    publicCategoryCursor = undefined;
    posEmployeeAuthorized = true;
    posCatalogRead = undefined;
    const module = await Test.createTestingModule({
      controllers: [
        MediaController,
        ModifierGroupController,
        CategoryController,
        ProductController,
        ProductQuoteController,
        PosCatalogController,
        PublicStorefrontController,
      ],
      providers: [
        OwnerGuard,
        PosEmployeeGuard,
        {
          provide: AuthService,
          useValue: {
            requireOwner: async () => {
              if (!authorized) throw new UnauthorizedException();
              return owner;
            },
            requirePosEmployee: async () => {
              if (!posEmployeeAuthorized) throw new UnauthorizedException();
              return posEmployee;
            },
          },
        },
        {
          provide: MediaService,
          useValue: {
            list: async () => [],
            upload: async (_merchantId: string, _actor: string, file: { buffer: Buffer }) => ({
              id: 'uploaded-media',
              storageKey: 'merchant/uploaded-image.jpg',
              publicUrl: 'http://localhost:4000/media/merchant/uploaded-image.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: file.buffer.length,
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            }),
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
          provide: ModifierGroupService,
          useValue: {
            list: async () => [],
            get: async (_merchantId: string, id: string) => ({ id, name: 'Sauces' }),
            create: async (merchantId: string, input: unknown) => {
              createdModifierGroup = { merchantId, input };
              return { id: 'modifier-group', ...(input as Record<string, unknown>) };
            },
          },
        },
        {
          provide: ProductService,
          useValue: {
            get: async (merchantId: string, id: string) => {
              readProduct = { merchantId, id };
              return { id };
            },
            list: async () => [],
            attachModifierGroup: async (
              _merchantId: string,
              _actor: string,
              productId: string,
              revision: number,
              assignment: unknown,
            ) => {
              attachedModifierGroup = { productId, revision, assignment };
              return { id: productId };
            },
            detachModifierGroup: async (
              _merchantId: string,
              _actor: string,
              productId: string,
              assignmentId: string,
              revision: number,
            ) => {
              detachedModifierGroup = { productId, assignmentId, revision };
              return { id: productId };
            },
            create: async (_merchantId: string, _actor: string, input: unknown) => {
              createdProduct = input as Record<string, unknown>;
              return { id: 'product', ...createdProduct };
            },
          },
        },
        {
          provide: ProductPricingService,
          useValue: {
            quote: async (
              id: string,
              selections: unknown,
              variantId?: string,
              storefrontSlug?: string,
            ) => {
              quotedProduct = {
                id,
                ...(variantId ? { variantId } : {}),
                selections,
                ...(storefrontSlug ? { storefrontSlug } : {}),
              };
              return { productId: id, selections };
            },
          },
        },
        {
          provide: CatalogQueryService,
          useValue: {
            getPublicStorefrontCatalog: async (slug: string) => {
              publicSlug = slug;
              return { slug, products: [] };
            },
            getPublicStorefrontProducts: async (slug: string, cursor?: string) => {
              publicSlug = slug;
              publicProductCursor = cursor;
              return { items: [], nextCursor: null };
            },
            getPublicStorefrontCategories: async (slug: string, cursor?: string) => {
              publicSlug = slug;
              publicCategoryCursor = cursor;
              return { items: [], nextCursor: null };
            },
            getPosSellableCatalog: async (
              merchantId: string,
              productCursor?: string,
              categoryCursor?: string,
            ) => {
              posCatalogRead = {
                merchantId,
                ...(productCursor ? { productCursor } : {}),
                ...(categoryCursor ? { categoryCursor } : {}),
              };
              return {
                categories: { items: [], nextCursor: null },
                products: { items: [], nextCursor: null },
              };
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

  it('reads one product under the authenticated owner tenant', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    authorized = false;
    await request(app.getHttpServer()).get(`/owner/catalog/products/${id}`).expect(401);
    assert.equal(readProduct, undefined);
    authorized = true;
    await request(app.getHttpServer()).get(`/owner/catalog/products/${id}`).expect(200);
    assert.deepEqual(readProduct, { merchantId: owner.merchantId, id });
  });

  it('protects catalog management with the owner session', async () => {
    authorized = false;
    await request(app.getHttpServer()).get('/owner/catalog/products').expect(401);
    await request(app.getHttpServer()).get('/owner/catalog/categories').expect(401);
    await request(app.getHttpServer()).get('/owner/catalog/media').expect(401);
    await request(app.getHttpServer()).get('/owner/catalog/modifier-groups').expect(401);
  });

  it('creates reusable merchant modifier definitions under the owner tenant', async () => {
    const payload = {
      name: 'Sauces',
      description: 'Choose a sauce',
      options: [
        { name: 'Mayo', position: 0 },
        { name: 'BBQ', position: 1 },
      ],
    };
    const response = await request(app.getHttpServer())
      .post('/owner/catalog/modifier-groups')
      .send(payload)
      .expect(201);
    assert.equal(response.body.id, 'modifier-group');
    assert.deepEqual(createdModifierGroup, { merchantId: owner.merchantId, input: payload });
  });

  it('reads one reusable modifier definition through the authenticated owner route', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const response = await request(app.getHttpServer())
      .get(`/owner/catalog/modifier-groups/${id}`)
      .expect(200);
    assert.equal(response.body.id, id);
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

  it('accepts ordered product-local modifier groups and validates selection bounds', async () => {
    const payload = {
      name: 'Burger',
      basePrice: '75.00',
      availability: 'available',
      imageAssetIds: ['11111111-1111-4111-8111-111111111111'],
      categoryIds: ['22222222-2222-4222-8222-222222222222'],
      modifierGroups: [
        {
          name: 'Size',
          selectionMode: 'single',
          minSelections: 1,
          maxSelections: 1,
          position: 0,
          options: [
            { name: 'Regular', priceAdjustment: '0', defaultSelected: false, position: 0 },
            { name: 'Large', priceAdjustment: '25.00', defaultSelected: true, position: 1 },
          ],
        },
      ],
    };
    await request(app.getHttpServer()).post('/owner/catalog/products').send(payload).expect(201);
    assert.deepEqual(createdProduct?.modifierGroups, payload.modifierGroups);

    await request(app.getHttpServer())
      .post('/owner/catalog/products')
      .send({
        ...payload,
        modifierGroups: [{ ...payload.modifierGroups[0], minSelections: 2 }],
      })
      .expect(400);
  });

  it('accepts a reusable-group assignment and generic variant attribute values', async () => {
    const payload = {
      name: 'Coffee',
      basePrice: '80.00',
      availability: 'available',
      imageAssetIds: ['11111111-1111-4111-8111-111111111111'],
      categoryIds: ['22222222-2222-4222-8222-222222222222'],
      modifierGroupAssignments: [
        {
          modifierGroupId: '33333333-3333-4333-8333-333333333333',
          selectionMode: 'single',
          minSelections: 0,
          maxSelections: 1,
          position: 0,
          options: [
            {
              optionId: '44444444-4444-4444-8444-444444444444',
              priceAdjustment: '5.00',
              defaultSelected: false,
            },
          ],
        },
      ],
      variants: [
        {
          name: 'Large cup',
          price: '100.00',
          availability: 'available',
          position: 0,
          attributes: [{ name: 'Cup size', value: 'Large' }],
        },
      ],
    };
    await request(app.getHttpServer()).post('/owner/catalog/products').send(payload).expect(201);
    assert.deepEqual(createdProduct?.modifierGroupAssignments, payload.modifierGroupAssignments);
    assert.deepEqual(createdProduct?.variants, payload.variants);
  });

  it('attaches and detaches reusable groups with product revision checks', async () => {
    const productId = '11111111-1111-4111-8111-111111111111';
    const modifierGroupId = '22222222-2222-4222-8222-222222222222';
    const optionId = '33333333-3333-4333-8333-333333333333';
    const assignmentId = '44444444-4444-4444-8444-444444444444';
    const assignment = {
      modifierGroupId,
      selectionMode: 'single',
      minSelections: 0,
      maxSelections: 1,
      position: 0,
      options: [{ optionId, priceAdjustment: '2.00', defaultSelected: false }],
    };
    await request(app.getHttpServer())
      .post(`/owner/catalog/products/${productId}/modifier-groups`)
      .send({ ...assignment, revision: 7 })
      .expect(201);
    assert.deepEqual(attachedModifierGroup, { productId, revision: 7, assignment });
    await request(app.getHttpServer())
      .delete(`/owner/catalog/products/${productId}/modifier-groups/${assignmentId}`)
      .send({ revision: 8 })
      .expect(200);
    assert.deepEqual(detachedModifierGroup, { productId, assignmentId, revision: 8 });
  });

  it('accepts sellable product variants and rejects invalid prices or duplicate identifiers', async () => {
    const payload = {
      name: 'Coffee',
      basePrice: '80.00',
      availability: 'available',
      imageAssetIds: ['11111111-1111-4111-8111-111111111111'],
      categoryIds: ['22222222-2222-4222-8222-222222222222'],
      variants: [
        {
          name: 'Small',
          sku: 'COF-S',
          barcode: '1234567890123',
          price: '80.00',
          stockQuantity: 12,
          availability: 'available',
          position: 0,
        },
        {
          name: 'Large',
          sku: 'COF-L',
          barcode: '1234567890124',
          price: '105.50',
          stockQuantity: null,
          availability: 'available',
          position: 1,
        },
      ],
    };
    await request(app.getHttpServer()).post('/owner/catalog/products').send(payload).expect(201);
    assert.deepEqual(createdProduct?.variants, payload.variants);

    await request(app.getHttpServer())
      .post('/owner/catalog/products')
      .send({ ...payload, variants: [{ ...payload.variants[0], price: '0' }] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/owner/catalog/products')
      .send({
        ...payload,
        variants: [payload.variants[0], { ...payload.variants[1], sku: ' cof-s ' }],
      })
      .expect(400);
  });

  it('exposes a public quote endpoint and validates its variant and selection payload', async () => {
    const groupId = '33333333-3333-4333-8333-333333333333';
    const optionId = '44444444-4444-4444-8444-444444444444';
    const productId = '55555555-5555-4555-8555-555555555555';
    authorized = false;

    await request(app.getHttpServer())
      .post(`/catalog/products/${productId}/quote`)
      .send({ variantId: optionId, selections: [{ groupId, optionIds: [optionId] }] })
      .expect(200);
    assert.deepEqual(quotedProduct, {
      id: productId,
      variantId: optionId,
      selections: [{ groupId, optionIds: [optionId] }],
    });

    const quantified = [
      { groupId, optionIds: [optionId], optionQuantities: [{ optionId, quantity: 3 }] },
    ];
    await request(app.getHttpServer())
      .post(`/catalog/products/${productId}/quote`)
      .send({ selections: quantified })
      .expect(200);
    assert.deepEqual(quotedProduct?.selections, quantified);
    for (const quantity of [0, -1, 1.5, 100]) {
      await request(app.getHttpServer())
        .post(`/catalog/products/${productId}/quote`)
        .send({
          selections: [
            { groupId, optionIds: [optionId], optionQuantities: [{ optionId, quantity }] },
          ],
        })
        .expect(400);
    }

    await request(app.getHttpServer())
      .post(`/catalog/products/${productId}/quote`)
      .send({ selections: [{ groupId: 'not-a-uuid', optionIds: [] }] })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/catalog/products/${productId}/quote`)
      .send({ variantId: 'not-a-uuid' })
      .expect(400);
  });

  it('serves the POS sellable catalog only to an authenticated employee and derives its tenant from the session', async () => {
    const productCursor = '55555555-5555-4555-8555-555555555555';
    const categoryCursor = '66666666-6666-4666-8666-666666666666';
    posEmployeeAuthorized = false;
    await request(app.getHttpServer()).get('/pos/catalog').expect(401);
    assert.equal(posCatalogRead, undefined);

    posEmployeeAuthorized = true;
    const response = await request(app.getHttpServer())
      .get(`/pos/catalog?productCursor=${productCursor}&categoryCursor=${categoryCursor}`)
      .expect(200);
    assert.deepEqual(response.body, {
      categories: { items: [], nextCursor: null },
      products: { items: [], nextCursor: null },
    });
    assert.deepEqual(posCatalogRead, {
      merchantId: owner.merchantId,
      productCursor,
      categoryCursor,
    });

    await request(app.getHttpServer()).get('/pos/catalog?productCursor=invalid').expect(400);
    assert.deepEqual(posCatalogRead, {
      merchantId: owner.merchantId,
      productCursor,
      categoryCursor,
    });
  });

  it('exposes public storefront catalogs without requiring an owner session', async () => {
    authorized = false;
    const response = await request(app.getHttpServer())
      .get('/catalog/stores/cairo-cafe')
      .expect(200);
    assert.deepEqual(response.body, { slug: 'cairo-cafe', products: [] });
    assert.equal(publicSlug, 'cairo-cafe');
    await request(app.getHttpServer()).get('/catalog/stores/Not%20A%20Slug').expect(400);
    await request(app.getHttpServer())
      .get('/catalog/stores/cairo-cafe/products?cursor=55555555-5555-4555-8555-555555555555')
      .expect(200);
    assert.equal(publicProductCursor, '55555555-5555-4555-8555-555555555555');
    await request(app.getHttpServer())
      .get('/catalog/stores/cairo-cafe/categories?cursor=not-a-uuid')
      .expect(400);
    await request(app.getHttpServer()).get('/catalog/stores/cairo-cafe/categories').expect(200);
    assert.equal(publicCategoryCursor, undefined);

    const productId = '55555555-5555-4555-8555-555555555555';
    await request(app.getHttpServer())
      .post(`/catalog/stores/cairo-cafe/products/${productId}/quote`)
      .send({})
      .expect(200);
    assert.deepEqual(quotedProduct, {
      id: productId,
      selections: [],
      storefrontSlug: 'cairo-cafe',
    });
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

  it('accepts multipart device uploads only through the owner session', async () => {
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const response = await request(app.getHttpServer())
      .post('/owner/catalog/media/upload')
      .attach('file', image, { filename: 'dish.jpg', contentType: 'image/jpeg' })
      .expect(201);
    assert.equal(response.body.id, 'uploaded-media');
    assert.equal(response.body.mimeType, 'image/jpeg');
    assert.equal(response.body.sizeBytes, image.length);

    authorized = false;
    await request(app.getHttpServer())
      .post('/owner/catalog/media/upload')
      .attach('file', image, { filename: 'dish.jpg', contentType: 'image/jpeg' })
      .expect(401);

    authorized = true;
    await request(app.getHttpServer())
      .post('/owner/catalog/media/upload')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'oversized.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);
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

describe('catalog media local file delivery', () => {
  let app: INestApplication | undefined;
  let storageDirectory: string | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    if (storageDirectory) await rm(storageDirectory, { recursive: true, force: true });
    storageDirectory = undefined;
  });

  it('stores an uploaded image and serves it from its generated public URL', async () => {
    storageDirectory = await mkdtemp(join(tmpdir(), 'waffarly-media-delivery-'));
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const config = {
      corsOrigins: [],
      mediaStorageDirectory: storageDirectory,
      publicApiBaseUrl: 'http://localhost:4000',
    };
    const media = new MediaService(
      {
        mediaAsset: {
          create: async ({ data }: { data: Record<string, unknown> }) => ({
            id: 'stored-media',
            ...data,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
      } as never,
      new LocalMediaStorage(config as never),
    );
    const module = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        OwnerGuard,
        { provide: AuthService, useValue: { requireOwner: async () => owner } },
        { provide: MediaService, useValue: media },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureHttpApplication(app, config as never, new StructuredLogger());
    await app.init();

    const uploaded = await request(app.getHttpServer())
      .post('/owner/catalog/media/upload')
      .attach('file', image, { filename: 'dish.jpg', contentType: 'image/jpeg' })
      .expect(201);
    assert.equal(uploaded.body.mimeType, 'image/jpeg');
    assert.equal(
      uploaded.body.publicUrl,
      `http://localhost:4000/media/${uploaded.body.storageKey}`,
    );

    const delivered = await request(app.getHttpServer())
      .get(new URL(uploaded.body.publicUrl).pathname)
      .expect(200)
      .expect('content-type', /image\/jpeg/)
      .expect('x-content-type-options', 'nosniff');
    assert.equal(Number(delivered.headers['content-length']), image.length);
    assert.deepEqual(
      await readFile(resolve(storageDirectory, ...uploaded.body.storageKey.split('/'))),
      image,
    );
  });
});
