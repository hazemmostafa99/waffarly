import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { z } from 'zod';
import { OwnerGuard } from '../auth/owner.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { MAX_MEDIA_SIZE_BYTES } from './catalog.constants.js';
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
  constructor(
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const owner = await this.auth.requireOwner(request);
    return (await this.media.list(owner.merchantId)).map(toMediaResponse);
  }

  @Post()
  async register(@Req() request: Request, @Body() body: unknown) {
    const parsed = mediaSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const owner = await this.auth.requireOwner(request);
    return toMediaResponse(
      await this.media.register(owner.merchantId, owner.username, parsed.data),
    );
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_MEDIA_SIZE_BYTES, files: 1, parts: 1 },
    }),
  )
  async upload(@Req() request: Request, @UploadedFile() file: MultipartImageFile | undefined) {
    if (!file) throw new BadRequestException('Choose an image file to upload.');
    const owner = await this.auth.requireOwner(request);
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
