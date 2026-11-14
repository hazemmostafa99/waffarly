/** Receives owner requests to list, create and update cashier registers. */
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CreatePosRegisterRequest,
  CursorPage,
  OwnerProfile,
  PosRegisterSummary,
  UpdatePosRegisterRequest,
} from '@waffarly/contracts';
import { parseRequest, ZodValidationPipe } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../../auth/index.js';
import {
  createPosRegisterSchema,
  ownerPosRegisterListSchema,
  updatePosRegisterSchema,
} from '../../shifts.schemas.js';
import { ShiftsService } from '../../shifts.service.js';
@UseGuards(OwnerGuard)
@Controller('owner/pos/registers')
export class OwnerPosRegistersController {
  constructor(@Inject(ShiftsService) private readonly shifts: ShiftsService) {}

  @Get()
  list(
    @CurrentOwner() owner: OwnerProfile,
    @Query() query: unknown,
  ): Promise<CursorPage<PosRegisterSummary>> {
    return this.shifts.listOwnerRegisters(
      owner.merchantId,
      parseRequest(ownerPosRegisterListSchema, query),
    );
  }

  @Post()
  create(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(createPosRegisterSchema, { format: 'messages' }))
    input: CreatePosRegisterRequest,
  ): Promise<PosRegisterSummary> {
    return this.shifts.createRegister(owner.merchantId, owner.username, input);
  }

  @Patch(':id')
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePosRegisterSchema, { format: 'messages' }))
    input: UpdatePosRegisterRequest,
  ): Promise<PosRegisterSummary> {
    return this.shifts.updateRegister(owner.merchantId, owner.username, id, input);
  }
}
