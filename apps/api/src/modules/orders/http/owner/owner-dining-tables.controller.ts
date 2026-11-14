/**
 * Receives owner requests to list, add and change dining tables.
 */
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
  OwnerProfile,
  PosDiningTableSummary,
  UpdatePosDiningTableRequest,
} from '@waffarly/contracts';
import { parseRequest, ZodValidationPipe } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../../auth/index.js';
import {
  createPosDiningTableSchema,
  ownerPosDiningTableListSchema,
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
