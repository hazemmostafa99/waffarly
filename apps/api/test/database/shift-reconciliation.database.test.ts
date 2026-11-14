import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ShiftsService } from '../../src/modules/shifts/shifts.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'reconciles cash and terminal tenders, requires supervisor approvals, blocks unsettled checks, and closes idempotently',
  { skip: !databaseUrl },
  async () => {
    assert.ok(
      databaseUrl,
      'Configure DATABASE_URL and apply the POS shift reconciliation migration.',
    );
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const merchantIds: string[] = [];
    const orderIds: string[] = [];

    try {
      const token = randomUUID().replaceAll('-', '');
      const merchant = await prisma.merchant.create({
        data: {
          name: `POS shift reconciliation ${token}`,
          storefrontSlug: `pos-reconcile-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'POS shift reconciliation',
          ownerMobile: '01100000000',
        },
      });
      merchantIds.push(merchant.id);
      const branch = await prisma.branch.create({
        data: {
          merchantId: merchant.id,
          name: `POS reconcile branch ${token}`,
          createdBy: 'pos-shift-reconciliation-test',
          updatedBy: 'pos-shift-reconciliation-test',
        },
      });
      const cashierRecord = await prisma.posEmployee.create({
        data: {
          merchantId: merchant.id,
          username: `reconcile-cashier-${token}`,
          displayName: 'Reconciliation cashier',
          passwordHash: 'database-test-only',
          role: 'cashier',
          permissions: ['open_register_shift', 'sell'],
          createdBy: 'pos-shift-reconciliation-test',
          updatedBy: 'pos-shift-reconciliation-test',
        },
      });
      const supervisorRecord = await prisma.posEmployee.create({
        data: {
          merchantId: merchant.id,
          username: `reconcile-supervisor-${token}`,
          displayName: 'Reconciliation supervisor',
          passwordHash: 'database-test-only',
          role: 'supervisor',
          permissions: [],
          createdBy: 'pos-shift-reconciliation-test',
          updatedBy: 'pos-shift-reconciliation-test',
        },
      });
      await prisma.posEmployeeBranch.createMany({
        data: [cashierRecord, supervisorRecord].map((employee) => ({
          merchantId: merchant.id,
          employeeId: employee.id,
          branchId: branch.id,
          createdBy: 'pos-shift-reconciliation-test',
        })),
      });
      const cashier: PosEmployeeSession = {
        id: cashierRecord.id,
        merchantId: merchant.id,
        username: cashierRecord.username,
        displayName: cashierRecord.displayName,
        role: 'cashier',
        permissions: ['open_register_shift', 'sell'],
        branches: [{ id: branch.id, name: branch.name, archivedAt: null }],
      };
      const supervisor: PosEmployeeSession = {
        id: supervisorRecord.id,
        merchantId: merchant.id,
        username: supervisorRecord.username,
        displayName: supervisorRecord.displayName,
        role: 'supervisor',
        permissions: [
          'open_register_shift',
          'sell',
          'approve_shift_close',
          'manage_cash_movements',
        ],
        branches: [{ id: branch.id, name: branch.name, archivedAt: null }],
      };
      const service = new ShiftsService(prisma as unknown as PrismaService);
      const register = await service.createRegister(merchant.id, 'pos-shift-reconciliation-test', {
        branchId: branch.id,
        name: 'Reconciliation register',
      });
      const shift = await service.openShift(cashier, {
        registerId: register.id,
        requestId: randomUUID(),
        openingFloat: '100.00',
      });

      const paidOrder = await prisma.storefrontOrder.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          posShiftId: shift.id,
          createdByPosEmployeeId: cashier.id,
          source: 'pos',
          fulfillmentType: 'takeaway',
          status: 'completed',
          total: '50.00',
        },
      });
      orderIds.push(paidOrder.id);
      const paidCheck = await prisma.posOrderCheck.create({
        data: {
          merchantId: merchant.id,
          orderId: paidOrder.id,
          position: 0,
          amount: '50.00',
          splitMethod: 'equal',
          settledAt: new Date(),
        },
      });
      const cashPayment = await prisma.posOrderPayment.create({
        data: {
          merchantId: merchant.id,
          orderId: paidOrder.id,
          checkId: paidCheck.id,
          shiftId: shift.id,
          operatorEmployeeId: cashier.id,
          requestId: randomUUID(),
          position: 0,
          method: 'cash',
          amount: '30.00',
          receivedAmount: '30.00',
          changeAmount: '0.00',
        },
      });
      const terminalPayment = await prisma.posOrderPayment.create({
        data: {
          merchantId: merchant.id,
          orderId: paidOrder.id,
          checkId: paidCheck.id,
          shiftId: shift.id,
          operatorEmployeeId: cashier.id,
          requestId: randomUUID(),
          position: 1,
          method: 'terminal',
          amount: '20.00',
          receivedAmount: '20.00',
          changeAmount: '0.00',
          terminalReference: 'TEST-TERMINAL-1',
        },
      });
      await prisma.posShiftCashMovement.create({
        data: {
          merchantId: merchant.id,
          shiftId: shift.id,
          paymentId: cashPayment.id,
          operatorEmployeeId: cashier.id,
          kind: 'cash_sale',
          amount: '30.00',
        },
      });
      const refund = await prisma.posOrderRefund.create({
        data: {
          merchantId: merchant.id,
          orderId: paidOrder.id,
          checkId: paidCheck.id,
          shiftId: shift.id,
          requestId: randomUUID(),
          createdByEmployeeId: cashier.id,
          receiptNumber: `RF-${token.slice(0, 20)}`,
          reason: 'Database reconciliation test refund',
          amount: '5.00',
          currency: 'EGP',
          issuedAt: new Date(),
          snapshot: { test: true },
        },
      });
      const refundTender = await prisma.posOrderRefundTender.create({
        data: {
          merchantId: merchant.id,
          refundId: refund.id,
          shiftId: shift.id,
          originalPaymentId: cashPayment.id,
          originalPaymentShiftId: shift.id,
          position: 0,
          method: 'cash',
          amount: '5.00',
        },
      });
      await prisma.posShiftRefundMovement.create({
        data: {
          merchantId: merchant.id,
          shiftId: shift.id,
          refundTenderId: refundTender.id,
          operatorEmployeeId: cashier.id,
          amount: '-5.00',
        },
      });
      assert.ok(terminalPayment.id);

      const unsettledOrder = await prisma.storefrontOrder.create({
        data: {
          merchantId: merchant.id,
          branchId: branch.id,
          posShiftId: shift.id,
          createdByPosEmployeeId: cashier.id,
          source: 'pos',
          fulfillmentType: 'takeaway',
          total: '20.00',
        },
      });
      orderIds.push(unsettledOrder.id);
      const unsettledCheck = await prisma.posOrderCheck.create({
        data: {
          merchantId: merchant.id,
          orderId: unsettledOrder.id,
          position: 0,
          amount: '20.00',
          splitMethod: 'equal',
        },
      });

      const cashInRequest = {
        requestId: randomUUID(),
        kind: 'cash_in' as const,
        amount: '10.00',
        reason: 'Add change float',
      };
      const cashIn = await service.recordManualCashMovement(
        cashier,
        shift.id,
        cashInRequest,
        supervisor.id,
      );
      const cashInRetry = await service.recordManualCashMovement(
        cashier,
        shift.id,
        cashInRequest,
        supervisor.id,
      );
      assert.equal(cashInRetry.movement.id, cashIn.movement.id);
      assert.equal(
        await prisma.posShiftManualCashMovement.count({ where: { merchantId: merchant.id } }),
        1,
      );
      await assert.rejects(
        service.recordManualCashMovement(
          cashier,
          shift.id,
          {
            ...cashInRequest,
            amount: '11.00',
          },
          supervisor.id,
        ),
        (error: unknown) => error instanceof ConflictException,
      );
      const cashOut = await service.recordManualCashMovement(
        cashier,
        shift.id,
        {
          requestId: randomUUID(),
          kind: 'cash_out',
          amount: '2.00',
          reason: 'Petty cash purchase',
        },
        supervisor.id,
      );
      assert.equal('expectedCash' in cashOut.reconciliation, false);
      assert.equal('cashSales' in cashOut.reconciliation, false);
      assert.equal(cashOut.reconciliation.unsettledCheckCount, 1);
      assert.equal(cashOut.reconciliation.unsettledBalance, '20.00');
      const cashDropRequest = {
        requestId: randomUUID(),
        kind: 'cash_drop' as const,
        amount: '3.00',
        reason: 'Evening safe drop',
        dropReference: 'SAFE-BAG-1042',
      };
      const cashDrop = await service.recordManualCashMovement(
        cashier,
        shift.id,
        cashDropRequest,
        supervisor.id,
      );
      const cashDropRetry = await service.recordManualCashMovement(
        cashier,
        shift.id,
        cashDropRequest,
        supervisor.id,
      );
      assert.equal(cashDropRetry.movement.id, cashDrop.movement.id);
      assert.equal(cashDrop.movement.kind, 'cash_drop');
      assert.equal(cashDrop.movement.dropReference, 'SAFE-BAG-1042');
      assert.equal(cashDrop.movement.approvedByName, supervisor.displayName);
      assert.equal(
        await prisma.posShiftManualCashMovement.count({ where: { merchantId: merchant.id } }),
        3,
      );
      assert.equal('expectedCash' in (await service.getReconciliation(cashier, shift.id)), false);
      assert.deepEqual(
        await service.previewCloseShift(cashier, shift.id, {
          countedCash: '130.00',
        }),
        {
          unsettledCheckCount: 1,
          requiresReason: false,
          requiresSupervisorApproval: false,
        },
      );
      await assert.rejects(
        service.closeShift(cashier, shift.id, {
          requestId: randomUUID(),
          countedCash: '133.00',
        }),
        (error: unknown) => error instanceof ConflictException,
      );

      await prisma.posOrderCheck.update({
        where: { id: unsettledCheck.id },
        data: { cancelledAt: new Date() },
      });
      const closeRequest = {
        requestId: randomUUID(),
        countedCash: '131.00',
        reason: 'One pound cash count variance',
      };
      assert.deepEqual(
        await service.previewCloseShift(cashier, shift.id, {
          countedCash: closeRequest.countedCash,
        }),
        {
          unsettledCheckCount: 0,
          requiresReason: true,
          requiresSupervisorApproval: true,
        },
      );
      assert.deepEqual(
        await service.previewCloseShift(cashier, shift.id, {
          countedCash: closeRequest.countedCash,
          reason: closeRequest.reason,
        }),
        {
          unsettledCheckCount: 0,
          requiresReason: false,
          requiresSupervisorApproval: true,
        },
      );
      await assert.rejects(
        service.closeShift(cashier, shift.id, closeRequest),
        (error: unknown) => error instanceof ForbiddenException,
      );
      const report = await service.closeShift(cashier, shift.id, closeRequest, supervisor.id);
      assert.equal(report.openingFloat, '100.00');
      assert.equal(report.cashOut, '2.00');
      assert.equal(report.cashDrop, '3.00');
      assert.equal(report.expectedCash, '130.00');
      assert.equal(report.countedCash, '131.00');
      assert.equal(report.variance, '1.00');
      assert.equal(report.terminalSales, '20.00');
      assert.equal(report.approvedByName, supervisor.displayName);
      assert.equal(report.reason, closeRequest.reason);
      const closeRetry = await service.closeShift(cashier, shift.id, closeRequest, supervisor.id);
      assert.equal(closeRetry.id, report.id);
      assert.equal(await prisma.posShiftCloseReport.count({ where: { shiftId: shift.id } }), 1);
      assert.equal(await service.getCurrentShift(cashier, register.id), null);
      assert.equal((await service.getLatestCloseReport(cashier, register.id))?.id, report.id);
      assert.equal((await service.getCloseReport(cashier, shift.id)).variance, '1.00');

      const secondRegister = await service.createRegister(
        merchant.id,
        'pos-shift-reconciliation-test',
        {
          branchId: branch.id,
          name: 'Second reconciliation register',
        },
      );
      const secondShift = await service.openShift(cashier, {
        registerId: secondRegister.id,
        requestId: randomUUID(),
        openingFloat: '25.00',
      });
      await service.closeShift(cashier, secondShift.id, {
        requestId: randomUUID(),
        countedCash: '25.00',
      });

      const otherMerchant = await prisma.merchant.create({
        data: {
          name: `Foreign shift reports ${token}`,
          storefrontSlug: `foreign-shift-reports-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'Foreign shift report test',
          ownerMobile: '01100000000',
        },
      });
      merchantIds.push(otherMerchant.id);
      const otherBranch = await prisma.branch.create({
        data: {
          merchantId: otherMerchant.id,
          name: `Foreign report branch ${token}`,
          createdBy: 'pos-shift-reconciliation-test',
          updatedBy: 'pos-shift-reconciliation-test',
        },
      });
      const otherEmployeeRecord = await prisma.posEmployee.create({
        data: {
          merchantId: otherMerchant.id,
          username: `foreign-report-cashier-${token}`,
          displayName: 'Foreign report cashier',
          passwordHash: 'database-test-only',
          role: 'cashier',
          permissions: ['open_register_shift', 'sell'],
          createdBy: 'pos-shift-reconciliation-test',
          updatedBy: 'pos-shift-reconciliation-test',
        },
      });
      await prisma.posEmployeeBranch.create({
        data: {
          merchantId: otherMerchant.id,
          employeeId: otherEmployeeRecord.id,
          branchId: otherBranch.id,
          createdBy: 'pos-shift-reconciliation-test',
        },
      });
      const otherEmployee: PosEmployeeSession = {
        id: otherEmployeeRecord.id,
        merchantId: otherMerchant.id,
        username: otherEmployeeRecord.username,
        displayName: otherEmployeeRecord.displayName,
        role: 'cashier',
        permissions: ['open_register_shift', 'sell'],
        branches: [{ id: otherBranch.id, name: otherBranch.name, archivedAt: null }],
      };
      const otherRegister = await service.createRegister(
        otherMerchant.id,
        'pos-shift-reconciliation-test',
        { branchId: otherBranch.id, name: 'Foreign reports register' },
      );
      const otherShift = await service.openShift(otherEmployee, {
        registerId: otherRegister.id,
        requestId: randomUUID(),
        openingFloat: '10.00',
      });
      await service.closeShift(otherEmployee, otherShift.id, {
        requestId: randomUUID(),
        countedCash: '10.00',
      });

      const reportRange = {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      const firstReportsPage = await service.listOwnerCloseReports(merchant.id, {
        ...reportRange,
        branchId: branch.id,
        limit: 1,
      });
      assert.equal(firstReportsPage.items.length, 1);
      assert.ok(firstReportsPage.nextCursor);
      assert.equal('snapshot' in firstReportsPage.items[0]!, false);
      assert.equal(firstReportsPage.items[0]!.branchName, branch.name);
      const secondReportsPage = await service.listOwnerCloseReports(merchant.id, {
        ...reportRange,
        branchId: branch.id,
        limit: 1,
        cursor: firstReportsPage.nextCursor!,
      });
      assert.equal(secondReportsPage.items.length, 1);
      assert.equal(secondReportsPage.nextCursor, null);
      assert.notEqual(firstReportsPage.items[0]!.id, secondReportsPage.items[0]!.id);
      const pagedReports = [...firstReportsPage.items, ...secondReportsPage.items];
      assert.equal(pagedReports.find((item) => item.shiftId === shift.id)?.cashDrop, '3.00');
      const allBranchReports = await service.listOwnerCloseReports(merchant.id, {
        ...reportRange,
        limit: 10,
      });
      assert.equal(allBranchReports.items.length, 2);
      assert.equal(
        allBranchReports.items.every((item) => item.branchId === branch.id),
        true,
      );
      const outsideRange = await service.listOwnerCloseReports(merchant.id, {
        from: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString(),
        limit: 25,
      });
      assert.deepEqual(outsideRange, { items: [], nextCursor: null });
      await assert.rejects(
        service.listOwnerCloseReports(merchant.id, {
          ...reportRange,
          branchId: otherBranch.id,
          limit: 25,
        }),
        (error: unknown) => error instanceof NotFoundException,
      );
    } finally {
      try {
        for (const merchantId of merchantIds) {
          await prisma.$transaction(async (tx) => {
            await tx.posShiftCloseReport.deleteMany({ where: { merchantId } });
            await tx.posShiftManualCashMovement.deleteMany({ where: { merchantId } });
            await tx.posShiftRefundMovement.deleteMany({ where: { merchantId } });
            await tx.posOrderRefundTender.deleteMany({ where: { merchantId } });
            await tx.posOrderRefund.deleteMany({ where: { merchantId } });
            await tx.posShiftCashMovement.deleteMany({ where: { merchantId } });
            await tx.posOrderPayment.deleteMany({ where: { merchantId } });
            await tx.posOrderCheck.deleteMany({ where: { merchantId } });
            await tx.storefrontOrder.deleteMany({ where: { merchantId } });
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
