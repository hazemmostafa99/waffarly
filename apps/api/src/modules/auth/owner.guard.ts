import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { ActorRequest } from './current-actor.js';

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    request.owner = await this.auth.requireOwner(request);
    return true;
  }
}
