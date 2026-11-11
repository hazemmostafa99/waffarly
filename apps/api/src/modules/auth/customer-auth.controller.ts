import { Body, Controller, Get, Header, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { CustomerProfile } from '@waffarly/contracts';
import type { Request, Response } from 'express';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { customerSignInSchema, customerSignUpSchema } from './customer-auth.schemas.js';
import { CustomerAuthService } from './customer-auth.service.js';

@Controller('auth/customer')
export class CustomerAuthController {
  constructor(@Inject(CustomerAuthService) private readonly auth: CustomerAuthService) {}

  @Post('sign-up')
  @Header('Cache-Control', 'no-store')
  signUp(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerProfile> {
    return this.auth.signUp(parseRequest(customerSignUpSchema, body), request, response);
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerProfile> {
    return this.auth.signIn(parseRequest(customerSignInSchema, body), request, response);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: Request): Promise<CustomerProfile> {
    return this.auth.me(request);
  }

  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: false }> {
    await this.auth.logout(request, response);
    return { authenticated: false };
  }
}
