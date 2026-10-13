import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.auth.requireOwner(context.switchToHttp().getRequest<Request>());
    return true;
  }
}
