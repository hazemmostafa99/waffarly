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
import { SubscriptionsModule } from '../subscriptions/index.js';
import { MerchantAccountController } from './merchant-account.controller.js';
import { MerchantAccountService } from './merchant-account.service.js';
@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [
    MerchantAccountController,
    MerchantController,
    OwnerPosAppearanceController,
    PosAppearanceController,
    AdminMerchantApplicationController,
    PublicMerchantApplicationController,
  ],
  providers: [MerchantService, MerchantPosAppearanceService, MerchantAccountService],
})
export class MerchantsModule {}
