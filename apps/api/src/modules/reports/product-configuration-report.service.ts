import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ProductConfigurationReport } from '@waffarly/contracts';
import { formatCents } from '../../common/money/money.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

type TotalsRow = {
  orderCount: bigint;
  totalQuantity: bigint;
  totalRevenueCents: string;
  linesWithoutPriceBreakdown: bigint;
  attributeSnapshotsWithoutIds: bigint;
  modifierSelectionsWithoutIds: bigint;
};
type ProductRow = {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  quantity: bigint;
  revenueCents: string;
};
type AttributeRow = {
  attributeId: string | null;
  valueId: string | null;
  attributeName: string;
  attributeValue: string;
  quantity: bigint;
  revenueCents: string;
};
type ModifierRow = {
  modifierGroupId: string | null;
  modifierOptionId: string | null;
  groupName: string;
  optionName: string;
  selectedQuantity: bigint;
  additionalRevenueCents: string;
};

@Injectable()
export class ProductConfigurationReportService {
  private readonly logger = new Logger(ProductConfigurationReportService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(merchantId: string, from: string, to: string): Promise<ProductConfigurationReport> {
    const startedAt = performance.now();
    const start = new Date(`${from}T00:00:00.000Z`);
    const endExclusive = new Date(`${to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    const [totalsResult, productsResult, attributesResult, modifiersResult] = await Promise.all([
      this.measure(
        () => this.prisma.$queryRaw<TotalsRow[]>`
        SELECT
          COUNT(DISTINCT o."id")::bigint AS "orderCount",
          COALESCE(SUM(l."quantity"), 0)::bigint AS "totalQuantity",
          COALESCE(TRUNC(SUM(l."lineTotal") * 100), 0)::text AS "totalRevenueCents",
          (SELECT COUNT(*)::bigint
           FROM "storefront_order_lines" legacy_line
           JOIN "storefront_orders" legacy_order ON legacy_order."id" = legacy_line."orderId"
           WHERE legacy_line."merchantId" = ${merchantId}
             AND legacy_order."merchantId" = ${merchantId}
             AND legacy_order."status" = 'accepted'
             AND legacy_order."createdAt" >= ${start}
             AND legacy_order."createdAt" < ${endExclusive}
             AND (legacy_line."basePrice" IS NULL OR legacy_line."modifierTotal" IS NULL))
            AS "linesWithoutPriceBreakdown",
          (SELECT COUNT(*)::bigint
           FROM "storefront_order_line_variant_attributes" snapshot
           JOIN "storefront_order_lines" snapshot_line ON snapshot_line."id" = snapshot."orderLineId"
           JOIN "storefront_orders" snapshot_order ON snapshot_order."id" = snapshot_line."orderId"
           WHERE snapshot_line."merchantId" = ${merchantId}
             AND snapshot_order."merchantId" = ${merchantId}
             AND snapshot_order."status" = 'accepted'
             AND snapshot_order."createdAt" >= ${start}
             AND snapshot_order."createdAt" < ${endExclusive}
             AND (snapshot."attributeId" IS NULL OR snapshot."valueId" IS NULL))
            AS "attributeSnapshotsWithoutIds",
          (SELECT COUNT(*)::bigint
           FROM "storefront_order_line_selections" snapshot
           JOIN "storefront_order_lines" snapshot_line ON snapshot_line."id" = snapshot."orderLineId"
           JOIN "storefront_orders" snapshot_order ON snapshot_order."id" = snapshot_line."orderId"
           WHERE snapshot_line."merchantId" = ${merchantId}
             AND snapshot_order."merchantId" = ${merchantId}
             AND snapshot_order."status" = 'accepted'
             AND snapshot_order."createdAt" >= ${start}
             AND snapshot_order."createdAt" < ${endExclusive}
             AND (snapshot."modifierGroupId" IS NULL OR snapshot."modifierOptionId" IS NULL))
            AS "modifierSelectionsWithoutIds"
        FROM "storefront_order_lines" l
        JOIN "storefront_orders" o ON o."id" = l."orderId"
        WHERE l."merchantId" = ${merchantId}
          AND o."merchantId" = ${merchantId}
          AND o."status" IN ('accepted', 'preparing')
          AND o."createdAt" >= ${start}
          AND o."createdAt" < ${endExclusive}
      `,
      ),
      this.measure(
        () => this.prisma.$queryRaw<ProductRow[]>`
        SELECT l."productId" AS "productId", MAX(l."productName") AS "productName",
          l."variantId" AS "variantId", l."variantName" AS "variantName",
          SUM(l."quantity")::bigint AS "quantity",
          TRUNC(SUM(l."lineTotal") * 100)::text AS "revenueCents"
        FROM "storefront_order_lines" l
        JOIN "storefront_orders" o ON o."id" = l."orderId"
        WHERE l."merchantId" = ${merchantId}
          AND o."merchantId" = ${merchantId}
          AND o."status" IN ('accepted', 'preparing')
          AND o."createdAt" >= ${start}
          AND o."createdAt" < ${endExclusive}
        GROUP BY l."productId", l."variantId", l."variantName"
      `,
      ),
      this.measure(
        () => this.prisma.$queryRaw<AttributeRow[]>`
        SELECT snapshot."attributeId" AS "attributeId", snapshot."valueId" AS "valueId",
          snapshot."attributeName" AS "attributeName", snapshot."attributeValue" AS "attributeValue",
          SUM(l."quantity")::bigint AS "quantity",
          TRUNC(SUM(l."lineTotal") * 100)::text AS "revenueCents"
        FROM "storefront_order_line_variant_attributes" snapshot
        JOIN "storefront_order_lines" l ON l."id" = snapshot."orderLineId"
        JOIN "storefront_orders" o ON o."id" = l."orderId"
        WHERE l."merchantId" = ${merchantId}
          AND o."merchantId" = ${merchantId}
          AND o."status" IN ('accepted', 'preparing')
          AND o."createdAt" >= ${start}
          AND o."createdAt" < ${endExclusive}
        GROUP BY snapshot."attributeId", snapshot."valueId", snapshot."attributeName", snapshot."attributeValue"
      `,
      ),
      this.measure(
        () => this.prisma.$queryRaw<ModifierRow[]>`
        SELECT snapshot."modifierGroupId" AS "modifierGroupId",
          snapshot."modifierOptionId" AS "modifierOptionId",
          snapshot."groupName" AS "groupName", snapshot."optionName" AS "optionName",
          SUM(snapshot."quantity"::bigint * l."quantity")::bigint AS "selectedQuantity",
          TRUNC(SUM(snapshot."priceAdjustment" * snapshot."quantity" * l."quantity") * 100)::text AS "additionalRevenueCents"
        FROM "storefront_order_line_selections" snapshot
        JOIN "storefront_order_lines" l ON l."id" = snapshot."orderLineId"
        JOIN "storefront_orders" o ON o."id" = l."orderId"
        WHERE l."merchantId" = ${merchantId}
          AND o."merchantId" = ${merchantId}
          AND o."status" IN ('accepted', 'preparing')
          AND o."createdAt" >= ${start}
          AND o."createdAt" < ${endExclusive}
        GROUP BY snapshot."modifierGroupId", snapshot."modifierOptionId",
          snapshot."groupName", snapshot."optionName"
      `,
      ),
    ]);
    const totalsRows = totalsResult.value;
    const productRows = productsResult.value;
    const attributeRows = attributesResult.value;
    const modifierRows = modifiersResult.value;
    const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
    this.logger.log(
      JSON.stringify({
        event: 'product_configuration_report.query_metrics',
        queryCount: 4,
        elapsedMs,
        queryMs: {
          totals: totalsResult.durationMs,
          products: productsResult.durationMs,
          attributes: attributesResult.durationMs,
          modifiers: modifiersResult.durationMs,
        },
      }),
    );

    const totals = totalsRows[0];
    if (!totals) throw new Error('Report totals query returned no result.');
    const products = new Map<
      string,
      {
        productId: string;
        productName: string;
        quantity: bigint;
        revenueCents: bigint;
        variants: Map<
          string,
          {
            variantId: string | null;
            variantName: string | null;
            quantity: bigint;
            revenueCents: bigint;
          }
        >;
      }
    >();
    for (const row of productRows) {
      let product = products.get(row.productId);
      if (!product) {
        product = {
          productId: row.productId,
          productName: row.productName,
          quantity: 0n,
          revenueCents: 0n,
          variants: new Map(),
        };
        products.set(row.productId, product);
      }
      product.quantity += row.quantity;
      product.revenueCents += BigInt(row.revenueCents);
      const variantKey = row.variantId ?? `legacy:${row.variantName ?? ''}`;
      const variant = product.variants.get(variantKey);
      if (variant) {
        variant.quantity += row.quantity;
        variant.revenueCents += BigInt(row.revenueCents);
      } else {
        product.variants.set(variantKey, {
          variantId: row.variantId,
          variantName: row.variantName,
          quantity: row.quantity,
          revenueCents: BigInt(row.revenueCents),
        });
      }
    }

    return {
      from,
      to,
      orderCount: asNumber(totals.orderCount),
      totalQuantity: asNumber(totals.totalQuantity),
      totalRevenue: formatCents(BigInt(totals.totalRevenueCents)),
      products: [...products.values()]
        .sort((left, right) => left.productName.localeCompare(right.productName))
        .map((product) => ({
          productId: product.productId,
          productName: product.productName,
          quantity: asNumber(product.quantity),
          revenue: formatCents(product.revenueCents),
          variants: [...product.variants.values()]
            .sort((left, right) => (left.variantName ?? '').localeCompare(right.variantName ?? ''))
            .map((variant) => ({
              variantId: variant.variantId,
              variantName: variant.variantName,
              quantity: asNumber(variant.quantity),
              revenue: formatCents(variant.revenueCents),
            })),
        })),
      attributeValues: attributeRows
        .sort(
          (left, right) =>
            left.attributeName.localeCompare(right.attributeName) ||
            left.attributeValue.localeCompare(right.attributeValue),
        )
        .map((attribute) => ({
          attributeId: attribute.attributeId,
          valueId: attribute.valueId,
          attributeName: attribute.attributeName,
          attributeValue: attribute.attributeValue,
          quantity: asNumber(attribute.quantity),
          revenue: formatCents(BigInt(attribute.revenueCents)),
        })),
      modifierOptions: modifierRows
        .sort(
          (left, right) =>
            left.groupName.localeCompare(right.groupName) ||
            left.optionName.localeCompare(right.optionName),
        )
        .map((modifier) => ({
          modifierGroupId: modifier.modifierGroupId,
          modifierOptionId: modifier.modifierOptionId,
          groupName: modifier.groupName,
          optionName: modifier.optionName,
          selectedQuantity: asNumber(modifier.selectedQuantity),
          additionalRevenue: formatCents(BigInt(modifier.additionalRevenueCents)),
        })),
      legacy: {
        linesWithoutPriceBreakdown: asNumber(totals.linesWithoutPriceBreakdown),
        attributeSnapshotsWithoutIds: asNumber(totals.attributeSnapshotsWithoutIds),
        modifierSelectionsWithoutIds: asNumber(totals.modifierSelectionsWithoutIds),
      },
    };
  }

  private async measure<T>(query: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
    const startedAt = performance.now();
    const value = await query();
    return { value, durationMs: Math.round((performance.now() - startedAt) * 100) / 100 };
  }
}

function asNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Report value exceeds the supported range.');
  return result;
}
