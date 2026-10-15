import { createPostgresAdapter, PrismaClient, type Prisma } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { ProductService } from '../../src/modules/catalog/products/product.service.js';
import { ProductPricingService } from '../../src/modules/catalog/pricing/product-pricing.service.js';
import { ProductConsumptionService } from '../../src/modules/catalog/products/product-consumption.service.js';
import { ModifierGroupService } from '../../src/modules/catalog/modifiers/modifier-group.service.js';
import { InventoryLedgerService } from '../../src/modules/inventory/inventory-ledger.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
import { StorefrontOrdersService } from '../../src/modules/orders/storefront-orders.service.js';
import { OrderLifecycleService } from '../../src/modules/orders/order-lifecycle.service.js';
import { ProductConfigurationReportService } from '../../src/modules/reports/product-configuration-report.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;
const actor = 'recipe-owner-test';

function transactionServices(tx: Prisma.TransactionClient) {
  let sequence = 0;
  return new Proxy(tx, {
    get(target, key) {
      if (key === '$transaction')
        return async (callback: (value: typeof tx) => unknown) => {
          const name = `m6_service_${++sequence}`;
          await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
          try {
            const result = await callback(tx);
            await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
            return result;
          } catch (error) {
            await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
            await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
            throw error;
          }
        };
      return Reflect.get(target, key);
    },
  }) as never;
}

async function fixture(tx: Prisma.TransactionClient, scoped: never) {
  const merchant = await tx.merchant.create({
    data: {
      name: 'M6 fixture',
      storefrontSlug: `recipe-${randomUUID()}`,
      activity: 'restaurant',
      contactPhone: '01000000000',
      ownerName: 'Test',
      ownerMobile: '01100000000',
    },
  });
  const merchantId = merchant.id;
  const media = await tx.mediaAsset.create({
    data: {
      merchantId,
      storageKey: `recipe/${randomUUID()}.jpg`,
      publicUrl: 'http://localhost:4000/test.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      createdBy: actor,
    },
  });
  const category = await tx.category.create({
    data: {
      merchantId,
      name: 'Recipe test',
      availability: 'available',
      imageAssetId: media.id,
      createdBy: actor,
      updatedBy: actor,
    },
  });
  const item = await tx.stockItem.create({
    data: {
      merchantId,
      name: 'Flour',
      baseUnit: 'g',
      creationRequest: randomUUID(),
      creationFingerprint: randomUUID(),
      createdBy: actor,
      updatedBy: actor,
    },
  });
  const branch = await tx.branch.create({
    data: { merchantId, name: 'Main', createdBy: actor, updatedBy: actor },
  });
  const missingDefault = await tx.branch.create({
    data: { merchantId, name: 'No default', createdBy: actor, updatedBy: actor },
  });
  const warehouse = await tx.warehouse.create({
    data: {
      merchantId,
      branchId: branch.id,
      name: 'Kitchen',
      isDefaultConsumption: true,
      createdBy: actor,
      updatedBy: actor,
    },
  });
  const ledger = new InventoryLedgerService(scoped);
  await ledger.postMovementBatch(tx, merchantId, actor, {
    requestId: randomUUID(),
    sourceType: 'opening_balance',
    sourceId: randomUUID(),
    kind: 'opening_balance',
    reason: 'Fixture opening',
    movements: [
      {
        warehouseId: warehouse.id,
        stockItemId: item.id,
        condition: 'available',
        unitCode: 'g',
        enteredQuantity: '100',
        baseDelta: '100',
      },
    ],
  });
  const products = new ProductService(scoped);
  const definition = await new ModifierGroupService(scoped).create(merchantId, {
    name: 'Extra flour',
    options: [{ name: 'Extra', position: 0 }],
  });
  const variantId = randomUUID();
  const configuration = {
    mode: 'RECIPE' as const,
    targets: [{ variantId, components: [{ stockItemId: item.id, unitCode: 'g', quantity: '10' }] }],
  };
  const recipe = await products.create(merchantId, actor, {
    name: 'Bread',
    basePrice: '10.00',
    availability: 'available',
    imageAssetIds: [media.id],
    categoryIds: [category.id],
    variants: [
      {
        id: variantId,
        name: 'Large',
        price: '10.00',
        stockQuantity: 0,
        availability: 'available',
        position: 0,
      },
    ],
    inventoryConfiguration: configuration,
    modifierGroupAssignments: [
      {
        modifierGroupId: definition.id,
        selectionMode: 'single',
        minSelections: 0,
        maxSelections: 1,
        position: 0,
        options: [
          {
            optionId: definition.options[0]!.id,
            priceAdjustment: '1.00',
            defaultSelected: false,
            maxQuantity: 3,
            effects: [{ stockItemId: item.id, direction: 'ADD', unitCode: 'g', quantity: '1' }],
          },
        ],
      },
    ],
  });
  const directVariantId = randomUUID();
  const direct = await products.create(merchantId, actor, {
    name: 'Direct bottle',
    basePrice: '5.00',
    availability: 'available',
    imageAssetIds: [media.id],
    categoryIds: [category.id],
    variants: [
      {
        id: directVariantId,
        name: 'Bottle',
        price: '5.00',
        stockQuantity: 10,
        availability: 'available',
        position: 0,
      },
    ],
    inventoryConfiguration: {
      mode: 'DIRECT',
      targets: [
        {
          variantId: directVariantId,
          components: [{ stockItemId: item.id, unitCode: 'g', quantity: '1' }],
        },
      ],
    },
  });
  const pricing = new ProductPricingService(scoped);
  const orders = new StorefrontOrdersService(scoped, pricing);
  const lifecycle = new OrderLifecycleService(scoped, new ProductConsumptionService(), ledger);
  const createOrder = (quantity = 2, mixed = false) =>
    orders.create(merchant.storefrontSlug!, {
      customerName: 'Recipe buyer',
      customerPhone: '01000000000',
      fulfillmentType: 'pickup',
      items: [
        {
          productId: recipe.id,
          variantId,
          quantity,
          selections: [
            {
              groupId: recipe.modifierGroups[0]!.id,
              optionIds: [definition.options[0]!.id],
              optionQuantities: [{ optionId: definition.options[0]!.id, quantity: 3 }],
            },
          ],
        },
        ...(mixed
          ? [{ productId: direct.id, variantId: directVariantId, quantity: 1, selections: [] }]
          : []),
      ],
    });
  const balance = async () =>
    (
      await tx.stockBalance.findFirstOrThrow({
        where: { merchantId, warehouseId: warehouse.id, stockItemId: item.id },
      })
    ).quantity.toString();
  return {
    merchantId,
    branch,
    missingDefault,
    warehouse,
    item,
    recipe,
    variantId,
    directVariantId,
    configuration,
    products,
    orders,
    lifecycle,
    createOrder,
    balance,
  };
}

it(
  'atomically accepts recipes, freezes pending configuration, restores recorded stock, and gates preparation',
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const rollback = new Error('Rollback recipe lifecycle fixtures');
    try {
      await assert.rejects(
        client.$transaction(
          async (tx) => {
            const scoped = transactionServices(tx);
            const f = await fixture(tx, scoped);
            const legacy = await tx.storefrontOrder.create({
              data: {
                merchantId: f.merchantId,
                customerName: 'Legacy recipe buyer',
                customerPhone: '01000000000',
                fulfillmentType: 'pickup',
                total: '10.00',
                lines: {
                  create: [
                    {
                      productId: f.recipe.id,
                      variantId: f.variantId,
                      productName: 'Old bread',
                      variantName: 'Large',
                      quantity: 1,
                      unitPrice: '10.00',
                      lineTotal: '10.00',
                      stockReserved: true,
                      position: 0,
                    },
                  ],
                },
              },
            });
            const legacyAccepted = await f.orders.updateStatus(f.merchantId, legacy.id, 'accepted');
            assert.equal(legacyAccepted.requiresRecipeAcceptance, undefined);
            assert.equal(await f.balance(), '100');
            assert.equal(
              await tx.stockMovementBatch.count({
                where: { merchantId: f.merchantId, kind: 'recipe_consumption' },
              }),
              0,
            );
            await assert.rejects(
              f.lifecycle.startPreparation(f.merchantId, actor, legacy.id, {
                requestId: randomUUID(),
              }),
              /only available for new recipe orders/,
            );
            const order = await f.createOrder(2, true);
            assert.equal(
              (await tx.productVariant.findUniqueOrThrow({ where: { id: f.variantId } }))
                .stockQuantity,
              0,
            );
            assert.equal(
              (await tx.productVariant.findUniqueOrThrow({ where: { id: f.directVariantId } }))
                .stockQuantity,
              9,
            );
            assert.equal(await f.balance(), '100');
            await assert.rejects(
              f.orders.updateStatus(f.merchantId, order.id, 'accepted'),
              /branch-based/,
            );
            const changed = structuredClone(f.configuration);
            changed.targets[0]!.components[0]!.quantity = '99';
            await assert.rejects(
              f.products.update(f.merchantId, actor, f.recipe.id, f.recipe.revision, {
                inventoryConfiguration: changed,
              }),
              /recipe orders are pending/,
            );
            await assert.rejects(
              f.products.detachModifierGroup(
                f.merchantId,
                actor,
                f.recipe.id,
                f.recipe.modifierGroups[0]!.id,
                f.recipe.revision,
              ),
              /recipe orders are pending/,
            );
            let metadata = await f.products.update(
              f.merchantId,
              actor,
              f.recipe.id,
              f.recipe.revision,
              { name: 'Renamed bread', basePrice: '12.00' },
            );
            const group = f.recipe.modifierGroups[0]!;
            const assignment = {
              modifierGroupId: group.modifierGroupId,
              selectionMode: group.selectionMode as 'single',
              minSelections: group.minSelections,
              maxSelections: group.maxSelections,
              position: group.position,
              options: group.options.map((option) => ({
                optionId: option.id,
                priceAdjustment: '2.00',
                defaultSelected: option.defaultSelected,
                maxQuantity: option.maxQuantity,
                effects: option.effects,
                variantOverrides: option.variantOverrides,
              })),
            };
            metadata = await f.products.update(
              f.merchantId,
              actor,
              f.recipe.id,
              metadata.revision,
              {
                inventoryConfiguration: f.configuration,
                modifierGroupAssignments: [assignment],
                variants: [
                  {
                    id: f.variantId,
                    name: 'Renamed Large',
                    price: '11.00',
                    availability: 'available',
                    stockQuantity: 0,
                    position: 0,
                  },
                ],
              },
            );
            const changedEffects = structuredClone(assignment);
            changedEffects.options[0]!.effects![0]!.quantity = '2';
            await assert.rejects(
              f.products.update(f.merchantId, actor, f.recipe.id, metadata.revision, {
                modifierGroupAssignments: [changedEffects],
              }),
              /recipe orders are pending/,
            );
            await assert.rejects(
              f.lifecycle.accept(randomUUID(), actor, order.id, {
                requestId: randomUUID(),
                branchId: f.branch.id,
              }),
              /not found/,
            );
            await assert.rejects(
              f.lifecycle.accept(f.merchantId, actor, order.id, {
                requestId: randomUUID(),
                branchId: randomUUID(),
              }),
              /active branch/,
            );
            await assert.rejects(
              f.lifecycle.accept(f.merchantId, actor, order.id, {
                requestId: randomUUID(),
                branchId: f.missingDefault.id,
              }),
              /default consumption warehouse/,
            );
            assert.equal(
              (await tx.storefrontOrder.findUniqueOrThrow({ where: { id: order.id } })).status,
              'pending',
            );
            const accept = { requestId: randomUUID(), branchId: f.branch.id };
            const accepted = await f.lifecycle.accept(f.merchantId, actor, order.id, accept);
            assert.equal(accepted.status, 'accepted');
            assert.equal(await f.balance(), '74');
            assert.equal(accepted.inventoryLifecycle?.warehouseId, f.warehouse.id);
            assert.deepEqual(
              await f.lifecycle.accept(f.merchantId, actor, order.id, accept),
              accepted,
            );
            await assert.rejects(
              f.lifecycle.accept(f.merchantId, actor, order.id, {
                ...accept,
                branchId: f.missingDefault.id,
              }),
              /already used/,
            );
            await assert.rejects(
              new InventoryService(scoped).setArchived(f.merchantId, actor, f.item.id, true, {
                revision: 1,
              }),
              /awaiting preparation/,
            );
            await f.products.update(f.merchantId, actor, f.recipe.id, metadata.revision, {
              inventoryConfiguration: changed,
            });
            const cancel = {
              requestId: randomUUID(),
              reason: 'Customer changed plans',
              restoreStock: true,
            };
            const cancelled = await f.lifecycle.cancel(f.merchantId, actor, order.id, cancel);
            assert.equal(cancelled.status, 'cancelled');
            assert.equal(await f.balance(), '100');
            assert.equal(
              (await tx.productVariant.findUniqueOrThrow({ where: { id: f.directVariantId } }))
                .stockQuantity,
              10,
            );
            assert.deepEqual(
              await f.lifecycle.cancel(f.merchantId, actor, order.id, cancel),
              cancelled,
            );
            assert.equal(await f.balance(), '100');
            assert.deepEqual(
              await f.lifecycle.accept(f.merchantId, actor, order.id, accept),
              accepted,
            );
            assert.equal(
              (await tx.storefrontOrder.findUniqueOrThrow({ where: { id: order.id } })).status,
              'cancelled',
            );
            const next = await f.createOrder(1);
            await f.lifecycle.accept(f.merchantId, actor, next.id, {
              requestId: randomUUID(),
              branchId: f.branch.id,
            });
            assert.equal(await f.balance(), '-2');
            const prepare = { requestId: randomUUID() };
            const preparing = await f.lifecycle.startPreparation(
              f.merchantId,
              actor,
              next.id,
              prepare,
            );
            assert.equal(preparing.status, 'preparing');
            assert.deepEqual(
              await f.lifecycle.startPreparation(f.merchantId, actor, next.id, prepare),
              preparing,
            );
            await assert.rejects(
              f.lifecycle.cancel(f.merchantId, actor, next.id, {
                requestId: randomUUID(),
                reason: 'Too late',
                restoreStock: true,
              }),
              /before preparation/,
            );
            const keep = await f.createOrder(1);
            await f.lifecycle.accept(f.merchantId, actor, keep.id, {
              requestId: randomUUID(),
              branchId: f.branch.id,
            });
            const before = await f.balance();
            await f.lifecycle.cancel(f.merchantId, actor, keep.id, {
              requestId: randomUUID(),
              reason: 'Ingredients discarded',
              restoreStock: false,
            });
            assert.equal(await f.balance(), before);
            const report = await new ProductConfigurationReportService(scoped).get(
              f.merchantId,
              '2020-01-01',
              '2100-01-01',
            );
            assert.equal(report.orderCount, 2);
            assert.ok(
              (
                await tx.storefrontOrderAction.findMany({ where: { merchantId: f.merchantId } })
              ).every((action) => action.createdBy === actor),
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

it(
  'serializes independent acceptance requests and shared-ingredient shortages without double deduction',
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    let merchantId: string | undefined;
    try {
      const f = await client.$transaction(
        async (tx) => {
          return fixture(tx, transactionServices(tx));
        },
        { timeout: 20_000 },
      );
      merchantId = f.merchantId;
      const pricing = new ProductPricingService(client as never);
      const orders = new StorefrontOrdersService(client as never, pricing);
      const lifecycle = new OrderLifecycleService(
        client as never,
        new ProductConsumptionService(),
        new InventoryLedgerService(client as never),
      );
      const merchant = await client.merchant.findUniqueOrThrow({ where: { id: f.merchantId } });
      const makeOrder = (quantity: number) =>
        orders.create(merchant.storefrontSlug!, {
          customerName: 'Concurrent buyer',
          customerPhone: '01000000000',
          fulfillmentType: 'pickup',
          items: [
            {
              productId: f.recipe.id,
              variantId: f.variantId,
              quantity,
              selections: [
                {
                  groupId: f.recipe.modifierGroups[0]!.id,
                  optionIds: [f.recipe.modifierGroups[0]!.options[0]!.id],
                  optionQuantities: [
                    { optionId: f.recipe.modifierGroups[0]!.options[0]!.id, quantity: 3 },
                  ],
                },
              ],
            },
          ],
        });
      const first = await makeOrder(2);
      const commands = [
        { requestId: randomUUID(), branchId: f.branch.id },
        { requestId: randomUUID(), branchId: f.branch.id },
      ];
      const concurrent = await Promise.allSettled(
        commands.map((command) => lifecycle.accept(f.merchantId, actor, first.id, command)),
      );
      assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
      const winner = concurrent.findIndex((result) => result.status === 'fulfilled');
      assert.equal(
        (await lifecycle.accept(f.merchantId, actor, first.id, commands[winner]!)).status,
        'accepted',
      );
      await client.merchant.update({
        where: { id: f.merchantId },
        data: { negativeStockPolicy: 'prevent' },
      });
      const a = await makeOrder(4);
      const b = await makeOrder(4);
      const competing = await Promise.allSettled(
        [a, b].map((order) =>
          lifecycle.accept(f.merchantId, actor, order.id, {
            requestId: randomUUID(),
            branchId: f.branch.id,
          }),
        ),
      );
      assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
      const loser = [a, b][competing.findIndex((result) => result.status === 'rejected')]!;
      await assert.rejects(
        lifecycle.accept(f.merchantId, actor, loser.id, {
          requestId: randomUUID(),
          branchId: f.branch.id,
        }),
        /Insufficient/,
      );
      assert.equal(
        (
          await client.stockBalance.findFirstOrThrow({ where: { merchantId: f.merchantId } })
        ).quantity.toString(),
        '22',
      );
      assert.equal(
        await client.stockMovementBatch.count({
          where: { merchantId: f.merchantId, kind: 'recipe_consumption' },
        }),
        2,
      );
      assert.equal(
        (await client.storefrontOrder.findUniqueOrThrow({ where: { id: loser.id } })).status,
        'pending',
      );
    } finally {
      if (merchantId) {
        const where = { merchantId };
        await client.storefrontOrderAction.deleteMany({ where });
        await client.storefrontOrderStockBatch.deleteMany({ where });
        await client.storefrontOrder.deleteMany({ where });
        await client.productImage.deleteMany({ where });
        await client.productCategory.deleteMany({ where });
        await client.productInventoryConfiguration.deleteMany({ where });
        await client.product.deleteMany({ where });
        await client.modifierOption.deleteMany({ where });
        await client.modifierGroup.deleteMany({ where });
        await client.category.deleteMany({ where });
        await client.mediaAsset.deleteMany({ where });
        await client.stockMovement.deleteMany({ where });
        await client.stockMovementBatch.deleteMany({ where });
        await client.stockBalance.deleteMany({ where });
        await client.warehouse.deleteMany({ where });
        await client.branch.deleteMany({ where });
        await client.stockItemUnit.deleteMany({ where });
        await client.stockItem.deleteMany({ where });
        await client.merchant.delete({ where: { id: merchantId } });
      }
      await client.$disconnect();
    }
  },
);
