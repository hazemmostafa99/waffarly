import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AuthService } from './auth.service.js';
import { StorefrontController } from './storefront.controller.js';
import { StorefrontService } from './storefront.service.js';
import { OwnerGuard } from './owner.guard.js';

@Module({
  controllers: [AuthController, StorefrontController],
  providers: [AuthService, AdminGuard, OwnerGuard, StorefrontService],
  exports: [AuthService, AdminGuard, OwnerGuard],
})
export class AuthModule {}
