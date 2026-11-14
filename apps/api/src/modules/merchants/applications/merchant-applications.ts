/** Receives merchant applications, shows prior rejections and records approval or rejection. */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type {
  ApproveMerchantApplicationRequest,
  MerchantApplicationSummary,
  MerchantSummary,
  RejectMerchantApplicationRequest,
  SubmitMerchantApplicationRequest,
} from '@waffarly/contracts';
import { randomUUID } from 'node:crypto';

import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { hashPassword } from '../../auth/index.js';

import {
  toMerchantSummary,
  type MerchantApplicationRecord,
  toRejectedApplicationSummary,
  toApplicationSummary,
} from '../merchant-record.mapper.js';

import { createStorefrontSlug } from '../onboarding/storefront-slug.js';

export async function submitApplication(
  prisma: PrismaService,
  input: SubmitMerchantApplicationRequest,
): Promise<{ received: true }> {
  await prisma.merchantApplication.create({
    data: { ...input, activity: input.activity ?? 'other' },
  });
  return { received: true };
}

export async function listApplications(
  prisma: PrismaService,
): Promise<MerchantApplicationSummary[]> {
  const applications: MerchantApplicationRecord[] = await prisma.merchantApplication.findMany({
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

export async function rejectApplication(
  prisma: PrismaService,
  applicationId: string,
  input: RejectMerchantApplicationRequest,
  administratorUsername: string,
): Promise<MerchantApplicationSummary> {
  const reason = input.reason.trim();
  if (!reason) throw new BadRequestException('A rejection reason is required.');
  const rejected = await prisma.$transaction(async (transaction) => {
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

export async function approveApplication(
  prisma: PrismaService,
  applicationId: string,
  input: ApproveMerchantApplicationRequest,
  administratorUsername: string,
): Promise<MerchantSummary> {
  const username = input.username.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.$transaction(async (transaction) => {
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
