import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  MerchantStorefrontSettings,
  SaveMerchantStorefrontRequest,
  StorefrontTemplateSummary,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

const defaultAccent = '#315b43';

function templateSummary(record: {
  id: string;
  key: string;
  name: string;
  description: string;
  activity: string;
  layout: string;
  accentColor: string;
  status: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}): StorefrontTemplateSummary {
  return {
    ...record,
    activity: record.activity as StorefrontTemplateSummary['activity'],
    layout: record.layout as StorefrontTemplateSummary['layout'],
    status: record.status as StorefrontTemplateSummary['status'],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class StorefrontService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSettings(merchantId: string): Promise<MerchantStorefrontSettings> {
    const merchant = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: { activity: true, storefrontSlug: true, storefrontHandle: true },
    });
    const [selected, available] = await Promise.all([
      this.prisma.merchantStorefront.findUnique({ where: { merchantId } }),
      this.prisma.storefrontTemplate.findMany({
        where: {
          activity: { in: ['general', merchant.activity] },
          OR: [{ status: 'available' }, { merchants: { some: { merchantId } } }],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return {
      merchantId,
      storefrontSlug: merchant.storefrontSlug,
      storefrontHandle: merchant.storefrontHandle ?? null,
      templateId: selected?.templateId ?? null,
      accentColor: selected?.accentColor ?? defaultAccent,
      logoData: selected?.logoData ?? null,
      revision: selected?.revision ?? 0,
      templates: available.map(templateSummary),
    };
  }

  async saveSettings(
    merchantId: string,
    input: SaveMerchantStorefrontRequest,
  ): Promise<MerchantStorefrontSettings> {
    if (input.logoData) {
      const encoded = input.logoData.slice(input.logoData.indexOf(',') + 1);
      const logoBytes = Buffer.from(encoded, 'base64');
      if (logoBytes.length > 48 * 1024) {
        throw new BadRequestException('Logo files must be 48 KB or smaller.');
      }
      if (logoBytes.toString('base64') !== encoded) {
        throw new BadRequestException('Upload a valid PNG, JPG, or WebP image.');
      }
      const mime = input.logoData.slice('data:'.length, input.logoData.indexOf(';'));
      const signatureMatches =
        (mime === 'image/png' &&
          logoBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
        (mime === 'image/jpeg' &&
          logoBytes.length >= 3 &&
          logoBytes[0] === 0xff &&
          logoBytes[1] === 0xd8 &&
          logoBytes[2] === 0xff) ||
        (mime === 'image/webp' &&
          logoBytes.toString('ascii', 0, 4) === 'RIFF' &&
          logoBytes.toString('ascii', 8, 12) === 'WEBP');
      if (!signatureMatches) {
        throw new BadRequestException('Upload a valid PNG, JPG, or WebP image.');
      }
    }

    await this.prisma.$transaction(async (transaction) => {
      const merchant = await transaction.merchant.findUniqueOrThrow({ where: { id: merchantId } });
      const template = await transaction.storefrontTemplate.findFirst({
        where: {
          id: input.templateId,
          status: 'available',
          activity: { in: ['general', merchant.activity] },
        },
        select: { id: true },
      });
      if (!template) {
        throw new BadRequestException('Choose an available design for your business activity.');
      }

      const current = await transaction.merchantStorefront.findUnique({ where: { merchantId } });
      if (!current) {
        if (input.revision !== 0) {
          throw new ConflictException('Storefront settings changed. Reload before saving again.');
        }
        await transaction.merchantStorefront.create({
          data: {
            merchantId,
            templateId: template.id,
            accentColor: input.accentColor,
            logoData: input.logoData,
          },
        });
        return;
      }

      const updated = await transaction.merchantStorefront.updateMany({
        where: { merchantId, revision: input.revision },
        data: {
          templateId: template.id,
          accentColor: input.accentColor,
          logoData: input.logoData,
          revision: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Storefront settings changed. Reload before saving again.');
      }
    });

    return this.getSettings(merchantId);
  }
}
