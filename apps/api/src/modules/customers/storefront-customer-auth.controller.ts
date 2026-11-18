/** Exposes a tenant's isolated customer sign-up and session endpoints. */
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type {
  CustomerSignInRequest,
  CustomerSignUpRequest,
  StorefrontCustomerProfile,
} from '@waffarly/contracts';
import type { Request, Response } from 'express';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { customerSignInSchema, customerSignUpSchema } from '../auth/index.js';
import { StorefrontCustomerAuthService } from './storefront-customer-auth.service.js';

@Controller('auth/stores/:slug/customer')
export class StorefrontCustomerAuthController {
  constructor(
    @Inject(StorefrontCustomerAuthService)
    private readonly customers: StorefrontCustomerAuthService,
  ) {}

  @Post('sign-up')
  @Header('Cache-Control', 'no-store')
  signUp(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StorefrontCustomerProfile> {
    return this.customers.signUp(
      slug,
      parseRequest(customerSignUpSchema, body) as CustomerSignUpRequest,
      request,
      response,
    );
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  login(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StorefrontCustomerProfile> {
    return this.customers.signIn(
      slug,
      parseRequest(customerSignInSchema, body) as CustomerSignInRequest,
      request,
      response,
    );
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Param('slug') slug: string, @Req() request: Request): Promise<StorefrontCustomerProfile> {
    return this.customers.me(slug, request);
  }

  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  logout(
    @Param('slug') slug: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.customers.logout(slug, request, response);
  }
}
