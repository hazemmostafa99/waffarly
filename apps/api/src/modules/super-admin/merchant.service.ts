import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApproveMerchantApplicationRequest,
  CreateMerchantRequest,
  MerchantApplicationSummary,
  MerchantSummary,
  SubmitMerchantApplicationRequest,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { hashPassword } from '../auth/password.js';

type MerchantWithOwner = {
  id: string;
  name: string;
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
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  createdAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  merchantId: string | null;
};

function toApplicationSummary(application: MerchantApplicationRecord): MerchantApplicationSummary {
  return {
    id: application.id,
    name: application.name,
    contactPhone: application.contactPhone,
    ownerName: application.ownerName,
    ownerMobile: application.ownerMobile,
    createdAt: application.createdAt.toISOString(),
    approvedAt: application.approvedAt?.toISOString() ?? null,
    approvedBy: application.approvedBy,
    merchantId: application.merchantId,
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
    await this.prisma.merchantApplication.create({ data: input });
    return { received: true };
  }

  async listApplications(): Promise<MerchantApplicationSummary[]> {
    const applications = await this.prisma.merchantApplication.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return applications.map(toApplicationSummary);
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
        if (application.approvedAt || application.merchantId) {
          throw new ConflictException('Application has already been approved.');
        }

        const reserved = await transaction.merchantApplication.updateMany({
          where: { id: applicationId, approvedAt: null, merchantId: null },
          data: { approvedAt: new Date(), approvedBy: administratorUsername },
        });
        if (reserved.count !== 1) {
          throw new ConflictException('Application has already been approved.');
        }

        const merchant = await transaction.merchant.create({
          data: {
            name: application.name,
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
