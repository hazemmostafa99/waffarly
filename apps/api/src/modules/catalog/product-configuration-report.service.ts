import { Inject, Injectable } from '@nestjs/common';
import type { ProductConfigurationReport } from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

@Injectable()
export class ProductConfigurationReportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(merchantId: string, from: string, to: string): Promise<ProductConfigurationReport> {
    const start = new Date(`${from}T00:00:00.000Z`);
    const endExclusive = new Date(`${to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const lines = await this.prisma.storefrontOrderLine.findMany({
      where: {
        merchantId,
        order: {
          is: {
            merchantId,
            status: 'accepted',
            createdAt: { gte: start, lt: endExclusive },
          },
        },
      },
      select: {
        id: true,
        orderId: true,
        productId: true,
        productName: true,
        variantId: true,
        variantName: true,
        basePrice: true,
        modifierTotal: true,
        quantity: true,
        lineTotal: true,
        selections: {
          select: {
            modifierGroupId: true,
            modifierOptionId: true,
            groupName: true,
            optionName: true,
            priceAdjustment: true,
          },
        },
        variantAttributes: {
          select: {
            attributeId: true,
            valueId: true,
            attributeName: true,
            attributeValue: true,
            position: true,
          },
        },
      },
    });

    const orderIds = new Set<string>();
    const productBuckets = new Map<string, ProductBucket>();
    const attributeBuckets = new Map<string, AttributeBucket>();
    const modifierBuckets = new Map<string, ModifierBucket>();
    let totalQuantity = 0;
    let totalRevenueCents = 0n;
    let linesWithoutPriceBreakdown = 0;
    let attributeSnapshotsWithoutIds = 0;
    let modifierSelectionsWithoutIds = 0;

    for (const line of lines) {
      orderIds.add(line.orderId);
      totalQuantity += line.quantity;
      const lineRevenueCents = toCents(line.lineTotal);
      totalRevenueCents += lineRevenueCents;
      if (line.basePrice === null || line.modifierTotal === null) linesWithoutPriceBreakdown += 1;

      const product = getOrCreate(productBuckets, line.productId, () => ({
        productId: line.productId,
        productName: line.productName,
        quantity: 0,
        revenueCents: 0n,
        variants: new Map(),
      }));
      product.quantity += line.quantity;
      product.revenueCents += lineRevenueCents;
      const variantKey = line.variantId ?? `legacy:${line.variantName ?? ''}`;
      const variant = getOrCreate(product.variants, variantKey, () => ({
        variantId: line.variantId,
        variantName: line.variantName,
        quantity: 0,
        revenueCents: 0n,
      }));
      variant.quantity += line.quantity;
      variant.revenueCents += lineRevenueCents;

      for (const snapshot of line.variantAttributes) {
        if (snapshot.attributeId === null || snapshot.valueId === null) {
          attributeSnapshotsWithoutIds += 1;
        }
        const key = `${snapshot.attributeId ?? ''}\u001f${snapshot.valueId ?? ''}\u001f${snapshot.attributeName}\u001f${snapshot.attributeValue}`;
        const attribute = getOrCreate(attributeBuckets, key, () => ({
          attributeId: snapshot.attributeId,
          valueId: snapshot.valueId,
          attributeName: snapshot.attributeName,
          attributeValue: snapshot.attributeValue,
          quantity: 0,
          revenueCents: 0n,
        }));
        attribute.quantity += line.quantity;
        attribute.revenueCents += lineRevenueCents;
      }

      for (const selection of line.selections) {
        if (selection.modifierGroupId === null || selection.modifierOptionId === null) {
          modifierSelectionsWithoutIds += 1;
        }
        const key = `${selection.modifierGroupId ?? ''}\u001f${selection.modifierOptionId ?? ''}\u001f${selection.groupName}\u001f${selection.optionName}`;
        const modifier = getOrCreate(modifierBuckets, key, () => ({
          modifierGroupId: selection.modifierGroupId,
          modifierOptionId: selection.modifierOptionId,
          groupName: selection.groupName,
          optionName: selection.optionName,
          selectedQuantity: 0,
          additionalRevenueCents: 0n,
        }));
        modifier.selectedQuantity += line.quantity;
        modifier.additionalRevenueCents += toCents(selection.priceAdjustment) * BigInt(line.quantity);
      }
    }

    return {
      from,
      to,
      orderCount: orderIds.size,
      totalQuantity,
      totalRevenue: formatCents(totalRevenueCents),
      products: [...productBuckets.values()]
        .sort((left, right) => left.productName.localeCompare(right.productName))
        .map((product) => ({
          productId: product.productId,
          productName: product.productName,
          quantity: product.quantity,
          revenue: formatCents(product.revenueCents),
          variants: [...product.variants.values()]
            .sort((left, right) => (left.variantName ?? '').localeCompare(right.variantName ?? ''))
            .map((variant) => ({
              variantId: variant.variantId,
              variantName: variant.variantName,
              quantity: variant.quantity,
              revenue: formatCents(variant.revenueCents),
            })),
        })),
      attributeValues: [...attributeBuckets.values()]
        .sort((left, right) =>
          left.attributeName.localeCompare(right.attributeName) ||
          left.attributeValue.localeCompare(right.attributeValue),
        )
        .map((attribute) => ({
          attributeId: attribute.attributeId,
          valueId: attribute.valueId,
          attributeName: attribute.attributeName,
          attributeValue: attribute.attributeValue,
          quantity: attribute.quantity,
          revenue: formatCents(attribute.revenueCents),
        })),
      modifierOptions: [...modifierBuckets.values()]
        .sort((left, right) =>
          left.groupName.localeCompare(right.groupName) || left.optionName.localeCompare(right.optionName),
        )
        .map((modifier) => ({
          modifierGroupId: modifier.modifierGroupId,
          modifierOptionId: modifier.modifierOptionId,
          groupName: modifier.groupName,
          optionName: modifier.optionName,
          selectedQuantity: modifier.selectedQuantity,
          additionalRevenue: formatCents(modifier.additionalRevenueCents),
        })),
      legacy: {
        linesWithoutPriceBreakdown,
        attributeSnapshotsWithoutIds,
        modifierSelectionsWithoutIds,
      },
    };
  }
}

type ProductBucket = {
  productId: string;
  productName: string;
  quantity: number;
  revenueCents: bigint;
  variants: Map<string, VariantBucket>;
};
type VariantBucket = {
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  revenueCents: bigint;
};
type AttributeBucket = {
  attributeId: string | null;
  valueId: string | null;
  attributeName: string;
  attributeValue: string;
  quantity: number;
  revenueCents: bigint;
};
type ModifierBucket = {
  modifierGroupId: string | null;
  modifierOptionId: string | null;
  groupName: string;
  optionName: string;
  selectedQuantity: number;
  additionalRevenueCents: bigint;
};

function getOrCreate<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  create: () => TValue,
): TValue {
  const value = map.get(key);
  if (value !== undefined) return value;
  const created = create();
  map.set(key, created);
  return created;
}

function toCents(value: { toString(): string }): bigint {
  const [whole, fraction = ''] = value.toString().split('.');
  return BigInt(whole ?? '0') * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
}

function formatCents(cents: bigint): string {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
