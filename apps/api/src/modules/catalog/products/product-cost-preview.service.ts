/** Calculates a current, per-sellable cost preview from saved stock requirements. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CatalogProductCostPreview,
  CatalogProductCostPreviewRequest,
} from '@waffarly/contracts';
import { formatCents, toCents } from '../../../common/money/money.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { parseStockQuantity } from '../../inventory/index.js';
import { ProductConsumptionService } from './product-consumption.service.js';

@Injectable()
export class ProductCostPreviewService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductConsumptionService) private readonly consumption: ProductConsumptionService,
  ) {}

  async get(merchantId: string, productId: string, input: CatalogProductCostPreviewRequest) {
    return this.prisma.$transaction(async (transaction): Promise<CatalogProductCostPreview> => {
      const product = await transaction.product.findFirst({
        where: { merchantId, id: productId, archivedAt: null },
        select: {
          id: true,
          name: true,
          basePrice: true,
          inventoryConfiguration: { select: { mode: true } },
          variants: { select: { id: true, price: true } },
          modifierGroups: {
            select: {
              modifierGroupId: true,
              variantOverrides: { select: { variantId: true, available: true } },
              options: {
                select: {
                  optionId: true,
                  priceAdjustment: true,
                  variantOverrides: {
                    select: { variantId: true, available: true, priceAdjustment: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!product) throw new NotFoundException('Product was not found.');
      if (!product.inventoryConfiguration || !['DIRECT', 'RECIPE'].includes(product.inventoryConfiguration.mode)) {
        throw new ConflictException('Configure the product stock usage before previewing its cost.');
      }

      const variant = input.variantId
        ? product.variants.find((candidate) => candidate.id === input.variantId)
        : null;
      if (
        (input.variantId && !variant) ||
        (!input.variantId && product.variants.length > 0)
      ) {
        throw new ConflictException('Select a valid product size before previewing its cost.');
      }
      let modifierTotalCents = 0n;
      for (const selection of input.selections) {
        const group = product.modifierGroups.find(
          (candidate) => candidate.modifierGroupId === selection.modifierGroupId,
        );
        const groupOverride = group?.variantOverrides.find(
          (override) => override.variantId === input.variantId,
        );
        const option = group?.options.find(
          (candidate) => candidate.optionId === selection.modifierOptionId,
        );
        const optionOverride = option?.variantOverrides.find(
          (override) => override.variantId === input.variantId,
        );
        if (
          !option ||
          groupOverride?.available === false ||
          optionOverride?.available === false
        ) {
          throw new ConflictException('A selected option is not available for this product size.');
        }
        modifierTotalCents +=
          toCents((optionOverride?.priceAdjustment ?? option.priceAdjustment).toString()) *
          BigInt(selection.quantity);
      }
      const mode = product.inventoryConfiguration.mode as 'DIRECT' | 'RECIPE';
      const requirements = await this.consumption.requirements(
        transaction,
        merchantId,
        [
          {
            productId,
            variantId: input.variantId,
            quantity: 1,
            selections: input.selections,
          },
        ],
        mode,
      );
      const itemIds = requirements.map((requirement) => requirement.stockItemId);
      const [items, costs] = await Promise.all([
        transaction.stockItem.findMany({
          where: { merchantId, id: { in: itemIds } },
          select: { id: true, name: true, baseUnit: true },
        }),
        transaction.stockItemCostCurrent.findMany({
          where: { merchantId, stockItemId: { in: itemIds } },
          select: { stockItemId: true, baseUnitCost: true, revision: true, sourceType: true },
        }),
      ]);
      const itemById = new Map(items.map((item) => [item.id, item]));
      const costById = new Map(costs.map((cost) => [cost.stockItemId, cost]));
      const lines = requirements.map((requirement) => {
        const item = itemById.get(requirement.stockItemId);
        if (!item) throw new NotFoundException('A configured stock item was not found.');
        const cost = costById.get(requirement.stockItemId);
        const baseUnitCost = cost?.baseUnitCost.toFixed(12) ?? null;
        return {
          stockItemId: item.id,
          stockItemName: item.name,
          baseUnit: item.baseUnit,
          requiredQuantity: requirement.quantity,
          baseUnitCost,
          costRevision: cost?.revision ?? null,
          sourceType: cost ? (cost.sourceType as 'opening' | 'purchase') : null,
          extendedCost: baseUnitCost
            ? formatCents(costForQuantityCents(requirement.quantity, baseUnitCost))
            : null,
        };
      });
      const isComplete = lines.every((line) => line.extendedCost !== null);
      const knownCostCents = lines.reduce(
        (total, line) => total + (line.extendedCost ? toCents(line.extendedCost) : 0n),
        0n,
      );
      const sellingPrice = formatCents(
        toCents((variant?.price ?? product.basePrice).toString()) + modifierTotalCents,
      );
      return {
        productId: product.id,
        productName: product.name,
        mode,
        variantId: input.variantId,
        sellingPrice,
        lines,
        totalKnownCost: formatCents(knownCostCents),
        totalCost: isComplete ? formatCents(knownCostCents) : null,
        grossMargin: isComplete ? formatCents(toCents(sellingPrice) - knownCostCents) : null,
        isComplete,
      };
    });
  }
}

function costForQuantityCents(quantity: string, costPerBaseUnit: string): bigint {
  // Requirements may omit trailing decimals; always scale quantities to six places.
  const quantityScaled = parseStockQuantity(quantity);
  const costScaled = BigInt(costPerBaseUnit.replace('.', ''));
  return (quantityScaled * costScaled + 5_000_000_000_000_000n) / 10_000_000_000_000_000n;
}
