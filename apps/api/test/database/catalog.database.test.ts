import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { CatalogQueryService } from '../../src/modules/catalog/catalog-query.service.js';
import { ModifierGroupService } from '../../src/modules/catalog/modifiers/modifier-group.service.js';
import { ProductPricingService } from '../../src/modules/catalog/pricing/product-pricing.service.js';
import { ProductService } from '../../src/modules/catalog/products/product.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'persists legacy product-local writes as reusable modifier configurations in PostgreSQL',
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
                storefrontSlug: `catalog-verification-${suffix}-${randomUUID().replaceAll('-', '')}`,
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
          const createFixtureStockItem = async (merchantId: string, suffix: string) =>
            transaction.stockItem.create({
              data: {
                merchantId,
                creationRequest: randomUUID(),
                creationFingerprint: randomUUID().replaceAll('-', ''),
                name: `Verification ${suffix} item`,
                baseUnit: 'piece',
                createdBy: 'catalog-database-test',
                updatedBy: 'catalog-database-test',
              },
            });
          const stockItem = await createFixtureStockItem(merchant.id, 'one');
          const otherStockItem = await createFixtureStockItem(otherMerchant.id, 'two');
          const directConfiguration = (itemId: string, variantIds: Array<string | null>) => ({
            mode: 'DIRECT' as const,
            targets: variantIds.map((variantId) => ({
              variantId,
              components: [{ stockItemId: itemId, unitCode: 'piece', quantity: '1' }],
            })),
          });
          const servicePrisma = {
            product: transaction.product,
            productVariant: transaction.productVariant,
            modifierGroup: transaction.modifierGroup,
            mediaAsset: transaction.mediaAsset,
            category: transaction.category,
            merchant: transaction.merchant,
            $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
              callback(transaction),
          } as unknown as PrismaService;
          const service = new ProductService(servicePrisma);
          const servicePricing = new ProductPricingService(servicePrisma);
          const serviceQuery = new CatalogQueryService(servicePrisma);

          const firstProduct = await service.create(merchant.id, 'catalog-database-test', {
            name: 'Verification burger',
            basePrice: '100.00',
            availability: 'available',
            imageAssetIds: [references.media.id],
            categoryIds: [references.category.id],
            inventoryConfiguration: directConfiguration(stockItem.id, [null]),
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
          const otherVariantIds = [randomUUID(), randomUUID()];
          const otherProduct = await service.create(otherMerchant.id, 'catalog-database-test', {
            name: 'Other merchant product',
            basePrice: '5.00',
            availability: 'available',
            imageAssetIds: [otherReferences.media.id],
            categoryIds: [otherReferences.category.id],
            inventoryConfiguration: directConfiguration(otherStockItem.id, otherVariantIds),
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
            variants: [
              {
                id: otherVariantIds[0],
                name: 'Single cup',
                sku: 'VERIFICATION-CUP',
                barcode: '9900000000001',
                price: '6.25',
                stockQuantity: 7,
                availability: 'available',
                position: 0,
              },
              {
                id: otherVariantIds[1],
                name: 'Out of stock cup',
                sku: 'VERIFICATION-OOS',
                barcode: '9900000000002',
                price: '8.50',
                stockQuantity: 0,
                availability: 'available',
                position: 1,
              },
            ],
          });
          const coffeeVariantIds = [randomUUID(), randomUUID()];
          await service.create(merchant.id, 'catalog-database-test', {
            name: 'Verification coffee',
            basePrice: '6.00',
            availability: 'available',
            imageAssetIds: [references.media.id],
            categoryIds: [references.category.id],
            inventoryConfiguration: directConfiguration(stockItem.id, coffeeVariantIds),
            variants: [
              {
                id: coffeeVariantIds[0],
                name: 'Regular cup',
                sku: 'PUBLIC-VERIFICATION-CUP',
                barcode: '9900000000099',
                price: '6.00',
                stockQuantity: 3,
                availability: 'available',
                position: 0,
              },
              {
                id: coffeeVariantIds[1],
                name: 'Out of stock cup',
                sku: 'PUBLIC-VERIFICATION-OOS',
                barcode: '9900000000100',
                price: '8.00',
                stockQuantity: 0,
                availability: 'available',
                position: 1,
              },
            ],
          });
          await service.create(merchant.id, 'catalog-database-test', {
            name: 'Unavailable item',
            basePrice: '4.00',
            availability: 'unavailable',
            imageAssetIds: [references.media.id],
            categoryIds: [references.category.id],
            inventoryConfiguration: directConfiguration(stockItem.id, [null]),
          });

          const publicCatalog = await serviceQuery.getPublicStorefrontCatalog(
            merchant.storefrontSlug,
          );
          assert.equal(publicCatalog.slug, merchant.storefrontSlug);
          assert.equal(publicCatalog.products.length, 2);
          const publicVariant = publicCatalog.products.find(
            (product) => product.name === 'Verification coffee',
          )?.variants[0];
          assert.ok(publicVariant);
          assert.equal(publicVariant.availability, 'available');
          assert.equal('sku' in publicVariant, false);
          assert.equal('barcode' in publicVariant, false);
          assert.equal('stockQuantity' in publicVariant, false);
          const soldOutPublicVariant = publicCatalog.products
            .find((product) => product.name === 'Verification coffee')
            ?.variants.find((variant) => variant.name === 'Out of stock cup');
          assert.equal(soldOutPublicVariant?.availability, 'unavailable');
          assert.equal(
            publicCatalog.products.find((product) => product.name === 'Verification coffee')
              ?.categories[0]?.name,
            'Verification one',
          );
          await assert.rejects(
            servicePricing.quote(otherProduct.id, [], undefined, merchant.storefrontSlug),
            /Product was not found/i,
          );

          assert.equal(firstProduct.revision, 1);
          assert.equal(firstProduct.sellingUnit, 'piece');
          assert.equal(firstProduct.modifierGroups.length, 2);
          const [sizeGroup, extrasGroup] = firstProduct.modifierGroups;
          const largeOption = sizeGroup?.options.find((option) => option.name === 'Large');
          const regularOption = sizeGroup?.options.find((option) => option.name === 'Regular');
          const cheeseOption = extrasGroup?.options.find((option) => option.name === 'Cheese');
          const baconOption = extrasGroup?.options.find((option) => option.name === 'Bacon');
          const otherOption = otherProduct.modifierGroups[0]?.options[0];
          const singleCup = otherProduct.variants[0];
          const outOfStockCup = otherProduct.variants[1];
          assert.ok(
            sizeGroup &&
              extrasGroup &&
              largeOption &&
              regularOption &&
              cheeseOption &&
              baconOption &&
              otherOption &&
              singleCup &&
              outOfStockCup,
          );

          const reusedProduct = await service.create(merchant.id, 'catalog-database-test', {
            name: 'Reusable group target',
            basePrice: '20.00',
            availability: 'available',
            imageAssetIds: [references.media.id],
            categoryIds: [references.category.id],
            inventoryConfiguration: directConfiguration(stockItem.id, [null]),
          });
          const attachedProduct = await service.attachModifierGroup(
            merchant.id,
            'catalog-database-test',
            reusedProduct.id,
            reusedProduct.revision,
            {
              modifierGroupId: sizeGroup.modifierGroupId,
              selectionMode: 'single',
              minSelections: 1,
              maxSelections: 1,
              position: 0,
              options: sizeGroup.options.map((option) => ({
                optionId: option.id,
                priceAdjustment: option.priceAdjustment,
                defaultSelected: false,
              })),
            },
          );
          assert.equal(attachedProduct.modifierGroups.length, 1);
          assert.equal(
            attachedProduct.modifierGroups[0]!.modifierGroupId,
            sizeGroup.modifierGroupId,
          );
          const modifierGroups = new ModifierGroupService({
            modifierGroup: transaction.modifierGroup,
            productModifierGroupAssignment: transaction.productModifierGroupAssignment,
            $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
              callback(transaction),
          } as unknown as PrismaService);
          await assert.rejects(
            modifierGroups.update(merchant.id, sizeGroup.modifierGroupId, {
              revision: 1,
              name: 'Changed Size',
            }),
            /Detach this modifier group from every product/i,
          );
          await service.detachModifierGroup(
            merchant.id,
            'catalog-database-test',
            reusedProduct.id,
            attachedProduct.modifierGroups[0]!.id,
            attachedProduct.revision,
          );
          const firstProductQuoteAfterDetach = await servicePricing.quote(firstProduct.id);
          assert.equal(firstProductQuoteAfterDetach.totalPrice, '135.45');

          const defaultQuote = await servicePricing.quote(firstProduct.id);
          assert.equal(defaultQuote.productRevision, 1);
          assert.equal(defaultQuote.basePrice, '100.00');
          assert.equal(defaultQuote.modifierTotal, '35.45');
          assert.equal(defaultQuote.totalPrice, '135.45');
          assert.deepEqual(defaultQuote.selections, [
            {
              groupId: sizeGroup.id,
              modifierGroupId: sizeGroup.modifierGroupId,
              optionIds: [largeOption.id],
              options: [{ optionId: largeOption.id, quantity: 1, unitPriceAdjustment: '25.35' }],
              priceAdjustment: '25.35',
            },
            {
              groupId: extrasGroup.id,
              modifierGroupId: extrasGroup.modifierGroupId,
              optionIds: [cheeseOption.id],
              options: [{ optionId: cheeseOption.id, quantity: 1, unitPriceAdjustment: '10.10' }],
              priceAdjustment: '10.10',
            },
          ]);

          const overrideQuote = await servicePricing.quote(firstProduct.id, [
            { groupId: sizeGroup.id, optionIds: [regularOption.id] },
            { groupId: extrasGroup.id, optionIds: [baconOption.id] },
          ]);
          assert.equal(overrideQuote.totalPrice, '115.20');
          await assert.rejects(
            servicePricing.quote(firstProduct.id, [{ groupId: sizeGroup.id, optionIds: [] }]),
            /Select between 1 and 1/i,
          );
          await assert.rejects(
            servicePricing.quote(firstProduct.id, [
              { groupId: sizeGroup.id, optionIds: [otherOption.id] },
            ]),
            /does not belong to its selected group/i,
          );
          await assert.rejects(
            servicePricing.quote(firstProduct.id, [
              { groupId: otherProduct.modifierGroups[0]!.id, optionIds: [] },
            ]),
            /does not belong to this product/i,
          );
          await assert.rejects(servicePricing.quote(otherProduct.id), /Choose a product variant/i);
          await assert.rejects(
            servicePricing.quote(
              otherProduct.id,
              [],
              firstProduct.variants[0]?.id ?? 'foreign-variant',
            ),
            /does not belong to this product/i,
          );
          await assert.rejects(
            servicePricing.quote(otherProduct.id, [], outOfStockCup.id),
            /out of stock/i,
          );
          const variantQuote = await servicePricing.quote(otherProduct.id, [], singleCup.id);
          assert.equal(variantQuote.variantId, singleCup.id);
          assert.equal(variantQuote.variantName, 'Single cup');
          assert.equal(variantQuote.basePrice, '6.25');
          assert.equal(variantQuote.totalPrice, '6.25');

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
          const unchangedQuote = await servicePricing.quote(firstProduct.id);
          assert.equal(unchangedQuote.productRevision, 1);
          assert.equal(unchangedQuote.totalPrice, '135.45');

          const updatedVariantId = randomUUID();
          const updated = await service.update(
            merchant.id,
            'catalog-database-test',
            firstProduct.id,
            1,
            {
              basePrice: '110.00',
              variants: [
                {
                  id: updatedVariantId,
                  name: 'New sellable identity',
                  sku: 'VERIFICATION-NEW',
                  barcode: '9900000000003',
                  price: '125.00',
                  stockQuantity: null,
                  availability: 'available',
                  position: 0,
                },
              ],
              inventoryConfiguration: directConfiguration(stockItem.id, [updatedVariantId]),
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
          assert.equal(updated.variants.length, 1);
          assert.equal(updated.variants[0]?.price, '125.00');
          const updatedQuote = await servicePricing.quote(updated.id, [], updated.variants[0]!.id);
          assert.equal(updatedQuote.productRevision, 2);
          assert.equal(updatedQuote.totalPrice, '125.00');
          const duplicateVariantId = randomUUID();
          await assert.rejects(
            service.create(merchant.id, 'catalog-database-test', {
              name: 'Duplicate variant code',
              basePrice: '20.00',
              availability: 'available',
              imageAssetIds: [references.media.id],
              categoryIds: [references.category.id],
              inventoryConfiguration: directConfiguration(stockItem.id, [duplicateVariantId]),
              variants: [
                {
                  id: duplicateVariantId,
                  name: 'Duplicate code',
                  sku: 'verification-new',
                  price: '20.00',
                  availability: 'available',
                  position: 0,
                },
              ],
            }),
            /unique per merchant/i,
          );
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
          await assert.rejects(servicePricing.quote(firstProduct.id), /Product is unavailable/i);

          await transaction.$executeRawUnsafe('SAVEPOINT invalid_modifier_price');
          await assert.rejects(
            transaction.$executeRawUnsafe(
              'UPDATE "product_modifier_group_assignment_options" SET "priceAdjustment" = -1 WHERE "assignmentId" = $1::uuid AND "optionId" = $2::uuid',
              updated.modifierGroups[0]!.id,
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
