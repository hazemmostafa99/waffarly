import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ProductConfigurationReportService } from '../../src/modules/reports/product-configuration-report.service.js';

it('formats database aggregates and scopes every report query to inventory-consumed tenant orders', async () => {
  const statements: string[] = [];
  const parameters: unknown[][] = [];
  const results: unknown[][] = [
    [
      {
        orderCount: 2n,
        totalQuantity: 3n,
        totalRevenueCents: '30000',
        linesWithoutPriceBreakdown: 1n,
        attributeSnapshotsWithoutIds: 0n,
        modifierSelectionsWithoutIds: 1n,
      },
    ],
    [
      {
        productId: 'product-1',
        productName: 'Coffee',
        variantId: 'variant-1',
        variantName: 'Large',
        quantity: 2n,
        revenueCents: '25000',
      },
      {
        productId: 'product-1',
        productName: 'Coffee',
        variantId: null,
        variantName: null,
        quantity: 1n,
        revenueCents: '5000',
      },
    ],
    [
      {
        attributeId: 'attribute-1',
        valueId: 'value-1',
        attributeName: 'Cup size',
        attributeValue: 'Large',
        quantity: 2n,
        revenueCents: '25000',
      },
    ],
    [
      {
        modifierGroupId: 'group-1',
        modifierOptionId: 'option-1',
        groupName: 'Extras',
        optionName: 'Extra shot',
        selectedQuantity: 2n,
        additionalRevenueCents: '5000',
      },
      {
        modifierGroupId: null,
        modifierOptionId: null,
        groupName: 'Milk',
        optionName: 'Oat milk',
        selectedQuantity: 1n,
        additionalRevenueCents: '0',
      },
    ],
  ];
  let call = 0;
  const service = new ProductConfigurationReportService({
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      statements.push(strings.join('?'));
      parameters.push(values);
      return results[call++]!;
    },
  } as unknown as PrismaService);

  const report = await service.get('merchant-1', '2026-10-01', '2026-10-14');

  assert.equal(call, 4);
  assert.equal(report.orderCount, 2);
  assert.equal(report.totalQuantity, 3);
  assert.equal(report.totalRevenue, '300.00');
  const largeVariant = report.products[0]?.variants.find(
    (variant) => variant.variantId === 'variant-1',
  );
  assert.deepEqual(largeVariant, {
    variantId: 'variant-1',
    variantName: 'Large',
    quantity: 2,
    revenue: '250.00',
  });
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
  assert.ok(statements.every((sql) => sql.includes('"merchantId" = ?')));
  assert.ok(
    statements.every((sql) =>
      sql.includes("\"status\" IN ('accepted', 'preparing', 'ready', 'completed')"),
    ),
  );
  assert.ok(statements.some((sql) => sql.includes('GROUP BY')));
  assert.ok(parameters.every((values) => values[0] === 'merchant-1'));
  assert.ok(parameters.every((values) => values.some((value) => value instanceof Date)));
});
