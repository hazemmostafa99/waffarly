/** Exposes owner password resets only to authenticated Super Admins. */
import {
  Body,
  Controller,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ResetMerchantOwnerPasswordRequest,
  ResetMerchantOwnerPasswordResponse,
} from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AdminGuard } from './admin.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentAdmin } from './current-actor.js';
import { resetMerchantOwnerPasswordSchema } from './owner-password-reset.schemas.js';

@UseGuards(AdminGuard)
@Controller('admin/merchants')
export class OwnerPasswordResetController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post(':merchantId/owner-password/reset')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  reset(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @CurrentAdmin() administrator: string,
    @Body(new ZodValidationPipe(resetMerchantOwnerPasswordSchema, { format: 'messages' }))
    input: ResetMerchantOwnerPasswordRequest,
  ): Promise<ResetMerchantOwnerPasswordResponse> {
    return this.auth.resetMerchantOwnerPassword(merchantId, administrator, input);
  }
}
