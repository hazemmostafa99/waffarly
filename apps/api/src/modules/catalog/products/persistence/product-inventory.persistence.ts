import { BadRequestException } from '@nestjs/common';
import type {
  CatalogProductInventoryConfigurationFields,
  StockBaseUnit,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { randomUUID } from 'node:crypto';
import { convertToBaseQuantity, normalizeStockQuantity } from '../../../inventory/index.js';
import { calculateInventoryRequirements } from '../product-inventory.calculator.js';
import { assertInventoryConfigurationShape } from '../product-inventory.rules.js';

export async function replaceProductInventoryConfiguration(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  configuration: CatalogProductInventoryConfigurationFields,
): Promise<void> {
  assertInventoryConfigurationShape(configuration);
  const variants = await transaction.productVariant.findMany({
    where: { productId, merchantId },
    select: { id: true },
  });
  const expectedVariantIds = variants.map((variant) => variant.id).sort();
  const providedVariantIds = configuration.targets
    .map((target) => target.variantId)
    .filter((variantId): variantId is string => variantId !== null)
    .sort();
  if (variants.length === 0) {
    if (configuration.targets.length !== 1 || configuration.targets[0]?.variantId !== null) {
      throw new BadRequestException('A simple product needs one product-level inventory target.');
    }
  } else if (
    providedVariantIds.length !== expectedVariantIds.length ||
    providedVariantIds.some((variantId, index) => variantId !== expectedVariantIds[index]) ||
    configuration.targets.some((target) => target.variantId === null)
  ) {
    throw new BadRequestException('Inventory configuration must include every product variant.');
  }

  const stockItemIds = [
    ...new Set(
      configuration.targets.flatMap((target) =>
        target.components.map((component) => component.stockItemId),
      ),
    ),
  ];
  const items = await transaction.stockItem.findMany({
    where: { merchantId, id: { in: stockItemIds }, archivedAt: null },
    select: {
      id: true,
      name: true,
      baseUnit: true,
      units: { select: { code: true, name: true, baseQuantity: true } },
    },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));
  if (itemById.size !== stockItemIds.length) {
    throw new BadRequestException('Choose active stock items owned by this merchant.');
  }

  const targets = configuration.targets.map((target) => ({
    id: randomUUID(),
    variantId: target.variantId,
    components: target.components.map((component, position) => {
      const item = itemById.get(component.stockItemId);
      if (!item)
        throw new BadRequestException('Choose an active stock item owned by this merchant.');
      const quantity = normalizeStockQuantity(component.quantity);
      const baseUnit = item.baseUnit as StockBaseUnit;
      const baseQuantity = convertToBaseQuantity(
        quantity,
        component.unitCode,
        baseUnit,
        item.units.map((unit) => ({
          code: unit.code,
          name: unit.name,
          baseQuantity: unit.baseQuantity.toFixed(6),
        })),
      );
      return {
        id: randomUUID(),
        stockItemId: item.id,
        unitCode: component.unitCode,
        quantity,
        baseQuantity,
        baseUnit,
        position,
      };
    }),
  }));
  for (const target of targets) {
    calculateInventoryRequirements(
      target.components.map((component) => ({
        stockItemId: component.stockItemId,
        baseUnit: component.baseUnit,
        baseQuantity: component.baseQuantity,
      })),
      1,
    );
  }

  await transaction.productInventoryConfiguration.deleteMany({ where: { productId, merchantId } });
  await transaction.productInventoryConfiguration.create({
    data: { productId, merchantId, mode: configuration.mode },
  });
  await transaction.productInventoryTarget.createMany({
    data: targets.map((target) => ({
      id: target.id,
      productId,
      merchantId,
      variantId: target.variantId,
    })),
  });
  await transaction.productInventoryComponent.createMany({
    data: targets.flatMap((target) =>
      target.components.map((component) => ({
        id: component.id,
        targetId: target.id,
        productId,
        merchantId,
        stockItemId: component.stockItemId,
        unitCode: component.unitCode,
        quantity: component.quantity,
        baseQuantity: component.baseQuantity,
        baseUnit: component.baseUnit,
        position: component.position,
      })),
    ),
  });
}
