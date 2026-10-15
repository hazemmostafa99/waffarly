import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import type {
  MerchantStorefrontSettings,
  OwnerProfile,
  SaveMerchantStorefrontRequest,
} from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { saveSchema } from './storefront.schemas.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { StorefrontService } from './storefront.service.js';

@UseGuards(OwnerGuard)
@Controller('auth/owner/storefront')
export class StorefrontController {
  constructor(@Inject(StorefrontService) private readonly storefront: StorefrontService) {}

  @Get()
  async get(@CurrentOwner() owner: OwnerProfile): Promise<MerchantStorefrontSettings> {
    return this.storefront.getSettings(owner.merchantId);
  }

  @Patch()
  async update(
    @Body(new ZodValidationPipe(saveSchema, { format: 'messages' }))
    input: SaveMerchantStorefrontRequest,
    @CurrentOwner() owner: OwnerProfile,
  ): Promise<MerchantStorefrontSettings> {
    return this.storefront.saveSettings(owner.merchantId, input);
  }
}
