import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PosDiningService } from '../../src/modules/orders/pos-dining.service.js';
import { PosOrdersService } from '../../src/modules/orders/pos-orders.service.js';
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

      async function createSession(tableId: string, total: string, withSplitLine = false) {
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
            ...(withSplitLine
              ? {
                  lines: {
                    create: [
                      {
                        productId: randomUUID(),
                        productName: 'Two shareable items',
                        quantity: 2,
                        unitPrice: '1.00',
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
          where: { id: { in: [firstOrderId, secondOrderId, roundOrderId, takeawayOrder.id] } },
        }),
        4,
      );
    } finally {
      try {
        for (const merchantId of merchantIds) {
          await prisma.$transaction(async (tx) => {
            await tx.posCheckReceipt.deleteMany({ where: { merchantId } });
            await tx.posShiftCashMovement.deleteMany({ where: { merchantId } });
            await tx.posOrderPayment.deleteMany({ where: { merchantId } });
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
            await tx.merchant.deleteMany({ where: { id: merchantId } });
          });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);
