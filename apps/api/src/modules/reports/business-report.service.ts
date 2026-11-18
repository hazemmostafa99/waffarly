/** Composes monthly results, comparisons and current balances from one database snapshot. */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OwnerBusinessReport } from '@waffarly/contracts';
import { formatCents, toSignedCents } from '../../common/money/money.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ProductProfitabilityReportService } from './product-profitability-report.service.js';
import { readBusinessBalances } from './business-balances.query.js';
import { readBusinessCharts, readPeriodCosts } from './business-report.query.js';
import { buildBusinessPeriod, reportMonth } from './business-report.rules.js';
import { businessReportQuerySchema } from './business-report.schemas.js';

@Injectable()
export class BusinessReportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductProfitabilityReportService)
    private readonly profitability: ProductProfitabilityReportService,
  ) {}

  async get(merchantId: string, input: unknown): Promise<OwnerBusinessReport> {
    const query = parseRequest(businessReportQuerySchema, input);
    const current = reportMonth(query.month);
    const previous = reportMonth(query.month, -1);
    const branchId = query.branchId ?? null;
    return this.prisma.$transaction(
      async (db) => {
        // 1. Keep historical branches selectable and authorize the entire scope once.
        const branches = await db.branch.findMany({
          where: { merchantId },
          select: { id: true, name: true, archivedAt: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        if (branchId && !branches.some((branch) => branch.id === branchId))
          throw new NotFoundException('Branch was not found.');

        // 2. Reuse the existing profit definition, under the same snapshot as the charts.
        const profitQuery = (period: typeof current) => ({
          from: period.from,
          to: period.to,
          limit: 100,
          ...(branchId ? { branchId } : {}),
        });
        const currentProfit = await this.profitability.get(merchantId, profitQuery(current), db);
        const previousProfit = await this.profitability.get(merchantId, profitQuery(previous), db);
        const currentCosts = await readPeriodCosts(db, merchantId, branchId, current);
        const previousCosts = await readPeriodCosts(db, merchantId, branchId, previous);
        const charts = await readBusinessCharts(db, merchantId, branchId, current);
        const balances = await readBusinessBalances(db, merchantId, branchId);

        return {
          generatedAt: new Date().toISOString(),
          timezone: 'Africa/Cairo',
          currency: 'EGP',
          branchId,
          branches: branches.map((branch) => ({
            id: branch.id,
            name: branch.name,
            archived: !!branch.archivedAt,
          })),
          current: buildBusinessPeriod(current, currentProfit.totals, currentCosts),
          previous: buildBusinessPeriod(previous, previousProfit.totals, previousCosts),
          ...charts,
          balances,
          products: currentProfit.products.map((product) => ({
            id: product.productId,
            name: product.productName,
            netSales: formatCents(
              toSignedCents(product.revenue) - toSignedCents(product.refundRevenue),
            ),
            grossProfit: product.grossProfit,
            ...(product.recordedGrossProfit !== undefined
              ? { recordedGrossProfit: product.recordedGrossProfit }
              : {}),
          })),
          productsTruncated: currentProfit.truncated,
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  }
}
