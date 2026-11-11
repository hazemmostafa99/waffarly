import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { OwnerProfile } from '@waffarly/contracts';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { createDiscountSchema, discountListSchema, updateDiscountSchema } from './discount.schemas.js';
import { DiscountsService } from './discounts.service.js';

@UseGuards(OwnerGuard)
@Controller('owner/discounts')
export class DiscountsController {
  constructor(@Inject(DiscountsService) private readonly discounts: DiscountsService) {}
  @Get() list(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.discounts.list(owner.merchantId, parseRequest(discountListSchema, query));
  }
  @Get('stats') stats(@CurrentOwner() owner: OwnerProfile) { return this.discounts.stats(owner.merchantId); }
  @Get('branches') branches(@CurrentOwner() owner: OwnerProfile) { return this.discounts.branches(owner.merchantId); }
  @Get(':id') get(@CurrentOwner() owner: OwnerProfile, @Param('id', ParseUUIDPipe) id: string) {
    return this.discounts.get(owner.merchantId, id);
  }
  @Post() create(@CurrentOwner() owner: OwnerProfile, @Body() body: unknown) {
    return this.discounts.create(owner.merchantId, owner.username, parseRequest(createDiscountSchema, body));
  }
  @Patch(':id') update(@CurrentOwner() owner: OwnerProfile, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.discounts.update(owner.merchantId, owner.username, id, parseRequest(updateDiscountSchema, body));
  }
}
