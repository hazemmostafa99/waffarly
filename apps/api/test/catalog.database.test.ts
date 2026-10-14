import assert from 'node:assert/strict';
import { it } from 'node:test';
import { config } from 'dotenv';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { ProductService } from '../src/modules/catalog/product.service.js';

config({ path: new URL('../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'persists, updates, validates, and quotes product-local modifier configurations in PostgreSQL',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply migrations first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback catalog verification fixtures');

    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const createFixtureMerchant = (suffix: string) =>
            transaction.merchant.create({
              data: {
                name: `Catalog verification ${suffix}`,
                activity: 'restaurant',
                contactPhone: `010000${suffix.padStart(6, '0')}`,
                ownerName: 'Catalog verification',
                ownerMobile: `011000${suffix.padStart(6, '0')}`,
              },
            });
          const merchant = await createFixtureMerchant('1');
          const otherMerchant = await createFixtureMerchant('2');

          const createFixtureReferences = async (merchantId: string, suffix: string) => {
            const media = await transaction.mediaAsset.create({
              data: {
                merchantId,
                storageKey: `catalog-verification/${suffix}.jpg`,
                publicUrl: `http://localhost:4000/media/catalog-verification/${suffix}.jpg`,
                mimeType: 'image/jpeg',
                sizeBytes: 16,
                createdBy: 'catalog-database-test',
              },
            });
            const category = await transaction.category.create({
              data: {
                merchantId,
                name: `Verification ${suffix}`,
                imageAssetId: media.id,
                availability: 'available',
                createdBy: 'catalog-database-test',
                updatedBy: 'catalog-database-test',
              },
            });
            return { media, category };
          };
          const references = await createFixtureReferences(merchant.id, 'one');
          const otherReferences = await createFixtureReferences(otherMerchant.id, 'two');
          const service = new ProductService({
            product: transaction.product,
            mediaAsset: transaction.mediaAsset,
            category: transaction.category,
            $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
              callback(transaction),
          } as unknown as PrismaService);

          const firstProduct = await service.create(merchant.id, 'catalog-database-test', {
            name: 'Verification burger',
            basePrice: '100.00',
            availability: 'available',
            imageAssetIds: [references.media.id],
            categoryIds: [references.category.id],
            modifierGroups: [
              {
                name: 'Size',
                selectionMode: 'single',
                minSelections: 1,
                maxSelections: 1,
                position: 0,
                options: [
                  { name: 'Regular', priceAdjustment: '0.00', defaultSelected: false, position: 0 },
                  { name: 'Large', priceAdjustment: '25.35', defaultSelected: true, position: 1 },
                ],
              },
              {
                name: 'Extras',
                selectionMode: 'multiple',
                minSelections: 0,
                maxSelections: 2,
                position: 1,
                options: [
                  { name: 'Cheese', priceAdjustment: '10.10', defaultSelected: true, position: 0 },
                  { name: 'Bacon', priceAdjustment: '15.20', defaultSelected: false, position: 1 },
                ],
              },
            ],
          });
          const otherProduct = await service.create(otherMerchant.id, 'catalog-database-test', {
            name: 'Other merchant product',
            basePrice: '5.00',
            availability: 'available',
            imageAssetIds: [otherReferences.media.id],
            categoryIds: [otherReferences.category.id],
            modifierGroups: [
              {
                name: 'Other group',
                selectionMode: 'single',
                minSelections: 0,
                maxSelections: 1,
                position: 0,
                options: [
                  {
                    name: 'Other option',
                    priceAdjustment: '1.00',
                    defaultSelected: false,
                    position: 0,
                  },
                ],
              },
            ],
          });

          assert.equal(firstProduct.revision, 1);
          assert.equal(firstProduct.sellingUnit, 'piece');
          assert.equal(firstProduct.modifierGroups.length, 2);
          const [sizeGroup, extrasGroup] = firstProduct.modifierGroups;
          const largeOption = sizeGroup?.options.find((option) => option.name === 'Large');
          const regularOption = sizeGroup?.options.find((option) => option.name === 'Regular');
          const cheeseOption = extrasGroup?.options.find((option) => option.name === 'Cheese');
          const baconOption = extrasGroup?.options.find((option) => option.name === 'Bacon');
          const otherOption = otherProduct.modifierGroups[0]?.options[0];
          assert.ok(
            sizeGroup &&
              extrasGroup &&
              largeOption &&
              regularOption &&
              cheeseOption &&
              baconOption &&
              otherOption,
          );

          const defaultQuote = await service.quote(firstProduct.id);
          assert.equal(defaultQuote.productRevision, 1);
          assert.equal(defaultQuote.basePrice, '100.00');
          assert.equal(defaultQuote.modifierTotal, '35.45');
          assert.equal(defaultQuote.totalPrice, '135.45');
          assert.deepEqual(defaultQuote.selections, [
            {
              groupId: sizeGroup.id,
              optionIds: [largeOption.id],
              priceAdjustment: '25.35',
            },
            {
              groupId: extrasGroup.id,
              optionIds: [cheeseOption.id],
              priceAdjustment: '10.10',
            },
          ]);

          const overrideQuote = await service.quote(firstProduct.id, [
            { groupId: sizeGroup.id, optionIds: [regularOption.id] },
            { groupId: extrasGroup.id, optionIds: [baconOption.id] },
          ]);
          assert.equal(overrideQuote.totalPrice, '115.20');
          await assert.rejects(
            service.quote(firstProduct.id, [{ groupId: sizeGroup.id, optionIds: [] }]),
            /Select between 1 and 1/i,
          );
          await assert.rejects(
            service.quote(firstProduct.id, [
              { groupId: sizeGroup.id, optionIds: [otherOption.id] },
            ]),
            /does not belong to its selected group/i,
          );
          await assert.rejects(
            service.quote(firstProduct.id, [
              { groupId: otherProduct.modifierGroups[0]!.id, optionIds: [] },
            ]),
            /does not belong to this product/i,
          );

          await transaction.$executeRawUnsafe('SAVEPOINT invalid_modifier_update');
          await assert.rejects(
            service.update(merchant.id, 'catalog-database-test', firstProduct.id, 1, {
              modifierGroups: [
                {
                  name: 'Invalid replacement',
                  selectionMode: 'single',
                  minSelections: 2,
                  maxSelections: 1,
                  position: 0,
                  options: [
                    {
                      name: 'Only choice',
                      priceAdjustment: '1.00',
                      defaultSelected: false,
                      position: 0,
                    },
                  ],
                },
              ],
            }),
          );
          await transaction.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_modifier_update');
          const unchangedQuote = await service.quote(firstProduct.id);
          assert.equal(unchangedQuote.productRevision, 1);
          assert.equal(unchangedQuote.totalPrice, '135.45');

          const updated = await service.update(
            merchant.id,
            'catalog-database-test',
            firstProduct.id,
            1,
            {
              basePrice: '110.00',
              modifierGroups: [
                {
                  name: 'Size',
                  selectionMode: 'single',
                  minSelections: 1,
                  maxSelections: 1,
                  position: 0,
                  options: [
                    {
                      name: 'Regular',
                      priceAdjustment: '0.00',
                      defaultSelected: true,
                      position: 0,
                    },
                    {
                      name: 'Large',
                      priceAdjustment: '30.05',
                      defaultSelected: false,
                      position: 1,
                    },
                  ],
                },
              ],
            },
          );
          assert.equal(updated.revision, 2);
          assert.equal(updated.basePrice, '110.00');
          assert.equal(updated.modifierGroups.length, 1);
          assert.notEqual(updated.modifierGroups[0]?.id, sizeGroup.id);
          const updatedQuote = await service.quote(updated.id);
          assert.equal(updatedQuote.productRevision, 2);
          assert.equal(updatedQuote.totalPrice, '110.00');
          await assert.rejects(
            service.update(merchant.id, 'catalog-database-test', firstProduct.id, 1, {
              basePrice: '120.00',
            }),
            /missing or stale/i,
          );

          const unavailable = await service.update(
            merchant.id,
            'catalog-database-test',
            firstProduct.id,
            2,
            { availability: 'unavailable' },
          );
          assert.equal(unavailable.revision, 3);
          await assert.rejects(service.quote(firstProduct.id), /Product is unavailable/i);

          await transaction.$executeRawUnsafe('SAVEPOINT invalid_modifier_price');
          await assert.rejects(
            transaction.$executeRawUnsafe(
              'UPDATE "product_modifier_options" SET "priceAdjustment" = -1 WHERE "id" = $1::uuid',
              updated.modifierGroups[0]!.options[0]!.id,
            ),
          );
          await transaction.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_modifier_price');

          throw rollback;
        }),
        (cause) => cause === rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
