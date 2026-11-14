import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { CatalogProductModifierGroupAssignmentFields } from '@waffarly/contracts';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { ProductService } from '../../src/modules/catalog/products/product.service.js';
import { ProductPricingService } from '../../src/modules/catalog/pricing/product-pricing.service.js';
import { ModifierGroupService } from '../../src/modules/catalog/modifiers/modifier-group.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
import { StorefrontOrdersService } from '../../src/modules/orders/checkout/storefront-orders.service.js';
import { ProductConfigurationReportService } from '../../src/modules/reports/product-configuration-report.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;

it(
  'persists modifier overrides, validates tenant recipes, and snapshots quantities and effective prices',
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const rollback = new Error('Rollback M5 fixtures');
    try {
      await assert.rejects(
        client.$transaction(
          async (tx) => {
            const suffix = randomUUID();
            const merchant = await tx.merchant.create({
              data: {
                name: 'M5 test',
                storefrontSlug: `m5-${suffix}`,
                activity: 'restaurant',
                contactPhone: '01000000000',
                ownerName: 'Test',
                ownerMobile: '01100000000',
              },
            });
            const other = await tx.merchant.create({
              data: {
                name: 'Foreign M5',
                storefrontSlug: `m5-other-${suffix}`,
                activity: 'other',
                contactPhone: '01000000000',
                ownerName: 'Test',
                ownerMobile: '01100000000',
              },
            });
            const media = await tx.mediaAsset.create({
              data: {
                merchantId: merchant.id,
                storageKey: `m5/${suffix}.jpg`,
                publicUrl: 'http://localhost:4000/test.jpg',
                mimeType: 'image/jpeg',
                sizeBytes: 16,
                createdBy: 'test',
              },
            });
            const category = await tx.category.create({
              data: {
                merchantId: merchant.id,
                name: 'M5',
                imageAssetId: media.id,
                availability: 'available',
                createdBy: 'test',
                updatedBy: 'test',
              },
            });
            const makeItem = (merchantId: string, name: string) =>
              tx.stockItem.create({
                data: {
                  merchantId,
                  name,
                  baseUnit: 'g',
                  creationRequest: randomUUID(),
                  creationFingerprint: randomUUID(),
                  createdBy: 'test',
                  updatedBy: 'test',
                },
              });
            const cheese = await makeItem(merchant.id, 'Cheese');
            const tomato = await makeItem(merchant.id, 'Tomato');
            const herbs = await makeItem(merchant.id, 'Herbs');
            const foreign = await makeItem(other.id, 'Foreign');
            let savepointId = 0;
            const scoped = new Proxy(tx, {
              get(target, key) {
                if (key === '$transaction')
                  return async (callback: (value: typeof tx) => unknown) => {
                    const savepoint = `m5_service_${++savepointId}`;
                    await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
                    try {
                      const result = await callback(tx);
                      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
                      return result;
                    } catch (error) {
                      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
                      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
                      throw error;
                    }
                  };
                return Reflect.get(target, key);
              },
            }) as never;
            const products = new ProductService(scoped);
            const pricing = new ProductPricingService(scoped);
            const groups = new ModifierGroupService(scoped);
            const definition = await groups.create(merchant.id, {
              name: 'Extras',
              options: [
                { name: 'Cheese', position: 0 },
                { name: 'Sauce', position: 1 },
              ],
            });
            const variantId = randomUUID();
            const assignments: CatalogProductModifierGroupAssignmentFields[] = [
              {
                modifierGroupId: definition.id,
                selectionMode: 'multiple',
                minSelections: 2,
                maxSelections: 2,
                position: 0,
                options: [
                  {
                    optionId: definition.options[0]!.id,
                    priceAdjustment: '2.00',
                    defaultSelected: true,
                    maxQuantity: 20,
                    effects: [
                      {
                        stockItemId: cheese.id,
                        direction: 'ADD',
                        unitCode: 'kg',
                        quantity: '0.002',
                      },
                      { stockItemId: tomato.id, direction: 'ADD', unitCode: 'g', quantity: '3' },
                      { stockItemId: herbs.id, direction: 'ADD', unitCode: 'g', quantity: '1' },
                    ],
                    variantOverrides: [
                      {
                        variantId,
                        available: true,
                        priceAdjustment: '3.00',
                        effects: [
                          {
                            stockItemId: cheese.id,
                            direction: 'REMOVE',
                            unitCode: 'g',
                            quantity: '1',
                          },
                        ],
                      },
                    ],
                  },
                  {
                    optionId: definition.options[1]!.id,
                    priceAdjustment: '2.00',
                    defaultSelected: true,
                    maxQuantity: 2,
                  },
                ],
              },
            ];
            const product = await products.create(merchant.id, 'test', {
              name: 'Recipe',
              basePrice: '99.00',
              availability: 'available',
              imageAssetIds: [media.id],
              categoryIds: [category.id],
              variants: [
                {
                  id: variantId,
                  name: 'Large',
                  price: '20.00',
                  availability: 'available',
                  position: 0,
                },
              ],
              modifierGroupAssignments: assignments,
              inventoryConfiguration: {
                mode: 'RECIPE',
                targets: [
                  {
                    variantId,
                    components: [
                      { stockItemId: cheese.id, unitCode: 'g', quantity: '10' },
                      { stockItemId: tomato.id, unitCode: 'g', quantity: '20' },
                    ],
                  },
                ],
              },
            });
            const assignmentId = product.modifierGroups[0]!.id;
            const optionId = definition.options[0]!.id;
            const sauceId = definition.options[1]!.id;
            const selections = [
              {
                groupId: assignmentId,
                optionIds: [optionId, sauceId],
                optionQuantities: [
                  { optionId, quantity: 3 },
                  { optionId: sauceId, quantity: 2 },
                ],
              },
            ];
            const quote = await pricing.quote(
              product.id,
              selections,
              variantId,
              merchant.storefrontSlug!,
            );
            assert.equal(quote.totalPrice, '33.00');
            assert.equal(product.modifierGroups[0]!.options[0]!.effects?.[0]?.quantity, '0.002');
            assert.deepEqual(
              product.modifierGroups[0]!.options[0]!.variantOverrides?.[0]?.effects,
              [{ stockItemId: cheese.id, direction: 'REMOVE', unitCode: 'g', quantity: '1' }],
            );
            await assert.rejects(
              pricing.quote(
                product.id,
                [{ ...selections[0]!, optionQuantities: [{ optionId, quantity: 11 }] }],
                variantId,
              ),
              /negative/,
            );
            const inventory = new InventoryService(scoped);
            await assert.rejects(
              inventory.setArchived(merchant.id, 'test', herbs.id, true, {
                revision: herbs.revision,
              }),
              /used by/,
            );
            const current = () => products.get(merchant.id, product.id);
            const empty = structuredClone(assignments);
            empty[0]!.options[0]!.variantOverrides![0]!.effects = [];
            const updated = await products.update(
              merchant.id,
              'test',
              product.id,
              product.revision,
              { modifierGroupAssignments: empty },
            );
            assert.equal(updated.modifierGroups[0]!.id, assignmentId);
            assert.deepEqual(
              updated.modifierGroups[0]!.options[0]!.variantOverrides?.[0]?.effects,
              [],
            );
            assert.equal(
              (
                await pricing.quote(
                  product.id,
                  [{ ...selections[0]!, optionQuantities: [{ optionId, quantity: 11 }] }],
                  variantId,
                )
              ).totalPrice,
              '55.00',
            );
            const bad = structuredClone(empty);
            bad[0]!.options[0]!.effects![0]!.stockItemId = foreign.id;
            await assert.rejects(
              products.update(merchant.id, 'test', product.id, updated.revision, {
                modifierGroupAssignments: bad,
              }),
              /owned by this merchant/,
            );
            assert.equal((await current()).revision, updated.revision);
            const unavailable = structuredClone(empty);
            unavailable[0]!.options[0]!.variantOverrides![0]!.available = false;
            await assert.rejects(
              products.update(merchant.id, 'test', product.id, updated.revision, {
                modifierGroupAssignments: unavailable,
              }),
              /selection bounds/,
            );
            const foreignVariant = structuredClone(empty);
            foreignVariant[0]!.options[0]!.variantOverrides![0]!.variantId = randomUUID();
            await assert.rejects(
              products.update(merchant.id, 'test', product.id, updated.revision, {
                modifierGroupAssignments: foreignVariant,
              }),
              /variants of this product/,
            );
            await assert.rejects(
              products.update(merchant.id, 'test', product.id, updated.revision, {
                inventoryConfiguration: {
                  mode: 'DIRECT',
                  targets: [
                    {
                      variantId,
                      components: [{ stockItemId: cheese.id, unitCode: 'g', quantity: '1' }],
                    },
                  ],
                },
              }),
              /only for RECIPE/,
            );
            assert.equal((await current()).revision, updated.revision);
            const orders = new StorefrontOrdersService(scoped, pricing);
            const receipt = await orders.create(merchant.storefrontSlug!, {
              customerName: 'Test buyer',
              customerPhone: '01000000000',
              fulfillmentType: 'pickup',
              items: [{ productId: product.id, variantId, quantity: 2, selections }],
            });
            assert.equal(receipt.total, '66.00');
            const snapshots = await tx.storefrontOrderLineSelection.findMany({
              where: { orderLine: { orderId: receipt.id } },
              orderBy: { optionPosition: 'asc' },
            });
            assert.deepEqual(
              snapshots.map((snapshot) => [snapshot.quantity, snapshot.priceAdjustment.toFixed(2)]),
              [
                [3, '3.00'],
                [2, '2.00'],
              ],
            );
            await tx.storefrontOrder.update({
              where: { id: receipt.id },
              data: { status: 'accepted' },
            });
            const reports = new ProductConfigurationReportService(scoped);
            const report = await reports.get(
              merchant.id,
              new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
              new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
            );
            assert.equal(
              report.modifierOptions.find((row) => row.modifierOptionId === optionId)
                ?.selectedQuantity,
              6,
            );
            assert.equal(
              report.modifierOptions.find((row) => row.modifierOptionId === optionId)
                ?.additionalRevenue,
              '18.00',
            );
            throw rollback;
          },
          { timeout: 30_000 },
        ),
        (error) => error === rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
