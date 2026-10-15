import type { OwnerProfile } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { LocalMediaStorage } from '../../src/infrastructure/storage/local-media-storage.js';
import { CategoryService } from '../../src/modules/catalog/categories/category.service.js';
import { ProductPricingService } from '../../src/modules/catalog/pricing/product-pricing.service.js';
import { ProductService } from '../../src/modules/catalog/products/product.service.js';
import { MediaService } from '../../src/modules/media/media.service.js';
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
    const servicePrisma = {
      product: { findFirst: async () => product },
    } as never;

    const servicePricing = new ProductPricingService(servicePrisma);

    const quote = await servicePricing.quote('product');
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
      selections: [
        {
          groupId: 'size-group',
          modifierGroupId: 'size-definition',
          optionIds: ['large'],
          priceAdjustment: '25.35',
        },
      ],
    });

    await assert.rejects(
      servicePricing.quote('product', [{ groupId: 'other-product-group', optionIds: ['large'] }]),
      /does not belong to this product/i,
    );
    await assert.rejects(
      servicePricing.quote('product', [{ groupId: 'size-group', optionIds: [] }]),
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
    const servicePrisma = {
      product: { findFirst: async () => product },
    } as never;

    const servicePricing = new ProductPricingService(servicePrisma);

    await assert.rejects(servicePricing.quote('product'), /Choose a product variant/i);
    await assert.rejects(
      servicePricing.quote('product', [], 'other'),
      /does not belong to this product/i,
    );
    await assert.rejects(servicePricing.quote('product', [], 'sold-out'), /out of stock/i);
    await assert.rejects(
      servicePricing.quote('product', [], 'disabled'),
      /variant is unavailable/i,
    );
    assert.deepEqual(await servicePricing.quote('product', [], 'small'), {
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
      new LocalMediaStorage({
        mediaStorageDirectory: storageDirectory,
        publicApiBaseUrl: 'http://localhost:4000',
      } as never),
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
          images: [
            {
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
            },
          ],
          categoryLinks: [
            {
              category: {
                id: categoryId,
                name: 'Mains',
                parentId: null,
                availability: 'available',
              },
            },
          ],
          modifierGroups: [
            {
              id: 'assignment-id',
              modifierGroupId: sharedGroupId,
              modifierGroup: { id: sharedGroupId, name: 'Size', description: null },
              selectionMode: 'single',
              minSelections: 1,
              maxSelections: 1,
              position: 0,
              options: [
                {
                  optionId: 'modifier-option',
                  option: { id: 'modifier-option', name: 'Large', position: 0 },
                  priceAdjustment: { toString: () => '25.00' },
                  defaultSelected: true,
                },
              ],
            },
          ],
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
    const servicePrisma = {
      mediaAsset: { findMany: async () => [{ id: imageId }] },
      category: { findMany: async () => [{ id: categoryId }] },
      $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    } as never;
    const service = new ProductService(servicePrisma);

    const product = await service.create(owner.merchantId, owner.username, {
      name: 'Burger',
      basePrice: '75.00',
      availability: 'available',
      imageAssetIds: [imageId],
      categoryIds: [categoryId],
      modifierGroups: [
        {
          name: 'Size',
          selectionMode: 'single',
          minSelections: 1,
          maxSelections: 1,
          position: 0,
          options: [
            { name: 'Large', priceAdjustment: '25.00', defaultSelected: true, position: 0 },
          ],
        },
      ],
    });

    assert.equal(product.sellingUnit, 'piece');
    assert.equal(product.modifierGroups[0]?.modifierGroupId, sharedGroupId);
    assert.equal(product.modifierGroups[0]?.options[0]?.priceAdjustment, '25.00');
    assert.equal(modifierGroupData?.name, 'Size');
    assert.equal(assignmentData?.productId, 'product');
    assert.equal(assignmentData?.modifierGroupId, sharedGroupId);
    assert.deepEqual(
      assignmentOptionData?.map((option) => ({
        priceAdjustment: option.priceAdjustment,
        defaultSelected: option.defaultSelected,
      })),
      [{ priceAdjustment: '25.00', defaultSelected: true }],
    );
    assert.deepEqual(productCreateData, {
      merchant: { connect: { id: owner.merchantId } },
      name: 'Burger',
      description: null,
      basePrice: '75.00',
      availability: 'available',
      createdBy: owner.username,
      updatedBy: owner.username,
      images: {
        create: [
          {
            position: 0,
            isPrimary: true,
            mediaAsset: {
              connect: { id_merchantId: { id: imageId, merchantId: owner.merchantId } },
            },
          },
        ],
      },
      categoryLinks: {
        create: [
          {
            category: {
              connect: { id_merchantId: { id: categoryId, merchantId: owner.merchantId } },
            },
          },
        ],
      },
    });
  });

  it('rejects archived category references on product creation', async () => {
    const servicePrisma = {
      mediaAsset: {
        findMany: async () => [{ id: '11111111-1111-4111-8111-111111111111' }],
      },
      category: { findMany: async () => [] },
    } as never;
    const service = new ProductService(servicePrisma);

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
