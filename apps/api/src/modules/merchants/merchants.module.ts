import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import {
  AdminMerchantApplicationController,
  PublicMerchantApplicationController,
} from './merchant-application.controller.js';
import { MerchantController } from './merchant.controller.js';
import { MerchantService } from './merchant.service.js';
import {
  OwnerPosAppearanceController,
  PosAppearanceController,
} from './pos-appearance.controller.js';
import { MerchantPosAppearanceService } from './merchant-pos-appearance.service.js';
@Module({
  imports: [AuthModule],
  controllers: [
    MerchantController,
    OwnerPosAppearanceController,
    PosAppearanceController,
    AdminMerchantApplicationController,
    PublicMerchantApplicationController,
  ],
  providers: [MerchantService, MerchantPosAppearanceService],
})
export class MerchantsModule {}
