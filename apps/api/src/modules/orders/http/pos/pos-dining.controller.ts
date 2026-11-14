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
  CreatePosDiningTableRequest,
  CursorPage,
  MovePosDiningSessionRequest,
  OwnerProfile,
  PosDiningSessionSummary,
  PosDiningTableOption,
  PosDiningTableSummary,
  PosEmployeeSession,
  SplitPosOrderChecksRequest,
  SplitPosOrderChecksResponse,
  UpdatePosDiningTableRequest,
} from '@waffarly/contracts';
import { parseRequest, ZodValidationPipe } from '../../../../common/http/zod-validation.pipe.js';
import {
  CurrentOwner,
  CurrentPosEmployee,
  OwnerGuard,
  PosEmployeeGuard,
} from '../../../auth/index.js';
import {
  createPosDiningTableSchema,
  movePosDiningSessionSchema,
  ownerPosDiningTableListSchema,
  posDiningTableListSchema,
  splitPosOrderChecksSchema,
  updatePosDiningTableSchema,
} from '../../dining/pos-dining.schemas.js';
import { PosDiningService } from '../../dining/pos-dining.service.js';

@UseGuards(OwnerGuard)
@Controller('owner/pos/tables')
export class OwnerPosDiningTablesController {
  constructor(@Inject(PosDiningService) private readonly dining: PosDiningService) {}

  @Get()
  list(
    @CurrentOwner() owner: OwnerProfile,
    @Query() query: unknown,
  ): Promise<CursorPage<PosDiningTableSummary>> {
    return this.dining.listOwnerTables(
      owner.merchantId,
      parseRequest(ownerPosDiningTableListSchema, query),
    );
  }

  @Post()
  create(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(createPosDiningTableSchema, { format: 'messages' }))
    input: CreatePosDiningTableRequest,
  ): Promise<PosDiningTableSummary> {
    return this.dining.createTable(owner.merchantId, owner.username, input);
  }

  @Patch(':id')
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePosDiningTableSchema, { format: 'messages' }))
    input: UpdatePosDiningTableRequest,
  ): Promise<PosDiningTableSummary> {
    return this.dining.updateTable(owner.merchantId, owner.username, id, input);
  }
}

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
