import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type {
  ApproveMerchantApplicationRequest,
  MerchantApplicationSummary,
  MerchantSummary,
  SubmitMerchantApplicationRequest,
} from '@waffarly/contracts';
import { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { MerchantService } from './merchant.service.js';

const applicationSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
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

function validate<T>(schema: z.ZodType<T>, body: unknown, description: string): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(
      result.error.issues.map(
        (issue) => `${issue.path.join('.') || description}: ${issue.message}`,
      ),
    );
  }
  return result.data;
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
  constructor(
    @Inject(MerchantService) private readonly merchants: MerchantService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  list(): Promise<MerchantApplicationSummary[]> {
    return this.merchants.listApplications();
  }

  @Post(':id/approve')
  async approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<MerchantSummary> {
    const input = validate<ApproveMerchantApplicationRequest>(
      approvalSchema,
      body,
      'owner credentials',
    );
    return this.merchants.approveApplication(id, input, await this.auth.requireAdmin(request));
  }
}
