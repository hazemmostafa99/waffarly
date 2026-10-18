import { createPostgresAdapter, PrismaClient, type Prisma } from '@waffarly/database';
import { config } from 'dotenv';
import { ConflictException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { ProductService } from '../../src/modules/catalog/products/product.service.js';
import { ProductPricingService } from '../../src/modules/catalog/pricing/product-pricing.service.js';
import { ProductConsumptionService } from '../../src/modules/catalog/products/product-consumption.service.js';
import { ModifierGroupService } from '../../src/modules/catalog/modifiers/modifier-group.service.js';
import { InventoryLedgerService } from '../../src/modules/inventory/inventory-ledger.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
import { InventoryLocationsService } from '../../src/modules/inventory/inventory-locations.service.js';
import { StorefrontOrdersService } from '../../src/modules/orders/storefront-orders.service.js';
import { OrderLifecycleService } from '../../src/modules/orders/order-lifecycle.service.js';
import { ProductConfigurationReportService } from '../../src/modules/reports/product-configuration-report.service.js';
import { PosEmployeeService } from '../../src/modules/auth/pos-employee.service.js';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { PosOrdersService } from '../../src/modules/orders/pos-orders.service.js';
import { ShiftsService } from '../../src/modules/shifts/shifts.service.js';

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
  const employee = await tx.posEmployee.create({
    data: {
      merchantId,
      username: 'recipe-cashier',
      displayName: 'Recipe Cashier',
      passwordHash: 'test-hash',
      createdBy: actor,
      updatedBy: actor,
      branches: {
        create: {
          createdBy: actor,
          branch: { connect: { id_merchantId: { id: branch.id, merchantId } } },
        },
      },
    },
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
    media,
    category,
    branch,
    employee,
    missingDefault,
    warehouse,
    item,
    recipe,
    direct,
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
            const queue = await f.orders.listForPos(f.merchantId, f.branch.id);
            assert.deepEqual(
              queue.items.map((item) => item.id),
              [order.id],
            );
            assert.deepEqual(await f.orders.listForPos(randomUUID(), f.branch.id), {
              items: [],
              nextCursor: null,
            });
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
            const editedWhilePending = await f.products.update(
              f.merchantId,
              actor,
              f.recipe.id,
              f.recipe.revision,
              { inventoryConfiguration: changed },
            );
            assert.equal(editedWhilePending.revision, f.recipe.revision + 1);
            const savedRequirements = await tx.storefrontOrderLineStockRequirement.findMany({
              where: { merchantId: f.merchantId, orderLine: { orderId: order.id } },
            });
            assert.equal(savedRequirements.length, 1);
            assert.equal(savedRequirements[0]?.quantity.toString(), '26');
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
            const posActor = `pos:${f.employee.id}`;
            assert.throws(() =>
              f.lifecycle.acceptFromPos(
                f.merchantId,
                posActor,
                order.id,
                { requestId: randomUUID(), branchId: f.missingDefault.id },
                [f.branch.id],
              ),
            );
            const accepted = await f.lifecycle.acceptFromPos(
              f.merchantId,
              posActor,
              order.id,
              accept,
              [f.branch.id],
            );
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
            await f.lifecycle.acceptFromPos(
              f.merchantId,
              posActor,
              next.id,
              { requestId: randomUUID(), branchId: f.branch.id },
              [f.branch.id],
            );
            assert.equal(await f.balance(), '-2');
            const prepare = { requestId: randomUUID() };
            await assert.rejects(
              f.lifecycle.startPreparationFromPos(
                f.merchantId,
                posActor,
                next.id,
                { requestId: randomUUID() },
                [f.missingDefault.id],
              ),
            );
            const preparing = await f.lifecycle.startPreparationFromPos(
              f.merchantId,
              posActor,
              next.id,
              prepare,
              [f.branch.id],
            );
            assert.equal(preparing.status, 'preparing');
            assert.deepEqual(
              await f.lifecycle.startPreparationFromPos(f.merchantId, posActor, next.id, prepare, [
                f.branch.id,
              ]),
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
              ).some((action) => action.createdBy === posActor),
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
  'confirms POS sales once, consumes direct stock immediately, and accepts frozen recipes later',
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const rollback = new Error('Rollback POS sale fixtures');
    try {
      await assert.rejects(
        client.$transaction(
          async (tx) => {
            const scoped = transactionServices(tx);
            const f = await fixture(tx, scoped);
            await tx.merchant.update({
              where: { id: f.merchantId },
              data: { negativeStockPolicy: 'prevent' },
            });
            const register = await tx.posRegister.create({
              data: {
                merchantId: f.merchantId,
                branchId: f.branch.id,
                name: 'Till 1',
                createdBy: actor,
                updatedBy: actor,
              },
            });
            const shift = await tx.posShift.create({
              data: {
                merchantId: f.merchantId,
                branchId: f.branch.id,
                registerId: register.id,
                openRequestId: randomUUID(),
                openedByEmployeeId: f.employee.id,
                openingFloat: '100.00',
              },
            });
            const legacyVariantId = randomUUID();
            const legacy = await f.products.create(f.merchantId, actor, {
              name: 'Legacy cookie',
              basePrice: '4.00',
              availability: 'available',
              imageAssetIds: [f.media.id],
              categoryIds: [f.category.id],
              variants: [
                {
                  id: legacyVariantId,
                  name: 'Single',
                  price: '4.00',
                  stockQuantity: 10,
                  availability: 'available',
                  position: 0,
                },
              ],
              inventoryConfiguration: {
                mode: 'DIRECT',
                targets: [
                  {
                    variantId: legacyVariantId,
                    components: [{ stockItemId: f.item.id, unitCode: 'g', quantity: '1' }],
                  },
                ],
              },
            });
            await tx.productInventoryConfiguration.deleteMany({
              where: { merchantId: f.merchantId, productId: legacy.id },
            });
            await f.products.update(f.merchantId, actor, f.direct.id, f.direct.revision, {
              inventoryConfiguration: {
                mode: 'DIRECT',
                targets: [
                  {
                    variantId: f.directVariantId,
                    components: [{ stockItemId: f.item.id, unitCode: 'g', quantity: '100' }],
                  },
                ],
              },
            });
            const cashier: PosEmployeeSession = {
              id: f.employee.id,
              merchantId: f.merchantId,
              username: f.employee.username,
              displayName: f.employee.displayName,
              role: 'cashier',
              permissions: ['sell'],
              branches: [{ id: f.branch.id, name: f.branch.name, archivedAt: null }],
            };
            const pricing = new ProductPricingService(scoped);
            const posOrders = new PosOrdersService(
              scoped,
              pricing,
              new ProductConsumptionService(),
              new InventoryLedgerService(scoped),
              new ShiftsService(scoped),
              { attachOrder: async () => undefined } as never,
              {} as never,
            );
            const recipeLineId = randomUUID();
            const directLineId = randomUUID();
            const legacyLineId = randomUUID();
            const items = [
              {
                lineId: recipeLineId,
                productId: f.recipe.id,
                variantId: f.variantId,
                selections: [
                  {
                    groupId: f.recipe.modifierGroups[0]!.id,
                    optionIds: [f.recipe.modifierGroups[0]!.options[0]!.id],
                    optionQuantities: [
                      { optionId: f.recipe.modifierGroups[0]!.options[0]!.id, quantity: 3 },
                    ],
                  },
                ],
                quantity: 2,
              },
              {
                lineId: directLineId,
                productId: f.direct.id,
                variantId: f.directVariantId,
                selections: [],
                quantity: 1,
              },
              {
                lineId: legacyLineId,
                productId: legacy.id,
                variantId: legacyVariantId,
                selections: [],
                quantity: 1,
              },
            ];
            const quote = await posOrders.quote(cashier, { items });
            const quoteByLine = new Map(quote.items.map((item) => [item.lineId, item.quote]));
            const payload = {
              requestId: randomUUID(),
              registerId: register.id,
              fulfillmentType: 'takeaway' as const,
              items: items.map((item) => ({
                ...item,
                expectedProductRevision: quoteByLine.get(item.lineId)!.productRevision,
                ...(item.lineId === recipeLineId ? { note: 'No onions' } : {}),
              })),
            };
            await f.products.update(
              f.merchantId,
              actor,
              f.direct.id,
              quoteByLine.get(directLineId)!.productRevision,
              { name: 'Direct item updated after quote' },
            );
            await assert.rejects(
              posOrders.create(cashier, payload),
              (error: unknown) =>
                error instanceof ConflictException &&
                /product changed/i.test(JSON.stringify(error.getResponse())),
            );
            assert.equal(await f.balance(), '100');
            const shortageLine = {
              lineId: randomUUID(),
              productId: f.direct.id,
              variantId: f.directVariantId,
              selections: [],
              quantity: 2,
            };
            const shortageQuote = await posOrders.quote(cashier, { items: [shortageLine] });
            const shortageQuotedLine = shortageQuote.items[0]!.quote;
            await assert.rejects(
              posOrders.create(cashier, {
                requestId: randomUUID(),
                registerId: register.id,
                fulfillmentType: 'takeaway',
                items: [
                  {
                    ...shortageLine,
                    expectedProductRevision: shortageQuotedLine.productRevision,
                  },
                ],
              }),
            );
            assert.equal(await f.balance(), '100');
            assert.equal(
              await tx.storefrontOrder.count({
                where: { merchantId: f.merchantId, source: 'pos' },
              }),
              0,
            );
            assert.equal(
              await tx.storefrontOrderAction.count({
                where: { merchantId: f.merchantId, action: 'pos_sale' },
              }),
              0,
            );
            assert.equal(
              await tx.stockMovementBatch.count({
                where: { merchantId: f.merchantId, sourceType: 'pos_sale' },
              }),
              0,
            );
            assert.equal(
              (await tx.productVariant.findUniqueOrThrow({ where: { id: f.directVariantId } }))
                .stockQuantity,
              10,
            );
            const refreshedQuote = await posOrders.quote(cashier, { items });
            const refreshedQuoteByLine = new Map(
              refreshedQuote.items.map((item) => [item.lineId, item.quote]),
            );
            const refreshedPayload = {
              ...payload,
              requestId: randomUUID(),
              items: payload.items.map((item) => ({
                ...item,
                expectedProductRevision: refreshedQuoteByLine.get(item.lineId)!.productRevision,
              })),
            };
            const created = await posOrders.create(cashier, refreshedPayload);
            const replayed = await posOrders.create(cashier, refreshedPayload);
            assert.equal(replayed.id, created.id);
            assert.equal(await f.balance(), '0');
            assert.equal(
              (await f.orders.listForOwner(f.merchantId)).items.some((order) => order.id === created.id),
              false,
            );
            assert.equal(
              (await f.orders.listForPos(f.merchantId, f.branch.id)).items.some(
                (order) => order.id === created.id,
              ),
              true,
            );
            assert.equal(
              (await tx.stockMovementBatch.count({
                where: { merchantId: f.merchantId, sourceType: 'pos_sale' },
              })),
              1,
            );
            assert.equal(
              (await tx.productVariant.findUniqueOrThrow({ where: { id: legacyVariantId } }))
                .stockQuantity,
              9,
            );
            const saved = await tx.storefrontOrder.findFirstOrThrow({
              where: { id: created.id, merchantId: f.merchantId },
              include: { lines: { include: { stockRequirements: true } } },
            });
            assert.equal(saved.source, 'pos');
            assert.equal(saved.posShiftId, shift.id);
            assert.equal(saved.createdByPosEmployeeId, cashier.id);
            const savedRecipeLine = saved.lines.find((line) => line.productId === f.recipe.id);
            assert.ok(savedRecipeLine?.stockRequirementsFrozenAt);
            assert.equal(savedRecipeLine?.note, 'No onions');
            assert.equal(
              savedRecipeLine?.stockRequirements[0]?.quantity.toString(),
              '26',
            );

            const backupWarehouse = await tx.warehouse.create({
              data: {
                merchantId: f.merchantId,
                branchId: f.branch.id,
                name: 'Backup kitchen',
                createdBy: actor,
                updatedBy: actor,
              },
            });
            const ledger = new InventoryLedgerService(scoped);
            await ledger.postMovementBatch(tx, f.merchantId, actor, {
              requestId: randomUUID(),
              sourceType: 'opening_balance',
              sourceId: randomUUID(),
              kind: 'opening_balance',
              reason: 'POS test backup stock',
              movements: [
                {
                  warehouseId: backupWarehouse.id,
                  stockItemId: f.item.id,
                  condition: 'available',
                  unitCode: 'g',
                  enteredQuantity: '100',
                  baseDelta: '100',
                },
              ],
            });
            const locations = new InventoryLocationsService(scoped);
            const currentBranch = await tx.branch.findUniqueOrThrow({
              where: { id: f.branch.id },
              select: { revision: true },
            });
            await locations.setDefaultConsumptionWarehouse(
              f.merchantId,
              actor,
              f.branch.id,
              { warehouseId: backupWarehouse.id, revision: currentBranch.revision },
            );
            const originalWarehouse = await tx.warehouse.findUniqueOrThrow({
              where: { id: f.warehouse.id },
              select: { revision: true },
            });
            await assert.rejects(
              locations.setWarehouseArchived(
                f.merchantId,
                actor,
                f.branch.id,
                f.warehouse.id,
                true,
                { revision: originalWarehouse.revision },
              ),
              /awaiting preparation/,
            );

            const editedRecipe = structuredClone(f.configuration);
            editedRecipe.targets[0]!.components[0]!.quantity = '99';
            await f.products.update(f.merchantId, actor, f.recipe.id, f.recipe.revision, {
              inventoryConfiguration: editedRecipe,
            });
            const lifecycle = new OrderLifecycleService(
              scoped,
              new ProductConsumptionService(),
              new InventoryLedgerService(scoped),
            );
            const accepted = await lifecycle.acceptFromPos(
              f.merchantId,
              `pos:${cashier.id}`,
              created.id,
              { requestId: randomUUID(), branchId: f.branch.id },
              [f.branch.id],
            );
            assert.equal(accepted.status, 'accepted');
            assert.equal(await f.balance(), '0');
            assert.equal(
              (
                await tx.stockBalance.findFirstOrThrow({
                  where: {
                    merchantId: f.merchantId,
                    warehouseId: backupWarehouse.id,
                    stockItemId: f.item.id,
                  },
                })
              ).quantity.toString(),
              '74',
            );
            const cancelled = await lifecycle.cancel(f.merchantId, actor, created.id, {
              requestId: randomUUID(),
              reason: 'Fixture reversal',
              restoreStock: true,
            });
            assert.equal(cancelled.status, 'cancelled');
            assert.equal(await f.balance(), '100');
            assert.equal(
              (
                await tx.stockBalance.findFirstOrThrow({
                  where: {
                    merchantId: f.merchantId,
                    warehouseId: backupWarehouse.id,
                    stockItemId: f.item.id,
                  },
                })
              ).quantity.toString(),
              '100',
            );
            assert.equal(
              (await tx.productVariant.findUniqueOrThrow({ where: { id: legacyVariantId } }))
                .stockQuantity,
              10,
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
        await client.storefrontOrderLineStockRequirement.deleteMany({ where });
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
        await client.posEmployeeBranch.deleteMany({ where });
        await client.posEmployee.deleteMany({ where });
        await client.branch.deleteMany({ where });
        await client.stockItemUnit.deleteMany({ where });
        await client.stockItem.deleteMany({ where });
        await client.merchant.delete({ where: { id: merchantId } });
      }
      await client.$disconnect();
    }
  },
);

it(
  'creates a POS employee with tenant-scoped branch assignments',
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const rollback = new Error('Rollback POS employee creation fixture');
    try {
      await assert.rejects(
        client.$transaction(async (tx) => {
          const token = randomUUID().replaceAll('-', '');
          const merchant = await tx.merchant.create({
            data: {
              name: `POS employee create ${token}`,
              storefrontSlug: `pos-employee-create-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'POS employee test',
              ownerMobile: '01100000000',
            },
          });
          const branch = await tx.branch.create({
            data: {
              merchantId: merchant.id,
              name: 'Main',
              createdBy: actor,
              updatedBy: actor,
            },
          });
          const employees = new PosEmployeeService(transactionServices(tx));
          const created = await employees.create(merchant.id, actor, {
            username: 'cashier-create-test',
            displayName: 'Cashier Create Test',
            password: 'new-password-long-enough',
            branchIds: [branch.id],
          });

          assert.equal(created.branches.length, 1);
          assert.equal(created.branches[0]?.id, branch.id);
          assert.equal(
            await tx.posEmployeeBranch.count({
              where: { merchantId: merchant.id, branchId: branch.id },
            }),
            1,
          );
          throw rollback;
        }),
        rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);

it(
  'revokes only the employee POS sessions after password reset or deactivation',
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const rollback = new Error('Rollback POS employee session fixtures');
    try {
      await assert.rejects(
        client.$transaction(async (tx) => {
          const scoped = transactionServices(tx);
          const token = randomUUID().replaceAll('-', '');
          const merchant = await tx.merchant.create({
            data: {
              name: `POS employee sessions ${token}`,
              storefrontSlug: `pos-employee-sessions-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'POS session test',
              ownerMobile: '01100000000',
            },
          });
          const branch = await tx.branch.create({
            data: {
              merchantId: merchant.id,
              name: 'Main',
              createdBy: actor,
              updatedBy: actor,
            },
          });
          const employee = await tx.posEmployee.create({
            data: {
              merchantId: merchant.id,
              username: 'cashier1',
              displayName: 'Cashier One',
              passwordHash: 'initial-test-hash',
              createdBy: actor,
              updatedBy: actor,
              branches: {
                create: {
                  createdBy: actor,
                  branch: {
                    connect: { id_merchantId: { id: branch.id, merchantId: merchant.id } },
                  },
                },
              },
            },
          });
          const employees = new PosEmployeeService(scoped);
          const createSession = (subjectKind: string, subjectId: string) =>
            tx.authSession.create({
              data: {
                tokenHash: randomUUID().replaceAll('-', '').repeat(2),
                subjectKind,
                subjectId,
                expiresAt: new Date(Date.now() + 60_000),
              },
            });

          await createSession('POS', employee.id);
          await createSession('OWNER', employee.id);
          const afterPasswordReset = await employees.update(merchant.id, actor, employee.id, {
            revision: 1,
            displayName: employee.displayName,
            active: true,
            branchIds: [branch.id],
            password: 'new-password-long-enough',
          });
          assert.equal(afterPasswordReset.revision, 2);
          assert.equal(
            await tx.authSession.count({ where: { subjectKind: 'POS', subjectId: employee.id } }),
            0,
          );
          assert.equal(
            await tx.authSession.count({ where: { subjectKind: 'OWNER', subjectId: employee.id } }),
            1,
          );

          await createSession('POS', employee.id);
          const otherEmployeeId = randomUUID();
          await createSession('POS', otherEmployeeId);
          const afterDeactivation = await employees.update(merchant.id, actor, employee.id, {
            revision: 2,
            displayName: employee.displayName,
            active: false,
            branchIds: [branch.id],
          });
          assert.equal(afterDeactivation.active, false);
          assert.equal(
            await tx.authSession.count({ where: { subjectKind: 'POS', subjectId: employee.id } }),
            0,
          );
          assert.equal(
            await tx.authSession.count({
              where: { subjectKind: 'POS', subjectId: otherEmployeeId },
            }),
            1,
          );
          assert.equal(
            await tx.authSession.count({
              where: { subjectKind: 'OWNER', subjectId: employee.id },
            }),
            1,
          );
          throw rollback;
        }),
        rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
