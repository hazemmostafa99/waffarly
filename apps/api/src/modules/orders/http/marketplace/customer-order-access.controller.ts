import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { CustomerOrderAccessService } from '../../customers/customer-order-access.service.js';
@Controller('customer/orders')
export class CustomerOrderAccessController {
  constructor(
    @Inject(CustomerOrderAccessService) private readonly access: CustomerOrderAccessService,
  ) {}
  @Post('session')
  @Header('Cache-Control', 'no-store')
  prepare(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.access.prepare(request, response);
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: Request, @Query() query: unknown) {
    const page = parseRequest(z.object({ cursor: z.string().uuid().optional() }).strict(), query);
    return this.access.list(request, page.cursor);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Req() request: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.access.detail(request, id);
  }
  @Post(':id/claim')
  @Header('Cache-Control', 'no-store')
  claim(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    parseRequest(z.object({}).strict(), body);
    return this.access.claim(request, id);
  }
}
