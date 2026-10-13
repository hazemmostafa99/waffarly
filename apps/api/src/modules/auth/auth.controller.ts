import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { OwnerProfile } from '@waffarly/contracts';
import { z } from 'zod';
import { AuthService } from './auth.service.js';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1),
});

function parseLogin(body: unknown): z.infer<typeof loginSchema> {
  const result = loginSchema.safeParse(body);
  if (!result.success) throw new BadRequestException('Username and password are required.');
  return result.data;
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('admin/login')
  @HttpCode(200)
  async adminLogin(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: true }> {
    const { username, password } = parseLogin(body);
    await this.auth.loginAdmin(username, password, response);
    return { authenticated: true };
  }

  @Get('admin/me')
  async adminMe(@Req() request: Request): Promise<{ username: string }> {
    return { username: await this.auth.requireAdmin(request) };
  }

  @Post('admin/logout')
  @HttpCode(200)
  async adminLogout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: false }> {
    await this.auth.logout(request, response, 'ADMIN');
    return { authenticated: false };
  }

  @Post('owner/login')
  @HttpCode(200)
  async ownerLogin(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: true }> {
    const { username, password } = parseLogin(body);
    await this.auth.loginOwner(username, password, response);
    return { authenticated: true };
  }

  @Get('owner/me')
  ownerMe(@Req() request: Request): Promise<OwnerProfile> {
    return this.auth.requireOwner(request);
  }

  @Post('owner/logout')
  @HttpCode(200)
  async ownerLogout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: false }> {
    await this.auth.logout(request, response, 'OWNER');
    return { authenticated: false };
  }
}
