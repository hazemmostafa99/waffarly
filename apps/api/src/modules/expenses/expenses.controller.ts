/** Receives owner requests to manage business expenses and private receipts. */
import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ExpenseMonthSummary, OwnerProfile } from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { ExpensesService } from './expenses.service.js';
import { expenseMonthSchema, listExpensesSchema } from './expenses.schemas.js';

interface ReceiptImage {
  buffer: Buffer;
  mimetype: string;
}

@UseGuards(OwnerGuard)
@Controller('owner/expenses')
export class ExpensesController {
  constructor(@Inject(ExpensesService) private readonly expenses: ExpensesService) {}

  @Get('categories')
  categories(@CurrentOwner() owner: OwnerProfile) {
    return this.expenses.categories(owner.merchantId);
  }

  @Get('summary')
  summary(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(expenseMonthSchema, { format: 'messages' }))
    query: { month: string },
  ): Promise<ExpenseMonthSummary> {
    return this.expenses.summary(owner.merchantId, query.month);
  }

  @Get()
  list(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listExpensesSchema, { format: 'messages' })) query: unknown,
  ) {
    return this.expenses.list(owner.merchantId, query);
  }

  @Post()
  create(@CurrentOwner() owner: OwnerProfile, @Body() input: unknown) {
    return this.expenses.create(owner.merchantId, owner.username, input);
  }

  @Patch(':id')
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.expenses.update(owner.merchantId, owner.username, id, input);
  }

  @Post(':id/payments')
  pay(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: unknown,
  ) {
    return this.expenses.pay(owner.merchantId, owner.username, id, input);
  }

  @Post(':id/receipt')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 4 * 1024 * 1024, files: 1, parts: 1 },
    }),
  )
  async uploadReceipt(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: ReceiptImage | undefined,
  ) {
    if (!file) throw new BadRequestException('Choose a receipt image to upload.');
    return this.expenses.uploadReceipt(owner.merchantId, owner.username, id, {
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
  }

  @Get(':id/receipt')
  async receipt(@CurrentOwner() owner: OwnerProfile, @Param('id', new ParseUUIDPipe()) id: string) {
    const receipt = await this.expenses.receipt(owner.merchantId, id);
    return new StreamableFile(receipt.buffer, {
      type: receipt.mimeType,
      disposition: 'inline',
    });
  }
}
