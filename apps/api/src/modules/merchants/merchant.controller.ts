import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { MerchantSummary } from '@waffarly/contracts';
import { BUSINESS_ACTIVITY_KEYS } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { AdminGuard, CurrentAdmin } from '../auth/index.js';
import { MerchantService } from './merchant.service.js';

const creationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  activity: z.enum(BUSINESS_ACTIVITY_KEYS).default('other'),
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
  constructor(@Inject(MerchantService) private readonly merchants: MerchantService) {}

  @Get()
  list(): Promise<MerchantSummary[]> {
    return this.merchants.list();
  }

  @Post()
  async create(@Body() body: unknown): Promise<MerchantSummary> {
    const result = parseRequest(creationSchema, body, { format: 'messages' });
    return this.merchants.create(result);
  }

  @Post(':id/activate-first-month')
  @HttpCode(200)
  async activateFirstMonth(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ): Promise<MerchantSummary> {
    parseRequest(z.object({ externalCollectionConfirmed: z.literal(true) }), body, {
      message: 'Confirm external collection before activation.',
    });
    return this.merchants.activateFirstMonth(id, administrator);
  }
}
