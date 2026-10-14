import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { RegisterCatalogMediaRequest } from '@waffarly/contracts';
import { AppConfiguration } from '../../config/app-configuration.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { MAX_MEDIA_SIZE_BYTES, isImageMimeType } from './catalog.constants.js';

export type RegisterMediaInput = RegisterCatalogMediaRequest;
export interface UploadMediaFile {
  buffer: Buffer;
  originalName: string;
}

const extensionByMimeType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

@Injectable()
export class MediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfiguration) private readonly config: AppConfiguration,
  ) {}

  async upload(merchantId: string, createdBy: string, file: UploadMediaFile) {
    if (file.buffer.length <= 0 || file.buffer.length > MAX_MEDIA_SIZE_BYTES) {
      throw new BadRequestException('Image size must be greater than zero and at most 10 MB.');
    }

    const mimeType = detectImageMimeType(file.buffer);
    if (!mimeType) {
      throw new BadRequestException('Upload a valid JPEG, PNG, or WebP image.');
    }

    const storageKey = createStorageKey(merchantId, file.originalName, mimeType);
    const storageRoot = resolve(this.config.mediaStorageDirectory);
    const filePath = resolve(storageRoot, ...storageKey.split('/'));
    const relativePath = relative(storageRoot, filePath);
    if (
      !relativePath ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new BadRequestException('Invalid upload path.');
    }

    await mkdir(dirname(filePath), { recursive: true, mode: 0o750 });
    let fileWritten = false;
    try {
      await writeFile(filePath, file.buffer, { flag: 'wx', mode: 0o640 });
      fileWritten = true;
      const publicUrl = new URL(
        `/media/${storageKey.split('/').map(encodeURIComponent).join('/')}`,
        this.config.publicApiBaseUrl,
      ).toString();
      return await this.prisma.mediaAsset.create({
        data: {
          merchantId,
          storageKey,
          publicUrl,
          mimeType,
          sizeBytes: file.buffer.length,
          createdBy,
        },
      });
    } catch (error) {
      if (fileWritten) await unlink(filePath).catch(() => undefined);
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('This media asset is already registered.');
      }
      throw error;
    }
  }

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

function detectImageMimeType(buffer: Buffer): keyof typeof extensionByMimeType | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
}

function createStorageKey(
  merchantId: string,
  originalName: string,
  mimeType: keyof typeof extensionByMimeType,
): string {
  const originalBaseName = originalName.split(/[\\/]/).at(-1) ?? '';
  const nameWithoutExtension = originalBaseName.replace(/\.[^.]*$/, '');
  const safeName = nameWithoutExtension
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  const fileName = `${safeName || 'image'}.${extensionByMimeType[mimeType]}`;
  return `${merchantId}/${randomUUID()}/${fileName}`;
}
