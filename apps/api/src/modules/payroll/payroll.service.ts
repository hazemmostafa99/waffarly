/** Calculates monthly payroll and records advances and pay against safe cash. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  AdvanceRepaymentPreview,
  PayrollAdjustmentSummary,
  PayrollEmployeePreview,
  PayrollLineSummary,
  PayrollRunSummary,
  StaffAdvanceSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { toCents } from '../../common/money/money.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { AttendanceService } from '../attendance/index.js';
import { StaffService } from '../employees/index.js';
import { recordSafeMovementInTransaction } from '../shifts/index.js';
import {
  addAmounts,
  calculateBasePay,
  minAmount,
  subtractAmount,
  type PayrollStaffSource,
} from './payroll.rules.js';
import {
  createPayrollAdjustmentSchema,
  createPayrollRunSchema,
  createStaffAdvanceSchema,
  formatMonth,
  listStaffAdvancesSchema,
  monthStartDate,
  recordPayrollPaymentSchema,
} from './payroll.schemas.js';

const payrollDetail = {
  lines: {
    orderBy: [{ employeeName: 'asc' as const }, { id: 'asc' as const }],
    include: { payments: { orderBy: [{ paidAt: 'asc' as const }, { id: 'asc' as const }] } },
  },
} satisfies Prisma.StaffPayrollRunInclude;

type PayrollRunWithLines = Prisma.StaffPayrollRunGetPayload<{
  include: typeof payrollDetail;
}>;
type TransactionClient = PrismaService | Prisma.TransactionClient;
type PayrollLineSnapshot = {
  adjustments: PayrollAdjustmentSummary[];
  advanceRepayments: AdvanceRepaymentPreview[];
};

@Injectable()
export class PayrollService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AttendanceService) private readonly attendance: AttendanceService,
    @Inject(StaffService) private readonly staff: StaffService,
  ) {}

  async month(merchantId: string, month: string): Promise<PayrollRunSummary | null> {
    const monthStart = monthStartDate(month);
    const run = await this.prisma.staffPayrollRun.findUnique({
      where: { merchantId_monthStart: { merchantId, monthStart } },
      include: payrollDetail,
    });
    return run ? this.toSummary(this.prisma, run) : null;
  }

  async createRun(merchantId: string, actor: string, input: unknown): Promise<PayrollRunSummary> {
    const parsed = parseRequest(createPayrollRunSchema, input);
    const monthStart = monthStartDate(parsed.month);
    const attendancePeriod = await this.attendance.approvedPeriod(merchantId, parsed.month);
    try {
      const run = await this.prisma.$transaction(async (tx) => {
        const currentPeriod = await tx.attendancePeriod.findFirst({
          where: { id: attendancePeriod.id, merchantId, status: 'approved', monthStart },
        });
        if (!currentPeriod)
          throw new ConflictException('Approve attendance for this month before creating payroll.');
        return tx.staffPayrollRun.upsert({
          where: { merchantId_monthStart: { merchantId, monthStart } },
          create: {
            merchantId,
            attendancePeriodId: currentPeriod.id,
            monthStart,
            createdBy: actor,
          },
          update: {},
          include: payrollDetail,
        });
      });
      return this.toSummary(this.prisma, run);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'Payroll for this month was started at the same time. Refresh.',
        );
      throw error;
    }
  }

  async getRun(merchantId: string, id: string): Promise<PayrollRunSummary> {
    const run = await this.prisma.staffPayrollRun.findFirst({
      where: { merchantId, id },
      include: payrollDetail,
    });
    if (!run) throw new NotFoundException('Payroll was not found.');
    return this.toSummary(this.prisma, run);
  }

  async addAdjustment(merchantId: string, actor: string, runId: string, input: unknown) {
    const parsed = parseRequest(createPayrollAdjustmentSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const run = await this.lockDraftRun(tx, merchantId, runId);
      const staffMember = await tx.staffMember.findFirst({
        where: {
          id: parsed.staffMemberId,
          merchantId,
          startDate: { lte: run.monthStart },
          OR: [{ endDate: null }, { endDate: { gte: run.monthStart } }],
        },
        select: { id: true },
      });
      if (!staffMember) throw new NotFoundException('Employee was not found.');
      await tx.staffPayrollAdjustment.create({
        data: {
          merchantId,
          payrollRunId: run.id,
          staffMemberId: staffMember.id,
          kind: parsed.kind,
          amount: parsed.amount,
          reason: parsed.reason,
          createdBy: actor,
        },
      });
      await this.draftLines(tx, merchantId, run.id, run.monthStart, run.attendancePeriodId);
    });
    return this.getRun(merchantId, runId);
  }

  async removeAdjustment(merchantId: string, runId: string, adjustmentId: string) {
    await this.prisma.$transaction(async (tx) => {
      const run = await this.lockDraftRun(tx, merchantId, runId);
      const adjustment = await tx.staffPayrollAdjustment.findFirst({
        where: { id: adjustmentId, merchantId, payrollRunId: run.id },
        select: { id: true },
      });
      if (!adjustment) throw new NotFoundException('Payroll adjustment was not found.');
      await tx.staffPayrollAdjustment.delete({ where: { id: adjustment.id } });
    });
    return this.getRun(merchantId, runId);
  }

  async approve(merchantId: string, actor: string, runId: string): Promise<PayrollRunSummary> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const run = await tx.staffPayrollRun.findFirst({ where: { id: runId, merchantId } });
          if (!run) throw new NotFoundException('Payroll was not found.');
          await tx.$queryRaw`SELECT "id" FROM "staff_payroll_runs" WHERE "id"=${run.id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
          const lockedRun = await tx.staffPayrollRun.findFirst({
            where: { id: run.id, merchantId },
          });
          if (!lockedRun) throw new NotFoundException('Payroll was not found.');
          if (lockedRun.status !== 'draft')
            throw new ConflictException('Only a draft payroll can be approved.');

          const previews = await this.draftLines(
            tx,
            merchantId,
            lockedRun.id,
            lockedRun.monthStart,
            lockedRun.attendancePeriodId,
          );
          for (const preview of previews) {
            const line = await tx.staffPayrollLine.create({
              data: {
                merchantId,
                payrollRunId: lockedRun.id,
                staffMemberId: preview.staffMemberId,
                employeeName: preview.employeeName,
                branchName: preview.branchName,
                branchId: preview.branchId,
                payBasis: preview.payBasis,
                presentDays: preview.presentDays,
                basePay: preview.basePay,
                additions: preview.additions,
                deductions: preview.deductions,
                advanceDeduction: preview.advanceDeduction,
                netDue: preview.netDue,
                snapshot: {
                  adjustments: preview.adjustments,
                  advanceRepayments: preview.advanceRepayments,
                  rateSnapshot: preview.rateSnapshot,
                } as unknown as Prisma.InputJsonValue,
              },
            });
            for (const repayment of preview.advanceRepayments) {
              await tx.staffAdvanceRepayment.create({
                data: {
                  merchantId,
                  advanceId: repayment.advanceId,
                  payrollLineId: line.id,
                  staffMemberId: preview.staffMemberId,
                  amount: repayment.amount,
                },
              });
            }
          }
          await tx.staffPayrollRun.update({
            where: { id: lockedRun.id },
            data: { status: 'approved', approvedBy: actor, approvedAt: new Date() },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'Payroll approval changed at the same time. Refresh and retry.',
        );
      throw error;
    }
    return this.getRun(merchantId, runId);
  }

  async advances(merchantId: string, input: unknown): Promise<StaffAdvanceSummary[]> {
    const query = parseRequest(listStaffAdvancesSchema, input);
    const advances = await this.prisma.staffAdvance.findMany({
      where: {
        merchantId,
        ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
      },
      include: {
        staffMember: { select: { displayName: true } },
        branch: { select: { id: true, name: true } },
        repayments: { select: { amount: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 250,
    });
    return advances
      .map(toAdvanceSummary)
      .filter((advance) => query.status === 'all' || toCents(advance.remainingBalance) > 0n);
  }

  async createAdvance(
    merchantId: string,
    actor: string,
    input: unknown,
  ): Promise<StaffAdvanceSummary> {
    const parsed = parseRequest(createStaffAdvanceSchema, input);
    const monthStart = monthStartDate(parsed.firstInstallmentMonth);
    const fingerprint = hash({ ...parsed });
    try {
      const advance = await this.prisma.$transaction(
        async (tx) => {
          const previous = await tx.staffAdvance.findUnique({
            where: { merchantId_requestId: { merchantId, requestId: parsed.requestId } },
            include: {
              staffMember: { select: { displayName: true } },
              branch: { select: { id: true, name: true } },
              repayments: { select: { amount: true } },
            },
          });
          if (previous) {
            if (previous.fingerprint !== fingerprint)
              throw new ConflictException(
                'This request ID was used with different advance details.',
              );
            return previous;
          }

          const staffMember = await tx.staffMember.findFirst({
            where: { id: parsed.staffMemberId, merchantId, active: true },
            select: { id: true, branchId: true, displayName: true },
          });
          if (!staffMember) throw new NotFoundException('Choose an active employee.');
          const movement = await recordSafeMovementInTransaction(tx, {
            merchantId,
            branchId: staffMember.branchId,
            safeId: parsed.safeId,
            requestId: parsed.requestId,
            actor,
            amount: parsed.amount,
            kind: 'withdrawal',
            purpose: 'hr_advance',
            reason: `Staff advance: ${parsed.reason}`,
          });
          return tx.staffAdvance.create({
            data: {
              merchantId,
              staffMemberId: staffMember.id,
              branchId: staffMember.branchId,
              requestId: parsed.requestId,
              fingerprint,
              cashMovementId: movement.id,
              amount: parsed.amount,
              installmentAmount: parsed.installmentAmount,
              firstInstallmentMonth: monthStart,
              reason: parsed.reason,
              createdBy: actor,
            },
            include: {
              staffMember: { select: { displayName: true } },
              branch: { select: { id: true, name: true } },
              repayments: { select: { amount: true } },
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
      return toAdvanceSummary(advance);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'Advance or cash record already exists. Refresh and retry the saved request.',
        );
      throw error;
    }
  }

  async recordPayment(
    merchantId: string,
    actor: string,
    lineId: string,
    input: unknown,
  ): Promise<PayrollRunSummary> {
    const parsed = parseRequest(recordPayrollPaymentSchema, input);
    const fingerprint = hash({ lineId, ...parsed });
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const prior = await tx.staffPayrollPayment.findUnique({
            where: { merchantId_requestId: { merchantId, requestId: parsed.requestId } },
          });
          if (prior) {
            if (prior.fingerprint !== fingerprint)
              throw new ConflictException(
                'This payment request ID was used with different details.',
              );
            return;
          }

          await tx.$queryRaw`SELECT "id" FROM "staff_payroll_lines" WHERE "id"=${lineId}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
          const line = await tx.staffPayrollLine.findFirst({
            where: { id: lineId, merchantId },
            include: {
              payrollRun: { select: { id: true, status: true } },
              payments: { select: { amount: true } },
            },
          });
          if (!line) throw new NotFoundException('Payroll line was not found.');
          if (!['approved', 'paid'].includes(line.payrollRun.status))
            throw new ConflictException('Approve payroll before recording a payment.');

          const paidSoFar = addAmounts(
            ...line.payments.map((payment) => payment.amount.toFixed(2)),
          );
          const remaining = subtractAmount(line.netDue.toFixed(2), paidSoFar);
          if (toCents(parsed.amount) > toCents(remaining))
            throw new ConflictException('The payment exceeds the employee’s remaining net pay.');

          const movement = await recordSafeMovementInTransaction(tx, {
            merchantId,
            branchId: line.branchId,
            safeId: parsed.safeId,
            requestId: parsed.requestId,
            actor,
            amount: parsed.amount,
            kind: 'withdrawal',
            purpose: 'hr_payroll',
            reason: `Payroll payment: ${parsed.reason}`,
          });
          await tx.staffPayrollPayment.create({
            data: {
              merchantId,
              payrollLineId: line.id,
              staffMemberId: line.staffMemberId,
              requestId: parsed.requestId,
              fingerprint,
              cashMovementId: movement.id,
              amount: parsed.amount,
              reason: parsed.reason,
              createdBy: actor,
            },
          });

          const lines = await tx.staffPayrollLine.findMany({
            where: { payrollRunId: line.payrollRun.id, merchantId },
            include: { payments: { select: { amount: true } } },
          });
          const fullyPaid = lines.every((payrollLine) => {
            const paid = addAmounts(
              ...payrollLine.payments.map((payment) => payment.amount.toFixed(2)),
              ...(payrollLine.id === line.id ? [parsed.amount] : []),
            );
            return toCents(paid) >= toCents(payrollLine.netDue.toFixed(2));
          });
          if (fullyPaid && lines.length > 0)
            await tx.staffPayrollRun.update({
              where: { id: line.payrollRun.id },
              data: { status: 'paid' },
            });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'Payment or cash record already exists. Refresh and retry the saved request.',
        );
      throw error;
    }
    const line = await this.prisma.staffPayrollLine.findFirst({
      where: { id: lineId, merchantId },
      select: { payrollRunId: true },
    });
    if (!line) throw new NotFoundException('Payroll line was not found.');
    return this.getRun(merchantId, line.payrollRunId);
  }

  private async lockDraftRun(tx: Prisma.TransactionClient, merchantId: string, runId: string) {
    const run = await tx.staffPayrollRun.findFirst({ where: { id: runId, merchantId } });
    if (!run) throw new NotFoundException('Payroll was not found.');
    await tx.$queryRaw`SELECT "id" FROM "staff_payroll_runs" WHERE "id"=${run.id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
    const locked = await tx.staffPayrollRun.findFirst({ where: { id: run.id, merchantId } });
    if (!locked) throw new NotFoundException('Payroll was not found.');
    if (locked.status !== 'draft')
      throw new ConflictException('Only draft payroll can be changed.');
    return locked;
  }

  private async draftLines(
    db: TransactionClient,
    merchantId: string,
    runId: string,
    monthStart: Date,
    attendancePeriodId: string,
  ): Promise<
    Array<
      PayrollEmployeePreview & { branchId: string; rateSnapshot: PayrollStaffSource['payRates'] }
    >
  > {
    const monthEnd = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
    );
    const period = await db.attendancePeriod.findFirst({
      where: { id: attendancePeriodId, merchantId, status: 'approved' },
      select: { id: true },
    });
    if (!period) throw new ConflictException('Attendance is not approved for this payroll month.');

    const staff = await this.staff.listForPeriod(merchantId, monthStart, monthEnd, undefined, db);
    const staffIds = staff.map((employee) => employee.id);
    const [attendance, adjustments, advances] = await Promise.all([
      db.staffAttendance.findMany({
        where: { merchantId, attendancePeriodId: period.id, staffMemberId: { in: staffIds } },
        select: { staffMemberId: true, attendanceDate: true, status: true },
      }),
      db.staffPayrollAdjustment.findMany({
        where: { merchantId, payrollRunId: runId, staffMemberId: { in: staffIds } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      db.staffAdvance.findMany({
        where: {
          merchantId,
          staffMemberId: { in: staffIds },
          firstInstallmentMonth: { lte: monthStart },
        },
        include: { repayments: { select: { amount: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const attendanceSources = attendance.map((entry) => ({
      staffMemberId: entry.staffMemberId,
      attendanceDate: toDateOnly(entry.attendanceDate),
      status: entry.status,
    }));
    return staff.map((employee) => {
      const source: PayrollStaffSource = {
        id: employee.id,
        displayName: employee.displayName,
        startDate: employee.startDate,
        endDate: employee.endDate,
        branch: employee.branch,
        payRates: employee.payRates.map((rate) => ({
          effectiveDate: rate.effectiveDate,
          basis: rate.basis,
          amount: rate.amount,
        })),
      };
      if (source.payRates.length === 0)
        throw new ConflictException(
          `${employee.displayName} needs a pay rate before payroll can be prepared.`,
        );
      const base = calculateBasePay(source, monthStart, monthEnd, attendanceSources);
      const employeeAdjustments = adjustments.filter((row) => row.staffMemberId === employee.id);
      const additionRows = employeeAdjustments.filter((row) => row.kind === 'addition');
      const deductionRows = employeeAdjustments.filter((row) => row.kind === 'deduction');
      const additions = addAmounts(...additionRows.map((row) => row.amount.toFixed(2)));
      const deductions = addAmounts(...deductionRows.map((row) => row.amount.toFixed(2)));
      const earnings = addAmounts(base.basePay, additions);
      if (toCents(deductions) > toCents(earnings))
        throw new ConflictException(
          `${employee.displayName}'s deductions exceed this month's earnings.`,
        );

      let available = subtractAmount(earnings, deductions);
      const advanceRepayments: AdvanceRepaymentPreview[] = [];
      for (const advance of advances.filter((row) => row.staffMemberId === employee.id)) {
        const repaid = addAmounts(
          ...advance.repayments.map((repayment) => repayment.amount.toFixed(2)),
        );
        const balance = subtractAmount(advance.amount.toFixed(2), repaid);
        if (toCents(balance) === 0n || toCents(available) === 0n) continue;
        const amount = minAmount(advance.installmentAmount.toFixed(2), balance, available);
        if (toCents(amount) === 0n) continue;
        available = subtractAmount(available, amount);
        advanceRepayments.push({
          advanceId: advance.id,
          amount,
          remainingBalance: subtractAmount(balance, amount),
        });
      }

      return {
        staffMemberId: employee.id,
        employeeName: employee.displayName,
        branchName: employee.branch.name,
        branchId: employee.branch.id,
        payBasis: base.payBasis,
        presentDays: base.presentDays,
        basePay: base.basePay,
        additions,
        deductions,
        advanceDeduction: addAmounts(...advanceRepayments.map((item) => item.amount)),
        netDue: available,
        adjustments: employeeAdjustments.map(toAdjustmentSummary),
        advanceRepayments,
        rateSnapshot: base.rateSnapshot,
      };
    });
  }

  private async toSummary(
    db: TransactionClient,
    run: PayrollRunWithLines,
  ): Promise<PayrollRunSummary> {
    const lines: PayrollLineSummary[] =
      run.status === 'draft'
        ? (
            await this.draftLines(
              db,
              run.merchantId,
              run.id,
              run.monthStart,
              run.attendancePeriodId,
            )
          ).map((preview) => ({
            ...toPayrollPreview(preview),
            id: preview.staffMemberId,
            paidAmount: '0.00',
            remainingAmount: preview.netDue,
            payments: [],
          }))
        : run.lines.map((line) => {
            const snapshot = line.snapshot as unknown as PayrollLineSnapshot;
            const paidAmount = addAmounts(
              ...line.payments.map((payment) => payment.amount.toFixed(2)),
            );
            const remainingAmount = subtractAmount(line.netDue.toFixed(2), paidAmount);
            return {
              id: line.id,
              staffMemberId: line.staffMemberId,
              branchId: line.branchId,
              employeeName: line.employeeName,
              branchName: line.branchName,
              payBasis: line.payBasis as PayrollLineSummary['payBasis'],
              presentDays: line.presentDays,
              basePay: line.basePay.toFixed(2),
              additions: line.additions.toFixed(2),
              deductions: line.deductions.toFixed(2),
              advanceDeduction: line.advanceDeduction.toFixed(2),
              netDue: line.netDue.toFixed(2),
              adjustments: snapshot.adjustments,
              advanceRepayments: snapshot.advanceRepayments,
              paidAmount,
              remainingAmount,
              payments: line.payments.map((payment) => ({
                id: payment.id,
                amount: payment.amount.toFixed(2),
                paidAt: payment.paidAt.toISOString(),
                reason: payment.reason,
              })),
            };
          });
    const totalDue = addAmounts(...lines.map((line) => line.netDue));
    const totalPaid = addAmounts(...lines.map((line) => line.paidAmount));
    return {
      id: run.id,
      month: formatMonth(run.monthStart),
      status: run.status as PayrollRunSummary['status'],
      approvedBy: run.approvedBy,
      approvedAt: run.approvedAt?.toISOString() ?? null,
      lines,
      totalDue,
      totalPaid,
      totalOutstanding: subtractAmount(totalDue, totalPaid),
    };
  }
}

function toPayrollPreview(
  preview: PayrollEmployeePreview & {
    rateSnapshot: PayrollStaffSource['payRates'];
  },
): PayrollEmployeePreview {
  return {
    staffMemberId: preview.staffMemberId,
    employeeName: preview.employeeName,
    branchName: preview.branchName,
    branchId: preview.branchId,
    payBasis: preview.payBasis,
    presentDays: preview.presentDays,
    basePay: preview.basePay,
    additions: preview.additions,
    deductions: preview.deductions,
    advanceDeduction: preview.advanceDeduction,
    netDue: preview.netDue,
    adjustments: preview.adjustments,
    advanceRepayments: preview.advanceRepayments,
  };
}

function toAdjustmentSummary(row: {
  id: string;
  staffMemberId: string;
  kind: string;
  amount: { toFixed: (digits: number) => string };
  reason: string;
  createdBy: string;
  createdAt: Date;
}): PayrollAdjustmentSummary {
  return {
    id: row.id,
    staffMemberId: row.staffMemberId,
    kind: row.kind as PayrollAdjustmentSummary['kind'],
    amount: row.amount.toFixed(2),
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAdvanceSummary(advance: {
  id: string;
  staffMemberId: string;
  branchId: string;
  amount: { toFixed: (digits: number) => string };
  installmentAmount: { toFixed: (digits: number) => string };
  firstInstallmentMonth: Date;
  reason: string;
  createdAt: Date;
  staffMember: { displayName: string };
  branch: { id: string; name: string };
  repayments: Array<{ amount: { toFixed: (digits: number) => string } }>;
}): StaffAdvanceSummary {
  const repaidAmount = addAmounts(...advance.repayments.map((item) => item.amount.toFixed(2)));
  return {
    id: advance.id,
    staffMemberId: advance.staffMemberId,
    employeeName: advance.staffMember.displayName,
    branchId: advance.branch.id,
    branchName: advance.branch.name,
    amount: advance.amount.toFixed(2),
    installmentAmount: advance.installmentAmount.toFixed(2),
    firstInstallmentMonth: formatMonth(advance.firstInstallmentMonth),
    reason: advance.reason,
    repaidAmount,
    remainingBalance: subtractAmount(advance.amount.toFixed(2), repaidAmount),
    createdAt: advance.createdAt.toISOString(),
  };
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
