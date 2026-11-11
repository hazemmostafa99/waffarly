import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  ApproveMerchantApplicationRequest,
  BusinessActivityKey,
  CreateMerchantRequest,
  MerchantApplicationSummary,
  MerchantSummary,
  CursorPage,
  RejectedMerchantApplicationSummary,
  RejectMerchantApplicationRequest,
  SubmitMerchantApplicationRequest,
} from '@waffarly/contracts';
import { randomUUID } from 'node:crypto';
import { isStorefrontHandle, type PublicStorefrontAddress } from '@waffarly/contracts';
import { storefrontHandleSchema } from './storefront-address.schemas.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { assertScopedCursor, type CursorPageQuery } from '../../common/http/pagination.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { hashPassword } from '../auth/index.js';
import { SubscriptionService, effectiveSubscriptionStatus } from '../subscriptions/index.js';

type MerchantWithOwner = {
  id: string;
  name: string;
  storefrontSlug: string;
  storefrontHandle?: string | null;
  activity?: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  firstMonthActivatedAt: Date | null;
  createdAt: Date;
  owner: { username: string } | null;
  subscription?: { status: string; periods: { id: string }[] } | null;
};

function toSummary(merchant: MerchantWithOwner): MerchantSummary {
  return {
    id: merchant.id,
    name: merchant.name,
    businessCode: merchant.storefrontSlug,
    storefrontHandle: merchant.storefrontHandle ?? null,
    activity: (merchant.activity ?? 'other') as BusinessActivityKey,
    contactPhone: merchant.contactPhone,
    ownerName: merchant.ownerName,
    ownerMobile: merchant.ownerMobile,
    username: merchant.owner?.username ?? '',
    firstMonthActivatedAt: merchant.firstMonthActivatedAt?.toISOString() ?? null,
    subscriptionStatus: merchant.subscription
      ? effectiveSubscriptionStatus(
          merchant.subscription.status,
          merchant.subscription.periods.length > 0,
        )
      : merchant.firstMonthActivatedAt
        ? 'legacy'
        : 'pending',
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

@Injectable()
export class MerchantService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional()
    @Inject(SubscriptionService)
    private readonly subscriptions: SubscriptionService = new SubscriptionService(prisma),
  ) {}

  async list(page: CursorPageQuery = { limit: 50 }): Promise<CursorPage<MerchantSummary>> {
    if (page.cursor) {
      const anchor = await this.prisma.merchant.findUnique({
        where: { id: page.cursor },
        select: { id: true },
      });
      assertScopedCursor(page.cursor, anchor !== null);
    }
    const merchants = await this.prisma.merchant.findMany({
      include: {
        owner: { select: { username: true } },
        subscription: {
          select: {
            status: true,
            periods: {
              where: { startsAt: { lte: new Date() }, coverageEndsAt: { gt: new Date() } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });
    const hasMore = merchants.length > page.limit;
    const items = merchants.slice(0, page.limit).map(toSummary);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async create(
    input: CreateMerchantRequest,
    administrator = 'super-admin',
  ): Promise<MerchantSummary> {
    const storefrontHandle =
      input.storefrontHandle === undefined
        ? undefined
        : parseRequest(storefrontHandleSchema, input.storefrontHandle);
    const username = input.username.trim().toLowerCase();
    const existing = await this.prisma.ownerAccount.findUnique({ where: { username } });
    if (existing) throw new ConflictException('Username is already in use.');

    try {
      const id = randomUUID();
      const passwordHash = await hashPassword(input.password);
      return await this.prisma.$transaction(async (tx) => {
        const merchant = await tx.merchant.create({
          data: {
            id,
            name: input.name.trim(),
            storefrontSlug: createStorefrontSlug(input.name, id),
            ...(storefrontHandle
              ? {
                  storefrontHandle,
                  storefrontHandleAssignedAt: new Date(),
                  storefrontHandleAssignedBy: administrator,
                }
              : {}),
            activity: input.activity ?? 'other',
            contactPhone: input.contactPhone.trim(),
            ownerName: input.ownerName.trim(),
            ownerMobile: input.ownerMobile.trim(),
            owner: {
              create: { username, passwordHash },
            },
          },
          include: { owner: { select: { username: true } } },
        });
        if (input.subscription)
          await this.subscriptions.assignOnboarding(tx, id, input.subscription, administrator);
        return toSummary(merchant);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Username or storefront handle is already in use.');
      }
      throw error;
    }
  }

  async assignStorefrontHandle(
    id: string,
    input: string,
    administrator: string,
  ): Promise<MerchantSummary> {
    const handle = parseRequest(storefrontHandleSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.merchant.findUnique({
          where: { id },
          include: {
            owner: { select: { username: true } },
            subscription: {
              select: {
                status: true,
                periods: {
                  where: { startsAt: { lte: new Date() }, coverageEndsAt: { gt: new Date() } },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        });
        if (!current) throw new NotFoundException('Merchant was not found.');
        if (current.storefrontHandle === handle) return toSummary(current);
        if (current.storefrontHandle !== null) {
          throw new ConflictException(
            'This merchant already has a storefront address. Address changes are not supported.',
          );
        }
        const result = await tx.merchant.updateMany({
          where: { id, storefrontHandle: null },
          data: {
            storefrontHandle: handle,
            storefrontHandleAssignedAt: new Date(),
            storefrontHandleAssignedBy: administrator,
          },
        });
        if (result.count !== 1)
          throw new ConflictException('The storefront address changed. Refresh and try again.');
        return toSummary({ ...current, storefrontHandle: handle });
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('Storefront handle is already in use.');
      throw error;
    }
  }

  async resolveStorefrontHandle(handle: string): Promise<PublicStorefrontAddress> {
    // Public lookup exposes only the same public identifier already used in catalog URLs.
    if (!isStorefrontHandle(handle)) throw new NotFoundException('Storefront was not found.');
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontHandle: handle },
      select: { storefrontSlug: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');
    return { handle, storefrontSlug: merchant.storefrontSlug };
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

        const id = randomUUID();
        const merchant = await transaction.merchant.create({
          data: {
            id,
            name: application.name,
            storefrontSlug: createStorefrontSlug(application.name, id),
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
    // Historical timestamp activation cannot create paid coverage or bypass suspension.
    void merchantId;
    void administratorUsername;
    throw new ConflictException('Activate a priced subscription from subscription management.');
  }
}

function createStorefrontSlug(name: string, id: string): string {
  const namePart = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return `${namePart || 'store'}-${id.replaceAll('-', '').toLocaleLowerCase('en')}`;
}
