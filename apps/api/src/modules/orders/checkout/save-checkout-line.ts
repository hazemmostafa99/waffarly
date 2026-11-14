/**
 * Saves one ordered item with its agreed name, choices and price.
 * It also holds its stock or remembers the ingredients needed when preparation is accepted.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { CreateStorefrontOrderRequest } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { formatCents, toCents } from '../../../common/money/money.js';

import { ProductConsumptionService, ProductPricingService } from '../../catalog/index.js';

import { freezeLineStockRequirements } from '../stock/order-stock.persistence.js';

const MAX_ORDER_TOTAL_CENTS = 999_999_999_999n;

export async function saveCheckoutLine(
  transaction: Prisma.TransactionClient,
  consumption: ProductConsumptionService,
  merchantId: string,
  orderId: string,
  item: CreateStorefrontOrderRequest['items'][number],
  quote: Awaited<ReturnType<ProductPricingService['quote']>>,
  position: number,
  subtotalBeforeLine: bigint,
): Promise<bigint> {
  // 1. Confirm the item and choices still match what the customer reviewed.
  const product = await transaction.product.findFirst({
    where: {
      id: item.productId,
      merchantId,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      availability: true,
      revision: true,
      inventoryConfiguration: { select: { mode: true } },
      variants: {
        select: {
          id: true,
          name: true,
          availability: true,
          stockQuantity: true,
          attributeSelections: {
            orderBy: { attribute: { position: 'asc' } },
            select: {
              attributeId: true,
              valueId: true,
              attribute: { select: { id: true, name: true, position: true } },
              value: { select: { id: true, value: true } },
            },
          },
        },
      },
      modifierGroups: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          modifierGroupId: true,
          position: true,
          modifierGroup: { select: { name: true } },
          options: {
            orderBy: { option: { position: 'asc' } },
            select: {
              optionId: true,
              priceAdjustment: true,
              option: { select: { name: true, position: true } },
            },
          },
        },
      },
    },
  });
  if (!product || product.availability !== 'available') {
    throw new ConflictException('A product in this order is no longer available.');
  }
  if (product.revision !== quote.productRevision) {
    throw new ConflictException('A product changed while this order was being placed.');
  }

  const variant = quote.variantId
    ? product.variants.find((candidate) => candidate.id === quote.variantId)
    : undefined;
  if (product.variants.length > 0 && !variant) {
    throw new ConflictException('A selected variant is no longer available.');
  }
  if (variant && variant.availability !== 'available') {
    throw new ConflictException('A selected variant is no longer available.');
  }

  // 2. Hold available finished stock; ingredients are accounted for at acceptance.
  const recipeHandling = product.inventoryConfiguration?.mode === 'RECIPE';
  let stockReserved = false;
  if (!recipeHandling && variant?.stockQuantity !== null && variant?.stockQuantity !== undefined) {
    const reservation = await transaction.productVariant.updateMany({
      where: {
        id: variant.id,
        merchantId,
        productId: product.id,
        availability: 'available',
        stockQuantity: { gte: item.quantity },
      },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    if (reservation.count !== 1) {
      throw new ConflictException('A selected variant does not have enough stock.');
    }
    stockReserved = true;
  }

  // 3. Remember the names, choices and prices used for this sale.
  const selectedOptions = new Map(
    quote.selections.map((selection) => [
      selection.groupId,
      new Map(
        (
          selection.options ??
          selection.optionIds.map((optionId) => ({
            optionId,
            quantity: 1,
            unitPriceAdjustment: undefined,
          }))
        ).map((option) => [option.optionId, option]),
      ),
    ]),
  );
  const selectionSnapshots = product.modifierGroups.flatMap((group) =>
    group.options
      .filter((option) => selectedOptions.get(group.id)?.has(option.optionId))
      .map((option) => ({
        modifierGroupId: group.modifierGroupId,
        modifierOptionId: option.optionId,
        groupName: group.modifierGroup.name,
        optionName: option.option.name,
        quantity: selectedOptions.get(group.id)!.get(option.optionId)!.quantity,
        priceAdjustment:
          selectedOptions.get(group.id)!.get(option.optionId)!.unitPriceAdjustment ??
          option.priceAdjustment.toString(),
        groupPosition: group.position,
        optionPosition: option.option.position,
      })),
  );
  const variantAttributeSnapshots =
    variant?.attributeSelections.map((selection) => ({
      attributeId: selection.attributeId,
      valueId: selection.valueId,
      attributeName: selection.attribute.name,
      attributeValue: selection.value.value,
      position: selection.attribute.position,
    })) ?? [];
  const unitPriceCents = toCents(quote.totalPrice);
  const lineTotalCents = unitPriceCents * BigInt(item.quantity);
  const orderTotalCents = subtotalBeforeLine + lineTotalCents;
  if (orderTotalCents > MAX_ORDER_TOTAL_CENTS) {
    throw new BadRequestException('The order total is too large.');
  }

  const savedLine = await transaction.storefrontOrderLine.create({
    data: {
      order: { connect: { id_merchantId: { id: orderId, merchantId } } },
      productId: product.id,
      variantId: variant?.id ?? null,
      productName: product.name,
      variantName: variant?.name ?? null,
      note: null,
      basePrice: quote.basePrice,
      modifierTotal: quote.modifierTotal,
      quantity: item.quantity,
      unitPrice: formatCents(unitPriceCents),
      lineTotal: formatCents(lineTotalCents),
      stockHandling: recipeHandling ? 'recipe_acceptance' : 'legacy',
      stockReserved,
      position,
      selections: { create: selectionSnapshots },
      variantAttributes: { create: variantAttributeSnapshots },
    },
    select: { id: true },
  });
  if (recipeHandling) {
    const requirements = await consumption.requirements(transaction, merchantId, [
      {
        productId: product.id,
        variantId: variant?.id ?? null,
        quantity: item.quantity,
        selections: selectionSnapshots.map((selection) => ({
          modifierGroupId: selection.modifierGroupId,
          modifierOptionId: selection.modifierOptionId,
          quantity: selection.quantity,
        })),
      },
    ]);
    await freezeLineStockRequirements(transaction, merchantId, savedLine.id, requirements);
  }
  return orderTotalCents;
}
