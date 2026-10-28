import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminGuard, CurrentAdmin } from '../auth/index.js';
import {
  SubscriptionService,
  subscriptionQuoteSchema,
  subscriptionCommandSchema,
} from '../subscriptions/index.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';

const listing = z
  .object({
    cursor: z.uuid().optional(),
    q: z.string().trim().max(160).optional(),
    status: z.enum(['pending', 'active', 'suspended', 'cancelled', 'expired', 'legacy']).optional(),
    expiring: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    planId: z.uuid().optional(),
  })
  .strict();

@UseGuards(AdminGuard)
@Controller('admin/subscriptions')
export class SubscriptionsController {
  constructor(@Inject(SubscriptionService) private readonly subscriptions: SubscriptionService) {}
  @Get() list(@Query() query: unknown) {
    return this.subscriptions.list(parseRequest(listing, query));
  }
  @Get('dashboard') dashboard() {
    return this.subscriptions.dashboard();
  }
  @Get(':id') detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.subscriptions.detail(id);
  }
  @Get(':id/history/:kind')
  history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('kind') kind: string,
    @Query() query: unknown,
  ) {
    const parsedKind = parseRequest(z.enum(['periods', 'events']), kind);
    const parsed = parseRequest(z.object({ cursor: z.uuid().optional() }).strict(), query);
    return this.subscriptions.history(id, parsedKind, parsed.cursor);
  }
  @Post(':id/quote')
  @HttpCode(200)
  quote(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.subscriptions.quote(id, parseRequest(subscriptionQuoteSchema, body));
  }
  @Post(':id/actions')
  @HttpCode(200)
  command(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentAdmin() admin: string,
  ) {
    return this.subscriptions.command(id, parseRequest(subscriptionCommandSchema, body), admin);
  }
}
