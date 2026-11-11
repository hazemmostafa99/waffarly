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
import type { OwnerProfile } from '@waffarly/contracts';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import {
  createCustomerSchema,
  customerListSchema,
  updateCustomerSchema,
} from './customer.schemas.js';
import { CustomersService } from './customers.service.js';

@UseGuards(OwnerGuard)
@Controller('owner/customers')
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}
  @Get()
  list(@CurrentOwner() owner: OwnerProfile, @Query() query: unknown) {
    return this.customers.list(owner.merchantId, parseRequest(customerListSchema, query));
  }
  @Get(':id')
  get(@CurrentOwner() owner: OwnerProfile, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(owner.merchantId, id);
  }
  @Post()
  create(@CurrentOwner() owner: OwnerProfile, @Body() body: unknown) {
    return this.customers.create(
      owner.merchantId,
      owner.username,
      parseRequest(createCustomerSchema, body),
    );
  }
  @Patch(':id')
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.customers.update(
      owner.merchantId,
      owner.username,
      id,
      parseRequest(updateCustomerSchema, body),
    );
  }
}
