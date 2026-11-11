import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { PublicStorefrontAddress } from '@waffarly/contracts';
import { MerchantService } from './merchant.service.js';

@Controller('storefront-handles')
export class PublicStorefrontAddressController {
  constructor(@Inject(MerchantService) private readonly merchants: MerchantService) {}

  @Get(':handle')
  resolve(@Param('handle') handle: string): Promise<PublicStorefrontAddress> {
    return this.merchants.resolveStorefrontHandle(handle);
  }
}
