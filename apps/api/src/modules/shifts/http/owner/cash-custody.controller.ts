/** Receives owner requests about safes, drawers and cash handoffs. */
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { OwnerProfile } from '@waffarly/contracts';
import { CurrentOwner, OwnerGuard } from '../../../auth/index.js';

import { CashCustodyService } from '../../cash-custody.service.js';
@UseGuards(OwnerGuard)
@Controller('owner/pos/cash')
export class OwnerCashCustodyController {
  constructor(@Inject(CashCustodyService) private readonly cash: CashCustodyService) {}
  @Get('safes')
  safes(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.cash.listSafes(owner.merchantId, query);
  }
  @Post('safes')
  createSafe(@CurrentOwner() owner: OwnerProfile, @Body() input: unknown) {
    return this.cash.createSafe(owner.merchantId, `owner:${owner.username}`, input);
  }
  @Get('drawers')
  drawers(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.cash.drawers(owner.merchantId, query);
  }
  @Get('drawers/:id/movements')
  drawerLedger(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: unknown,
  ) {
    return this.cash.drawerLedger(owner.merchantId, id, query);
  }
  @Get('transfers')
  transfers(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.cash.listTransfers(owner.merchantId, query);
  }
  @Post('shifts/:id/transfers')
  transfer(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.cash.transferClosedCash(owner.merchantId, `owner:${owner.username}`, id, input);
  }
  @Post('transfers/:id/receive')
  receive(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.cash.receive(owner.merchantId, `owner:${owner.username}`, id, input);
  }
  @Post('transfers/:id/resolve')
  resolve(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.cash.resolve(owner.merchantId, `owner:${owner.username}`, id, input);
  }
  @Get('safes/:id/movements')
  ledger(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: unknown,
  ) {
    return this.cash.safeLedger(owner.merchantId, id, query);
  }
  @Post('safes/:id/movements')
  movement(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.cash.safeMovement(owner.merchantId, `owner:${owner.username}`, id, input);
  }
}
