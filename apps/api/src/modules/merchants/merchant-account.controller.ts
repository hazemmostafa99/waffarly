import { Body, Controller, Get, Inject, Patch, Query, UseGuards } from '@nestjs/common';
import type {
  OwnerProfile,
  MerchantAccountOverview,
  MerchantAccountProfile,
  OwnerSubscriptionHistory,
} from '@waffarly/contracts';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { MerchantAccountService } from './merchant-account.service.js';
import {
  ownerSubscriptionHistorySchema,
  updateMerchantAccountSchema,
} from './merchant-account.schemas.js';

@UseGuards(OwnerGuard)
@Controller('owner/account')
export class MerchantAccountController {
  constructor(@Inject(MerchantAccountService) private readonly account: MerchantAccountService) {}

  @Get()
  get(@CurrentOwner() owner: OwnerProfile): Promise<MerchantAccountOverview> {
    return this.account.get(owner.merchantId);
  }

  @Patch()
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Body() body: unknown,
  ): Promise<MerchantAccountProfile> {
    return this.account.update(
      owner.merchantId,
      owner.username,
      parseRequest(updateMerchantAccountSchema, body, { format: 'messages' }),
    );
  }

  @Get('subscription/periods')
  history(
    @CurrentOwner() owner: OwnerProfile,
    @Query() query: unknown,
  ): Promise<OwnerSubscriptionHistory> {
    const { cursor } = parseRequest(ownerSubscriptionHistorySchema, query);
    return this.account.history(owner.merchantId, cursor);
  }
}
