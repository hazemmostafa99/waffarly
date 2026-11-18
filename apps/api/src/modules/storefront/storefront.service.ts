import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  MerchantStorefrontSettings,
  SaveMerchantStorefrontRequest,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

const defaultPrimary = '#0f705a';
const defaultAccent = '#f5b544';
const defaultBackground = '#faf8f4';
const defaultSurface = '#ffffff';

function imageSource(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('src' in value)) return null;
  return typeof value.src === 'string' ? value.src : null;
}

function logoScale(value: string | undefined): MerchantStorefrontSettings['logoScale'] {
  return value === 'small' || value === 'large' ? value : 'medium';
}

@Injectable()
export class StorefrontService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSettings(merchantId: string): Promise<MerchantStorefrontSettings> {
    const merchant = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: {
        storefrontSlug: true,
        storefrontHandle: true,
        restaurantProfile: { select: { logoImage: true, coverImage: true } },
      },
    });
    const selected = await this.prisma.merchantStorefront.findUnique({ where: { merchantId } });
    return {
      merchantId,
      storefrontSlug: merchant.storefrontSlug,
      storefrontHandle: merchant.storefrontHandle ?? null,
      layout: selected?.layout === 'menu' ? 'menu' : 'hero',
      primaryColor: selected?.primaryColor ?? defaultPrimary,
      accentColor: selected?.accentColor ?? defaultAccent,
      backgroundColor: selected?.backgroundColor ?? defaultBackground,
      surfaceColor: selected?.surfaceColor ?? defaultSurface,
      logoScale: logoScale(selected?.logoScale),
      logoData: imageSource(merchant.restaurantProfile?.logoImage) ?? selected?.logoData ?? null,
      coverImageUrl: imageSource(merchant.restaurantProfile?.coverImage),
      revision: selected?.revision ?? 0,
    };
  }

  async saveSettings(
    merchantId: string,
    input: SaveMerchantStorefrontRequest,
  ): Promise<MerchantStorefrontSettings> {
    if (input.logoData?.startsWith('data:')) {
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
      const current = await transaction.merchantStorefront.findUnique({ where: { merchantId } });
      if (
        merchant.activity !== 'restaurant' &&
        input.logoData &&
        !input.logoData.startsWith('data:') &&
        current?.logoData !== input.logoData
      ) {
        const uploadedLogo = await transaction.mediaAsset.findFirst({
          where: { merchantId, publicUrl: input.logoData },
          select: { id: true },
        });
        if (!uploadedLogo) {
          throw new BadRequestException('Upload the logo to this business account before saving it.');
        }
      }
      if (!current) {
        if (input.revision !== 0) {
          throw new ConflictException('Storefront settings changed. Reload before saving again.');
        }
        await transaction.merchantStorefront.create({
          data: {
            merchantId,
            layout: input.layout,
            primaryColor: input.primaryColor,
            accentColor: input.accentColor,
            backgroundColor: input.backgroundColor,
            surfaceColor: input.surfaceColor,
            logoScale: input.logoScale,
            logoData: merchant.activity === 'restaurant' ? null : input.logoData,
          },
        });
        return;
      }

      const updated = await transaction.merchantStorefront.updateMany({
        where: { merchantId, revision: input.revision },
        data: {
          layout: input.layout,
          primaryColor: input.primaryColor,
          accentColor: input.accentColor,
          backgroundColor: input.backgroundColor,
          surfaceColor: input.surfaceColor,
          logoScale: input.logoScale,
          ...(merchant.activity === 'restaurant' ? {} : { logoData: input.logoData }),
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
