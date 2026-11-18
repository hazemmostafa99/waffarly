/** Creates merchants and owners, reviews applications and assigns storefront addresses. */
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
  CreateMerchantRequest,
  CursorPage,
  MerchantApplicationSummary,
  MerchantSummary,
  PublicStorefrontAddress,
  RejectMerchantApplicationRequest,
  SubmitMerchantApplicationRequest,
} from '@waffarly/contracts';
import { randomUUID } from 'node:crypto';
import { type CursorPageQuery } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { hashPassword } from '../auth/index.js';
import { SubscriptionService } from '../subscriptions/index.js';
import { resolveStorefrontHandle } from './addresses/storefront-address.query.js';
import { listApplications } from './applications/merchant-applications.query.js';
import { toApplicationSummary, toMerchantSummary } from './merchant-record.mapper.js';
import { createStorefrontSlug } from './onboarding/storefront-slug.js';
import { listMerchants } from './queries/merchant-queries.js';
import { storefrontHandleSchema } from './storefront-address.schemas.js';

@Injectable()
export class MerchantService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional()
    @Inject(SubscriptionService)
    private readonly subscriptions: SubscriptionService = new SubscriptionService(prisma),
  ) {}

  async list(page: CursorPageQuery = { limit: 50 }): Promise<CursorPage<MerchantSummary>> {
    return listMerchants(this.prisma, page);
  }

  async resolveStorefrontSlug(slug: string): Promise<{ merchantId: string }> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
      throw new BadRequestException('Storefront address is invalid.');
    }
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');
    return { merchantId: merchant.id };
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
        return toMerchantSummary(merchant);
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
        if (current.storefrontHandle === handle) return toMerchantSummary(current);
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
        return toMerchantSummary({ ...current, storefrontHandle: handle });
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('Storefront handle is already in use.');
      throw error;
    }
  }

  async resolveStorefrontHandle(handle: string): Promise<PublicStorefrontAddress> {
    return resolveStorefrontHandle(this.prisma, handle);
  }

  async submitApplication(input: SubmitMerchantApplicationRequest): Promise<{ received: true }> {
    await this.prisma.merchantApplication.create({
      data: { ...input, activity: input.activity ?? 'other' },
    });
    return { received: true };
  }

  async listApplications(): Promise<MerchantApplicationSummary[]> {
    return listApplications(this.prisma);
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
        return toMerchantSummary(merchant);
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
