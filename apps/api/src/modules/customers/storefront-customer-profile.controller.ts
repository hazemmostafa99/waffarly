/** Exposes authenticated customer profile and saved-address actions for one storefront. */
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type {
  CreateStorefrontCustomerAddressRequest,
  DeleteStorefrontCustomerAddressRequest,
  StorefrontCustomerAddress,
  StorefrontCustomerProfile,
  UpdateStorefrontCustomerAddressRequest,
  UpdateStorefrontCustomerProfileRequest,
} from '@waffarly/contracts';
import type { Request } from 'express';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { StorefrontCustomerProfileService } from './storefront-customer-profile.service.js';
import {
  createStorefrontCustomerAddressSchema,
  deleteStorefrontCustomerAddressSchema,
  updateStorefrontCustomerAddressSchema,
  updateStorefrontCustomerProfileSchema,
  storefrontCustomerAddressIdSchema,
} from './storefront-customer.schemas.js';

@Controller('auth/stores/:slug/customer')
export class StorefrontCustomerProfileController {
  constructor(
    @Inject(StorefrontCustomerProfileService)
    private readonly customers: StorefrontCustomerProfileService,
  ) {}

  @Patch('profile')
  @Header('Cache-Control', 'no-store')
  updateProfile(
    @Param('slug') slug: string,
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<StorefrontCustomerProfile> {
    const input = parseRequest(
      updateStorefrontCustomerProfileSchema,
      body,
    ) as UpdateStorefrontCustomerProfileRequest;
    return this.customers.updateProfile(slug, request, input);
  }

  @Get('addresses')
  @Header('Cache-Control', 'no-store')
  listAddresses(
    @Param('slug') slug: string,
    @Req() request: Request,
  ): Promise<StorefrontCustomerAddress[]> {
    return this.customers.listAddresses(slug, request);
  }

  @Post('addresses')
  @Header('Cache-Control', 'no-store')
  createAddress(
    @Param('slug') slug: string,
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<StorefrontCustomerAddress> {
    const input = parseRequest(
      createStorefrontCustomerAddressSchema,
      body,
    ) as CreateStorefrontCustomerAddressRequest;
    return this.customers.createAddress(slug, request, input);
  }

  @Patch('addresses/:addressId')
  @Header('Cache-Control', 'no-store')
  updateAddress(
    @Param('slug') slug: string,
    @Param('addressId') id: string,
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<StorefrontCustomerAddress> {
    const addressId = parseRequest(storefrontCustomerAddressIdSchema, id);
    const input = parseRequest(
      updateStorefrontCustomerAddressSchema,
      body,
    ) as UpdateStorefrontCustomerAddressRequest;
    return this.customers.updateAddress(slug, request, addressId, input);
  }

  @Delete('addresses/:addressId')
  @Header('Cache-Control', 'no-store')
  deleteAddress(
    @Param('slug') slug: string,
    @Param('addressId') id: string,
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<{ deleted: true }> {
    const addressId = parseRequest(storefrontCustomerAddressIdSchema, id);
    const input = parseRequest(
      deleteStorefrontCustomerAddressSchema,
      body,
    ) as DeleteStorefrontCustomerAddressRequest;
    return this.customers.deleteAddress(slug, request, addressId, input);
  }
}
