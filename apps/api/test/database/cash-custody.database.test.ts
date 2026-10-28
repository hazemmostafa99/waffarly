import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ShiftsService } from '../../src/modules/shifts/shifts.service.js';
import { CashCustodyService } from '../../src/modules/shifts/cash-custody.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;

it(
  'tracks physical custody, independently confirms receipts, protects close snapshots and allocates carryover only once',
  { skip: !databaseUrl },
  async () => {
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const shifts = new ShiftsService(prisma as unknown as PrismaService);
    const cash = new CashCustodyService(prisma as unknown as PrismaService);
    const tenants: string[] = [];
    const token = randomUUID();
    try {
      const merchant = await prisma.merchant.create({
        data: {
          name: 'Cash custody test',
          storefrontSlug: `cash-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'Owner',
          ownerMobile: '01100000000',
        },
      });
      tenants.push(merchant.id);
      const foreign = await prisma.merchant.create({
        data: {
          name: 'Other tenant',
          storefrontSlug: `other-cash-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'Owner',
          ownerMobile: '01100000000',
        },
      });
      tenants.push(foreign.id);
      const branch = await prisma.branch.create({
        data: { merchantId: merchant.id, name: 'Main', createdBy: 'test', updatedBy: 'test' },
      });
      const otherBranch = await prisma.branch.create({
        data: {
          merchantId: merchant.id,
          name: 'Other branch',
          createdBy: 'test',
          updatedBy: 'test',
        },
      });
      const foreignBranch = await prisma.branch.create({
        data: { merchantId: foreign.id, name: 'Foreign', createdBy: 'test', updatedBy: 'test' },
      });
      const makeEmployee = async (name: string): Promise<PosEmployeeSession> => {
        const row = await prisma.posEmployee.create({
          data: {
            merchantId: merchant.id,
            username: `${name}-${token}`,
            displayName: name,
            passwordHash: 'test-only',
            role: 'supervisor',
            permissions: [],
            createdBy: 'test',
            updatedBy: 'test',
          },
        });
        await prisma.posEmployeeBranch.create({
          data: {
            merchantId: merchant.id,
            employeeId: row.id,
            branchId: branch.id,
            createdBy: 'test',
          },
        });
        return {
          id: row.id,
          merchantId: merchant.id,
          username: row.username,
          displayName: name,
          role: 'supervisor',
          permissions: [
            'sell',
            'open_register_shift',
            'approve_shift_close',
            'manage_cash_movements',
          ],
          branches: [{ id: branch.id, name: branch.name, archivedAt: null }],
        };
      };
      const cashier = await makeEmployee('Cashier');
      const receiver = await makeEmployee('Receiver');
      const register = await shifts.createRegister(merchant.id, 'test', {
        branchId: branch.id,
        name: 'Drawer',
      });
      const safeRequest = {
        requestId: randomUUID(),
        branchId: branch.id,
        name: 'Main safe',
        openingBalance: '10.00',
      };
      const safe = await cash.createSafe(merchant.id, 'owner:owner', safeRequest);
      assert.equal((await cash.createSafe(merchant.id, 'owner:owner', safeRequest)).id, safe.id);
      await assert.rejects(
        cash.createSafe(merchant.id, 'owner:owner', { ...safeRequest, openingBalance: '11.00' }),
        ConflictException,
      );
      const wrongSafe = await cash.createSafe(merchant.id, 'owner:owner', {
        ...safeRequest,
        requestId: randomUUID(),
        branchId: otherBranch.id,
        name: 'Other safe',
      });
      const foreignSafe = await cash.createSafe(foreign.id, 'owner:foreign', {
        ...safeRequest,
        requestId: randomUUID(),
        branchId: foreignBranch.id,
      });

      const shift = await shifts.openShift(cashier, {
        requestId: randomUUID(),
        registerId: register.id,
        openingFloat: '500.00',
      });
      const drop = {
        requestId: randomUUID(),
        kind: 'cash_drop',
        safeId: safe.id,
        amount: '200.00',
        reason: 'Mid-shift handoff',
        dropReference: 'BAG-1',
      };
      await assert.rejects(
        shifts.recordManualCashMovement(cashier, shift.id, { ...drop, safeId: wrongSafe.id }),
        NotFoundException,
      );
      assert.equal(
        await prisma.posShiftManualCashMovement.count({ where: { merchantId: merchant.id } }),
        0,
        'invalid destination rolls back drawer movement',
      );
      await shifts.recordManualCashMovement(cashier, shift.id, drop);
      await shifts.recordManualCashMovement(cashier, shift.id, drop);
      let transfers = await cash.listTransfers(merchant.id, { shiftId: shift.id });
      assert.equal(transfers.items.length, 1);
      const dropTransfer = transfers.items[0]!;
      assert.equal(dropTransfer.createdByName, 'Cashier');
      let safeSummary = (await cash.listSafes(merchant.id, {})).items.find(
        (row) => row.id === safe.id,
      )!;
      assert.equal(safeSummary.balance, '10.00', 'unreceived handoff does not credit safe');
      assert.equal(safeSummary.pendingAmount, '200.00');
      assert.equal(
        (await cash.drawers(merchant.id, { shiftId: shift.id })).items[0]?.remainingCash,
        '300.00',
      );
      assert.ok(
        !Object.hasOwn(await shifts.getReconciliation(cashier, shift.id), 'expectedCash'),
        'blind count remains private',
      );

      const close = await shifts.closeShift(cashier, shift.id, {
        requestId: randomUUID(),
        countedCash: '300.00',
      });
      assert.equal(close.cashDrop, '200.00');
      const frozen = await prisma.posShiftCloseReport.findFirstOrThrow({
        where: { shiftId: shift.id, merchantId: merchant.id },
      });
      const transferRequest = {
        requestId: randomUUID(),
        safeId: safe.id,
        amount: '100.00',
        reference: 'BAG-2',
        reason: 'After close',
      };
      await assert.rejects(
        cash.transferClosedCash(merchant.id, 'owner:owner', shift.id, {
          ...transferRequest,
          safeId: foreignSafe.id,
        }),
        NotFoundException,
      );
      const postClose = await cash.transferClosedCash(
        merchant.id,
        'owner:owner',
        shift.id,
        transferRequest,
      );
      assert.equal(
        (await cash.transferClosedCash(merchant.id, 'owner:owner', shift.id, transferRequest)).id,
        postClose.id,
      );
      await assert.rejects(
        cash.transferClosedCash(foreign.id, 'owner:foreign', shift.id, transferRequest),
        NotFoundException,
      );
      await assert.rejects(
        cash.transferClosedCash(merchant.id, 'owner:owner', shift.id, {
          ...transferRequest,
          amount: '101.00',
        }),
        ConflictException,
      );
      await assert.rejects(
        cash.receive(merchant.id, 'owner:owner', postClose.id, {
          requestId: randomUUID(),
          receivedAmount: '100.00',
        }),
        ForbiddenException,
      );
      await assert.rejects(
        cash.receive(foreign.id, 'owner:foreign', postClose.id, {
          requestId: randomUUID(),
          receivedAmount: '100.00',
        }),
        NotFoundException,
      );
      await assert.rejects(cash.listTransfers(foreign.id, { cursor: postClose.id }), /cursor/i);

      const receipt = {
        requestId: randomUUID(),
        receivedAmount: '190.00',
        note: 'Short by ten, under review',
      };
      await assert.rejects(
        cash.receive(merchant.id, 'owner:owner', dropTransfer.id, { ...receipt, note: '' }),
        ConflictException,
      );
      const received = await cash.receive(merchant.id, 'owner:owner', dropTransfer.id, receipt);
      assert.equal(received.status, 'discrepancy');
      assert.equal(received.difference, '-10.00');
      assert.equal(
        (await cash.receive(merchant.id, 'owner:owner', dropTransfer.id, receipt)).id,
        received.id,
      );
      await assert.rejects(
        cash.receive(merchant.id, 'owner:owner', dropTransfer.id, {
          ...receipt,
          receivedAmount: '200.00',
        }),
        ConflictException,
      );
      await cash.receiveForEmployee(receiver, branch.id, postClose.id, {
        requestId: randomUUID(),
        receivedAmount: '100.00',
      });
      await assert.rejects(
        cash.receiveForEmployee(receiver, otherBranch.id, postClose.id, {
          requestId: randomUUID(),
          receivedAmount: '100.00',
        }),
        NotFoundException,
      );
      assert.equal(
        (await cash.listSafes(merchant.id, {})).items.find((row) => row.id === safe.id)?.balance,
        '300.00',
      );
      await cash.resolve(merchant.id, 'owner:owner', dropTransfer.id, {
        note: 'Cashier repaid the shortage; deposit recorded separately.',
      });
      assert.equal(
        (await cash.listSafes(merchant.id, {})).items.find((row) => row.id === safe.id)?.balance,
        '300.00',
        'review does not fabricate recovered cash',
      );
      const recovery = {
        requestId: randomUUID(),
        kind: 'deposit',
        amount: '10.00',
        reason: `Shortage recovery ${dropTransfer.id}`,
      };
      await cash.safeMovement(merchant.id, 'owner:owner', safe.id, recovery);
      await cash.safeMovement(merchant.id, 'owner:owner', safe.id, recovery);
      await assert.rejects(
        cash.safeMovement(merchant.id, 'owner:owner', safe.id, {
          ...recovery,
          requestId: randomUUID(),
          kind: 'withdrawal',
          amount: '1000.00',
        }),
        ConflictException,
      );
      const withdrawals = await Promise.allSettled(
        [1, 2].map(() =>
          cash.safeMovement(merchant.id, 'owner:owner', safe.id, {
            requestId: randomUUID(),
            kind: 'withdrawal',
            amount: '200.00',
            reason: 'Bank deposit',
          }),
        ),
      );
      assert.equal(
        withdrawals.filter((row) => row.status === 'fulfilled').length,
        1,
        'concurrent withdrawals cannot overdraw safe',
      );

      const competing = await Promise.allSettled(
        [1, 2].map((index) =>
          cash.transferClosedCash(merchant.id, 'owner:owner', shift.id, {
            ...transferRequest,
            requestId: randomUUID(),
            amount: '150.00',
            reference: `CONCURRENT-${index}`,
          }),
        ),
      );
      assert.equal(
        competing.filter((row) => row.status === 'fulfilled').length,
        1,
        'cash cannot be handed over twice concurrently',
      );
      const opening = {
        registerId: register.id,
        requestId: randomUUID(),
        openingFloat: '50.00',
        sourceShiftId: shift.id,
      };
      const next = await shifts.openShift(receiver, opening);
      assert.equal((await shifts.openShift(receiver, opening)).id, next.id);
      await assert.rejects(
        shifts.openShift(receiver, { ...opening, sourceShiftId: undefined }),
        ConflictException,
      );
      const drawer = (await cash.drawers(merchant.id, { shiftId: shift.id })).items[0]!;
      assert.equal(drawer.remainingCash, '0.00');
      assert.equal(drawer.carriedForward, '50.00');
      assert.equal(drawer.receivedInSafe, '290.00');
      assert.equal(drawer.pendingAmount, '150.00');
      assert.equal(drawer.legacyDropAmount, '0.00');
      const drawerLedger = await cash.drawerLedger(merchant.id, shift.id, {});
      assert.equal(drawerLedger.items[0]?.balanceAfter, '0.00');
      assert.equal(drawerLedger.items.filter((row) => row.kind === 'cash_drop').length, 1);
      assert.equal(drawerLedger.items.filter((row) => row.kind === 'safe_transfer').length, 2);
      assert.equal(drawerLedger.items.filter((row) => row.kind === 'carryover').length, 1);
      await assert.rejects(cash.drawerLedger(foreign.id, shift.id, {}), NotFoundException);
      assert.deepEqual(
        await prisma.posShiftCloseReport.findFirstOrThrow({
          where: { shiftId: shift.id, merchantId: merchant.id },
        }),
        frozen,
        'later settlement never rewrites close report',
      );
      const ledger = await cash.safeLedger(merchant.id, safe.id, { limit: 2 });
      assert.equal(ledger.items.length, 2);
      assert.ok(ledger.nextCursor);
      assert.equal(ledger.items[0]?.balanceAfter, '110.00');
      const ledgerNext = await cash.safeLedger(merchant.id, safe.id, {
        limit: 2,
        cursor: ledger.nextCursor,
      });
      assert.ok(
        ledgerNext.items.every((row) => !ledger.items.some((prior) => prior.id === row.id)),
      );
      safeSummary = (await cash.listSafes(merchant.id, {})).items.find(
        (row) => row.id === safe.id,
      )!;
      assert.equal(safeSummary.balance, '110.00');
      assert.equal(
        (await cash.listSafes(foreign.id, {})).items.some((row) => row.id === safe.id),
        false,
      );
      transfers = await cash.listTransfers(merchant.id, { shiftId: shift.id });
      assert.equal(transfers.items.filter((row) => row.kind === 'carryover').length, 1);
      assert.equal(
        (await cash.listTransfers(merchant.id, { branchId: branch.id }, cashier)).items.length,
        4,
      );
      const receiverHandoffs = await cash.listTransfers(
        merchant.id,
        { branchId: branch.id },
        receiver,
      );
      assert.equal(
        receiverHandoffs.items.length,
        1,
        'employees only read their own handoffs or source-shift custody',
      );
      assert.equal(receiverHandoffs.items[0]?.kind, 'carryover');
      await prisma.posEmployee.update({ where: { id: receiver.id }, data: { active: false } });
      await assert.rejects(cash.employeeBranch(receiver, branch.id, true), ForbiddenException);
    } finally {
      // Delete only this test's isolated tenants and their records.
      await prisma.posCashSafeMovement.deleteMany({ where: { merchantId: { in: tenants } } });
      await prisma.posCashTransfer.deleteMany({ where: { merchantId: { in: tenants } } });
      await prisma.posCashSafe.deleteMany({ where: { merchantId: { in: tenants } } });
      await prisma.posShiftCloseReport.deleteMany({ where: { merchantId: { in: tenants } } });
      await prisma.posShiftManualCashMovement.deleteMany({
        where: { merchantId: { in: tenants } },
      });
      await prisma.posShift.deleteMany({ where: { merchantId: { in: tenants } } });
      await prisma.posRegister.deleteMany({ where: { merchantId: { in: tenants } } });
      await prisma.posEmployeeBranch.deleteMany({ where: { merchantId: { in: tenants } } });
      await prisma.posEmployee.deleteMany({ where: { merchantId: { in: tenants } } });
      await prisma.branch.deleteMany({ where: { merchantId: { in: tenants } } });
      await prisma.merchant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.$disconnect();
    }
  },
);
