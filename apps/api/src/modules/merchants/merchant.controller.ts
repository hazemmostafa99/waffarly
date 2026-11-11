import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { MerchantSummary } from '@waffarly/contracts';
import { BUSINESS_ACTIVITY_KEYS } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { parseCursorPageQuery } from '../../common/http/pagination.js';
import { AdminGuard, CurrentAdmin } from '../auth/index.js';
import { MerchantService } from './merchant.service.js';
import {
  assignStorefrontHandleSchema,
  storefrontHandleSchema,
} from './storefront-address.schemas.js';

const creationSchema = z.object({
  storefrontHandle: storefrontHandleSchema.optional(),
  subscription: z
    .object({
      planId: z.uuid(),
      months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal(24)]),
    })
    .strict()
    .optional(),
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

  @Put(':id/storefront-handle')
  assignStorefrontHandle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ): Promise<MerchantSummary> {
    const input = parseRequest(assignStorefrontHandleSchema, body, { format: 'messages' });
    return this.merchants.assignStorefrontHandle(id, input.handle, administrator);
  }

  @Get()
  list(@Query() query: unknown) {
    return this.merchants.list(parseCursorPageQuery(query));
  }

  @Post()
  async create(
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ): Promise<MerchantSummary> {
    const result = parseRequest(creationSchema, body, { format: 'messages' });
    return this.merchants.create(result, administrator);
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
