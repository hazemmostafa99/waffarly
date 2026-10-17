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
import type { CursorPage, OwnerProfile, PosEmployeeSummary } from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner } from './current-actor.js';
import { OwnerGuard } from './owner.guard.js';
import { PosEmployeeService } from './pos-employee.service.js';
import { listPosEmployeesSchema, type PosEmployeeListQuery } from './pos-employee.schemas.js';

@UseGuards(OwnerGuard)
@Controller('owner/employees')
export class PosEmployeesController {
  constructor(@Inject(PosEmployeeService) private readonly employees: PosEmployeeService) {}

  @Get()
  list(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listPosEmployeesSchema, { format: 'messages' }))
    query: PosEmployeeListQuery,
  ): Promise<CursorPage<PosEmployeeSummary>> {
    return this.employees.list(owner.merchantId, query);
  }

  @Post()
  create(@CurrentOwner() owner: OwnerProfile, @Body() body: unknown): Promise<PosEmployeeSummary> {
    return this.employees.create(owner.merchantId, owner.username, body);
  }

  @Patch(':id')
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<PosEmployeeSummary> {
    return this.employees.update(owner.merchantId, owner.username, id, body);
  }
}
