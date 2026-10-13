import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AdminGuard],
  exports: [AuthService, AdminGuard],
})
export class AuthModule {}
