/** Lists merchant applications with earlier matching rejections for administrator review. */
import type { MerchantApplicationSummary } from '@waffarly/contracts';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import {
  toApplicationSummary,
  toRejectedApplicationSummary,
  type MerchantApplicationRecord,
} from '../merchant-record.mapper.js';

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
