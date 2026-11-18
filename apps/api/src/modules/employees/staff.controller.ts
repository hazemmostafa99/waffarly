/** Receives owner requests for HR staff records and optional POS-account links. */
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
import type { CursorPage, OwnerProfile, StaffMemberSummary } from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { StaffService } from './staff.service.js';
import {
  listStaffSchema,
  staffPosEmployeeOptionsSchema,
  type StaffListQuery,
} from './staff.schemas.js';

@UseGuards(OwnerGuard)
@Controller('owner/staff')
export class StaffController {
  constructor(@Inject(StaffService) private readonly staff: StaffService) {}

  @Get()
  list(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listStaffSchema, { format: 'messages' })) query: StaffListQuery,
  ): Promise<CursorPage<StaffMemberSummary>> {
    return this.staff.list(owner.merchantId, query);
  }

  @Get('pos-employee-options')
  posEmployeeOptions(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(staffPosEmployeeOptionsSchema, { format: 'messages' }))
    query: { branchId: string },
  ) {
    return this.staff.posEmployeeOptions(owner.merchantId, query.branchId);
  }

  @Post()
  create(@CurrentOwner() owner: OwnerProfile, @Body() input: unknown) {
    return this.staff.create(owner.merchantId, owner.username, input);
  }

  @Patch(':id')
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.staff.update(owner.merchantId, owner.username, id, input);
  }

  @Post(':id/pay-rates')
  addPayRate(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.staff.addPayRate(owner.merchantId, owner.username, id, input);
  }
}
