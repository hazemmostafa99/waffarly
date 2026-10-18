import {
  Body,
  Controller,
  ForbiddenException,
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
  PosEmployeeSession,
  PosRegisterOption,
  PosRegisterSummary,
  PosShiftSummary,
  UpdatePosRegisterRequest,
} from '@waffarly/contracts';
import { parseRequest, ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, CurrentPosEmployee, OwnerGuard, PosEmployeeGuard } from '../auth/index.js';
import {
  createPosRegisterSchema,
  openPosShiftSchema,
  ownerPosRegisterListSchema,
  posCurrentShiftSchema,
  posRegisterListSchema,
  updatePosRegisterSchema,
} from './shifts.schemas.js';
import { ShiftsService } from './shifts.service.js';

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

@UseGuards(PosEmployeeGuard)
@Controller('pos')
export class PosShiftsController {
  constructor(@Inject(ShiftsService) private readonly shifts: ShiftsService) {}

  @Get('registers')
  listRegisters(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<PosRegisterOption[]> {
    requireShiftPermission(employee);
    return this.shifts.listForEmployee(employee, parseRequest(posRegisterListSchema, query));
  }

  @Get('shifts/current')
  currentShift(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<PosShiftSummary | null> {
    requireShiftPermission(employee);
    const parsed = parseRequest(posCurrentShiftSchema, query);
    return this.shifts.getCurrentShift(employee, parsed.registerId);
  }

  @Post('shifts/open')
  openShift(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Body() input: unknown,
  ): Promise<PosShiftSummary> {
    requireShiftPermission(employee);
    return this.shifts.openShift(employee, parseRequest(openPosShiftSchema, input));
  }
}

function requireShiftPermission(employee: PosEmployeeSession): void {
  if (!employee.permissions.includes('open_register_shift')) {
    throw new ForbiddenException('This employee is not authorized to use register shifts.');
  }
}
