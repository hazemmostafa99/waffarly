import assert from 'node:assert/strict';
import { it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { listOwnerCloseReports } from '../../src/modules/shifts/reports/close-report.queries.js';

const merchantId = '10000000-0000-4000-8000-000000000001';
const branchId = '20000000-0000-4000-8000-000000000001';
const scope = {
  from: '2026-11-01T00:00:00.000Z',
  to: '2026-11-19T00:00:00.000Z',
  branchId,
  limit: 1,
};

it('reads full-period shift aggregates with tenant/date/branch scope and a shared snapshot', async () => {
  const reads: Array<{ where: unknown }> = [];
  let transactionOptions: unknown;
  const prisma = {
    branch: { findFirst: async () => ({ id: branchId }) },
    posShiftCloseReport: {
      findMany: (query: { where: unknown }) => {
        reads.push(query);
        return Promise.resolve([]);
      },
      aggregate: (query: { where: unknown }) => {
        reads.push(query);
        return Promise.resolve({
          _count: { _all: 40 },
          _sum: { variance: { toFixed: () => '-125.50' } },
        });
      },
      count: (query: { where: unknown }) => {
        reads.push(query);
        return Promise.resolve(31);
      },
    },
    $transaction: (operations: Promise<unknown>[], options: unknown) => {
      transactionOptions = options;
      return Promise.all(operations);
    },
  } as unknown as PrismaService;
  const report = await listOwnerCloseReports(prisma, merchantId, scope);
  assert.deepEqual(report.summary, {
    closedCount: 40,
    matchedCount: 31,
    varianceCount: 9,
    netVariance: '-125.50',
  });
  assert.deepEqual(transactionOptions, { isolationLevel: 'RepeatableRead' });
  const expectedWhere = {
    merchantId,
    closedAt: { gte: new Date(scope.from), lt: new Date(scope.to) },
    shift: { is: { branchId } },
  };
  assert.deepEqual(reads[0]?.where, expectedWhere);
  assert.deepEqual(reads[1]?.where, expectedWhere);
  assert.deepEqual(reads[2]?.where, { ...expectedWhere, variance: 0 });
  assert.equal(report.nextCursor, null);
});

it('rejects a foreign branch before querying shift summaries', async () => {
  const prisma = { branch: { findFirst: async () => null } } as unknown as PrismaService;
  await assert.rejects(listOwnerCloseReports(prisma, merchantId, scope), NotFoundException);
});
