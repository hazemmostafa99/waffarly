import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CatalogProductQuoteResponse,
  CatalogProductQuoteSelection,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { formatCents, toCents } from '../../../common/money/money.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { StockBaseUnit } from '@waffarly/contracts';
import { selectedOptionQuantities } from './modifier-selections.js';
import {
  calculateInventoryRequirements,
  modifierEffectRequirements,
  type InventoryRequirementEffectInput,
} from '../products/product-inventory.calculator.js';
import { assertPersistedModifierGroup } from '../products/product.rules.js';
@Injectable()
export class ProductPricingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async quote(
    id: string,
    selections: CatalogProductQuoteSelection[] = [],
    variantId?: string,
    storefrontSlug?: string,
    sellableQuantity = 1,
  ): Promise<CatalogProductQuoteResponse> {
    const merchant = storefrontSlug
      ? await this.prisma.merchant.findUnique({
          where: { storefrontSlug },
          select: { id: true },
        })
      : null;
    if (storefrontSlug && !merchant) throw new NotFoundException('Storefront was not found.');
    return this.quoteForMerchant(merchant?.id ?? null, id, selections, variantId, sellableQuantity);
  }

  async quoteForMerchant(
    merchantId: string | null,
    id: string,
    selections: CatalogProductQuoteSelection[] = [],
    variantId?: string,
    sellableQuantity = 1,
    transaction?: Prisma.TransactionClient,
  ): Promise<CatalogProductQuoteResponse> {
    const db = transaction ?? this.prisma;
    const product = await db.product.findFirst({
      where: { id, archivedAt: null, ...(merchantId ? { merchantId } : {}) },
      select: {
        id: true,
        availability: true,
        basePrice: true,
        revision: true,
        inventoryConfiguration: { include: { targets: { include: { components: true } } } },
        variants: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            price: true,
            availability: true,
            stockQuantity: true,
            attributeSelections: {
              orderBy: { attribute: { position: 'asc' } },
              select: {
                attributeId: true,
                valueId: true,
                attribute: { select: { name: true, position: true } },
                value: { select: { value: true } },
              },
            },
          },
        },
        modifierGroups: {
          orderBy: { position: 'asc' },
          include: {
            variantOverrides: true,
            modifierGroup: { select: { id: true, name: true, description: true } },
            options: {
              orderBy: { option: { position: 'asc' } },
              include: {
                variantOverrides: true,
                effects: true,
                option: { select: { id: true, name: true, position: true } },
              },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product was not found.');
    if (product.availability !== 'available') {
      throw new ConflictException('Product is unavailable.');
    }
    const selectedVariant = variantId
      ? product.variants.find((variant) => variant.id === variantId)
      : undefined;
    if (product.variants.length > 0 && !variantId) {
      throw new BadRequestException('Choose a product variant.');
    }
    if (variantId && !selectedVariant) {
      throw new BadRequestException('A variant does not belong to this product.');
    }
    if (
      selectedVariant?.availability !== undefined &&
      selectedVariant.availability !== 'available'
    ) {
      throw new ConflictException('Product variant is unavailable.');
    }
    if (product.inventoryConfiguration?.mode !== 'RECIPE' && selectedVariant?.stockQuantity === 0) {
      throw new ConflictException('Product variant is out of stock.');
    }

    const requested = new Map<string, Map<string, number>>();
    for (const selection of selections) {
      if (requested.has(selection.groupId)) {
        throw new BadRequestException('Each modifier group can be selected only once.');
      }
      requested.set(selection.groupId, selectedOptionQuantities(selection));
    }

    const productGroupIds = new Set(product.modifierGroups.map((group) => group.id));
    if ([...requested.keys()].some((groupId) => !productGroupIds.has(groupId))) {
      throw new BadRequestException('A modifier group does not belong to this product.');
    }

    let modifierTotalCents = 0n;
    const effects: InventoryRequirementEffectInput[] = [];
    const resolvedSelections = product.modifierGroups.flatMap((group) => {
      assertPersistedModifierGroup(group);
      const submitted = requested.get(group.id);
      const groupAvailable =
        (group.variantOverrides ?? []).find((override) => override.variantId === variantId)
          ?.available !== false;
      if (!groupAvailable) {
        if (submitted?.size)
          throw new BadRequestException('Modifier group is unavailable for this variant.');
        return [];
      }
      const overrideFor = (option: (typeof group.options)[number]) =>
        (option.variantOverrides ?? []).find((override) => override.variantId === variantId);
      const available = group.options.filter((option) => overrideFor(option)?.available !== false);
      const quantities =
        submitted ??
        new Map(
          available
            .filter((option) => option.defaultSelected)
            .map((option) => [option.optionId, 1]),
        );
      if (quantities.size < group.minSelections || quantities.size > group.maxSelections)
        throw new BadRequestException(
          `Select between ${group.minSelections} and ${group.maxSelections} options for ${group.modifierGroup.name}.`,
        );
      const selected = available.filter((option) => quantities.has(option.optionId));
      if (selected.length !== quantities.size)
        throw new BadRequestException(
          'A modifier option does not belong to its selected group or is unavailable.',
        );
      const options = selected.map((option) => {
        const quantity = quantities.get(option.optionId)!;
        if (quantity > (option.maxQuantity ?? 1))
          throw new BadRequestException('Modifier quantity exceeds its configured cap.');
        const override = overrideFor(option);
        const unitPriceAdjustment = formatCents(
          toCents((override?.priceAdjustment ?? option.priceAdjustment).toString()),
        );
        effects.push(...modifierEffectRequirements(option, variantId ?? null, quantity));
        return { optionId: option.optionId, quantity, unitPriceAdjustment };
      });
      const adjustment = options.reduce(
        (sum, option) => sum + toCents(option.unitPriceAdjustment) * BigInt(option.quantity),
        0n,
      );
      modifierTotalCents += adjustment;
      return [
        {
          groupId: group.id,
          modifierGroupId: group.modifierGroupId,
          optionIds: options.map((option) => option.optionId),
          options,
          priceAdjustment: formatCents(adjustment),
        },
      ];
    });
    if (product.inventoryConfiguration?.mode === 'RECIPE') {
      const target = product.inventoryConfiguration.targets.find(
        (target) => target.variantId === (variantId ?? null),
      );
      if (!target) throw new ConflictException('Product recipe is incomplete.');
      calculateInventoryRequirements(
        target.components.map((component) => ({
          stockItemId: component.stockItemId,
          baseUnit: component.baseUnit as StockBaseUnit,
          baseQuantity: component.baseQuantity.toString(),
        })),
        sellableQuantity,
        effects,
      );
    } else if (effects.length)
      throw new ConflictException('Ingredient effects require RECIPE mode.');

    const basePriceCents = toCents((selectedVariant?.price ?? product.basePrice).toString());
    if (basePriceCents + modifierTotalCents > 999_999_999_999n)
      throw new BadRequestException('Configured product price exceeds the supported range.');
    const variantAttributes =
      selectedVariant?.attributeSelections.map((selection) => ({
        attributeId: selection.attributeId,
        attributeName: selection.attribute.name,
        valueId: selection.valueId,
        value: selection.value.value,
        position: selection.attribute.position,
      })) ?? [];
    return {
      productId: product.id,
      productRevision: product.revision,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? null,
      variantAttributes,
      currency: 'EGP',
      basePrice: formatCents(basePriceCents),
      modifierTotal: formatCents(modifierTotalCents),
      totalPrice: formatCents(basePriceCents + modifierTotalCents),
      selections: resolvedSelections,
    };
  }
}
