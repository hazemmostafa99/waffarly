import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { OwnerProfile } from '@waffarly/contracts';
import { StructuredLogger } from '../src/common/logging/structured-logger.js';
import { configureHttpApplication } from '../src/configure-http-application.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { OwnerGuard } from '../src/modules/auth/owner.guard.js';
import { CategoryController } from '../src/modules/catalog/category.controller.js';
import { CategoryService } from '../src/modules/catalog/category.service.js';
import { MediaController } from '../src/modules/catalog/media.controller.js';
import { MediaService } from '../src/modules/catalog/media.service.js';
import { ModifierGroupController } from '../src/modules/catalog/modifier-group.controller.js';
import { ModifierGroupService } from '../src/modules/catalog/modifier-group.service.js';
import {
  ProductController,
  ProductQuoteController,
  PublicStorefrontController,
} from '../src/modules/catalog/product.controller.js';
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
  let createdModifierGroup: { merchantId: string; input: unknown } | undefined;
  let quotedProduct:
    | { id: string; variantId?: string; selections: unknown; storefrontSlug?: string }
    | undefined;
  let attachedModifierGroup: { productId: string; revision: number; assignment: unknown } | undefined;
  let detachedModifierGroup: { productId: string; assignmentId: string; revision: number } | undefined;
  let publicSlug: string | undefined;

  beforeEach(async () => {
    authorized = true;
    createdProduct = undefined;
    createdModifierGroup = undefined;
    quotedProduct = undefined;
    attachedModifierGroup = undefined;
    detachedModifierGroup = undefined;
    publicSlug = undefined;
    const module = await Test.createTestingModule({
      controllers: [
        MediaController,
        ModifierGroupController,
        CategoryController,
        ProductController,
        ProductQuoteController,
        PublicStorefrontController,
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
            getPublicStorefrontCatalog: async (slug: string) => {
              publicSlug = slug;
              return { slug, products: [] };
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

    await request(app.getHttpServer())
      .post(`/catalog/products/${productId}/quote`)
      .send({ selections: [{ groupId: 'not-a-uuid', optionIds: [] }] })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/catalog/products/${productId}/quote`)
      .send({ variantId: 'not-a-uuid' })
      .expect(400);
  });

  it('exposes public storefront catalogs without requiring an owner session', async () => {
    authorized = false;
    const response = await request(app.getHttpServer()).get('/catalog/stores/cairo-cafe').expect(200);
    assert.deepEqual(response.body, { slug: 'cairo-cafe', products: [] });
    assert.equal(publicSlug, 'cairo-cafe');
    await request(app.getHttpServer()).get('/catalog/stores/Not%20A%20Slug').expect(400);

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

describe('catalog service invariants', () => {
  it('quotes defaults using fixed-precision arithmetic and the current product revision', async () => {
    const product = {
      id: 'product',
      availability: 'available',
      basePrice: { toString: () => '75.10' },
      revision: 7,
      variants: [],
      modifierGroups: [
        {
          id: 'size-group',
          modifierGroupId: 'size-definition',
          selectionMode: 'single',
          minSelections: 1,
          maxSelections: 1,
          modifierGroup: { id: 'size-definition', name: 'Size', description: null },
          options: [
            {
              optionId: 'regular',
              option: { id: 'regular', name: 'Regular', position: 0 },
              priceAdjustment: { toString: () => '0.20' },
              defaultSelected: false,
            },
            {
              optionId: 'large',
              option: { id: 'large', name: 'Large', position: 1 },
              priceAdjustment: { toString: () => '25.35' },
              defaultSelected: true,
            },
          ],
        },
      ],
    };
    const service = new ProductService({
      product: { findFirst: async () => product },
    } as never);

    const quote = await service.quote('product');
    assert.deepEqual(quote, {
      productId: 'product',
      productRevision: 7,
      variantId: null,
      variantName: null,
      variantAttributes: [],
      currency: 'EGP',
      basePrice: '75.10',
      modifierTotal: '25.35',
      totalPrice: '100.45',
      selections: [{ groupId: 'size-group', modifierGroupId: 'size-definition', optionIds: ['large'], priceAdjustment: '25.35' }],
    });

    await assert.rejects(
      service.quote('product', [{ groupId: 'other-product-group', optionIds: ['large'] }]),
      /does not belong to this product/i,
    );
    await assert.rejects(
      service.quote('product', [{ groupId: 'size-group', optionIds: [] }]),
      /Select between 1 and 1/i,
    );
  });

  it('quotes the selected variant price and rejects missing, foreign, unavailable, or sold-out variants', async () => {
    const product = {
      id: 'product',
      availability: 'available',
      basePrice: { toString: () => '75.10' },
      revision: 3,
      variants: [
        {
          id: 'small',
          name: 'Small',
          price: { toString: () => '80.00' },
          availability: 'available',
          stockQuantity: 4,
          attributeSelections: [],
        },
        {
          id: 'sold-out',
          name: 'Sold out',
          price: { toString: () => '90.00' },
          availability: 'available',
          stockQuantity: 0,
          attributeSelections: [],
        },
        {
          id: 'disabled',
          name: 'Disabled',
          price: { toString: () => '95.00' },
          availability: 'unavailable',
          stockQuantity: null,
          attributeSelections: [],
        },
      ],
      modifierGroups: [],
    };
    const service = new ProductService({
      product: { findFirst: async () => product },
    } as never);

    await assert.rejects(service.quote('product'), /Choose a product variant/i);
    await assert.rejects(service.quote('product', [], 'other'), /does not belong to this product/i);
    await assert.rejects(service.quote('product', [], 'sold-out'), /out of stock/i);
    await assert.rejects(service.quote('product', [], 'disabled'), /variant is unavailable/i);
    assert.deepEqual(await service.quote('product', [], 'small'), {
      productId: 'product',
      productRevision: 3,
      variantId: 'small',
      variantName: 'Small',
      variantAttributes: [],
      currency: 'EGP',
      basePrice: '80.00',
      modifierTotal: '0.00',
      totalPrice: '80.00',
      selections: [],
    });
  });

  it('stores uploads under a generated tenant path and verifies the actual file signature', async () => {
    const storageDirectory = await mkdtemp(join(tmpdir(), 'waffarly-catalog-media-'));
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const service = new MediaService(
      {
        mediaAsset: {
          create: async ({ data }: { data: Record<string, unknown> }) => ({
            id: 'stored-media',
            ...data,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
      } as never,
      {
        mediaStorageDirectory: storageDirectory,
        publicApiBaseUrl: 'http://localhost:4000',
      } as never,
    );

    try {
      const asset = await service.upload(owner.merchantId, owner.username, {
        buffer: image,
        originalName: 'dish photo.jpg',
      });
      assert.equal(asset.mimeType, 'image/jpeg');
      assert.equal(asset.sizeBytes, image.length);
      assert.match(
        asset.storageKey,
        new RegExp(`^${owner.merchantId}/[0-9a-f-]+/dish-photo\\.jpg$`),
      );
      assert.equal(asset.publicUrl, `http://localhost:4000/media/${asset.storageKey}`);
      assert.deepEqual(
        await readFile(resolve(storageDirectory, ...asset.storageKey.split('/'))),
        image,
      );

      await assert.rejects(
        service.upload(owner.merchantId, owner.username, {
          buffer: Buffer.from('not an image'),
          originalName: 'dish.jpg',
        }),
        /valid JPEG, PNG, or WebP/i,
      );
    } finally {
      await rm(storageDirectory, { recursive: true, force: true });
    }
  });

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

  it('creates tenant-owned modifier definitions and separate product assignments', async () => {
    const imageId = '11111111-1111-4111-8111-111111111111';
    const categoryId = '22222222-2222-4222-8222-222222222222';
    const now = new Date('2026-01-01T00:00:00.000Z');
    let productCreateData: Record<string, unknown> | undefined;
    let modifierGroupData: Record<string, unknown> | undefined;
    let assignmentData: Record<string, unknown> | undefined;
    let assignmentOptionData: Array<Record<string, unknown>> | undefined;
    let sharedGroupId = '';
    const transaction = {
      product: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          productCreateData = data;
          return { id: 'product' };
        },
        findUniqueOrThrow: async () => ({
          id: 'product',
          name: 'Burger',
          description: null,
          basePrice: { toString: () => '75.00' },
          availability: 'available',
          archivedAt: null,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          images: [{
            id: 'product-image',
            mediaAssetId: imageId,
            isPrimary: true,
            position: 0,
            mediaAsset: {
              id: imageId,
              publicUrl: 'http://localhost:4000/media/burger.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: 12,
            },
          }],
          categoryLinks: [{ category: { id: categoryId, name: 'Mains', parentId: null, availability: 'available' } }],
          modifierGroups: [{
            id: 'assignment-id',
            modifierGroupId: sharedGroupId,
            modifierGroup: { id: sharedGroupId, name: 'Size', description: null },
            selectionMode: 'single',
            minSelections: 1,
            maxSelections: 1,
            position: 0,
            options: [{
              optionId: 'modifier-option',
              option: { id: 'modifier-option', name: 'Large', position: 0 },
              priceAdjustment: { toString: () => '25.00' },
              defaultSelected: true,
            }],
          }],
          variants: [],
        }),
      },
      modifierGroup: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          modifierGroupData = data;
          sharedGroupId = data.id as string;
          return { id: sharedGroupId };
        },
      },
      productModifierGroupAssignment: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          assignmentData = data;
          return { id: 'assignment-id' };
        },
      },
      productModifierGroupAssignmentOption: {
        createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
          assignmentOptionData = data;
        },
      },
    };
    const service = new ProductService({
      mediaAsset: { findMany: async () => [{ id: imageId }] },
      category: { findMany: async () => [{ id: categoryId }] },
      $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
    } as never);

    const product = await service.create(owner.merchantId, owner.username, {
      name: 'Burger',
      basePrice: '75.00',
      availability: 'available',
      imageAssetIds: [imageId],
      categoryIds: [categoryId],
      modifierGroups: [{
        name: 'Size',
        selectionMode: 'single',
        minSelections: 1,
        maxSelections: 1,
        position: 0,
        options: [{ name: 'Large', priceAdjustment: '25.00', defaultSelected: true, position: 0 }],
      }],
    });

    assert.equal(product.sellingUnit, 'piece');
    assert.equal(product.modifierGroups[0]?.modifierGroupId, sharedGroupId);
    assert.equal(product.modifierGroups[0]?.options[0]?.priceAdjustment, '25.00');
    assert.equal(modifierGroupData?.name, 'Size');
    assert.equal(assignmentData?.productId, 'product');
    assert.equal(assignmentData?.modifierGroupId, sharedGroupId);
    assert.deepEqual(assignmentOptionData?.map((option) => ({
      priceAdjustment: option.priceAdjustment,
      defaultSelected: option.defaultSelected,
    })), [{ priceAdjustment: '25.00', defaultSelected: true }]);
    assert.deepEqual(productCreateData, {
      merchant: { connect: { id: owner.merchantId } },
      name: 'Burger',
      description: null,
      basePrice: '75.00',
      availability: 'available',
      createdBy: owner.username,
      updatedBy: owner.username,
      images: {
        create: [{
          position: 0,
          isPrimary: true,
          mediaAsset: { connect: { id_merchantId: { id: imageId, merchantId: owner.merchantId } } },
        }],
      },
      categoryLinks: {
        create: [{ category: { connect: { id_merchantId: { id: categoryId, merchantId: owner.merchantId } } } }],
      },
    });
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
      config as never,
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
