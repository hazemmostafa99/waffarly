import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ProductConfigurationReportService } from '../../src/modules/reports/product-configuration-report.service.js';

it('aggregates accepted-order snapshots by product, variant, attribute, and modifier option', async () => {
  let query: Record<string, unknown> | undefined;
  const service = new ProductConfigurationReportService({
    storefrontOrderLine: {
      findMany: async (input: Record<string, unknown>) => {
        query = input;
        return [
          {
            id: 'line-1',
            orderId: 'order-1',
            productId: 'product-1',
            productName: 'Coffee',
            variantId: 'variant-1',
            variantName: 'Large',
            basePrice: { toString: () => '100.00' },
            modifierTotal: { toString: () => '25.00' },
            quantity: 2,
            lineTotal: { toString: () => '250.00' },
            selections: [
              {
                modifierGroupId: 'group-1',
                modifierOptionId: 'option-1',
                groupName: 'Extras',
                optionName: 'Extra shot',
                priceAdjustment: { toString: () => '25.00' },
              },
            ],
            variantAttributes: [
              {
                attributeId: 'attribute-1',
                valueId: 'value-1',
                attributeName: 'Cup size',
                attributeValue: 'Large',
                position: 0,
              },
            ],
          },
          {
            id: 'line-2',
            orderId: 'order-2',
            productId: 'product-1',
            productName: 'Coffee',
            variantId: null,
            variantName: null,
            basePrice: null,
            modifierTotal: null,
            quantity: 1,
            lineTotal: { toString: () => '50.00' },
            selections: [
              {
                modifierGroupId: null,
                modifierOptionId: null,
                groupName: 'Milk',
                optionName: 'Oat milk',
                priceAdjustment: { toString: () => '0.00' },
              },
            ],
            variantAttributes: [],
          },
        ];
      },
    },
  } as unknown as PrismaService);

  const report = await service.get('merchant-1', '2026-10-01', '2026-10-14');

  assert.equal(report.orderCount, 2);
  assert.equal(report.totalQuantity, 3);
  assert.equal(report.totalRevenue, '300.00');
  const largeVariant = report.products[0]?.variants.find(
    (variant) => variant.variantId === 'variant-1',
  );
  assert.equal(largeVariant?.variantName, 'Large');
  assert.equal(largeVariant?.quantity, 2);
  assert.deepEqual(report.attributeValues[0], {
    attributeId: 'attribute-1',
    valueId: 'value-1',
    attributeName: 'Cup size',
    attributeValue: 'Large',
    quantity: 2,
    revenue: '250.00',
  });
  assert.equal(
    report.modifierOptions.find((option) => option.modifierOptionId === 'option-1')
      ?.additionalRevenue,
    '50.00',
  );
  assert.deepEqual(report.legacy, {
    linesWithoutPriceBreakdown: 1,
    attributeSnapshotsWithoutIds: 0,
    modifierSelectionsWithoutIds: 1,
  });

  const where = query?.where as { merchantId?: string; order?: { is?: Record<string, unknown> } };
  assert.equal(where.merchantId, 'merchant-1');
  assert.equal(where.order?.is?.status, 'accepted');
  assert.equal(where.order?.is?.merchantId, 'merchant-1');
});
