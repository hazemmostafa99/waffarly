import type { CatalogModifierEffectFields } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { formatCents, toCents } from '../../../common/money/money.js';
import { normalizeStockQuantity } from '../../inventory/index.js';
import { defaultInventoryModeForActivity } from './product-inventory.rules.js';
export const sellableInclude = {
  images: {
    orderBy: { position: 'asc' as const },
    include: {
      mediaAsset: { select: { id: true, publicUrl: true, mimeType: true, sizeBytes: true } },
    },
  },
  categoryLinks: {
    include: { category: { select: { id: true, name: true, parentId: true, availability: true } } },
  },
  modifierGroups: {
    orderBy: { position: 'asc' as const },
    include: {
      variantOverrides: true,
      modifierGroup: { select: { id: true, name: true, description: true } },
      options: {
        orderBy: { option: { position: 'asc' as const } },
        include: {
          variantOverrides: true,
          option: { select: { id: true, name: true, position: true } },
        },
      },
    },
  },
  variants: {
    orderBy: { position: 'asc' as const },
    include: {
      attributeSelections: {
        orderBy: { attribute: { position: 'asc' as const } },
        include: {
          attribute: { select: { id: true, name: true, position: true } },
          value: { select: { id: true, value: true } },
        },
      },
    },
  },
} as const;

export const productInclude = {
  ...sellableInclude,
  modifierGroups: {
    ...sellableInclude.modifierGroups,
    include: {
      ...sellableInclude.modifierGroups.include,
      options: {
        ...sellableInclude.modifierGroups.include.options,
        include: {
          ...sellableInclude.modifierGroups.include.options.include,
          effects: { orderBy: { position: 'asc' as const } },
        },
      },
    },
  },
  merchant: { select: { activity: true } },
  inventoryConfiguration: {
    include: {
      targets: {
        orderBy: { variantId: 'asc' as const },
        include: {
          components: {
            orderBy: { position: 'asc' as const },
            include: {
              stockItem: {
                select: {
                  id: true,
                  name: true,
                  baseUnit: true,
                  units: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function toSellableResponse(
  product: Prisma.ProductGetPayload<{ include: typeof sellableInclude }>,
) {
  return {
    id: product.id,
    displayOrder: product.displayOrder,
    menuSectionId: product.menuSectionId,
    name: product.name,
    description: product.description,
    basePrice: formatCents(toCents(product.basePrice.toString())),
    currency: 'EGP',
    sellingUnit: 'piece',
    availability: product.availability,
    archivedAt: product.archivedAt?.toISOString() ?? null,
    revision: product.revision,
    images: product.images.map((image) => ({
      id: image.id,
      mediaAssetId: image.mediaAssetId,
      publicUrl: image.mediaAsset.publicUrl,
      mimeType: image.mediaAsset.mimeType,
      sizeBytes: image.mediaAsset.sizeBytes,
      isPrimary: image.isPrimary,
      position: image.position,
    })),
    categories: product.categoryLinks.map(({ category }) => category),
    modifierGroups: product.modifierGroups.map((group) => ({
      id: group.id,
      modifierGroupId: group.modifierGroupId,
      variantOverrides: (group.variantOverrides ?? []).map((override) => ({
        variantId: override.variantId,
        available: override.available,
      })),
      name: group.modifierGroup.name,
      description: group.modifierGroup.description,
      selectionMode: group.selectionMode,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      position: group.position,
      options: group.options.map((option) => ({
        maxQuantity: option.maxQuantity ?? 1,
        variantOverrides: (option.variantOverrides ?? []).map((override) => ({
          variantId: override.variantId,
          available: override.available,
          ...(override.priceAdjustment === null
            ? {}
            : { priceAdjustment: formatCents(toCents(override.priceAdjustment.toString())) }),
        })),
        id: option.option.id,
        name: option.option.name,
        priceAdjustment: formatCents(toCents(option.priceAdjustment.toString())),
        defaultSelected: option.defaultSelected,
        position: option.option.position,
      })),
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      price: formatCents(toCents(variant.price.toString())),
      stockQuantity: variant.stockQuantity,
      availability: variant.availability,
      position: variant.position,
      attributes: variant.attributeSelections.map((selection) => ({
        attributeId: selection.attributeId,
        attributeName: selection.attribute.name,
        valueId: selection.valueId,
        value: selection.value.value,
        position: selection.attribute.position,
      })),
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function toProductResponse(
  product: Prisma.ProductGetPayload<{ include: typeof productInclude }>,
) {
  return {
    ...toSellableResponse(product),
    modifierGroups: toSellableResponse(product).modifierGroups.map((group, index) => ({
      ...group,
      options: group.options.map((option, optionIndex) => {
        const saved = product.modifierGroups[index]!.options[optionIndex]!;
        const effects = (variantId: string | null): CatalogModifierEffectFields[] =>
          (saved.effects ?? [])
            .filter((effect) => effect.variantId === variantId)
            .map((effect) => ({
              stockItemId: effect.stockItemId,
              direction: effect.direction as 'ADD' | 'REMOVE',
              unitCode: effect.unitCode,
              quantity: normalizeStockQuantity(effect.quantity.toFixed(6)),
            }));
        return {
          ...option,
          effects: effects(null),
          variantOverrides: (saved.variantOverrides ?? []).map((override) => ({
            variantId: override.variantId,
            available: override.available,
            ...(override.priceAdjustment === null
              ? {}
              : { priceAdjustment: formatCents(toCents(override.priceAdjustment.toString())) }),
            ...(override.effectsOverride ? { effects: effects(override.variantId) } : {}),
          })),
        };
      }),
    })),
    inventoryConfigurationRequired: product.inventoryConfigurationRequired ?? false,
    inventoryDefaultMode: defaultInventoryModeForActivity(product.merchant?.activity ?? 'other'),
    inventoryConfiguration: product.inventoryConfiguration
      ? {
          mode: product.inventoryConfiguration.mode as 'DIRECT' | 'RECIPE',
          updatedAt: product.inventoryConfiguration.updatedAt.toISOString(),
          targets: product.inventoryConfiguration.targets.map((target) => ({
            id: target.id,
            variantId: target.variantId,
            components: target.components.map((component) => ({
              id: component.id,
              stockItemId: component.stockItemId,
              stockItemName: component.stockItem.name,
              stockItemBaseUnit: component.baseUnit,
              unitCode: component.unitCode,
              unitName:
                component.stockItem.units.find((unit) => unit.code === component.unitCode)?.name ??
                component.unitCode,
              quantity: normalizeStockQuantity(component.quantity.toFixed(6)),
              baseQuantity: normalizeStockQuantity(component.baseQuantity.toFixed(6)),
              position: component.position,
            })),
          })),
        }
      : null,
  };
}
