import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PosDiningService } from '../../src/modules/orders/dining/pos-dining.service.js';
import { OrderLifecycleService } from '../../src/modules/orders/fulfillment/order-lifecycle.service.js';
import { PosKitchenService } from '../../src/modules/orders/kitchen/pos-kitchen.service.js';
import { PosOrdersService } from '../../src/modules/orders/pos-sales/pos-orders.service.js';
import { ProductConfigurationReportService } from '../../src/modules/reports/product-configuration-report.service.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { ShiftsService } from '../../src/modules/shifts/shifts.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;

it(
  'persists dining sessions, split checks, and safe cash/terminal payment settlement',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply the POS dining migration first.');
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const token = randomUUID().replaceAll('-', '');
    const merchantIds: string[] = [];

    try {
      const merchant = await prisma.merchant.create({
        data: {
          name: `POS dining verification ${token}`,
          storefrontSlug: `pos-dining-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'POS dining verification',
          ownerMobile: '01100000000',
        },
      });
      merchantIds.push(merchant.id);
      const branch = await prisma.branch.create({
        data: {
          merchantId: merchant.id,
          name: `Dining branch ${token}`,
          createdBy: 'pos-dining-test',
          updatedBy: 'pos-dining-test',
        },
      });
      const otherBranch = await prisma.branch.create({
        data: {
          merchantId: merchant.id,
          name: `Other dining branch ${token}`,
          createdBy: 'pos-dining-test',
          updatedBy: 'pos-dining-test',
        },
      });
      const employeeRecord = await prisma.posEmployee.create({
        data: {
          merchantId: merchant.id,
          username: `dining-${token}`,
          displayName: 'Dining Cashier',
          passwordHash: 'database-test-only',
          role: 'cashier',
          permissions: ['sell'],
          createdBy: 'pos-dining-test',
          updatedBy: 'pos-dining-test',
          branches: {
            create: {
              createdBy: 'pos-dining-test',
              branch: { connect: { id_merchantId: { id: branch.id, merchantId: merchant.id } } },
            },
          },
        },
      });
      const otherEmployee = await prisma.posEmployee.create({
        data: {
          merchantId: merchant.id,
          username: `other-dining-${token}`,
          displayName: 'Other Branch Cashier',
          passwordHash: 'database-test-only',
          role: 'cashier',
          permissions: ['sell'],
          createdBy: 'pos-dining-test',
          updatedBy: 'pos-dining-test',
          branches: {
            create: {
              createdBy: 'pos-dining-test',
              branch: {
                connect: { id_merchantId: { id: otherBranch.id, merchantId: merchant.id } },
              },
            },
          },
        },
      });
      const employee: PosEmployeeSession = {
        id: employeeRecord.id,
        merchantId: merchant.id,
        username: employeeRecord.username,
        displayName: employeeRecord.displayName,
        role: 'cashier',
        permissions: ['sell'],
        branches: [{ id: branch.id, name: branch.name, archivedAt: null }],
      };
      const otherBranchSession: PosEmployeeSession = {
        id: otherEmployee.id,
        merchantId: merchant.id,
        username: otherEmployee.username,
        displayName: otherEmployee.displayName,
        role: 'cashier',
        permissions: ['sell'],
        branches: [{ id: otherBranch.id, name: otherBranch.name, archivedAt: null }],
      };
      const dining = new PosDiningService(prisma as unknown as PrismaService);
      const tables = await Promise.all(
        ['#01', '#02', '#03', '#04'].map((code) =>
          dining.createTable(merchant.id, 'pos-dining-test', {
            branchId: branch.id,
            code,
            capacity: 4,
          }),
        ),
      );
      const register = await prisma.posRegister.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          name: `Dining register ${token}`,
          createdBy: 'pos-dining-test',
          updatedBy: 'pos-dining-test',
        },
      });
      const shift = await prisma.posShift.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          registerId: register.id,
          openRequestId: randomUUID(),
          openedByEmployeeId: employee.id,
          openingFloat: '100.00',
          currency: 'EGP',
          status: 'open',
        },
      });
      const shifts = new ShiftsService(prisma as unknown as PrismaService);
      const payments = new PaymentsService(shifts);
      const posOrders = new PosOrdersService(
        prisma as unknown as PrismaService,
        {} as never,
        {} as never,
        {} as never,
        shifts,
        dining,
        payments,
      );
      const kitchen = new PosKitchenService(prisma as unknown as PrismaService);
      const lifecycle = new OrderLifecycleService(
        prisma as unknown as PrismaService,
        {} as never,
        {} as never,
      );

      const supervisor = await prisma.posEmployee.create({
        data: {
          merchantId: merchant.id,
          username: `supervisor-${token}`,
          displayName: 'POS Supervisor',
          passwordHash: 'database-test-only',
          role: 'supervisor',
          permissions: [],
          createdBy: 'pos-cancellation-test',
          updatedBy: 'pos-cancellation-test',
          branches: {
            create: {
              createdBy: 'pos-cancellation-test',
              branch: { connect: { id_merchantId: { id: branch.id, merchantId: merchant.id } } },
            },
          },
        },
      });
      const kitchenEmployeeRecord = await prisma.posEmployee.create({
        data: {
          merchantId: merchant.id,
          username: `kitchen-${token}`,
          displayName: 'Kitchen Operator',
          passwordHash: 'database-test-only',
          role: 'kitchen',
          permissions: ['accept_recipe_orders'],
          createdBy: 'pos-cancellation-test',
          updatedBy: 'pos-cancellation-test',
          branches: {
            create: {
              createdBy: 'pos-cancellation-test',
              branch: { connect: { id_merchantId: { id: branch.id, merchantId: merchant.id } } },
            },
          },
        },
      });
      const kitchenEmployee: PosEmployeeSession = {
        id: kitchenEmployeeRecord.id,
        merchantId: merchant.id,
        username: kitchenEmployeeRecord.username,
        displayName: kitchenEmployeeRecord.displayName,
        role: 'kitchen',
        permissions: ['accept_recipe_orders'],
        branches: [{ id: branch.id, name: branch.name, archivedAt: null }],
      };
      const cancellationOrder = await prisma.storefrontOrder.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          posShiftId: shift.id,
          createdByPosEmployeeId: employee.id,
          fulfillmentType: 'takeaway',
          source: 'pos',
          status: 'pending',
          currency: 'EGP',
          total: '3.00',
          checks: {
            create: { position: 0, amount: '3.00', splitMethod: 'whole' },
          },
        },
      });
      const cancellationStation = await prisma.posKitchenStation.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          code: `cancel-${token.slice(0, 12)}`,
          name: 'Cancellation test station',
        },
      });
      await prisma.posKitchenTicket.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          stationId: cancellationStation.id,
          orderId: cancellationOrder.id,
          dispatchMode: 'automatic',
        },
      });
      const cancellationCommand = {
        requestId: randomUUID(),
        branchId: branch.id,
        reason: 'Disposable database cancellation test',
      };
      const cancelledOrder = await lifecycle.cancelPosFromPos(
        employee,
        cancellationOrder.id,
        cancellationCommand,
        supervisor.id,
      );
      assert.equal(cancelledOrder.status, 'cancelled');
      assert.equal(cancelledOrder.cancellationReason, cancellationCommand.reason);
      assert.equal(
        (
          await prisma.storefrontOrder.findUniqueOrThrow({
            where: { id: cancellationOrder.id },
          })
        ).stockRestored,
        true,
      );
      assert.deepEqual(
        await lifecycle.cancelPosFromPos(
          employee,
          cancellationOrder.id,
          cancellationCommand,
          supervisor.id,
        ),
        cancelledOrder,
      );
      const cancelledCheck = await prisma.posOrderCheck.findFirstOrThrow({
        where: { orderId: cancellationOrder.id, merchantId: merchant.id },
      });
      assert.ok(cancelledCheck.cancelledAt);
      const cancellationAction = await prisma.storefrontOrderAction.findFirstOrThrow({
        where: {
          orderId: cancellationOrder.id,
          merchantId: merchant.id,
          action: 'pos_cancel',
        },
      });
      assert.equal(cancellationAction.approvedByPosEmployeeId, supervisor.id);
      assert.equal(
        await prisma.storefrontOrderAction.count({
          where: { orderId: cancellationOrder.id, merchantId: merchant.id, action: 'pos_cancel' },
        }),
        1,
      );
      const cancellationAcknowledgement = { requestId: randomUUID() };
      const acknowledgedCancellation = await kitchen.acknowledgeCancellation(
        kitchenEmployee,
        cancellationOrder.id,
        cancellationAcknowledgement,
      );
      assert.ok(acknowledgedCancellation.kitchenTicket?.cancellationAcknowledgedAt);
      assert.deepEqual(
        await kitchen.acknowledgeCancellation(
          kitchenEmployee,
          cancellationOrder.id,
          cancellationAcknowledgement,
        ),
        acknowledgedCancellation,
      );

      async function createSession(
        tableId: string,
        total: string,
        withSplitLine = false,
        lineUnitPrice = '1.00',
        withKitchenLines = false,
      ) {
        const order = await prisma.storefrontOrder.create({
          data: {
            merchantId: merchant.id,
            branchId: branch.id,
            posShiftId: shift.id,
            fulfillmentType: 'dine_in',
            source: 'pos',
            status: 'pending',
            currency: 'EGP',
            total,
            ...(withKitchenLines
              ? {
                  lines: {
                    create: [
                      {
                        productId: randomUUID(),
                        productName: 'Soup',
                        quantity: 1,
                        unitPrice: '5.00',
                        lineTotal: '5.00',
                        position: 0,
                      },
                      {
                        productId: randomUUID(),
                        productName: 'Bread',
                        quantity: 1,
                        unitPrice: '5.00',
                        lineTotal: '5.00',
                        position: 1,
                      },
                    ],
                  },
                }
              : withSplitLine
                ? {
                    lines: {
                      create: [
                        {
                          productId: randomUUID(),
                          productName: 'Two shareable items',
                          quantity: 2,
                          unitPrice: lineUnitPrice,
                          lineTotal: total,
                          position: 0,
                        },
                      ],
                    },
                  }
                : {}),
          },
        });
        await prisma.$transaction((tx) =>
          dining.attachOrder(tx, employee, branch.id, tableId, order.id, total),
        );
        return order.id;
      }

      const [firstOrderId, secondOrderId] = await Promise.all([
        createSession(tables[0]!.id, '10.00'),
        createSession(tables[2]!.id, '5.00'),
      ]);
      const roundOrderId = await createSession(tables[0]!.id, '2.00', true);
      const restoredOrder = await posOrders.detail(employee, roundOrderId);
      assert.equal(restoredOrder.total, '2.00');
      assert.equal(restoredOrder.lines[0]?.productName, 'Two shareable items');
      assert.equal(restoredOrder.lines[0]?.quantity, 2);
      await assert.rejects(
        posOrders.detail({ ...employee, merchantId: randomUUID() }, roundOrderId),
        NotFoundException,
      );
      await assert.rejects(
        posOrders.detail(
          {
            ...employee,
            branches: [{ id: otherBranch.id, name: otherBranch.name, archivedAt: null }],
          },
          roundOrderId,
        ),
        NotFoundException,
      );
      await assert.rejects(
        posOrders.detail(
          {
            ...employee,
            branches: [{ id: branch.id, name: branch.name, archivedAt: new Date().toISOString() }],
          },
          roundOrderId,
        ),
        NotFoundException,
      );
      await assert.rejects(
        posOrders.detail({ ...employee, permissions: [] }, roundOrderId),
        ForbiddenException,
      );
      const storefrontOnlyOrder = await prisma.storefrontOrder.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          source: 'storefront',
          status: 'pending',
          currency: 'EGP',
          total: '1.00',
          fulfillmentType: 'pickup',
        },
      });
      await assert.rejects(posOrders.detail(employee, storefrontOnlyOrder.id), NotFoundException);
      const takeawayOrder = await prisma.storefrontOrder.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          posShiftId: shift.id,
          fulfillmentType: 'takeaway',
          source: 'pos',
          status: 'pending',
          currency: 'EGP',
          total: '3.25',
        },
      });
      await prisma.$transaction((tx) =>
        dining.attachOrder(tx, employee, branch.id, null, takeawayOrder.id, '3.25'),
      );
      assert.equal(await prisma.posOrderCheck.count({ where: { orderId: takeawayOrder.id } }), 1);
      assert.equal(
        (await prisma.storefrontOrder.findUniqueOrThrow({ where: { id: takeawayOrder.id } }))
          .posDiningSessionId,
        null,
      );
      const firstSession = await prisma.posDiningSession.findFirstOrThrow({
        where: { merchantId: merchant.id, tableId: tables[0]!.id, status: 'open' },
      });
      const secondSession = await prisma.posDiningSession.findFirstOrThrow({
        where: { merchantId: merchant.id, tableId: tables[2]!.id, status: 'open' },
      });

      const splitRequestId = randomUUID();
      const splitRequest = {
        requestId: splitRequestId,
        revision: 1,
        method: 'equal' as const,
        checkCount: 3,
      };
      const losingSplitRequest = {
        requestId: randomUUID(),
        revision: 1,
        method: 'custom' as const,
        amounts: ['4.00', '6.00'],
      };
      const concurrentSplits = await Promise.allSettled([
        dining.splitOrder(employee, firstOrderId, splitRequest),
        dining.splitOrder(employee, firstOrderId, losingSplitRequest),
      ]);
      assert.equal(concurrentSplits.filter((result) => result.status === 'fulfilled').length, 1);
      const successfulSplit = concurrentSplits.find((result) => result.status === 'fulfilled');
      assert.ok(successfulSplit?.status === 'fulfilled');
      const winningRequest =
        successfulSplit.value.checks[0]?.splitMethod === 'equal'
          ? splitRequest
          : losingSplitRequest;
      const split = successfulSplit.value;
      if (winningRequest.method === 'equal')
        assert.deepEqual(
          split.checks.map((check) => check.amount),
          ['3.34', '3.33', '3.33'],
        );
      else
        assert.deepEqual(
          split.checks.map((check) => check.amount),
          ['4.00', '6.00'],
        );
      const replay = await dining.splitOrder(employee, firstOrderId, winningRequest);
      assert.deepEqual(replay, split);
      assert.equal(
        await prisma.posOrderCheck.count({ where: { orderId: firstOrderId } }),
        split.checks.length,
      );
      assert.equal(
        (await prisma.storefrontOrder.findUniqueOrThrow({ where: { id: firstOrderId } })).revision,
        2,
      );
      await assert.rejects(
        dining.splitOrder(employee, firstOrderId, {
          requestId: randomUUID(),
          revision: 1,
          method: 'equal',
          checkCount: 2,
        }),
        (error: unknown) => error instanceof ConflictException,
      );

      const customSplitRequest = {
        requestId: randomUUID(),
        revision: 1,
        method: 'custom' as const,
        amounts: ['2.00', '3.00'],
      };
      const customSplit = await dining.splitOrder(employee, secondOrderId, customSplitRequest);
      assert.deepEqual(
        customSplit.checks.map((check) => check.amount),
        ['2.00', '3.00'],
      );
      assert.deepEqual(
        await dining.splitOrder(employee, secondOrderId, customSplitRequest),
        customSplit,
      );

      const splitLine = await prisma.storefrontOrderLine.findFirstOrThrow({
        where: { orderId: roundOrderId },
      });
      const itemSplitRequest = {
        requestId: randomUUID(),
        revision: 1,
        method: 'items' as const,
        checks: [
          { lines: [{ orderLineId: splitLine.id, quantity: 1 }] },
          { lines: [{ orderLineId: splitLine.id, quantity: 1 }] },
        ],
      };
      const itemSplit = await dining.splitOrder(employee, roundOrderId, itemSplitRequest);
      assert.deepEqual(
        itemSplit.checks.map((check) => check.amount),
        ['1.00', '1.00'],
      );
      assert.deepEqual(
        itemSplit.checks.map((check) => check.allocations[0]?.quantity),
        [1, 1],
      );
      assert.deepEqual(
        await dining.splitOrder(employee, roundOrderId, itemSplitRequest),
        itemSplit,
      );
      const payableCheck = await prisma.posOrderCheck.findFirstOrThrow({
        where: { orderId: roundOrderId, position: 0 },
      });
      const cashPaymentRequest = {
        requestId: randomUUID(),
        revision: itemSplit.revision,
        tenders: [{ method: 'cash' as const, amount: '0.50', receivedAmount: '1.00' }],
      };
      const duplicateCashPayments = await Promise.all([
        posOrders.recordCheckPayment(employee, roundOrderId, payableCheck.id, cashPaymentRequest),
        posOrders.recordCheckPayment(employee, roundOrderId, payableCheck.id, cashPaymentRequest),
      ]);
      const cashPayment = duplicateCashPayments[0];
      assert.deepEqual(duplicateCashPayments[1], cashPayment);
      assert.equal(cashPayment.check.paidAmount, '0.50');
      assert.equal(cashPayment.check.balanceDue, '0.50');
      assert.equal(cashPayment.check.status, 'open');
      assert.equal(cashPayment.payments[0]?.changeAmount, '0.50');
      assert.equal(cashPayment.receipt, null);
      const partialPaymentState = await posOrders.paymentState(employee, roundOrderId);
      assert.equal(partialPaymentState.context?.order.id, roundOrderId);
      assert.equal(partialPaymentState.context?.order.lines[0]?.productName, 'Two shareable items');
      assert.equal(partialPaymentState.context?.tableCode, tables[0]!.code);
      assert.equal(partialPaymentState.checks[0]?.splitMethod, 'items');
      assert.equal(partialPaymentState.checks[0]?.allocations?.[0]?.quantity, 1);
      assert.equal(partialPaymentState.checks[0]?.allocations?.[0]?.amount, '1.00');
      assert.equal(partialPaymentState.checks[0]?.paidAmount, '0.50');
      assert.equal(partialPaymentState.checks[0]?.balanceDue, '0.50');
      assert.equal(partialPaymentState.checks[0]?.payments[0]?.method, 'cash');
      await assert.rejects(
        posOrders.paymentState(
          {
            ...employee,
            branches: employee.branches.map((branch) => ({
              ...branch,
              archivedAt: new Date().toISOString(),
            })),
          },
          roundOrderId,
        ),
        NotFoundException,
      );
      await assert.rejects(
        posOrders.paymentState({ ...employee, merchantId: randomUUID() }, roundOrderId),
        NotFoundException,
      );
      await assert.rejects(
        posOrders.paymentState({ ...employee, permissions: [] }, roundOrderId),
        ForbiddenException,
      );
      await assert.rejects(
        posOrders.paymentState(
          {
            ...employee,
            branches: [{ id: otherBranch.id, name: otherBranch.name, archivedAt: null }],
          },
          roundOrderId,
        ),
        (error: unknown) => error instanceof NotFoundException,
      );
      assert.deepEqual(
        await posOrders.recordCheckPayment(
          employee,
          roundOrderId,
          payableCheck.id,
          cashPaymentRequest,
        ),
        cashPayment,
      );
      const terminalPaymentRequest = {
        requestId: randomUUID(),
        revision: cashPayment.orderRevision,
        tenders: [{ method: 'terminal' as const, amount: '0.50', terminalReference: 'AUTH-1942' }],
      };
      const terminalPayment = await posOrders.recordCheckPayment(
        employee,
        roundOrderId,
        payableCheck.id,
        terminalPaymentRequest,
      );
      assert.equal(terminalPayment.check.status, 'settled');
      assert.equal(terminalPayment.check.balanceDue, '0.00');
      assert.ok(terminalPayment.check.settledAt);
      assert.equal(terminalPayment.receipt?.amount, '1.00');
      assert.equal(terminalPayment.receipt?.items[0]?.name, 'Two shareable items');
      assert.equal(terminalPayment.receipt?.items[0]?.quantity, 1);
      assert.equal(terminalPayment.receipt?.paidAmount, '1.00');
      const settledPaymentState = await posOrders.paymentState(employee, roundOrderId);
      assert.equal(settledPaymentState.checks[0]?.status, 'settled');
      assert.equal(settledPaymentState.checks[0]?.balanceDue, '0.00');
      assert.equal(settledPaymentState.checks[0]?.payments.length, 2);
      assert.equal(
        settledPaymentState.checks[0]?.receipt?.receiptNumber,
        terminalPayment.receipt?.receiptNumber,
      );
      assert.deepEqual(
        await posOrders.getCheckReceipt(employee, roundOrderId, payableCheck.id),
        terminalPayment.receipt,
      );
      assert.deepEqual(
        await posOrders.recordCheckPayment(
          employee,
          roundOrderId,
          payableCheck.id,
          terminalPaymentRequest,
        ),
        terminalPayment,
      );
      assert.equal(await prisma.posCheckReceipt.count({ where: { orderId: roundOrderId } }), 1);
      await assert.rejects(
        posOrders.getCheckReceipt(otherBranchSession, roundOrderId, payableCheck.id),
        (error: unknown) => error instanceof NotFoundException,
      );
      await prisma.storefrontOrderLine.updateMany({
        where: { orderId: roundOrderId },
        data: { productName: 'Updated catalog name' },
      });
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { name: 'Updated merchant name' },
      });
      const reprintedReceipt = await posOrders.getCheckReceipt(
        employee,
        roundOrderId,
        payableCheck.id,
      );
      assert.equal(reprintedReceipt.merchantName, merchant.name);
      assert.equal(reprintedReceipt.items[0]?.name, 'Two shareable items');
      const receiptHistory = await posOrders.listReceipts(employee, {
        branchId: branch.id,
        limit: 1,
      });
      assert.equal(receiptHistory.items[0]?.id, terminalPayment.receipt?.id);
      assert.equal(receiptHistory.items[0]?.checkId, payableCheck.id);
      const accountant: PosEmployeeSession = {
        ...employee,
        role: 'accountant',
        permissions: ['view_receipts'],
      };
      assert.equal(
        (await posOrders.listReceipts(accountant, { branchId: branch.id, limit: 1 })).items[0]?.id,
        terminalPayment.receipt?.id,
      );
      assert.equal(
        (await posOrders.getCheckReceipt(accountant, roundOrderId, payableCheck.id)).merchantName,
        merchant.name,
      );
      await assert.rejects(
        posOrders.quote(accountant, {}),
        (error: unknown) => error instanceof ForbiddenException,
      );
      assert.deepEqual(
        await posOrders.listReceipts(otherBranchSession, {
          branchId: otherBranch.id,
          limit: 25,
        }),
        { items: [], nextCursor: null },
      );
      await assert.rejects(
        posOrders.listReceipts(otherBranchSession, { branchId: branch.id, limit: 25 }),
        (error: unknown) => error instanceof ForbiddenException,
      );
      assert.equal(await prisma.posOrderPayment.count({ where: { orderId: roundOrderId } }), 2);
      assert.equal(await prisma.posShiftCashMovement.count({ where: { shiftId: shift.id } }), 1);
      assert.equal(
        (
          await prisma.posShiftCashMovement.findFirstOrThrow({ where: { shiftId: shift.id } })
        ).amount.toFixed(2),
        '0.50',
      );
      await assert.rejects(
        dining.splitOrder(employee, roundOrderId, {
          requestId: randomUUID(),
          revision: terminalPayment.orderRevision,
          method: 'equal',
          checkCount: 2,
        }),
        (error: unknown) => error instanceof ConflictException,
      );

      const competingCheck = await prisma.posOrderCheck.findFirstOrThrow({
        where: { orderId: roundOrderId, position: 1 },
      });
      const competingRequests = [
        {
          requestId: randomUUID(),
          revision: terminalPayment.orderRevision,
          tenders: [{ method: 'cash' as const, amount: '0.75', receivedAmount: '0.75' }],
        },
        {
          requestId: randomUUID(),
          revision: terminalPayment.orderRevision,
          tenders: [{ method: 'cash' as const, amount: '0.75', receivedAmount: '0.75' }],
        },
      ];
      const competingPayments = await Promise.allSettled(
        competingRequests.map((request) =>
          posOrders.recordCheckPayment(employee, roundOrderId, competingCheck.id, request),
        ),
      );
      assert.equal(competingPayments.filter((result) => result.status === 'fulfilled').length, 1);
      const losingPayment = competingPayments.find((result) => result.status === 'rejected');
      assert.ok(
        losingPayment?.status === 'rejected' && losingPayment.reason instanceof ConflictException,
      );
      const winningPaymentIndex = competingPayments.findIndex(
        (result) => result.status === 'fulfilled',
      );
      const winningPayment = competingPayments[winningPaymentIndex];
      assert.ok(winningPayment?.status === 'fulfilled');
      assert.deepEqual(
        await posOrders.recordCheckPayment(
          employee,
          roundOrderId,
          competingCheck.id,
          competingRequests[winningPaymentIndex]!,
        ),
        winningPayment.value,
      );
      const competingCheckState = (
        await posOrders.paymentState(employee, roundOrderId)
      ).checks.find((check) => check.id === competingCheck.id);
      assert.equal(competingCheckState?.paidAmount, '0.75');
      assert.equal(competingCheckState?.balanceDue, '0.25');
      const competingPaymentTotal = await prisma.posOrderPayment.aggregate({
        where: { orderId: roundOrderId, checkId: competingCheck.id },
        _sum: { amount: true },
      });
      assert.equal(competingPaymentTotal._sum.amount?.toFixed(2), '0.75');
      assert.equal(await prisma.posShiftCashMovement.count({ where: { shiftId: shift.id } }), 2);

      const beforeRefundState = await posOrders.paymentState(employee, roundOrderId);
      const refundRequest = {
        requestId: randomUUID(),
        revision: beforeRefundState.revision,
        branchId: branch.id,
        refundShiftId: shift.id,
        reason: 'Disposable database partial refund',
        allocations: [
          { paymentId: cashPayment.payments[0]!.id, amount: '0.15' },
          {
            paymentId: terminalPayment.payments[0]!.id,
            amount: '0.25',
            terminalReference: 'REFUND-1942',
          },
        ],
      };
      await assert.rejects(
        posOrders.recordCheckRefund(employee, roundOrderId, payableCheck.id, refundRequest),
        (error: unknown) => error instanceof ForbiddenException,
      );
      await assert.rejects(
        posOrders.recordCheckRefund(
          employee,
          roundOrderId,
          payableCheck.id,
          refundRequest,
          otherEmployee.id,
        ),
        (error: unknown) => error instanceof ForbiddenException,
      );
      await assert.rejects(
        posOrders.recordCheckRefund(
          otherBranchSession,
          roundOrderId,
          payableCheck.id,
          refundRequest,
          supervisor.id,
        ),
        (error: unknown) => error instanceof NotFoundException,
      );
      const refund = await posOrders.recordCheckRefund(
        employee,
        roundOrderId,
        payableCheck.id,
        refundRequest,
        supervisor.id,
      );
      assert.equal(refund.refund.amount, '0.40');
      assert.equal(refund.refund.reason, refundRequest.reason);
      assert.equal(refund.refund.approvedByEmployeeId, supervisor.id);
      assert.deepEqual(
        refund.refund.tenders.map((tender) => [tender.method, tender.amount]),
        [
          ['cash', '0.15'],
          ['terminal', '0.25'],
        ],
      );
      assert.deepEqual(
        await posOrders.recordCheckRefund(
          employee,
          roundOrderId,
          payableCheck.id,
          refundRequest,
          supervisor.id,
        ),
        refund,
      );
      await assert.rejects(
        posOrders.recordCheckRefund(
          employee,
          roundOrderId,
          payableCheck.id,
          {
            ...refundRequest,
            requestId: randomUUID(),
            revision: refund.orderRevision,
            allocations: [{ paymentId: cashPayment.payments[0]!.id, amount: '0.36' }],
          },
          supervisor.id,
        ),
        (error: unknown) => error instanceof ConflictException,
      );
      const refundTenderState = await posOrders.paymentState(employee, roundOrderId);
      const refundedCheck = refundTenderState.checks.find((check) => check.id === payableCheck.id);
      assert.equal(refundedCheck?.status, 'settled');
      assert.equal(refundedCheck?.refunds?.length, 1);
      assert.equal(refundedCheck?.refunds?.[0]?.requestId, refundRequest.requestId);
      assert.equal(refundedCheck?.payments[0]?.refundableAmount, '0.35');
      assert.equal(refundedCheck?.payments[1]?.refundableAmount, '0.25');
      assert.equal(await prisma.posOrderRefund.count({ where: { orderId: roundOrderId } }), 1);
      assert.equal(
        await prisma.posOrderRefundTender.count({ where: { refundId: refund.refund.id } }),
        2,
      );
      assert.equal(await prisma.posShiftRefundMovement.count({ where: { shiftId: shift.id } }), 1);
      assert.equal(
        (
          await prisma.posShiftRefundMovement.findFirstOrThrow({ where: { shiftId: shift.id } })
        ).amount.toFixed(2),
        '-0.15',
      );
      const refundAction = await prisma.storefrontOrderAction.findUniqueOrThrow({
        where: {
          merchantId_requestId: { merchantId: merchant.id, requestId: refundRequest.requestId },
        },
      });
      assert.equal(refundAction.action, 'pos_refund');
      assert.equal(refundAction.createdBy, `pos:${employee.id}`);
      assert.equal(refundAction.approvedByPosEmployeeId, supervisor.id);

      const beforeCompetingRefunds = await posOrders.paymentState(employee, roundOrderId);
      const competingRefundRequests = [randomUUID(), randomUUID()].map((requestId) => ({
        requestId,
        revision: beforeCompetingRefunds.revision,
        branchId: branch.id,
        refundShiftId: shift.id,
        reason: 'Competing disposable partial refund',
        allocations: [{ paymentId: cashPayment.payments[0]!.id, amount: '0.21' }],
      }));
      const competingRefunds = await Promise.allSettled(
        competingRefundRequests.map((request) =>
          posOrders.recordCheckRefund(
            employee,
            roundOrderId,
            payableCheck.id,
            request,
            supervisor.id,
          ),
        ),
      );
      assert.equal(competingRefunds.filter((result) => result.status === 'fulfilled').length, 1);
      const losingRefund = competingRefunds.find((result) => result.status === 'rejected');
      assert.ok(
        losingRefund?.status === 'rejected' && losingRefund.reason instanceof ConflictException,
      );
      const winningRefundIndex = competingRefunds.findIndex(
        (result) => result.status === 'fulfilled',
      );
      const winningRefund = competingRefunds[winningRefundIndex];
      assert.ok(winningRefund?.status === 'fulfilled');
      assert.deepEqual(
        await posOrders.recordCheckRefund(
          employee,
          roundOrderId,
          payableCheck.id,
          competingRefundRequests[winningRefundIndex]!,
          supervisor.id,
        ),
        winningRefund.value,
      );
      const afterCompetingRefunds = await posOrders.paymentState(employee, roundOrderId);
      const cappedCheck = afterCompetingRefunds.checks.find(
        (check) => check.id === payableCheck.id,
      );
      assert.equal(cappedCheck?.refunds?.length, 2);
      assert.equal(
        cappedCheck?.payments.find((payment) => payment.id === cashPayment.payments[0]!.id)
          ?.refundableAmount,
        '0.14',
      );
      const cashRefundTotal = await prisma.posOrderRefundTender.aggregate({
        where: { merchantId: merchant.id, originalPaymentId: cashPayment.payments[0]!.id },
        _sum: { amount: true },
      });
      assert.equal(cashRefundTotal._sum.amount?.toFixed(2), '0.36');
      assert.equal(await prisma.posOrderRefund.count({ where: { orderId: roundOrderId } }), 2);
      assert.equal(await prisma.posShiftRefundMovement.count({ where: { shiftId: shift.id } }), 2);
      const totalRefundMovement = await prisma.posShiftRefundMovement.aggregate({
        where: { merchantId: merchant.id, shiftId: shift.id },
        _sum: { amount: true },
      });
      assert.equal(totalRefundMovement._sum.amount?.toFixed(2), '-0.36');

      const failingShifts = Object.create(shifts) as ShiftsService;
      failingShifts.recordCashSale = async (tx, input) => {
        await shifts.recordCashSale(tx, input);
        throw new Error('Injected cash journal failure for rollback verification.');
      };
      const rollbackPayments = new PaymentsService(failingShifts);
      const rollbackOrders = new PosOrdersService(
        prisma as unknown as PrismaService,
        {} as never,
        {} as never,
        {} as never,
        failingShifts,
        dining,
        rollbackPayments,
      );
      const takeawayCheck = await prisma.posOrderCheck.findFirstOrThrow({
        where: { orderId: takeawayOrder.id, position: 0 },
      });
      await assert.rejects(
        rollbackOrders.recordCheckPayment(employee, takeawayOrder.id, takeawayCheck.id, {
          requestId: randomUUID(),
          revision: 1,
          tenders: [{ method: 'cash', amount: '1.00', receivedAmount: '1.00' }],
        }),
        (error: unknown) =>
          error instanceof Error &&
          error.message === 'Injected cash journal failure for rollback verification.',
      );
      assert.equal(await prisma.posOrderPayment.count({ where: { orderId: takeawayOrder.id } }), 0);
      assert.equal(await prisma.posShiftCashMovement.count({ where: { shiftId: shift.id } }), 2);
      const rolledBackCheck = await prisma.posOrderCheck.findUniqueOrThrow({
        where: { id: takeawayCheck.id },
      });
      assert.equal(rolledBackCheck.revision, 1);
      assert.equal(rolledBackCheck.settledAt, null);
      assert.equal(
        (await prisma.storefrontOrder.findUniqueOrThrow({ where: { id: takeawayOrder.id } }))
          .revision,
        1,
      );

      const handoverOrderId = await createSession(tables[1]!.id, '10.00', true, '5.00', true);
      const laterRoundOrderId = await createSession(tables[1]!.id, '4.00', true, '2.00');
      const handoverSplit = await dining.splitOrder(employee, handoverOrderId, {
        requestId: randomUUID(),
        revision: 1,
        method: 'custom',
        amounts: ['5.00', '5.00'],
      });
      const handoverSession = await prisma.posDiningSession.findFirstOrThrow({
        where: { merchantId: merchant.id, tableId: tables[1]!.id, status: 'open' },
      });
      assert.equal(
        (await prisma.storefrontOrder.findUniqueOrThrow({ where: { id: laterRoundOrderId } }))
          .posDiningSessionId,
        handoverSession.id,
      );

      async function makeTicketReady(id: string) {
        await kitchen.dispatchDineInOrder(employee, id, { requestId: randomUUID() });
        await lifecycle.acceptFromPos(
          merchant.id,
          `pos:${employee.id}`,
          id,
          { requestId: randomUUID(), branchId: branch.id },
          [branch.id],
        );
        await lifecycle.startPreparationFromPos(
          merchant.id,
          `pos:${employee.id}`,
          id,
          { requestId: randomUUID() },
          [branch.id],
        );
        const lines = await prisma.storefrontOrderLine.findMany({
          where: { orderId: id, merchantId: merchant.id },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        assert.ok(lines.length > 0);
        let readyOrder;
        let lastReadyRequestId = '';
        for (const [index, line] of lines.entries()) {
          lastReadyRequestId = randomUUID();
          readyOrder = await lifecycle.markKitchenItemReadyFromPos(
            merchant.id,
            `pos:${employee.id}`,
            id,
            line.id,
            { requestId: lastReadyRequestId },
            [branch.id],
          );
          assert.equal(readyOrder.status, index === lines.length - 1 ? 'ready' : 'preparing');
        }
        assert.ok(readyOrder?.lines.every((line) => line.kitchenReadyAt));
        assert.deepEqual(
          await lifecycle.markKitchenItemReadyFromPos(
            merchant.id,
            `pos:${employee.id}`,
            id,
            lines.at(-1)!.id,
            { requestId: lastReadyRequestId },
            [branch.id],
          ),
          readyOrder,
        );
      }
      await makeTicketReady(handoverOrderId);
      await makeTicketReady(laterRoundOrderId);

      const handover = (requestId: string) =>
        lifecycle.handoverFromPos(
          merchant.id,
          `pos:${employee.id}`,
          handoverOrderId,
          { requestId },
          [branch.id],
        );
      await assert.rejects(
        handover(randomUUID()),
        (error: unknown) => error instanceof ConflictException,
      );

      const firstCheck = handoverSplit.checks[0]!;
      const firstPaymentState = await posOrders.paymentState(employee, handoverOrderId);
      await posOrders.recordCheckPayment(employee, handoverOrderId, firstCheck.id, {
        requestId: randomUUID(),
        revision: firstPaymentState.revision,
        tenders: [{ method: 'cash', amount: '5.00', receivedAmount: '5.00' }],
      });
      await assert.rejects(
        handover(randomUUID()),
        (error: unknown) => error instanceof ConflictException,
      );
      const secondPaymentState = await posOrders.paymentState(employee, handoverOrderId);
      await posOrders.recordCheckPayment(employee, handoverOrderId, handoverSplit.checks[1]!.id, {
        requestId: randomUUID(),
        revision: secondPaymentState.revision,
        tenders: [{ method: 'cash', amount: '5.00', receivedAmount: '5.00' }],
      });

      const handoverRequestId = randomUUID();
      const completedFirstRound = await handover(handoverRequestId);
      assert.equal(completedFirstRound.status, 'completed');
      const completedOrderReport = await new ProductConfigurationReportService(
        prisma as unknown as PrismaService,
      ).get(merchant.id, '2020-01-01', '2030-01-01');
      assert.equal(completedOrderReport.orderCount, 2);
      assert.equal(completedOrderReport.totalQuantity, 4);
      assert.equal(completedOrderReport.totalRevenue, '14.00');
      assert.equal(
        (await prisma.posDiningSession.findUniqueOrThrow({ where: { id: handoverSession.id } }))
          .status,
        'open',
      );
      assert.equal(
        (await dining.listTablesForEmployee(employee, branch.id)).find(
          (table) => table.id === tables[1]!.id,
        )?.occupancy,
        'occupied',
      );

      const laterRoundState = await posOrders.paymentState(employee, laterRoundOrderId);
      const laterRoundCheck = laterRoundState.checks[0]!;
      await posOrders.recordCheckPayment(employee, laterRoundOrderId, laterRoundCheck.id, {
        requestId: randomUUID(),
        revision: laterRoundState.revision,
        tenders: [{ method: 'cash', amount: '4.00', receivedAmount: '4.00' }],
      });
      const laterRoundCompleted = await lifecycle.handoverFromPos(
        merchant.id,
        `pos:${employee.id}`,
        laterRoundOrderId,
        { requestId: randomUUID() },
        [branch.id],
      );
      assert.equal(laterRoundCompleted.status, 'completed');
      assert.equal(
        (await prisma.posDiningSession.findUniqueOrThrow({ where: { id: handoverSession.id } }))
          .status,
        'closed',
      );
      assert.deepEqual(await handover(handoverRequestId), completedFirstRound);
      assert.equal(
        (await dining.listTablesForEmployee(employee, branch.id)).find(
          (table) => table.id === tables[1]!.id,
        )?.occupancy,
        'available',
      );

      await assert.rejects(
        dining.moveSession(otherBranchSession, firstSession.id, {
          requestId: randomUUID(),
          revision: firstSession.revision,
          tableId: tables[1]!.id,
        }),
        (error: unknown) => error instanceof NotFoundException,
      );

      const simultaneousMoves = await Promise.allSettled([
        dining.moveSession(employee, firstSession.id, {
          requestId: randomUUID(),
          revision: firstSession.revision,
          tableId: tables[3]!.id,
        }),
        dining.moveSession(employee, secondSession.id, {
          requestId: randomUUID(),
          revision: secondSession.revision,
          tableId: tables[3]!.id,
        }),
      ]);
      assert.equal(simultaneousMoves.filter((result) => result.status === 'fulfilled').length, 1);
      const failure = simultaneousMoves.find((result) => result.status === 'rejected');
      assert.ok(failure?.status === 'rejected' && failure.reason instanceof ConflictException);
      assert.equal(
        await prisma.posDiningSession.count({
          where: { merchantId: merchant.id, tableId: tables[3]!.id, status: 'open' },
        }),
        1,
      );
      assert.equal(
        await prisma.posDiningSession.count({
          where: {
            merchantId: merchant.id,
            tableId: { in: [tables[0]!.id, tables[2]!.id] },
            status: 'open',
          },
        }),
        1,
      );

      const openSessions = await dining.listOpenSessionsForEmployee(employee, branch.id);
      assert.equal(openSessions.length, 2);
      assert.equal(openSessions.flatMap((session) => session.orders).length, 3);
      assert.equal(openSessions.find((session) => session.id === firstSession.id)?.orderCount, 2);
      assert.ok(
        openSessions.every((session) => session.orders.every((order) => order.checks.length > 0)),
      );
      const tableOptions = await dining.listTablesForEmployee(employee, branch.id);
      assert.equal(tableOptions.find((table) => table.id === tables[3]!.id)?.occupancy, 'occupied');
      assert.equal(
        tableOptions.find((table) => table.id === tables[1]!.id)?.occupancy,
        'available',
      );

      assert.equal(
        await prisma.storefrontOrder.count({
          where: {
            id: {
              in: [
                firstOrderId,
                secondOrderId,
                roundOrderId,
                takeawayOrder.id,
                handoverOrderId,
                laterRoundOrderId,
              ],
            },
          },
        }),
        6,
      );

      const supervisorSession: PosEmployeeSession = {
        id: supervisor.id,
        merchantId: merchant.id,
        username: supervisor.username,
        displayName: supervisor.displayName,
        role: 'supervisor',
        permissions: [
          'open_register_shift',
          'sell',
          'approve_refunds',
          'approve_shift_close',
          'manage_cash_movements',
        ],
        branches: employee.branches,
      };
      const reconciliationRegister = await shifts.createRegister(merchant.id, 'pos-dining-test', {
        branchId: branch.id,
        name: `Close race register ${token}`,
      });
      const reconciliationShift = await shifts.openShift(supervisorSession, {
        registerId: reconciliationRegister.id,
        requestId: randomUUID(),
        openingFloat: '10.00',
      });
      const reconciliationOrder = await prisma.storefrontOrder.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          posShiftId: reconciliationShift.id,
          createdByPosEmployeeId: employee.id,
          fulfillmentType: 'takeaway',
          source: 'pos',
          status: 'pending',
          currency: 'EGP',
          total: '1.00',
          lines: {
            create: {
              productId: randomUUID(),
              productName: 'Close race test item',
              quantity: 1,
              unitPrice: '1.00',
              lineTotal: '1.00',
              position: 0,
            },
          },
          checks: { create: { position: 0, amount: '1.00', splitMethod: 'whole' } },
        },
      });
      const reconciliationCheck = await prisma.posOrderCheck.findFirstOrThrow({
        where: { orderId: reconciliationOrder.id, merchantId: merchant.id },
      });
      const beforeReconciliationPayment = await posOrders.paymentState(
        employee,
        reconciliationOrder.id,
      );
      const reconciliationPayment = await posOrders.recordCheckPayment(
        employee,
        reconciliationOrder.id,
        reconciliationCheck.id,
        {
          requestId: randomUUID(),
          revision: beforeReconciliationPayment.revision,
          tenders: [{ method: 'cash', amount: '1.00', receivedAmount: '1.00' }],
        },
      );
      const beforeReconciliationRefund = await posOrders.paymentState(
        employee,
        reconciliationOrder.id,
      );
      const [closeRace, refundRace] = await Promise.allSettled([
        shifts.closeShift(supervisorSession, reconciliationShift.id, {
          requestId: randomUUID(),
          countedCash: '11.00',
          reason: 'Disposable close/refund race verification',
        }),
        posOrders.recordCheckRefund(
          employee,
          reconciliationOrder.id,
          reconciliationCheck.id,
          {
            requestId: randomUUID(),
            revision: beforeReconciliationRefund.revision,
            branchId: branch.id,
            refundShiftId: reconciliationShift.id,
            reason: 'Disposable close/refund race verification',
            allocations: [{ paymentId: reconciliationPayment.payments[0]!.id, amount: '1.00' }],
          },
          supervisor.id,
        ),
      ]);
      assert.ok(closeRace.status === 'fulfilled');
      const closeRaceRefundAmount = refundRace.status === 'fulfilled' ? '1.00' : '0.00';
      if (refundRace.status === 'rejected')
        assert.ok(refundRace.reason instanceof ConflictException);
      assert.equal(closeRace.value.cashRefunds, closeRaceRefundAmount);
      assert.equal(
        (await prisma.posShift.findUniqueOrThrow({ where: { id: reconciliationShift.id } })).status,
        'closed',
      );
      assert.equal(
        await prisma.posShiftCloseReport.count({
          where: { merchantId: merchant.id, shiftId: reconciliationShift.id },
        }),
        1,
      );
    } finally {
      try {
        for (const merchantId of merchantIds) {
          await prisma.$transaction(async (tx) => {
            await tx.posShiftCloseReport.deleteMany({ where: { merchantId } });
            await tx.posCheckReceipt.deleteMany({ where: { merchantId } });
            await tx.posShiftRefundMovement.deleteMany({ where: { merchantId } });
            await tx.posOrderRefundTender.deleteMany({ where: { merchantId } });
            await tx.posOrderRefund.deleteMany({ where: { merchantId } });
            await tx.posShiftCashMovement.deleteMany({ where: { merchantId } });
            await tx.posOrderPayment.deleteMany({ where: { merchantId } });
            await tx.posKitchenTicket.deleteMany({ where: { merchantId } });
            await tx.posKitchenStation.deleteMany({ where: { merchantId } });
            await tx.storefrontOrderAction.deleteMany({ where: { merchantId } });
            await tx.posOrderCheckLine.deleteMany({ where: { merchantId } });
            await tx.posOrderCheck.deleteMany({ where: { merchantId } });
            await tx.storefrontOrder.deleteMany({ where: { merchantId } });
            await tx.posDiningSession.deleteMany({ where: { merchantId } });
            await tx.posDiningTable.deleteMany({ where: { merchantId } });
            await tx.posShift.deleteMany({ where: { merchantId } });
            await tx.posRegister.deleteMany({ where: { merchantId } });
            await tx.posEmployeeBranch.deleteMany({ where: { merchantId } });
            await tx.posEmployee.deleteMany({ where: { merchantId } });
            await tx.branch.deleteMany({ where: { merchantId } });
            // Remove the subscription created with this test merchant before its parent row.
            await tx.subscriptionEvent.deleteMany({ where: { merchantId } });
            await tx.subscriptionPeriod.deleteMany({ where: { merchantId } });
            await tx.subscription.deleteMany({ where: { merchantId } });
            await tx.merchant.deleteMany({ where: { id: merchantId } });
          });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);
