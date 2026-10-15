import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import {
  AdminMerchantApplicationController,
  PublicMerchantApplicationController,
} from './merchant-application.controller.js';
import { MerchantController } from './merchant.controller.js';
import { MerchantService } from './merchant.service.js';
@Module({
  imports: [AuthModule],
  controllers: [
    MerchantController,
    AdminMerchantApplicationController,
    PublicMerchantApplicationController,
  ],
  providers: [MerchantService],
})
export class MerchantsModule {}
