import assert from 'node:assert/strict';
import { it } from 'node:test';
import { ProductProfitabilityReportService } from '../../src/modules/reports/product-profitability-report.service.js';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';

it('marks cost and profit metrics incomplete when any included line lacks a cost snapshot', async () => {
  const product = {
    productId: '11111111-1111-4111-8111-111111111111',
    productName: 'Historic item',
    quantitySold: 1n,
    quantityRefunded: 0n,
    revenueCents: '10000',
    refundCents: '0',
    costCents: '0',
    salesLines: 1n,
    unknownCostLines: 1n,
  };
  const totals = {
    ...product,
    unallocatedRefundCents: '0',
    unallocatedRefundCount: 0n,
  };
  const dimension = {
    dimensionType: 'menu' as const,
    dimensionId: 'unassigned',
    dimensionName: 'Unassigned',
    quantitySold: 1n,
    quantityRefunded: 0n,
    revenueCents: '10000',
    refundCents: '0',
    costCents: '0',
    salesLines: 1n,
    unknownCostLines: 1n,
  };
  const responses = [[product], [totals], [dimension]];
  const prisma = {
    $queryRaw: async () => responses.shift(),
  } as unknown as PrismaService;
  const service = new ProductProfitabilityReportService(prisma);

  const report = await service.get('22222222-2222-4222-8222-222222222222', {
    from: '2026-11-01',
    to: '2026-11-14',
    limit: 100,
  });

  assert.equal(report.totals.cost, null);
  assert.equal(report.totals.grossProfit, null);
  assert.equal(report.totals.marginPercent, null);
  assert.equal(report.products[0]?.cost, null);
  assert.equal(report.products[0]?.grossProfit, null);
  assert.equal(report.products[0]?.marginPercent, null);
  assert.equal(report.menuSections[0]?.cost, null);
  assert.equal(report.menuSections[0]?.grossProfit, null);
  assert.equal(report.menuSections[0]?.marginPercent, null);
});
