import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateMonthlyPlanRequest,
  MonthlyPlanSettings,
  MonthlyPlanSummary,
  UpdateMonthlyPlanRequest,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { requireEgpCurrency } from '../../common/money/money.js';

type PlanRecord = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: { toFixed: (digits: number) => string };
  currency: string;
  billingInterval: string;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

function toSummary(record: PlanRecord): MonthlyPlanSummary {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    monthlyPrice: record.monthlyPrice.toFixed(2),
    currency: requireEgpCurrency(record.currency),
    billingInterval: 'monthly',
    revision: record.revision,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function sameCreation(
  record: PlanRecord,
  input: MonthlyPlanSettings,
  administrator: string,
): boolean {
  return (
    record.revision === 1 &&
    record.createdBy === administrator &&
    record.name === input.name &&
    record.description === input.description &&
    record.monthlyPrice.toFixed(2) === input.monthlyPrice &&
    record.currency === input.currency
  );
}

@Injectable()
export class PlanService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<MonthlyPlanSummary[]> {
    return (
      await this.prisma.monthlyPlan.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      })
    ).map(toSummary);
  }

  async create(
    input: CreateMonthlyPlanRequest,
    administrator: string,
  ): Promise<MonthlyPlanSummary> {
    if (input.currency !== 'EGP') throw new BadRequestException('Plan currency must be EGP.');
    const { requestId, ...settings } = input;
    try {
      return toSummary(
        await this.prisma.monthlyPlan.create({
          data: {
            ...settings,
            creationRequest: requestId,
            createdBy: administrator,
            updatedBy: administrator,
          },
        }),
      );
    } catch (cause) {
      if (
        typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        cause.code === 'P2002'
      ) {
        const existing = await this.prisma.monthlyPlan.findUnique({
          where: { creationRequest: requestId },
        });
        if (existing && sameCreation(existing, settings, administrator)) return toSummary(existing);
        throw new ConflictException(
          'This creation request has already been used. Reload plans before creating another plan.',
        );
      }
      throw cause;
    }
  }

  async update(
    id: string,
    input: UpdateMonthlyPlanRequest,
    administrator: string,
  ): Promise<MonthlyPlanSummary> {
    if (input.currency !== 'EGP') throw new BadRequestException('Plan currency must be EGP.');
    const { revision, ...settings } = input;
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.monthlyPlan.updateMany({
        where: { id, revision },
        data: { ...settings, revision: { increment: 1 }, updatedBy: administrator },
      });
      if (changed.count !== 1) {
        const existing = await transaction.monthlyPlan.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Plan was not found.');
        throw new ConflictException(
          'Plan changed since you opened it. Reload plans before editing again.',
        );
      }
      return toSummary(await transaction.monthlyPlan.findUniqueOrThrow({ where: { id } }));
    });
  }
}
