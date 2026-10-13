import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MerchantController } from './merchant.controller.js';
import { MerchantService } from './merchant.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MerchantController],
  providers: [MerchantService],
})
export class SuperAdminModule {}
