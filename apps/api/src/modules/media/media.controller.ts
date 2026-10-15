import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { OwnerProfile } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { MAX_MEDIA_SIZE_BYTES } from './media.constants.js';
import { MediaService } from './media.service.js';

interface MultipartImageFile {
  buffer: Buffer;
  originalname: string;
}

const mediaSchema = z.object({
  storageKey: z.string().trim().min(1).max(255),
  publicUrl: z.string().trim().url().max(2000).refine(isHttpUrl, {
    message: 'Media URL must use HTTP or HTTPS.',
  }),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().positive(),
});

@UseGuards(OwnerGuard)
@Controller('owner/catalog/media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get()
  async list(@CurrentOwner() owner: OwnerProfile) {
    return (await this.media.list(owner.merchantId)).map(toMediaResponse);
  }

  @Post()
  async register(@CurrentOwner() owner: OwnerProfile, @Body() body: unknown) {
    const parsed = parseRequest(mediaSchema, body);
    return toMediaResponse(await this.media.register(owner.merchantId, owner.username, parsed));
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_MEDIA_SIZE_BYTES, files: 1, parts: 1 },
    }),
  )
  async upload(
    @CurrentOwner() owner: OwnerProfile,
    @UploadedFile() file: MultipartImageFile | undefined,
  ) {
    if (!file) throw new BadRequestException('Choose an image file to upload.');
    return toMediaResponse(
      await this.media.upload(owner.merchantId, owner.username, {
        buffer: file.buffer,
        originalName: file.originalname,
      }),
    );
  }
}

function toMediaResponse(asset: {
  id: string;
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}) {
  return {
    id: asset.id,
    storageKey: asset.storageKey,
    publicUrl: asset.publicUrl,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    createdAt: asset.createdAt.toISOString(),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
