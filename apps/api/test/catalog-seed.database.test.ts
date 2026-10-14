import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { config } from 'dotenv';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { ProductService } from '../src/modules/catalog/product.service.js';
import { seedRestaurantCatalog } from '../src/scripts/catalog-seed-data.js';

config({ path: new URL('../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'creates an idempotent, storefront-safe restaurant catalog with variants and stock edge cases',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply migrations first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback catalog seed verification fixtures');

    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const suffix = randomUUID().replaceAll('-', '');
          const merchant = await transaction.merchant.create({
            data: {
              name: 'Catalog seed verification',
              storefrontSlug: `catalog-seed-${suffix}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Catalog seed verification',
              ownerMobile: '01100000000',
            },
          });
          const first = await seedRestaurantCatalog(transaction, merchant.id, 'http://localhost:4000');
          const second = await seedRestaurantCatalog(transaction, merchant.id, 'http://localhost:4000');

          assert.deepEqual(first.created, { media: 11, categories: 8, products: 11 });
          assert.equal(first.totals.variants, 17);
          assert.deepEqual(second.created, { media: 0, categories: 0, products: 0 });
          assert.deepEqual(second.totals, first.totals);

          const catalogService = new ProductService({
            product: transaction.product,
            productVariant: transaction.productVariant,
            mediaAsset: transaction.mediaAsset,
            category: transaction.category,
            merchant: transaction.merchant,
            $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
              callback(transaction),
          } as unknown as PrismaService);
          const publicCatalog = await catalogService.getPublicStorefrontCatalog(merchant.storefrontSlug);
          assert.equal(publicCatalog.categories.some((category) => category.name === 'عروض الإفطار'), false);
          assert.equal(publicCatalog.products.some((product) => product.name === 'برجر إفطار بالكمأة'), false);
          assert.equal(publicCatalog.products.length, 10);

          const classicBurger = publicCatalog.products.find((product) => product.name === 'برجر لحم كلاسيك');
          const cola = publicCatalog.products.find((product) => product.name === 'كولا');
          const smashBurger = publicCatalog.products.find((product) => product.name === 'سماش برجر');
          assert.ok(classicBurger && cola && smashBurger);
          const soldOutWrap = classicBurger.variants.find((variant) => variant.name === 'لفائف خس');
          const soldOutCola = cola.variants.find((variant) => variant.name === 'علبة بدون سكر');
          const disabledBottle = cola.variants.find((variant) => variant.name === 'زجاجة ١ لتر');
          assert.equal(soldOutWrap?.availability, 'unavailable');
          assert.equal(soldOutCola?.availability, 'unavailable');
          assert.equal(disabledBottle?.availability, 'unavailable');
          assert.equal(smashBurger.variants[0]?.availability, 'available');
          assert.equal('stockQuantity' in smashBurger.variants[0]!, false);

          const ownerClassic = await transaction.product.findFirstOrThrow({
            where: { merchantId: merchant.id, name: 'برجر لحم كلاسيك' },
            include: {
              variants: { orderBy: { position: 'asc' } },
              modifierGroups: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
            },
          });
          const ownerCola = await transaction.product.findFirstOrThrow({
            where: { merchantId: merchant.id, name: 'كولا' },
            include: { variants: { orderBy: { position: 'asc' } } },
          });
          const regularBun = ownerClassic.variants.find((variant) => variant.name === 'خبز عادي');
          const zeroSugar = ownerCola.variants.find((variant) => variant.name === 'علبة بدون سكر');
          const sauces = ownerClassic.modifierGroups.find((group) => group.name === 'الصلصات');
          assert.ok(regularBun && zeroSugar && sauces);

          const quoted = await catalogService.quote(ownerClassic.id, [], regularBun.id, merchant.storefrontSlug);
          assert.equal(quoted.totalPrice, '165.00');
          await assert.rejects(
            catalogService.quote(ownerCola.id, [], zeroSugar.id, merchant.storefrontSlug),
            /out of stock/i,
          );
          await assert.rejects(
            catalogService.quote(
              ownerClassic.id,
              [{ groupId: sauces.id, optionIds: sauces.options.map((option) => option.id) }],
              regularBun.id,
              merchant.storefrontSlug,
            ),
            /Select between 0 and 2/i,
          );

          throw rollback;
        }),
        (error: unknown) => error === rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
