import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type {
  MerchantStorefrontSettings,
  SaveMerchantStorefrontRequest,
} from '@waffarly/contracts';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { OwnerGuard } from './owner.guard.js';
import { StorefrontService } from './storefront.service.js';

const saveSchema = z
  .object({
    templateId: z.string().uuid(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .transform((value) => value.toLowerCase()),
    logoData: z
      .string()
      .max(65_570)
      .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/)
      .nullable(),
    revision: z.number().int().min(0).max(2147483646),
  })
  .strict();

@UseGuards(OwnerGuard)
@Controller('auth/owner/storefront')
export class StorefrontController {
  constructor(
    @Inject(StorefrontService) private readonly storefront: StorefrontService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  async get(@Req() request: Request): Promise<MerchantStorefrontSettings> {
    const owner = await this.auth.requireOwner(request);
    return this.storefront.getSettings(owner.merchantId);
  }

  @Patch()
  async update(
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<MerchantStorefrontSettings> {
    const result = saveSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
    }
    const owner = await this.auth.requireOwner(request);
    const input: SaveMerchantStorefrontRequest = result.data;
    return this.storefront.saveSettings(owner.merchantId, input);
  }
}
