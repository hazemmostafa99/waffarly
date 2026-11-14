/**
 * Receives cashier requests to view or move table sessions and divide order bills.
 */
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
import type {
  MovePosDiningSessionRequest,
  PosDiningSessionSummary,
  PosDiningTableOption,
  PosEmployeeSession,
  SplitPosOrderChecksRequest,
  SplitPosOrderChecksResponse,
} from '@waffarly/contracts';
import { parseRequest, ZodValidationPipe } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentPosEmployee, PosEmployeeGuard } from '../../../auth/index.js';
import {
  movePosDiningSessionSchema,
  posDiningTableListSchema,
  splitPosOrderChecksSchema,
} from '../../dining/pos-dining.schemas.js';
import { PosDiningService } from '../../dining/pos-dining.service.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/dining')
export class PosDiningController {
  constructor(@Inject(PosDiningService) private readonly dining: PosDiningService) {}

  @Get('tables')
  tables(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<PosDiningTableOption[]> {
    const parsed = parseRequest(posDiningTableListSchema, query);
    return this.dining.listTablesForEmployee(employee, parsed.branchId);
  }

  @Get('sessions')
  sessions(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<PosDiningSessionSummary[]> {
    const parsed = parseRequest(posDiningTableListSchema, query);
    return this.dining.listOpenSessionsForEmployee(employee, parsed.branchId);
  }

  @Post('sessions/:id/move')
  move(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(movePosDiningSessionSchema)) input: MovePosDiningSessionRequest,
  ): Promise<PosDiningSessionSummary> {
    return this.dining.moveSession(employee, id, input);
  }
}

@UseGuards(PosEmployeeGuard)
@Controller('pos/orders')
export class PosDiningOrdersController {
  constructor(@Inject(PosDiningService) private readonly dining: PosDiningService) {}

  @Post(':id/split-checks')
  split(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(splitPosOrderChecksSchema)) input: SplitPosOrderChecksRequest,
  ): Promise<SplitPosOrderChecksResponse> {
    return this.dining.splitOrder(employee, id, input);
  }
}
