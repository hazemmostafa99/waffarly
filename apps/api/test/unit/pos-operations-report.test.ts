import { BadRequestException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PosOperationsReportService } from '../../src/modules/reports/pos-operations-report.service.js';

it('formats POS order, tender, refund and preparation aggregates without multiplying facts', async () => {
  const statements: string[] = [];
  const parameters: unknown[][] = [];
  const results: unknown[][] = [
    [
      {
        placedCount: 5n,
        cancelledCount: 1n,
        acceptedCount: 3n,
        completedCount: 2n,
        paidCount: 2n,
        settledCheckCount: 4n,
        orderValueCents: '11500',
        outstandingCents: '2500',
        acceptedToStartSeconds: 300n,
        startToReadySeconds: 900n,
      },
    ],
    [{ cashCents: '10000', terminalCents: '2000' }],
    [{ cashCents: '250', terminalCents: '0' }],
    [
      {
        employeeId: 'employee-1',
        employeeName: 'Cashier One',
        ordersOpened: 5n,
        cancelledOrders: 1n,
        orderValueCents: '11500',
        paymentCount: 4n,
        cashCollectedCents: '10000',
        terminalCollectedCents: '2000',
        refundCount: 1n,
        cashRefundedCents: '250',
        terminalRefundedCents: '0',
      },
      {
        employeeId: null,
        employeeName: null,
        ordersOpened: 0n,
        cancelledOrders: 0n,
        orderValueCents: '0',
        paymentCount: 0n,
        cashCollectedCents: '0',
        terminalCollectedCents: '0',
        refundCount: 0n,
        cashRefundedCents: '0',
        terminalRefundedCents: '0',
      },
    ],
  ];
  let call = 0;
  const service = new PosOperationsReportService({
    branch: { findFirst: async () => ({ id: 'branch-1' }) },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      statements.push(strings.join('?'));
      parameters.push(values);
      return results[call++]!;
    },
  } as unknown as PrismaService);

  const report = await service.get('merchant-1', {
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-10-31T00:00:00.000Z',
    branchId: 'branch-1',
  });

  assert.equal(call, 4);
  assert.deepEqual(report.orders, {
    placedCount: 5,
    cancelledCount: 1,
    acceptedCount: 3,
    completedCount: 2,
    paidCount: 2,
    value: '115.00',
    outstanding: '25.00',
  });
  assert.deepEqual(report.checks, { settledCount: 4 });
  assert.deepEqual(report.collections, { cash: '100.00', terminal: '20.00', total: '120.00' });
  assert.deepEqual(report.refunds, { cash: '2.50', terminal: '0.00', total: '2.50' });
  assert.equal(report.netCollected, '117.50');
  assert.deepEqual(report.preparation, {
    acceptedToStartSeconds: 300,
    startToReadySeconds: 900,
  });
  assert.deepEqual(report.cashierActivity, [
    {
      employeeId: 'employee-1',
      employeeName: 'Cashier One',
      ordersOpened: 5,
      cancelledOrders: 1,
      orderValue: '115.00',
      paymentCount: 4,
      collections: { cash: '100.00', terminal: '20.00', total: '120.00' },
      refundCount: 1,
      refunds: { cash: '2.50', terminal: '0.00', total: '2.50' },
      netCollected: '117.50',
    },
    {
      employeeId: null,
      employeeName: null,
      ordersOpened: 0,
      cancelledOrders: 0,
      orderValue: '0.00',
      paymentCount: 0,
      collections: { cash: '0.00', terminal: '0.00', total: '0.00' },
      refundCount: 0,
      refunds: { cash: '0.00', terminal: '0.00', total: '0.00' },
      netCollected: '0.00',
    },
  ]);
  assert.equal(report.branchId, 'branch-1');
  assert.ok(statements.every((sql) => sql.includes('"merchantId" = ?')));
  assert.ok(statements.every((sql) => sql.includes("'pos'")));
  assert.ok(statements.some((sql) => sql.includes('activity_employees')));
  assert.ok(statements.some((sql) => sql.includes('WITH scoped_orders')));
  assert.ok(parameters.every((values) => values.includes('merchant-1')));
  assert.ok(parameters.every((values) => values.includes('branch-1')));
  assert.ok(parameters.every((values) => values.some((value) => value instanceof Date)));
});

it('rejects a foreign or archived branch before querying report facts', async () => {
  let queryCount = 0;
  const service = new PosOperationsReportService({
    branch: { findFirst: async () => null },
    $queryRaw: async () => {
      queryCount += 1;
      return [];
    },
  } as unknown as PrismaService);

  await assert.rejects(
    service.get('merchant-1', {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-02T00:00:00.000Z',
      branchId: 'foreign-branch',
    }),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(queryCount, 0);
});
