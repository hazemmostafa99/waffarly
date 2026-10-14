import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { config } from 'dotenv';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { ProductService } from '../src/modules/catalog/product.service.js';
import { StorefrontOrdersService } from '../src/modules/catalog/storefront-orders.service.js';

config({ path: new URL('../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'snapshots configured products, reserves tracked stock, and restores it when a pending order is rejected',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply migrations first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback storefront order verification fixtures');

    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const suffix = randomUUID().replaceAll('-', '');
          const merchant = await transaction.merchant.create({
            data: {
              name: `Order verification ${suffix}`,
              storefrontSlug: `order-verification-${suffix}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Order verification',
              ownerMobile: '01100000000',
            },
          });
          const media = await transaction.mediaAsset.create({
            data: {
              merchantId: merchant.id,
              storageKey: `order-verification/${suffix}.jpg`,
              publicUrl: `http://localhost:4000/media/order-verification/${suffix}.jpg`,
              mimeType: 'image/jpeg',
              sizeBytes: 16,
              createdBy: 'storefront-order-database-test',
            },
          });
          const category = await transaction.category.create({
            data: {
              merchantId: merchant.id,
              name: 'Order verification',
              imageAssetId: media.id,
              availability: 'available',
              createdBy: 'storefront-order-database-test',
              updatedBy: 'storefront-order-database-test',
            },
          });
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
          const product = await products.create(merchant.id, 'order-verification-test', {
            name: 'Verification bowl',
            basePrice: '80.00',
            availability: 'available',
            imageAssetIds: [media.id],
            categoryIds: [category.id],
            variants: [
              {
                name: 'Large',
                price: '100.00',
                stockQuantity: 3,
                availability: 'available',
                position: 0,
                attributes: [
                  { name: 'Size', value: 'Large' },
                  { name: 'Milk', value: 'Dairy' },
                ],
              },
            ],
            modifierGroups: [
              {
                name: 'Extras',
                selectionMode: 'multiple',
                minSelections: 0,
                maxSelections: 1,
                position: 0,
                options: [
                  {
                    name: 'Cheese',
                    priceAdjustment: '10.00',
                    defaultSelected: false,
                    position: 0,
                  },
                ],
              },
            ],
          });
          const orders = new StorefrontOrdersService(transactionClient, products);
          const first = await orders.create(merchant.storefrontSlug, {
            customerName: 'Mona Ali',
            customerPhone: '01000000000',
            fulfillmentType: 'delivery',
            deliveryAddress: '12 Cairo Street',
            items: [
              {
                productId: product.id,
                variantId: product.variants[0]!.id,
                selections: [
                  { groupId: product.modifierGroups[0]!.id, optionIds: [product.modifierGroups[0]!.options[0]!.id] },
                ],
                quantity: 2,
              },
            ],
          });

          assert.equal(first.total, '220.00');
          assert.equal(first.status, 'pending');
          await assert.rejects(
            products.remove(merchant.id, product.id),
            /cannot be deleted/i,
          );
          await assert.rejects(
            products.update(merchant.id, 'order-verification-test', product.id, product.revision, {
              variants: [
                {
                  name: 'Large',
                  price: '100.00',
                  stockQuantity: 3,
                  availability: 'available',
                  position: 0,
                },
              ],
            }),
            /pending order holds a stock reservation/i,
          );
          const reservedVariant = await transaction.productVariant.findUniqueOrThrow({
            where: { id: product.variants[0]!.id },
          });
          assert.equal(reservedVariant.stockQuantity, 1);

          const listed = await orders.listForOwner(merchant.id);
          assert.equal(listed.length, 1);
          assert.equal(listed[0]!.deliveryAddress, '12 Cairo Street');
          assert.equal(listed[0]!.lines[0]!.productName, 'Verification bowl');
          assert.equal(listed[0]!.lines[0]!.variantName, 'Large');
          const attributeSnapshots = listed[0]!.lines[0]!.variantAttributes;
          assert.deepEqual(
            attributeSnapshots.map(({ attributeName, attributeValue, position }) => ({
              attributeName,
              attributeValue,
              position,
            })),
            [
              { attributeName: 'Size', attributeValue: 'Large', position: 0 },
              { attributeName: 'Milk', attributeValue: 'Dairy', position: 1 },
            ],
          );
          assert.ok(attributeSnapshots.every((snapshot) => snapshot.attributeId && snapshot.valueId));
          assert.deepEqual(listed[0]!.lines[0]!.selections, [
            {
              groupName: 'Extras',
              optionName: 'Cheese',
              priceAdjustment: '10.00',
              modifierGroupId: product.modifierGroups[0]!.modifierGroupId,
              modifierOptionId: product.modifierGroups[0]!.options[0]!.id,
            },
          ]);

          const rejected = await orders.updateStatus(merchant.id, first.id, 'rejected');
          assert.equal(rejected.status, 'rejected');
          const restoredVariant = await transaction.productVariant.findUniqueOrThrow({
            where: { id: product.variants[0]!.id },
          });
          assert.equal(restoredVariant.stockQuantity, 3);

          const second = await orders.create(merchant.storefrontSlug, {
            customerName: 'Omar Samir',
            customerPhone: '01100000000',
            fulfillmentType: 'pickup',
            items: [
              {
                productId: product.id,
                variantId: product.variants[0]!.id,
                selections: [],
                quantity: 1,
              },
            ],
          });
          await orders.updateStatus(merchant.id, second.id, 'accepted');
          const acceptedVariant = await transaction.productVariant.findUniqueOrThrow({
            where: { id: product.variants[0]!.id },
          });
          assert.equal(acceptedVariant.stockQuantity, 2);

          const currentProductRevision = await transaction.product.findUniqueOrThrow({
            where: { id: product.id },
            select: { revision: true },
          });
          await products.update(merchant.id, 'order-verification-test', product.id, currentProductRevision.revision, {
            variants: [
              {
                id: product.variants[0]!.id,
                name: 'Extra large',
                price: '120.00',
                stockQuantity: acceptedVariant.stockQuantity,
                availability: 'available',
                position: 0,
                attributes: product.variants[0]!.attributes.map((attribute) => ({
                  attributeId: attribute.attributeId,
                  valueId: attribute.valueId,
                  name: attribute.attributeName,
                  value: attribute.value,
                })),
              },
            ],
          });
          const afterCatalogEdit = await orders.listForOwner(merchant.id);
          const acceptedOrderSnapshot = afterCatalogEdit.find((order) => order.id === second.id)!.lines[0]!;
          assert.equal(acceptedOrderSnapshot.variantName, 'Large');
          assert.equal(acceptedOrderSnapshot.basePrice, '100.00');
          assert.equal(acceptedOrderSnapshot.unitPrice, '100.00');
          assert.deepEqual(
            acceptedOrderSnapshot.variantAttributes.map(({ attributeName, attributeValue }) => ({
              attributeName,
              attributeValue,
            })),
            [
              { attributeName: 'Size', attributeValue: 'Large' },
              { attributeName: 'Milk', attributeValue: 'Dairy' },
            ],
          );

          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
