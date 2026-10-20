import { BadRequestException } from '@nestjs/common';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { Prisma } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PosOperationsReportService } from '../../src/modules/reports/pos-operations-report.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'aggregates POS operations once per order and isolates branches and tender event time',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply POS migrations first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback POS operations report fixtures');
    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const token = randomUUID().replaceAll('-', '');
          const merchant = await transaction.merchant.create({
            data: {
              name: `POS operations report ${token}`,
              storefrontSlug: `pos-operations-report-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'POS operations report test',
              ownerMobile: '01100000000',
            },
          });
          const branchA = await transaction.branch.create({
            data: {
              merchantId: merchant.id,
              name: `Front ${token}`,
              createdBy: 'pos-operations-report-test',
              updatedBy: 'pos-operations-report-test',
            },
          });
          const branchB = await transaction.branch.create({
            data: {
              merchantId: merchant.id,
              name: `Patio ${token}`,
              createdBy: 'pos-operations-report-test',
              updatedBy: 'pos-operations-report-test',
            },
          });
          const employee = await transaction.posEmployee.create({
            data: {
              merchantId: merchant.id,
              username: `operations-report-${token}`,
              displayName: 'Operations Report Cashier',
              passwordHash: 'database-test-only',
              role: 'cashier',
              permissions: ['sell'],
              createdBy: 'pos-operations-report-test',
              updatedBy: 'pos-operations-report-test',
            },
          });
          const paymentOperator = await transaction.posEmployee.create({
            data: {
              merchantId: merchant.id,
              username: `operations-payment-operator-${token}`,
              displayName: 'Operations Payment Operator',
              passwordHash: 'database-test-only',
              role: 'supervisor',
              permissions: ['sell'],
              createdBy: 'pos-operations-report-test',
              updatedBy: 'pos-operations-report-test',
            },
          });
          const register = await transaction.posRegister.create({
            data: {
              merchantId: merchant.id,
              branchId: branchA.id,
              name: `Register ${token}`,
              createdBy: 'pos-operations-report-test',
              updatedBy: 'pos-operations-report-test',
            },
          });
          const shift = await transaction.posShift.create({
            data: {
              merchantId: merchant.id,
              branchId: branchA.id,
              registerId: register.id,
              openRequestId: randomUUID(),
              openedByEmployeeId: employee.id,
              openingFloat: '100.00',
              currency: 'EGP',
            },
          });
          const orderCreatedAt = new Date('2026-10-10T10:00:00.000Z');
          const paymentAt = new Date('2026-10-10T10:15:00.000Z');
          const refundAt = new Date('2026-10-12T10:00:00.000Z');
          const order = await transaction.storefrontOrder.create({
            data: {
              merchantId: merchant.id,
              branchId: branchA.id,
              branchName: branchA.name,
              posShiftId: shift.id,
              createdByPosEmployeeId: employee.id,
              fulfillmentType: 'dine_in',
              source: 'pos',
              status: 'completed',
              currency: 'EGP',
              total: '100.00',
              createdAt: orderCreatedAt,
              acceptedAt: new Date('2026-10-10T10:01:00.000Z'),
              preparationStartedAt: new Date('2026-10-10T10:03:00.000Z'),
              readyAt: new Date('2026-10-10T10:13:00.000Z'),
              completedAt: new Date('2026-10-10T10:20:00.000Z'),
              checks: {
                create: [
                  { position: 0, amount: '60.00', splitMethod: 'whole', settledAt: paymentAt },
                  { position: 1, amount: '40.00', splitMethod: 'whole', settledAt: paymentAt },
                ],
              },
            },
            include: { checks: { orderBy: { position: 'asc' } } },
          });
          const [cashCheck, terminalCheck] = order.checks;
          assert.ok(cashCheck && terminalCheck);
          const cashPayment = await transaction.posOrderPayment.create({
            data: {
              merchantId: merchant.id,
              orderId: order.id,
              checkId: cashCheck.id,
              shiftId: shift.id,
              operatorEmployeeId: employee.id,
              requestId: randomUUID(),
              position: 0,
              method: 'cash',
              amount: '60.00',
              receivedAmount: '60.00',
              changeAmount: '0.00',
              createdAt: paymentAt,
            },
          });
          await transaction.posOrderPayment.create({
            data: {
              merchantId: merchant.id,
              orderId: order.id,
              checkId: terminalCheck.id,
              shiftId: shift.id,
              operatorEmployeeId: paymentOperator.id,
              requestId: randomUUID(),
              position: 0,
              method: 'terminal',
              amount: '40.00',
              receivedAmount: '40.00',
              changeAmount: '0.00',
              terminalReference: 'TEST-TERMINAL-001',
              createdAt: paymentAt,
            },
          });
          const refund = await transaction.posOrderRefund.create({
            data: {
              merchantId: merchant.id,
              orderId: order.id,
              checkId: cashCheck.id,
              shiftId: shift.id,
              requestId: randomUUID(),
              createdByEmployeeId: paymentOperator.id,
              receiptNumber: `REF-${token.slice(0, 20)}`,
              reason: 'Disposable operations report verification',
              amount: '5.00',
              currency: 'EGP',
              issuedAt: refundAt,
              snapshot: { test: true } as Prisma.InputJsonValue,
            },
          });
          await transaction.posOrderRefundTender.create({
            data: {
              merchantId: merchant.id,
              refundId: refund.id,
              shiftId: shift.id,
              originalPaymentId: cashPayment.id,
              originalPaymentShiftId: shift.id,
              position: 0,
              method: 'cash',
              amount: '5.00',
              createdAt: refundAt,
            },
          });
          const olderSaleAt = new Date('2026-09-20T10:00:00.000Z');
          const olderOrder = await transaction.storefrontOrder.create({
            data: {
              merchantId: merchant.id,
              branchId: branchA.id,
              branchName: branchA.name,
              posShiftId: shift.id,
              createdByPosEmployeeId: employee.id,
              fulfillmentType: 'takeaway',
              source: 'pos',
              status: 'completed',
              currency: 'EGP',
              total: '20.00',
              createdAt: olderSaleAt,
              acceptedAt: olderSaleAt,
              preparationStartedAt: new Date('2026-09-20T10:30:00.000Z'),
              readyAt: new Date('2026-09-20T11:30:00.000Z'),
              completedAt: new Date('2026-09-20T11:45:00.000Z'),
              checks: {
                create: {
                  position: 0,
                  amount: '20.00',
                  splitMethod: 'whole',
                  settledAt: olderSaleAt,
                },
              },
            },
            include: { checks: true },
          });
          const olderCheck = olderOrder.checks[0];
          assert.ok(olderCheck);
          const olderPayment = await transaction.posOrderPayment.create({
            data: {
              merchantId: merchant.id,
              orderId: olderOrder.id,
              checkId: olderCheck.id,
              shiftId: shift.id,
              operatorEmployeeId: employee.id,
              requestId: randomUUID(),
              position: 0,
              method: 'cash',
              amount: '20.00',
              receivedAmount: '20.00',
              changeAmount: '0.00',
              createdAt: olderSaleAt,
            },
          });
          const laterRefund = await transaction.posOrderRefund.create({
            data: {
              merchantId: merchant.id,
              orderId: olderOrder.id,
              checkId: olderCheck.id,
              shiftId: shift.id,
              requestId: randomUUID(),
              createdByEmployeeId: paymentOperator.id,
              receiptNumber: `REF-OLD-${token.slice(0, 16)}`,
              reason: 'Refund in the selected report period for an older sale',
              amount: '5.00',
              currency: 'EGP',
              issuedAt: refundAt,
              snapshot: { test: true } as Prisma.InputJsonValue,
            },
          });
          await transaction.posOrderRefundTender.create({
            data: {
              merchantId: merchant.id,
              refundId: laterRefund.id,
              shiftId: shift.id,
              originalPaymentId: olderPayment.id,
              originalPaymentShiftId: shift.id,
              position: 0,
              method: 'cash',
              amount: '5.00',
              createdAt: refundAt,
            },
          });
          const branchBOrder = await transaction.storefrontOrder.create({
            data: {
              merchantId: merchant.id,
              branchId: branchB.id,
              branchName: branchB.name,
              fulfillmentType: 'takeaway',
              source: 'pos',
              status: 'pending',
              currency: 'EGP',
              total: '30.00',
              createdAt: orderCreatedAt,
              checks: { create: { position: 0, amount: '30.00', splitMethod: 'whole' } },
            },
          });
          assert.ok(branchBOrder.id);
          const cancelledAt = new Date('2026-10-12T12:00:00.000Z');
          await transaction.storefrontOrder.create({
            data: {
              merchantId: merchant.id,
              branchId: branchA.id,
              branchName: branchA.name,
              fulfillmentType: 'takeaway',
              source: 'pos',
              status: 'cancelled',
              cancelledAt,
              cancellationReason: 'Disposable report verification',
              currency: 'EGP',
              total: '50.00',
              createdAt: new Date('2026-10-11T12:00:00.000Z'),
              checks: {
                create: {
                  position: 0,
                  amount: '50.00',
                  splitMethod: 'whole',
                  cancelledAt,
                },
              },
            },
          });
          await transaction.storefrontOrder.create({
            data: {
              merchantId: merchant.id,
              branchId: branchA.id,
              branchName: branchA.name,
              fulfillmentType: 'takeaway',
              source: 'storefront',
              status: 'pending',
              currency: 'EGP',
              total: '400.00',
              createdAt: orderCreatedAt,
            },
          });

          const service = new PosOperationsReportService(transaction as unknown as PrismaService);
          const query = {
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-11-01T00:00:00.000Z',
          };
          const allBranches = await service.get(merchant.id, query);
          assert.equal(allBranches.orders.placedCount, 3);
          assert.equal(allBranches.orders.cancelledCount, 1);
          assert.equal(allBranches.orders.acceptedCount, 1);
          assert.equal(allBranches.orders.completedCount, 1);
          assert.equal(allBranches.orders.paidCount, 1);
          assert.equal(allBranches.orders.value, '130.00');
          assert.equal(allBranches.orders.outstanding, '30.00');
          assert.equal(allBranches.checks.settledCount, 2);
          assert.deepEqual(allBranches.collections, {
            cash: '60.00',
            terminal: '40.00',
            total: '100.00',
          });
          assert.deepEqual(allBranches.refunds, {
            cash: '10.00',
            terminal: '0.00',
            total: '10.00',
          });
          assert.equal(allBranches.netCollected, '90.00');
          assert.equal(allBranches.preparation.acceptedToStartSeconds, 120);
          assert.equal(allBranches.preparation.startToReadySeconds, 600);
          assert.deepEqual(
            allBranches.cashierActivity.map((activity) => ({
              employeeName: activity.employeeName,
              ordersOpened: activity.ordersOpened,
              cancelledOrders: activity.cancelledOrders,
              orderValue: activity.orderValue,
              paymentCount: activity.paymentCount,
              collections: activity.collections,
              refundCount: activity.refundCount,
              refunds: activity.refunds,
              netCollected: activity.netCollected,
            })),
            [
              {
                employeeName: 'Operations Payment Operator',
                ordersOpened: 0,
                cancelledOrders: 0,
                orderValue: '0.00',
                paymentCount: 1,
                collections: { cash: '0.00', terminal: '40.00', total: '40.00' },
                refundCount: 2,
                refunds: { cash: '10.00', terminal: '0.00', total: '10.00' },
                netCollected: '30.00',
              },
              {
                employeeName: 'Operations Report Cashier',
                ordersOpened: 1,
                cancelledOrders: 0,
                orderValue: '100.00',
                paymentCount: 1,
                collections: { cash: '60.00', terminal: '0.00', total: '60.00' },
                refundCount: 0,
                refunds: { cash: '0.00', terminal: '0.00', total: '0.00' },
                netCollected: '60.00',
              },
              {
                employeeName: null,
                ordersOpened: 2,
                cancelledOrders: 1,
                orderValue: '30.00',
                paymentCount: 0,
                collections: { cash: '0.00', terminal: '0.00', total: '0.00' },
                refundCount: 0,
                refunds: { cash: '0.00', terminal: '0.00', total: '0.00' },
                netCollected: '0.00',
              },
            ],
          );

          const branchOnly = await service.get(merchant.id, { ...query, branchId: branchA.id });
          assert.equal(branchOnly.orders.placedCount, 2);
          assert.equal(branchOnly.orders.cancelledCount, 1);
          assert.equal(branchOnly.orders.value, '100.00');
          assert.equal(branchOnly.orders.outstanding, '0.00');
          assert.equal(branchOnly.checks.settledCount, 2);
          assert.equal(branchOnly.collections.total, '100.00');
          assert.equal(branchOnly.refunds.total, '10.00');
          assert.equal(branchOnly.cashierActivity.length, 3);
          const branchUnattributed = branchOnly.cashierActivity.find(
            (activity) => activity.employeeId === null,
          );
          assert.equal(branchUnattributed?.ordersOpened, 1);
          assert.equal(branchUnattributed?.cancelledOrders, 1);
          assert.equal(branchUnattributed?.orderValue, '0.00');
          await assert.rejects(
            service.get(merchant.id, { ...query, from: query.to, to: query.from }),
            BadRequestException,
          );
          throw rollback;
        }),
        rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
