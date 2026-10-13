import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { MAX_MEDIA_SIZE_BYTES, isImageMimeType } from './catalog.constants.js';

export type RegisterMediaInput = {
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
};

@Injectable()
export class MediaService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(merchantId: string, createdBy: string, input: RegisterMediaInput) {
    if (!isImageMimeType(input.mimeType)) {
      throw new ConflictException('Only JPEG, PNG, and WebP images are supported.');
    }
    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_MEDIA_SIZE_BYTES) {
      throw new ConflictException('Image size must be greater than zero and at most 10 MB.');
    }
    try {
      return await this.prisma.mediaAsset.create({
        data: {
          merchantId,
          storageKey: input.storageKey.trim(),
          publicUrl: input.publicUrl.trim(),
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          createdBy,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('This media asset is already registered.');
      }
      throw error;
    }
  }

  async list(merchantId: string) {
    return this.prisma.mediaAsset.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
