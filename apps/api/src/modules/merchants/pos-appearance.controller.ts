import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import type { OwnerProfile, PosAppearanceSummary, PosEmployeeSession } from '@waffarly/contracts';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, CurrentPosEmployee, OwnerGuard, PosEmployeeGuard } from '../auth/index.js';
import { MerchantPosAppearanceService } from './merchant-pos-appearance.service.js';
import { updatePosAppearanceSchema } from './pos-appearance.schemas.js';

@UseGuards(OwnerGuard)
@Controller('owner/merchant/pos-appearance')
export class OwnerPosAppearanceController {
  constructor(
    @Inject(MerchantPosAppearanceService) private readonly appearance: MerchantPosAppearanceService,
  ) {}

  @Get()
  get(@CurrentOwner() owner: OwnerProfile): Promise<PosAppearanceSummary> {
    return this.appearance.get(owner.merchantId);
  }

  @Patch()
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Body() body: unknown,
  ): Promise<PosAppearanceSummary> {
    const input = parseRequest(updatePosAppearanceSchema, body, { format: 'messages' });
    return this.appearance.update(owner.merchantId, owner.username, input);
  }
}

@UseGuards(PosEmployeeGuard)
@Controller('pos/appearance')
export class PosAppearanceController {
  constructor(
    @Inject(MerchantPosAppearanceService) private readonly appearance: MerchantPosAppearanceService,
  ) {}

  @Get()
  get(@CurrentPosEmployee() employee: PosEmployeeSession): Promise<PosAppearanceSummary> {
    return this.appearance.get(employee.merchantId);
  }
}
