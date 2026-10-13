import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { MerchantSummary } from '@waffarly/contracts';
import { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { MerchantService } from './merchant.service.js';

const creationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  contactPhone: z.string().trim().min(3).max(32),
  ownerName: z.string().trim().min(1).max(160),
  ownerMobile: z.string().trim().min(3).max(32),
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(12).max(128),
});

@UseGuards(AdminGuard)
@Controller('admin/merchants')
export class MerchantController {
  constructor(
    @Inject(MerchantService) private readonly merchants: MerchantService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  list(): Promise<MerchantSummary[]> {
    return this.merchants.list();
  }

  @Post()
  async create(@Body() body: unknown): Promise<MerchantSummary> {
    const result = creationSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
    }
    return this.merchants.create(result.data);
  }

  @Post(':id/activate-first-month')
  @HttpCode(200)
  async activateFirstMonth(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<MerchantSummary> {
    const result = z.object({ externalCollectionConfirmed: z.literal(true) }).safeParse(body);
    if (!result.success) {
      throw new BadRequestException('Confirm external collection before activation.');
    }
    const administrator = await this.auth.requireAdmin(request);
    return this.merchants.activateFirstMonth(id, administrator);
  }
}
