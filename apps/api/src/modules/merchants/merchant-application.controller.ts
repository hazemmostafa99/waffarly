import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  type ApproveMerchantApplicationRequest,
  type MerchantApplicationSummary,
  type MerchantSummary,
  type RejectMerchantApplicationRequest,
  type SubmitMerchantApplicationRequest,
  BUSINESS_ACTIVITY_KEYS,
} from '@waffarly/contracts';

import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { AdminGuard, CurrentAdmin } from '../auth/index.js';
import { MerchantService } from './merchant.service.js';

const applicationSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    activity: z.enum(BUSINESS_ACTIVITY_KEYS).default('other'),
    contactPhone: z.string().trim().min(3).max(32),
    ownerName: z.string().trim().min(1).max(160),
    ownerMobile: z.string().trim().min(3).max(32),
  })
  .strict();

const approvalSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-zA-Z0-9._-]+$/),
    password: z.string().min(12).max(128),
  })
  .strict();

const rejectionSchema = z.object({ reason: z.string().trim().min(1) }).strict();

function validate<T>(schema: z.ZodType<T>, body: unknown, description: string): T {
  const result = parseRequest(schema, body, { format: 'messages', fallbackPath: description });
  return result;
}

@Controller('merchant-applications')
export class PublicMerchantApplicationController {
  constructor(@Inject(MerchantService) private readonly merchants: MerchantService) {}

  @Post()
  submit(@Body() body: unknown): Promise<{ received: true }> {
    return this.merchants.submitApplication(
      validate<SubmitMerchantApplicationRequest>(applicationSchema, body, 'application'),
    );
  }
}

@UseGuards(AdminGuard)
@Controller('admin/merchant-applications')
export class AdminMerchantApplicationController {
  constructor(@Inject(MerchantService) private readonly merchants: MerchantService) {}

  @Get()
  list(): Promise<MerchantApplicationSummary[]> {
    return this.merchants.listApplications();
  }

  @Post(':id/approve')
  async approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ): Promise<MerchantSummary> {
    const input = validate<ApproveMerchantApplicationRequest>(
      approvalSchema,
      body,
      'owner credentials',
    );
    return this.merchants.approveApplication(id, input, administrator);
  }

  @Post(':id/reject')
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentAdmin() administrator: string,
  ): Promise<MerchantApplicationSummary> {
    const input = validate<RejectMerchantApplicationRequest>(
      rejectionSchema,
      body,
      'rejection reason',
    );
    return this.merchants.rejectApplication(id, input, administrator);
  }
}
