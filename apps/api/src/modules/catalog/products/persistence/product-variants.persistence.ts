import { BadRequestException } from '@nestjs/common';
import type { CatalogProductVariantFields } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { randomUUID } from 'node:crypto';
import { normalizeAttributeName, normalizeVariantCode } from '../product.rules.js';
import type { ProductInput } from '../product.types.js';
export type ExistingVariantConfiguration = Prisma.ProductVariantGetPayload<{
  include: { attributeSelections: true };
}>;

export type ExistingVariantAttribute = Prisma.ProductVariantAttributeGetPayload<{
  include: { values: true };
}>;

export async function createVariantsWithAttributes(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  variants: NonNullable<ProductInput['variants']>,
): Promise<void> {
  await persistVariantsWithAttributes(transaction, merchantId, productId, variants, [], []);
}

export async function replaceVariantsWithAttributes(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  variants: NonNullable<ProductInput['variants']>,
): Promise<void> {
  const [existingVariants, existingAttributes] = await Promise.all([
    transaction.productVariant.findMany({
      where: { productId, merchantId },
      include: { attributeSelections: true },
    }),
    transaction.productVariantAttribute.findMany({
      where: { productId, merchantId },
      include: { values: true },
    }),
  ]);
  const requestedIds = variants.map((variant) => variant.id).filter((id): id is string => !!id);
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new BadRequestException('Variant IDs must be unique within a product.');
  }
  const existingIds = new Set(existingVariants.map((variant) => variant.id));
  if (requestedIds.some((variantId) => !existingIds.has(variantId))) {
    throw new BadRequestException('Every existing variant ID must belong to this product.');
  }
  await persistVariantsWithAttributes(
    transaction,
    merchantId,
    productId,
    variants,
    existingVariants,
    existingAttributes,
  );
}

export async function persistVariantsWithAttributes(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  variants: NonNullable<ProductInput['variants']>,
  existingVariants: ExistingVariantConfiguration[],
  existingAttributes: ExistingVariantAttribute[],
): Promise<void> {
  const existingVariantById = new Map(existingVariants.map((variant) => [variant.id, variant]));
  const existingAttributeById = new Map(
    existingAttributes.map((attribute) => [attribute.id, attribute]),
  );
  const existingAttributeByName = new Map(
    existingAttributes.map((attribute) => [normalizeAttributeName(attribute.name), attribute]),
  );
  const variantIds = new Map<CatalogProductVariantFields, string>();
  for (const variant of variants) variantIds.set(variant, variant.id ?? randomUUID());

  const attributePlan = new Map<
    string,
    {
      id: string;
      name: string;
      position: number;
      existing?: ExistingVariantAttribute;
      values: Map<
        string,
        {
          id: string;
          value: string;
          position: number;
          existing?: ExistingVariantAttribute['values'][number];
        }
      >;
    }
  >();
  const attributeIdByName = new Map<string, string>();
  const selections: Array<{
    variantId: string;
    attributeId: string;
    valueId: string;
    productId: string;
    merchantId: string;
  }> = [];

  for (const variant of variants) {
    const seenDimensions = new Set<string>();
    for (const [attributePosition, selection] of (variant.attributes ?? []).entries()) {
      const name = selection.name.trim();
      const value = selection.value.trim();
      if (!name || name.length > 120 || !value || value.length > 120) {
        throw new BadRequestException(
          'Variant attribute names and values must contain 1 to 120 characters.',
        );
      }
      const nameKey = normalizeAttributeName(name);
      if (seenDimensions.has(nameKey)) {
        throw new BadRequestException('A variant can select only one value for each attribute.');
      }
      seenDimensions.add(nameKey);
      const currentAttribute = selection.attributeId
        ? existingAttributeById.get(selection.attributeId)
        : existingAttributeByName.get(nameKey);
      if (selection.attributeId && !currentAttribute) {
        throw new BadRequestException('Variant attribute does not belong to this product.');
      }
      const attributeId =
        selection.attributeId ??
        currentAttribute?.id ??
        attributeIdByName.get(nameKey) ??
        randomUUID();
      const mappedAttributeId = attributeIdByName.get(nameKey);
      if (mappedAttributeId && mappedAttributeId !== attributeId) {
        throw new BadRequestException(
          'A variant attribute name must use one stable identity per product.',
        );
      }
      attributeIdByName.set(nameKey, attributeId);
      const attribute = attributePlan.get(attributeId) ?? {
        id: attributeId,
        name,
        position: currentAttribute?.position ?? attributePosition,
        ...(currentAttribute ? { existing: currentAttribute } : {}),
        values: new Map(),
      };
      if (normalizeAttributeName(attribute.name) !== nameKey) {
        throw new BadRequestException(
          'A variant attribute ID cannot represent multiple dimensions.',
        );
      }

      const valueKey = normalizeAttributeName(value);
      const currentValue = selection.valueId
        ? currentAttribute?.values.find((item) => item.id === selection.valueId)
        : (currentAttribute?.values.find(
            (item) => normalizeAttributeName(item.value) === valueKey,
          ) ??
          [...attribute.values.values()].find(
            (item) => normalizeAttributeName(item.value) === valueKey,
          ));
      if (selection.valueId && !currentValue) {
        throw new BadRequestException(
          'Variant attribute value does not belong to this product dimension.',
        );
      }
      const valueId = selection.valueId ?? currentValue?.id ?? randomUUID();
      const plannedValue = attribute.values.get(valueId) ?? {
        id: valueId,
        value,
        position: currentValue?.position ?? attribute.values.size,
        ...(currentValue ? { existing: currentValue } : {}),
      };
      if (normalizeAttributeName(plannedValue.value) !== valueKey) {
        throw new BadRequestException(
          'A variant attribute value ID cannot represent multiple values.',
        );
      }
      attribute.values.set(valueId, plannedValue);
      attributePlan.set(attributeId, attribute);
      selections.push({
        variantId: variantIds.get(variant)!,
        attributeId,
        valueId,
        productId,
        merchantId,
      });
    }
  }

  const usedAttributeIds = new Set([...attributePlan.values()].map((attribute) => attribute.id));
  const retainedVariantIds = new Set([...variantIds.values()]);
  if (existingVariants.length) {
    await transaction.productVariantAttributeSelection.deleteMany({
      where: { productId, merchantId },
    });
    if (retainedVariantIds.size) {
      await transaction.productVariant.deleteMany({
        where: { productId, merchantId, id: { notIn: [...retainedVariantIds] } },
      });
    } else {
      await transaction.productVariant.deleteMany({ where: { productId, merchantId } });
    }
  }
  const unusedAttributeIds = existingAttributes
    .filter((attribute) => !usedAttributeIds.has(attribute.id))
    .map((attribute) => attribute.id);
  if (unusedAttributeIds.length) {
    await transaction.productVariantAttribute.deleteMany({
      where: { productId, merchantId, id: { in: unusedAttributeIds } },
    });
  }

  for (const attribute of attributePlan.values()) {
    if (attribute.existing) {
      await transaction.productVariantAttribute.update({
        where: { id: attribute.id },
        data: { name: attribute.name, position: attribute.position },
      });
    } else {
      await transaction.productVariantAttribute.create({
        data: {
          id: attribute.id,
          productId,
          merchantId,
          name: attribute.name,
          position: attribute.position,
        },
      });
    }
    const plannedValueIds = new Set([...attribute.values.values()].map((value) => value.id));
    const previousValues = attribute.existing?.values ?? [];
    const removedValueIds = previousValues
      .filter((value) => !plannedValueIds.has(value.id))
      .map((value) => value.id);
    if (removedValueIds.length) {
      await transaction.productVariantAttributeValue.deleteMany({
        where: { attributeId: attribute.id, productId, merchantId, id: { in: removedValueIds } },
      });
    }
    for (const value of attribute.values.values()) {
      if (value.existing) {
        await transaction.productVariantAttributeValue.update({
          where: { id: value.id },
          data: { value: value.value, position: value.position },
        });
      } else {
        await transaction.productVariantAttributeValue.create({
          data: {
            id: value.id,
            attributeId: attribute.id,
            productId,
            merchantId,
            value: value.value,
            position: value.position,
          },
        });
      }
    }
  }

  for (const variant of variants) {
    const variantId = variantIds.get(variant)!;
    const data = { ...toVariantCreateData(variant), position: variant.position };
    if (existingVariantById.has(variantId)) {
      await transaction.productVariant.update({ where: { id: variantId }, data });
    } else {
      await transaction.productVariant.create({
        data: { id: variantId, productId, merchantId, ...data },
      });
    }
  }
  if (selections.length) {
    await transaction.productVariantAttributeSelection.createMany({ data: selections });
  }
}

export function toVariantCreateData(variant: CatalogProductVariantFields) {
  return {
    name: variant.name.trim(),
    sku: normalizeVariantCode(variant.sku) || null,
    barcode: normalizeVariantCode(variant.barcode) || null,
    price: variant.price,
    stockQuantity: variant.stockQuantity ?? null,
    availability: variant.availability,
    position: variant.position,
  };
}
