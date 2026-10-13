import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMerchantRequest, MerchantSummary } from '@waffarly/contracts';
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
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
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
