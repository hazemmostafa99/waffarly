import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OwnerGuard } from './owner.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AdminGuard, OwnerGuard],
  exports: [AuthService, AdminGuard, OwnerGuard],
})
export class AuthModule {}
