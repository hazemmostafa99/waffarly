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
import { formatCents, toCents } from '../../../common/money/money.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { assertPersistedModifierGroup } from '../products/product.rules.js';
@Injectable()
export class ProductPricingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async quote(
    id: string,
    selections: CatalogProductQuoteSelection[] = [],
    variantId?: string,
    storefrontSlug?: string,
  ): Promise<CatalogProductQuoteResponse> {
    const merchant = storefrontSlug
      ? await this.prisma.merchant.findUnique({
          where: { storefrontSlug },
          select: { id: true },
        })
      : null;
    if (storefrontSlug && !merchant) throw new NotFoundException('Storefront was not found.');
    const product = await this.prisma.product.findFirst({
      where: { id, archivedAt: null, ...(merchant ? { merchantId: merchant.id } : {}) },
      select: {
        id: true,
        availability: true,
        basePrice: true,
        revision: true,
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
            modifierGroup: { select: { id: true, name: true, description: true } },
            options: {
              orderBy: { option: { position: 'asc' } },
              include: { option: { select: { id: true, name: true, position: true } } },
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
    if (selectedVariant?.stockQuantity === 0) {
      throw new ConflictException('Product variant is out of stock.');
    }

    const requested = new Map<string, string[]>();
    for (const selection of selections) {
      if (requested.has(selection.groupId)) {
        throw new BadRequestException('Each modifier group can be selected only once.');
      }
      requested.set(selection.groupId, selection.optionIds);
    }

    const productGroupIds = new Set(product.modifierGroups.map((group) => group.id));
    if ([...requested.keys()].some((groupId) => !productGroupIds.has(groupId))) {
      throw new BadRequestException('A modifier group does not belong to this product.');
    }

    let modifierTotalCents = 0n;
    const resolvedSelections = product.modifierGroups.map((group) => {
      assertPersistedModifierGroup(group);
      const submittedOptionIds = requested.get(group.id);
      const selectedIds =
        submittedOptionIds ??
        group.options.filter((option) => option.defaultSelected).map((option) => option.optionId);
      if (new Set(selectedIds).size !== selectedIds.length) {
        throw new BadRequestException('Modifier options must be unique within a group.');
      }
      if (selectedIds.length < group.minSelections || selectedIds.length > group.maxSelections) {
        throw new BadRequestException(
          `Select between ${group.minSelections} and ${group.maxSelections} options for ${group.modifierGroup.name}.`,
        );
      }

      const selectedIdSet = new Set(selectedIds);
      const selectedOptions = group.options.filter((option) => selectedIdSet.has(option.optionId));
      if (selectedOptions.length !== selectedIds.length) {
        throw new BadRequestException('A modifier option does not belong to its selected group.');
      }

      const priceAdjustmentCents = selectedOptions.reduce(
        (sum, option) => sum + toCents(option.priceAdjustment.toString()),
        0n,
      );
      modifierTotalCents += priceAdjustmentCents;
      return {
        groupId: group.id,
        modifierGroupId: group.modifierGroupId,
        optionIds: selectedOptions.map((option) => option.optionId),
        priceAdjustment: formatCents(priceAdjustmentCents),
      };
    });

    const basePriceCents = toCents((selectedVariant?.price ?? product.basePrice).toString());
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
