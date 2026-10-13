import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApproveMerchantApplicationRequest,
  BusinessActivityKey,
  CreateMerchantRequest,
  MerchantApplicationSummary,
  MerchantSummary,
  RejectedMerchantApplicationSummary,
  RejectMerchantApplicationRequest,
  SubmitMerchantApplicationRequest,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { hashPassword } from '../auth/password.js';

type MerchantWithOwner = {
  id: string;
  name: string;
  activity?: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  firstMonthActivatedAt: Date | null;
  createdAt: Date;
  owner: { username: string } | null;
};

function toSummary(merchant: MerchantWithOwner): MerchantSummary {
  return {
    id: merchant.id,
    name: merchant.name,
    activity: (merchant.activity ?? 'other') as BusinessActivityKey,
    contactPhone: merchant.contactPhone,
    ownerName: merchant.ownerName,
    ownerMobile: merchant.ownerMobile,
    username: merchant.owner?.username ?? '',
    firstMonthActivatedAt: merchant.firstMonthActivatedAt?.toISOString() ?? null,
    createdAt: merchant.createdAt.toISOString(),
  };
}

type MerchantApplicationRecord = {
  id: string;
  name: string;
  activity?: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  createdAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  merchantId: string | null;
};

function toRejectedApplicationSummary(
  application: MerchantApplicationRecord,
): RejectedMerchantApplicationSummary {
  if (!application.rejectedAt || !application.rejectedBy || application.rejectionReason === null) {
    throw new Error('Rejected application is missing rejection metadata.');
  }
  return {
    id: application.id,
    name: application.name,
    activity: (application.activity ?? 'other') as BusinessActivityKey,
    contactPhone: application.contactPhone,
    ownerName: application.ownerName,
    ownerMobile: application.ownerMobile,
    createdAt: application.createdAt.toISOString(),
    approvedAt: application.approvedAt?.toISOString() ?? null,
    approvedBy: application.approvedBy,
    merchantId: application.merchantId,
    rejectedAt: application.rejectedAt.toISOString(),
    rejectedBy: application.rejectedBy,
    rejectionReason: application.rejectionReason,
  };
}

function toApplicationSummary(
  application: MerchantApplicationRecord,
  priorRejectedApplications: RejectedMerchantApplicationSummary[] = [],
): MerchantApplicationSummary {
  return {
    id: application.id,
    name: application.name,
    activity: (application.activity ?? 'other') as BusinessActivityKey,
    contactPhone: application.contactPhone,
    ownerName: application.ownerName,
    ownerMobile: application.ownerMobile,
    createdAt: application.createdAt.toISOString(),
    approvedAt: application.approvedAt?.toISOString() ?? null,
    approvedBy: application.approvedBy,
    merchantId: application.merchantId,
    rejectedAt: application.rejectedAt?.toISOString() ?? null,
    rejectedBy: application.rejectedBy,
    rejectionReason: application.rejectionReason,
    priorRejectedApplications,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class MerchantService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<MerchantSummary[]> {
    const merchants = await this.prisma.merchant.findMany({
      include: { owner: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return merchants.map(toSummary);
  }

  async create(input: CreateMerchantRequest): Promise<MerchantSummary> {
    const username = input.username.trim().toLowerCase();
    const existing = await this.prisma.ownerAccount.findUnique({ where: { username } });
    if (existing) throw new ConflictException('Username is already in use.');

    try {
      const merchant = await this.prisma.merchant.create({
        data: {
          name: input.name.trim(),
          activity: input.activity ?? 'other',
          contactPhone: input.contactPhone.trim(),
          ownerName: input.ownerName.trim(),
          ownerMobile: input.ownerMobile.trim(),
          owner: {
            create: { username, passwordHash: await hashPassword(input.password) },
          },
        },
        include: { owner: { select: { username: true } } },
      });
      return toSummary(merchant);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Username is already in use.');
      }
      throw error;
    }
  }

  async submitApplication(input: SubmitMerchantApplicationRequest): Promise<{ received: true }> {
    await this.prisma.merchantApplication.create({
      data: { ...input, activity: input.activity ?? 'other' },
    });
    return { received: true };
  }

  async listApplications(): Promise<MerchantApplicationSummary[]> {
    const applications: MerchantApplicationRecord[] =
      await this.prisma.merchantApplication.findMany({
        orderBy: { createdAt: 'desc' },
      });

    const rejectedByBusinessPhone = new Map<string, MerchantApplicationRecord[]>();
    const rejectedByOwnerMobile = new Map<string, MerchantApplicationRecord[]>();
    for (const application of applications) {
      if (!application.rejectedAt) continue;
      const businessMatches = rejectedByBusinessPhone.get(application.contactPhone) ?? [];
      businessMatches.push(application);
      rejectedByBusinessPhone.set(application.contactPhone, businessMatches);
      const ownerMatches = rejectedByOwnerMobile.get(application.ownerMobile) ?? [];
      ownerMatches.push(application);
      rejectedByOwnerMobile.set(application.ownerMobile, ownerMatches);
    }

    return applications.map((application) => {
      const matches = new Map<string, MerchantApplicationRecord>();
      for (const previous of [
        ...(rejectedByBusinessPhone.get(application.contactPhone) ?? []),
        ...(rejectedByOwnerMobile.get(application.ownerMobile) ?? []),
      ]) {
        if (
          previous.id !== application.id &&
          previous.createdAt.getTime() <= application.createdAt.getTime()
        ) {
          matches.set(previous.id, previous);
        }
      }
      return toApplicationSummary(
        application,
        [...matches.values()].map(toRejectedApplicationSummary),
      );
    });
  }

  async rejectApplication(
    applicationId: string,
    input: RejectMerchantApplicationRequest,
    administratorUsername: string,
  ): Promise<MerchantApplicationSummary> {
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException('A rejection reason is required.');
    const rejected = await this.prisma.$transaction(async (transaction) => {
      const application = await transaction.merchantApplication.findUnique({
        where: { id: applicationId },
      });
      if (!application) throw new NotFoundException('Application was not found.');
      if (application.approvedAt || application.merchantId || application.rejectedAt) {
        throw new ConflictException('Application has already been processed.');
      }

      const changed = await transaction.merchantApplication.updateMany({
        where: {
          id: applicationId,
          approvedAt: null,
          merchantId: null,
          rejectedAt: null,
        },
        data: {
          rejectedAt: new Date(),
          rejectedBy: administratorUsername,
          rejectionReason: reason,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('Application has already been processed.');
      }
      return transaction.merchantApplication.findUniqueOrThrow({
        where: { id: applicationId },
      });
    });
    return toApplicationSummary(rejected);
  }

  async approveApplication(
    applicationId: string,
    input: ApproveMerchantApplicationRequest,
    administratorUsername: string,
  ): Promise<MerchantSummary> {
    const username = input.username.trim().toLowerCase();
    const passwordHash = await hashPassword(input.password);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const application = await transaction.merchantApplication.findUnique({
          where: { id: applicationId },
        });
        if (!application) throw new NotFoundException('Application was not found.');
        if (application.approvedAt || application.merchantId || application.rejectedAt) {
          throw new ConflictException('Application has already been processed.');
        }

        const reserved = await transaction.merchantApplication.updateMany({
          where: { id: applicationId, approvedAt: null, merchantId: null, rejectedAt: null },
          data: { approvedAt: new Date(), approvedBy: administratorUsername },
        });
        if (reserved.count !== 1) {
          throw new ConflictException('Application has already been processed.');
        }

        const merchant = await transaction.merchant.create({
          data: {
            name: application.name,
            activity: application.activity ?? 'other',
            contactPhone: application.contactPhone,
            ownerName: application.ownerName,
            ownerMobile: application.ownerMobile,
            application: { connect: { id: applicationId } },
            owner: { create: { username, passwordHash } },
          },
          include: { owner: { select: { username: true } } },
        });
        return toSummary(merchant);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Username is already in use.');
      }
      throw error;
    }
  }

  async activateFirstMonth(
    merchantId: string,
    administratorUsername: string,
  ): Promise<MerchantSummary> {
    const changed = await this.prisma.merchant.updateMany({
      where: { id: merchantId, firstMonthActivatedAt: null },
      data: {
        firstMonthActivatedAt: new Date(),
        firstMonthActivatedBy: administratorUsername,
      },
    });
    if (changed.count === 0) {
      const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
      if (!merchant) throw new NotFoundException('Merchant was not found.');
      throw new ConflictException('First month has already been activated.');
    }
    const merchant = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      include: { owner: { select: { username: true } } },
    });
    return toSummary(merchant);
  }
}
