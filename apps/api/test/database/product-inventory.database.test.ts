import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { calculateInventoryRequirements } from '../../src/modules/catalog/products/product-inventory.calculator.js';
import { ProductService } from '../../src/modules/catalog/products/product.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'stores direct mappings and independent exact recipes while preserving legacy products',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply migrations first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback product inventory verification fixtures');

    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const suffix = randomUUID().replaceAll('-', '');
          const merchant = await transaction.merchant.create({
            data: {
              name: `Product inventory ${suffix}`,
              storefrontSlug: `product-inventory-${suffix}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Product inventory test',
              ownerMobile: '01100000000',
            },
          });
          const otherMerchant = await transaction.merchant.create({
            data: {
              name: `Other inventory ${suffix}`,
              storefrontSlug: `other-inventory-${suffix}`,
              activity: 'other',
              contactPhone: '01000000001',
              ownerName: 'Other inventory test',
              ownerMobile: '01100000001',
            },
          });
          const media = await transaction.mediaAsset.create({
            data: {
              merchantId: merchant.id,
              storageKey: `product-inventory/${suffix}.jpg`,
              publicUrl: `http://localhost:4000/media/product-inventory/${suffix}.jpg`,
              mimeType: 'image/jpeg',
              sizeBytes: 16,
              createdBy: 'product-inventory-database-test',
            },
          });
          const category = await transaction.category.create({
            data: {
              merchantId: merchant.id,
              name: `Inventory ${suffix}`,
              imageAssetId: media.id,
              availability: 'available',
              createdBy: 'product-inventory-database-test',
              updatedBy: 'product-inventory-database-test',
            },
          });
          const createStockItem = async (
            merchantId: string,
            name: string,
            baseUnit: string,
            pack?: { code: string; baseQuantity: string },
          ) =>
            transaction.stockItem.create({
              data: {
                merchantId,
                creationRequest: randomUUID(),
                creationFingerprint: randomUUID().replaceAll('-', ''),
                name,
                baseUnit,
                createdBy: 'product-inventory-database-test',
                updatedBy: 'product-inventory-database-test',
                ...(pack
                  ? {
                      units: {
                        create: {
                          code: pack.code,
                          name: pack.code,
                          baseQuantity: pack.baseQuantity,
                          createdBy: 'product-inventory-database-test',
                        },
                      },
                    }
                  : {}),
              },
            });
          const flour = await createStockItem(merchant.id, 'Flour', 'g', {
            code: 'sack',
            baseQuantity: '1000',
          });
          const water = await createStockItem(merchant.id, 'Water', 'ml');
          const inexactPack = await createStockItem(merchant.id, 'Inexact item', 'g', {
            code: 'third',
            baseQuantity: '0.333333',
          });
          const foreignItem = await createStockItem(otherMerchant.id, 'Foreign item', 'piece');
          const transactionClient = new Proxy(transaction, {
            get(target, property) {
              if (property === '$transaction') {
                return async (callback: (tx: typeof transaction) => Promise<unknown>) =>
                  callback(target);
              }
              return Reflect.get(target, property, target);
            },
          }) as unknown as PrismaService;
          const products = new ProductService(transactionClient);
          const inventories = new InventoryService(transactionClient);

          const legacyProduct = await transaction.product.create({
            data: {
              merchantId: merchant.id,
              name: `Legacy ${suffix}`,
              basePrice: '10.00',
              availability: 'available',
              createdBy: 'product-inventory-database-test',
              updatedBy: 'product-inventory-database-test',
            },
          });
          const legacySummary = (await products.list(merchant.id)).items.find(
            (product) => product.id === legacyProduct.id,
          );
          assert.ok(legacySummary);
          assert.equal(legacySummary.availability, 'available');
          assert.equal(legacySummary.inventoryConfigurationRequired, false);
          assert.equal(legacySummary.inventoryConfiguration, null);
          assert.equal(legacySummary.inventoryDefaultMode, 'RECIPE');

          const incomplete = await products.create(merchant.id, 'product-inventory-test', {
            name: 'Unpublished item',
            basePrice: '20.00',
            availability: 'unavailable',
            imageAssetIds: [media.id],
            categoryIds: [category.id],
          });
          assert.equal(incomplete.inventoryConfigurationRequired, true);
          await assert.rejects(
            products.update(
              merchant.id,
              'product-inventory-test',
              incomplete.id,
              incomplete.revision,
              {
                availability: 'available',
              },
            ),
            /Configure inventory before making this product available/i,
          );

          const firstVariantId = randomUUID();
          const secondVariantId = randomUUID();
          const recipeProduct = await products.create(merchant.id, 'product-inventory-test', {
            name: 'Recipe bowl',
            basePrice: '50.00',
            availability: 'available',
            imageAssetIds: [media.id],
            categoryIds: [category.id],
            variants: [
              {
                id: firstVariantId,
                name: 'Regular',
                price: '50.00',
                availability: 'available',
                position: 0,
              },
              {
                id: secondVariantId,
                name: 'Large',
                price: '65.00',
                availability: 'available',
                position: 1,
              },
            ],
            inventoryConfiguration: {
              mode: 'RECIPE',
              targets: [
                {
                  variantId: firstVariantId,
                  components: [
                    { stockItemId: flour.id, unitCode: 'sack', quantity: '0.5' },
                    { stockItemId: flour.id, unitCode: 'kg', quantity: '0.25' },
                  ],
                },
                {
                  variantId: secondVariantId,
                  components: [
                    { stockItemId: flour.id, unitCode: 'kg', quantity: '0.75' },
                    { stockItemId: water.id, unitCode: 'ml', quantity: '10' },
                  ],
                },
              ],
            },
          });
          assert.equal(recipeProduct.inventoryConfiguration?.mode, 'RECIPE');
          assert.equal(recipeProduct.inventoryConfiguration?.targets.length, 2);
          const regularTarget = recipeProduct.inventoryConfiguration?.targets.find(
            (target) => target.variantId === firstVariantId,
          );
          const largeTarget = recipeProduct.inventoryConfiguration?.targets.find(
            (target) => target.variantId === secondVariantId,
          );
          assert.ok(regularTarget && largeTarget);
          assert.deepEqual(
            regularTarget.components.map((component) => component.baseQuantity),
            ['500', '250'],
          );
          assert.deepEqual(
            calculateInventoryRequirements(
              regularTarget.components.map((component) => ({
                stockItemId: component.stockItemId,
                baseUnit: component.stockItemBaseUnit as 'g' | 'ml',
                baseQuantity: component.baseQuantity,
              })),
              2,
            ),
            [{ stockItemId: flour.id, baseUnit: 'g', quantity: '1500' }],
          );
          assert.deepEqual(
            largeTarget.components.map((component) => component.baseQuantity),
            ['750', '10'],
          );

          const simpleProduct = await products.create(merchant.id, 'product-inventory-test', {
            name: 'Bottled drink',
            basePrice: '12.00',
            availability: 'available',
            imageAssetIds: [media.id],
            categoryIds: [category.id],
            inventoryConfiguration: {
              mode: 'DIRECT',
              targets: [
                {
                  variantId: null,
                  components: [{ stockItemId: flour.id, unitCode: 'sack', quantity: '1' }],
                },
              ],
            },
          });
          assert.equal((await products.get(merchant.id, simpleProduct.id)).id, simpleProduct.id);
          await assert.rejects(products.get(otherMerchant.id, simpleProduct.id), /not found/i);
          assert.equal(simpleProduct.inventoryConfiguration?.mode, 'DIRECT');
          assert.equal(
            simpleProduct.inventoryConfiguration?.targets[0]?.components[0]?.baseQuantity,
            '1000',
          );

          await assert.rejects(
            inventories.setArchived(merchant.id, 'product-inventory-test', flour.id, true, {
              revision: 1,
            }),
            /used by a product or recipe cannot be archived/i,
          );

          await transaction.$executeRawUnsafe('SAVEPOINT foreign_product_inventory');
          await assert.rejects(
            products.create(merchant.id, 'product-inventory-test', {
              name: 'Foreign mapping',
              basePrice: '5.00',
              availability: 'available',
              imageAssetIds: [media.id],
              categoryIds: [category.id],
              inventoryConfiguration: {
                mode: 'DIRECT',
                targets: [
                  {
                    variantId: null,
                    components: [{ stockItemId: foreignItem.id, unitCode: 'piece', quantity: '1' }],
                  },
                ],
              },
            }),
            /active stock items owned by this merchant/i,
          );
          await transaction.$executeRawUnsafe('ROLLBACK TO SAVEPOINT foreign_product_inventory');

          await transaction.$executeRawUnsafe('SAVEPOINT inexact_product_inventory');
          await assert.rejects(
            products.create(merchant.id, 'product-inventory-test', {
              name: 'Inexact recipe',
              basePrice: '5.00',
              availability: 'available',
              imageAssetIds: [media.id],
              categoryIds: [category.id],
              inventoryConfiguration: {
                mode: 'DIRECT',
                targets: [
                  {
                    variantId: null,
                    components: [
                      { stockItemId: inexactPack.id, unitCode: 'third', quantity: '0.333333' },
                    ],
                  },
                ],
              },
            }),
            /require rounding/i,
          );
          await transaction.$executeRawUnsafe('ROLLBACK TO SAVEPOINT inexact_product_inventory');

          throw rollback;
        }),
        (cause) => cause === rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
