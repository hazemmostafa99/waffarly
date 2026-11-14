import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { CatalogQueryService } from '../../src/modules/catalog/catalog-query.service.js';
import { CategoryService } from '../../src/modules/catalog/categories/category.service.js';
import { ProductService } from '../../src/modules/catalog/products/product.service.js';
import { MerchantService } from '../../src/modules/merchants/merchant.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'pages tenant catalog, public catalog, and merchant results with scoped PostgreSQL cursors',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply migrations first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback pagination verification fixtures');

    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const suffix = randomUUID().replaceAll('-', '');
          const createMerchant = (label: string) =>
            transaction.merchant.create({
              data: {
                name: `Pagination ${label} ${suffix}`,
                storefrontSlug: `pagination-${label}-${suffix}`,
                activity: 'restaurant',
                contactPhone: `010${suffix.slice(0, 8)}`,
                ownerName: 'Pagination verification',
                ownerMobile: `011${suffix.slice(0, 8)}`,
              },
            });
          const [merchant, otherMerchant] = await Promise.all([
            createMerchant('one'),
            createMerchant('two'),
          ]);
          const [media, otherMedia] = await Promise.all([
            transaction.mediaAsset.create({
              data: {
                merchantId: merchant.id,
                storageKey: `pagination/${suffix}.jpg`,
                publicUrl: `http://localhost:4000/media/pagination/${suffix}.jpg`,
                mimeType: 'image/jpeg',
                sizeBytes: 16,
                createdBy: 'pagination-database-test',
              },
            }),
            transaction.mediaAsset.create({
              data: {
                merchantId: otherMerchant.id,
                storageKey: `pagination/${suffix}-other.jpg`,
                publicUrl: `http://localhost:4000/media/pagination/${suffix}-other.jpg`,
                mimeType: 'image/jpeg',
                sizeBytes: 16,
                createdBy: 'pagination-database-test',
              },
            }),
          ]);
          await transaction.category.createMany({
            data: Array.from({ length: 201 }, (_, index) => ({
              merchantId: merchant.id,
              name: `Category ${String(index).padStart(3, '0')}`,
              imageAssetId: media.id,
              availability: 'available',
              createdBy: 'pagination-database-test',
              updatedBy: 'pagination-database-test',
            })),
          });
          await transaction.category.create({
            data: {
              merchantId: otherMerchant.id,
              name: 'Other tenant category',
              imageAssetId: otherMedia.id,
              availability: 'available',
              createdBy: 'pagination-database-test',
              updatedBy: 'pagination-database-test',
            },
          });
          await transaction.product.createMany({
            data: Array.from({ length: 41 }, (_, index) => ({
              merchantId: merchant.id,
              name: `Product ${String(index).padStart(3, '0')}`,
              basePrice: '10.00',
              availability: 'available',
              createdBy: 'pagination-database-test',
              updatedBy: 'pagination-database-test',
            })),
          });
          const otherProduct = await transaction.product.create({
            data: {
              merchantId: otherMerchant.id,
              name: 'Other tenant product',
              basePrice: '10.00',
              availability: 'available',
              createdBy: 'pagination-database-test',
              updatedBy: 'pagination-database-test',
            },
          });

          const prisma = transaction as unknown as PrismaService;
          const products = new ProductService(prisma);
          const categories = new CategoryService(prisma);
          const publicCatalog = new CatalogQueryService(prisma);
          const merchants = new MerchantService(prisma);

          const productPageOne = await products.list(merchant.id, { limit: 20 });
          assert.equal(productPageOne.items.length, 20);
          assert.ok(productPageOne.nextCursor);
          const productPageTwo = await products.list(merchant.id, {
            limit: 20,
            cursor: productPageOne.nextCursor,
          });
          assert.equal(productPageTwo.items.length, 20);
          assert.equal(
            new Set([...productPageOne.items, ...productPageTwo.items].map(({ id }) => id)).size,
            40,
          );
          await assert.rejects(
            products.list(merchant.id, { limit: 20, cursor: otherProduct.id }),
            /Pagination cursor is invalid/i,
          );

          const categoryPageOne = await categories.list(merchant.id, { limit: 50 });
          const categoryPageTwo = await categories.list(merchant.id, {
            limit: 50,
            cursor: categoryPageOne.nextCursor!,
          });
          const categoryPageThree = await categories.list(merchant.id, {
            limit: 50,
            cursor: categoryPageTwo.nextCursor!,
          });
          const categoryPageFour = await categories.list(merchant.id, {
            limit: 50,
            cursor: categoryPageThree.nextCursor!,
          });
          const categoryPageFive = await categories.list(merchant.id, {
            limit: 50,
            cursor: categoryPageFour.nextCursor!,
          });
          assert.deepEqual(
            [
              categoryPageOne.items.length,
              categoryPageTwo.items.length,
              categoryPageThree.items.length,
              categoryPageFour.items.length,
              categoryPageFive.items.length,
            ],
            [50, 50, 50, 50, 1],
          );
          assert.equal((await categories.list(otherMerchant.id)).items.length, 1);

          const publicPageOne = await publicCatalog.getPublicStorefrontCatalog(
            merchant.storefrontSlug,
          );
          assert.equal(publicPageOne.products.length, 40);
          assert.equal(publicPageOne.categories.length, 100);
          assert.ok(publicPageOne.nextProductCursor);
          assert.ok(publicPageOne.nextCategoryCursor);
          await assert.rejects(
            publicCatalog.getPublicStorefrontProducts(merchant.storefrontSlug, otherProduct.id),
            /Product pagination cursor is invalid/i,
          );
          const publicProductPageTwo = await publicCatalog.getPublicStorefrontProducts(
            merchant.storefrontSlug,
            publicPageOne.nextProductCursor!,
          );
          const publicCategoryPageTwo = await publicCatalog.getPublicStorefrontCategories(
            merchant.storefrontSlug,
            publicPageOne.nextCategoryCursor!,
          );
          assert.equal(publicProductPageTwo.items.length, 1);
          assert.equal(publicProductPageTwo.nextCursor, null);
          assert.equal(publicCategoryPageTwo.items.length, 100);
          assert.ok(publicCategoryPageTwo.nextCursor);

          const publicCategoryPageThree = await publicCatalog.getPublicStorefrontCategories(
            merchant.storefrontSlug,
            publicCategoryPageTwo.nextCursor,
          );
          assert.equal(publicCategoryPageThree.items.length, 1);
          assert.equal(publicCategoryPageThree.nextCursor, null);
          assert.equal(
            new Set(
              [
                ...publicPageOne.categories,
                ...publicCategoryPageTwo.items,
                ...publicCategoryPageThree.items,
              ].map(({ id }) => id),
            ).size,
            201,
          );

          const merchantPageOne = await merchants.list({ limit: 1 });
          assert.equal(merchantPageOne.items.length, 1);
          assert.ok(merchantPageOne.nextCursor);
          const merchantPageTwo = await merchants.list({
            limit: 1,
            cursor: merchantPageOne.nextCursor,
          });
          assert.equal(merchantPageTwo.items.length, 1);
          assert.notEqual(merchantPageOne.items[0]!.id, merchantPageTwo.items[0]!.id);

          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
